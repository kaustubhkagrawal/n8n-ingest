/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CollectionBeforeChangeHook } from 'payload'

export const extractNodes: CollectionBeforeChangeHook = async ({
  data, // incoming data to be saved
  req, // full express request
  originalDoc, // original document before changes (for updates)
  operation, // name of the operation ie. 'create', 'update'
}: Parameters<CollectionBeforeChangeHook>[0]) => {
  // Add a log to indicate the hook is triggered
  req.payload.logger.info(`extractNodes hook triggered for operation: ${operation}`)

  if (operation === 'update' || operation === 'create') {
    try {
      const workflowData = data.workflow
      const nodes = workflowData?.nodes || []

      if (!Array.isArray(nodes)) {
        req.payload.logger.error('Workflow nodes is not an array.')
        return data
      }

      const nodeTypes = nodes.map((node) => node.type)
      const existingNodes = await req.payload.find({
        collection: 'n8n-nodes',
        where: {
          type: {
            in: nodeTypes,
          },
        },
        limit: nodes.length,
      })

      const existingNodeMap = new Map(existingNodes.docs.map((node: any) => [node.type, node]))
      const nodesToCreate = []
      const nodesToUpdate = []

      // Determine the document ID to use for workflow references
      const workflowId = operation === 'update' && originalDoc ? originalDoc.id : data.id

      for (const node of nodes) {
        const { name, type, parameters } = node

        const existingNode = existingNodeMap.get(type) as any
        if (existingNode) {
          // For existing nodes, we need to merge the workflows array
          const existingWorkflows = Array.isArray(existingNode.workflows)
            ? existingNode.workflows.map((w: any) => (typeof w === 'string' ? w : w.id))
            : []

          // Add current workflow if not already present
          const workflowsSet = new Set(existingWorkflows)
          if (workflowId) {
            workflowsSet.add(workflowId)
          }

          nodesToUpdate.push({
            id: type, // Use type as the ID
            name,
            type,
            description: existingNode.description || '',
            properties: parameters ? JSON.stringify(parameters) : existingNode.properties || '{}',
            workflows: Array.from(workflowsSet) as string[],
          })
        } else {
          // For new nodes, include the current workflow in the workflows field
          nodesToCreate.push({
            id: type, // Use type as the ID
            name,
            type,
            description: '',
            properties: parameters ? JSON.stringify(parameters) : '{}',
            workflows: workflowId ? ([workflowId] as string[]) : [], // Include current workflow if available
          })
        }
      }

      const createdNodePromises = nodesToCreate.map((nodeData) =>
        req.payload.create({
          collection: 'n8n-nodes',
          data: nodeData,
        }),
      )

      const updatedNodePromises = nodesToUpdate.map(({ id, ...nodeData }) =>
        req.payload.update({
          collection: 'n8n-nodes',
          id,
          data: nodeData,
        }),
      )

      const settledPromises = await Promise.allSettled([
        ...createdNodePromises,
        ...updatedNodePromises,
      ])

      const extractedNodeIds = settledPromises
        .filter((result) => result.status === 'fulfilled')
        .map((result) => {
          const value = (result as PromiseFulfilledResult<any>).value
          // Since we're using type as ID, return the type field
          return value.type || value.id
        })

      settledPromises.forEach((result) => {
        if (result.status === 'rejected') {
          req.payload.logger.error(`Error processing node: ${result.reason}`)
        }
      })

      // Set the nodes field directly on the data object before it's saved
      if (extractedNodeIds.length > 0) {
        data.nodes = extractedNodeIds
      }
    } catch (error: unknown) {
      req.payload.logger.error(
        `Error extracting nodes from workflow: ${error instanceof Error ? error.message : 'An unknown error occurred'}`,
      )
    }
  }

  // Return the modified data object
  return data
}
