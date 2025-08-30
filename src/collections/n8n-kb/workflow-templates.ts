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
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Detailed description of what the workflow does',
      },
    },
    {
      name: 'symbolic',
      type: 'textarea',
      admin: {
        description: 'Mermaid diagram representation of the workflow',
      },
    },
    {
      name: 'stepBreakdown',
      type: 'textarea',
      admin: {
        description: 'Gherkin-style step-by-step breakdown of the workflow',
      },
    },
    {
      name: 'nodesUsage',
      type: 'json',
      admin: {
        description: "Array of objects describing each node's role and general purpose",
      },
    },
    {
      name: 'whenToUse',
      type: 'json',
      admin: {
        description: 'List of scenarios when to use this workflow',
      },
    },
    {
      name: 'mentalModel',
      type: 'textarea',
      admin: {
        description: 'Conceptual understanding of the workflow',
      },
    },
    {
      name: 'tags',
      type: 'json',

      admin: {
        description: 'Searchable tags for the workflow',
      },
    },
    {
      name: 'categories',
      type: 'json',

      admin: {
        description: 'Categories the workflow belongs to',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: ['basic', 'symbolic_expansion', 'nodes_enriched', 'fully_enriched'],
      defaultValue: 'basic',
    },
  ],
}
