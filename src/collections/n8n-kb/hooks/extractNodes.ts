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

      const existingNodeMap = new Map(existingNodes.docs.map((node) => [node.type, node]))
      const nodesToCreate = []
      const nodesToUpdate = []

      for (const node of nodes) {
        const { name, type, parameters } = node
        const data = {
          name,
          type,
          description: '',
          properties: parameters ? JSON.stringify(parameters) : '{}',
        }

        const existingNode = existingNodeMap.get(type)
        if (existingNode) {
          nodesToUpdate.push({
            id: existingNode.id,
            ...data,
          })
        } else {
          nodesToCreate.push(data)
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
        .map((result) => (result as PromiseFulfilledResult<any>).value.id)

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
