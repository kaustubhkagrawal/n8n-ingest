import type { CollectionConfig } from 'payload'

import { anyone } from '../../access/anyone'
import { authenticated } from '../../access/authenticated'
import { extractNodes, updateNodeRelationshipsAfterCreate } from './hooks/extractNodes'

export const N8NWorkflowTemplates: CollectionConfig = {
  slug: 'n8n-workflow-templates',
  admin: {
    useAsTitle: 'name',
    group: 'n8n-kb',
  },
  hooks: {
    beforeChange: [extractNodes],
    afterChange: [updateNodeRelationshipsAfterCreate],
  },
  access: {
    create: anyone,
    delete: anyone,
    read: anyone,
    update: anyone,
  },
  fields: [
    {
      name: 'workflowId',
      type: 'text',
      index: true,
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'workflow',
      type: 'json',
      required: true,
    },
    {
      name: 'nodes',
      type: 'relationship',
      relationTo: 'n8n-nodes',
      hasMany: true,
    },
    {
      name: 'symbolic',
      type: 'textarea',
    },
    {
      name: 'status',
      type: 'select',
      options: ['basic', 'symbolic_expansion', 'nodes_enriched', 'fully_enriched'],
      defaultValue: 'basic',
    },
  ],
}
