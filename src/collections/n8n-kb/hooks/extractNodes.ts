/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CollectionBeforeChangeHook, CollectionAfterChangeHook } from 'payload'

// Helper function to update node relationships after workflow is created
export const updateNodeRelationshipsAfterCreate: CollectionAfterChangeHook = async ({
  doc, // full document data
  req, // full express request
  operation, // name of the operation ie. 'create', 'update'
}) => {
  if (operation === 'create' && doc.nodes && doc.nodes.length > 0) {
    req.payload.logger.info(
      `[updateNodeRelationships] Updating node relationships for newly created workflow ${doc.id}`,
    )

    try {
      // Update each node to include this workflow in their relationships
      const updatePromises = doc.nodes.map(async (nodeId: string) => {
        const node = await req.payload.findByID({
          collection: 'n8n-nodes',
          id: nodeId,
        })

        const existingWorkflows = Array.isArray(node.workflows)
          ? node.workflows.map((w: any) => (typeof w === 'string' ? w : w.id))
          : []

        // Add current workflow if not already present
        const workflowsSet = new Set(existingWorkflows)
        workflowsSet.add(doc.id)

        req.payload.logger.info(
          `[updateNodeRelationships] Updating node ${nodeId} to include workflow ${doc.id}`,
        )

        return req.payload.update({
          collection: 'n8n-nodes',
          id: nodeId,
          data: {
            workflows: Array.from(workflowsSet),
          },
        })
      })

      await Promise.all(updatePromises)
      req.payload.logger.info(
        `[updateNodeRelationships] Successfully updated ${doc.nodes.length} nodes with workflow relationship`,
      )
    } catch (error) {
      req.payload.logger.error(
        `[updateNodeRelationships] Error updating node relationships: ${error}`,
      )
    }
  }

  return doc
}

