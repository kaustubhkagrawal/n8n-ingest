import { anyone } from '@/access/anyone'
import type { CollectionConfig } from 'payload'

export const Nodes: CollectionConfig = {
  slug: 'n8n-nodes',
  admin: {
    useAsTitle: 'type',
    group: 'n8n-kb',
  },
  access: {
    read: anyone,
    create: anyone,
    update: anyone,
    delete: anyone,
  },
  fields: [
    {
      name: 'id',
      type: 'text',
      required: true,
      admin: {
        hidden: true,
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            // Use the type field as the ID
            return data?.type || value
          },
        ],
      },
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'type',
      index: true,
      unique: true,
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'usageGuidelines',
      type: 'textarea',
    },
    {
      name: 'properties',
      type: 'json',
    },
    {
      name: 'workflows',
      type: 'relationship',
      relationTo: 'n8n-workflow-templates',
      hasMany: true,
      admin: {
        description: 'Workflows that use this node',
      },
    },
  ],
}
