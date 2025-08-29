import type { CollectionConfig } from 'payload'

export const Nodes: CollectionConfig = {
  slug: 'n8n-nodes',
  admin: {
    useAsTitle: 'name',
    group: 'n8n-kb',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
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
      required: true,
    },
    {
      name: 'usageGuidelines',
      type: 'textarea',
    },
    {
      name: 'properties',
      type: 'json',
    },
  ],
}