export const extractNodes: CollectionBeforeChangeHook = async ({
  data, // incoming data to be saved
  req, // full express request
  originalDoc, // original document before changes (for updates)
  operation, // name of the operation ie. 'create', 'update'
}: Parameters<CollectionBeforeChangeHook>[0]) => {
  // Add a log to indicate the hook is triggered
  req.payload.logger.info(`[extractNodes] Hook triggered for operation: ${operation}`)
  req.payload.logger.info(`[extractNodes] Incoming data.id: ${data.id}`)
  req.payload.logger.info(`[extractNodes] Original doc ID: ${originalDoc?.id}`)

  if (operation === 'update' || operation === 'create') {
    try {
      const workflowData = data.workflow
      const nodes = workflowData?.nodes || []

      req.payload.logger.info(`[extractNodes] Found ${nodes.length} nodes in workflow`)

      if (!Array.isArray(nodes)) {
        req.payload.logger.error('[extractNodes] Workflow nodes is not an array.')
        return data
      }

      const nodeTypes = nodes.map((node) => node.type)
      req.payload.logger.info(`[extractNodes] Node types to process: ${nodeTypes.join(', ')}`)

      const existingNodes = await req.payload.find({
        collection: 'n8n-nodes',
        where: {
          type: {
            in: nodeTypes,
          },
        },
        limit: nodes.length,
      })

      req.payload.logger.info(`[extractNodes] Found ${existingNodes.docs.length} existing nodes`)
      existingNodes.docs.forEach((node: any) => {
        req.payload.logger.info(
          `[extractNodes] Existing node: id=${node.id}, type=${node.type}, workflows=${JSON.stringify(node.workflows)}`,
        )
      })

      const existingNodeMap = new Map(existingNodes.docs.map((node: any) => [node.type, node]))
      const nodesToCreate = []
      const nodesToUpdate = []

      // Determine the document ID to use for workflow references
      // Note: During create, we don't have an ID yet, so we'll handle that in afterChange hook
      const workflowId = operation === 'update' && originalDoc ? originalDoc.id : null
      req.payload.logger.info(
        `[extractNodes] Operation: ${operation}, Workflow ID for relationships: ${workflowId}`,
      )

      if (operation === 'create') {
        req.payload.logger.info(
          `[extractNodes] CREATE operation detected - workflow relationships will be set in afterChange hook`,
        )
      }

      for (const node of nodes) {
        const { name, type, parameters } = node
        req.payload.logger.info(`[extractNodes] Processing node: type=${type}, name=${name}`)

        const existingNode = existingNodeMap.get(type) as any
        if (existingNode) {
          req.payload.logger.info(
            `[extractNodes] Node exists: id=${existingNode.id}, type=${existingNode.type}`,
          )

          // For existing nodes, we need to merge the workflows array
          const existingWorkflows = Array.isArray(existingNode.workflows)
            ? existingNode.workflows.map((w: any) => (typeof w === 'string' ? w : w.id))
            : []

          req.payload.logger.info(
            `[extractNodes] Existing workflows for node ${type}: ${JSON.stringify(existingWorkflows)}`,
          )

          // Add current workflow if not already present
          const workflowsSet = new Set(existingWorkflows)
          if (workflowId) {
            workflowsSet.add(workflowId)
            req.payload.logger.info(`[extractNodes] Adding workflow ${workflowId} to node ${type}`)
          } else {
            req.payload.logger.warn(
              `[extractNodes] No workflow ID available to add to node ${type}`,
            )
          }

          const updateData = {
            id: existingNode.id, // Use the actual document ID, not type
            name,
            type,
            description: existingNode.description || '',
            properties: parameters ? JSON.stringify(parameters) : existingNode.properties || '{}',
            workflows:
              operation === 'update'
                ? (Array.from(workflowsSet) as string[])
                : existingNode.workflows, // Only update workflows on update operation
          }

          req.payload.logger.info(
            `[extractNodes] Preparing to update node ${type} with ID ${existingNode.id}, workflows: ${JSON.stringify(updateData.workflows)}`,
          )
          nodesToUpdate.push(updateData)
        } else {
          req.payload.logger.info(`[extractNodes] Node ${type} doesn't exist, will create new`)

          // For new nodes, include the current workflow in the workflows field
          const createData = {
            id: type, // Use type as the ID for new nodes
            name,
            type,
            description: '',
            properties: parameters ? JSON.stringify(parameters) : '{}',
            workflows: [], // Will be set in afterChange hook for create operations
          }

          req.payload.logger.info(
            `[extractNodes] Preparing to create node ${type} with workflows: ${JSON.stringify(createData.workflows)}`,
          )
          nodesToCreate.push(createData)
        }
      }

      req.payload.logger.info(
        `[extractNodes] Creating ${nodesToCreate.length} nodes, updating ${nodesToUpdate.length} nodes`,
      )

      const createdNodePromises = nodesToCreate.map((nodeData) => {
        req.payload.logger.info(
          `[extractNodes] Creating node with data: ${JSON.stringify(nodeData)}`,
        )
        return req.payload.create({
          collection: 'n8n-nodes',
          data: nodeData,
        })
      })

      const updatedNodePromises = nodesToUpdate.map(({ id, ...nodeData }) => {
        req.payload.logger.info(
          `[extractNodes] Updating node ${id} with data: ${JSON.stringify(nodeData)}`,
        )
        return req.payload.update({
          collection: 'n8n-nodes',
          id,
          data: nodeData,
        })
      })

      const settledPromises = await Promise.allSettled([
        ...createdNodePromises,
        ...updatedNodePromises,
      ])

      const extractedNodeIds: string[] = []
      settledPromises.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const value = result.value
          req.payload.logger.info(
            `[extractNodes] Successfully processed node: id=${value.id}, type=${value.type}`,
          )

          // Use the actual document ID for the relationship
          extractedNodeIds.push(value.id)
        } else {
          req.payload.logger.error(
            `[extractNodes] Error processing node at index ${index}: ${result.reason}`,
          )
        }
      })

      req.payload.logger.info(
        `[extractNodes] Extracted node IDs for relationship: ${JSON.stringify(extractedNodeIds)}`,
      )

      // Set the nodes field directly on the data object before it's saved
      if (extractedNodeIds.length > 0) {
        data.nodes = extractedNodeIds
        req.payload.logger.info(
          `[extractNodes] Setting data.nodes to: ${JSON.stringify(data.nodes)}`,
        )
      } else {
        req.payload.logger.warn(`[extractNodes] No node IDs to set on workflow`)
      }
    } catch (error: unknown) {
      req.payload.logger.error(
        `[extractNodes] Error extracting nodes from workflow: ${error instanceof Error ? error.message : 'An unknown error occurred'}`,
      )
      if (error instanceof Error) {
        req.payload.logger.error(`[extractNodes] Stack trace: ${error.stack}`)
      }
    }
  }

  req.payload.logger.info(
    `[extractNodes] Final data.nodes before return: ${JSON.stringify(data.nodes)}`,
  )

  // Return the modified data object
  return data
}
