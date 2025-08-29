/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CollectionAfterChangeHook } from 'payload'

export const extractNodes: CollectionAfterChangeHook = async ({
  doc, // full document data
  req, // full express request
  previousDoc, // document data before updating the collection
  operation, // name of the operation ie. 'create', 'update'
}: {
  doc: any
  req: any
  previousDoc: any
  operation: 'create' | 'update' | 'delete'
}) => {
  if (operation === 'update' || operation === 'create') {
    try {
      const workflowData = doc.workflow
      const nodes = workflowData?.nodes || []

      if (!Array.isArray(nodes)) {
        req.payload.logger.error('Workflow nodes is not an array.')
        return
      }

      const extractedNodeIds = []

      for (const node of nodes) {
        const { id: nodeId, name, type, position, parameters, typeVersion } = node

        try {
          const existingNode = await req.payload.find({
            collection: 'nodes',
            where: {
              type: {
                equals: type,
              },
            },
            limit: 1,
          })

          let savedNode: any
          if (existingNode.docs.length > 0) {
            // Update existing node
            const nodeIdToUpdate = existingNode.docs[0].id
            savedNode = await req.payload.update({
              collection: 'n8n-nodes' as any,
              id: nodeIdToUpdate,
              data: {
                name,
                type,
                position,
                parameters: parameters ? JSON.stringify(parameters) : '{}',
                typeVersion,
              },
            })
          } else {
            // Create new node
            savedNode = await req.payload.create({
              collection: 'n8n-nodes' as any,
              data: {
                name,
                type,
                position,
                parameters: parameters ? JSON.stringify(parameters) : '{}',
                typeVersion,
              },
            })
          }
          extractedNodeIds.push(savedNode.id)
        } catch (error: unknown) {
          req.payload.logger.error(
            `Error processing node ${name} (${type}): ${error instanceof Error ? error.message : 'An unknown error occurred'}`,
          )
        }
      }

      // Update the workflow template with the extracted node relationships
      if (extractedNodeIds.length > 0) {
        await req.payload.update({
          collection: 'n8n-workflow-templates' as any,
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
