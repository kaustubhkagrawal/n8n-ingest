import type { CollectionConfig } from 'payload'

import { anyone } from '../../access/anyone'
import { authenticated } from '../../access/authenticated'
import { extractNodes } from './hooks/extractNodes'

export const N8NWorkflowTemplates: CollectionConfig = {
  slug: 'n8n-workflow-templates',
  admin: {
    useAsTitle: 'name',
  },
  hooks: {
    afterChange: [extractNodes],
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'id',
      type: 'number',
      required: true,
      unique: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
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
  ],
}
