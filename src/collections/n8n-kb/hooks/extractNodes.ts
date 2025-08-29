/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CollectionAfterChangeHook } from 'payload'

export const extractNodes: CollectionAfterChangeHook = async ({
  doc, // full document data
  req, // full express request
  previousDoc, // document data before updating the collection
  operation, // name of the operation ie. 'create', 'update'
}: Parameters<CollectionAfterChangeHook>[0]) => {
  // Add a log to indicate the hook is triggered
  req.payload.logger.info(`extractNodes hook triggered for operation: ${operation}`)

  if (operation === 'update' || operation === 'create') {
    try {
      const workflowData = doc.workflow
      const nodes = workflowData?.nodes || []

      if (!Array.isArray(nodes)) {
        req.payload.logger.error('Workflow nodes is not an array.')
        return
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
          workflowsSet.add(doc.id)

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
            workflows: [doc.id] as string[], // Include current workflow
          })
        }
      }

      const createdNodePromises = nodesToCreate.map((data) =>
        req.payload.create({
          collection: 'n8n-nodes',
          data,
        }),
      )

      const updatedNodePromises = nodesToUpdate.map(({ id, ...data }) =>
        req.payload.update({
          collection: 'n8n-nodes',
          id,
          data,
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
      if (extractedNodeIds.length > 0) {
        await req.payload.update({
          collection: 'n8n-workflow-templates',
          id: doc.id,
          data: {
            nodes: extractedNodeIds,
          },
        })
      }
    } catch (error: unknown) {
      req.payload.logger.error(
        `Error extracting nodes from workflow ${doc.id}: ${error instanceof Error ? error.message : 'An unknown error occurred'}`,
      )
    }
  }
  return doc
}
