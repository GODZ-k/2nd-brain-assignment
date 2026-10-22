import { z } from 'zod';

export const propertiesSchema = z.array(z.object({
  key: z.string(),
  value: z.string(),
}))

export const accessVisibility = z.enum(['public', 'restricted'])

export const accessPolicySchema = z.object({
  visibility: accessVisibility,
  roles: z.array(z.string()),
  ownerId: z.string(),
});

export const entitySchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  properties: propertiesSchema,
})

export const relationSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  relationType: z.string(),
  properties: propertiesSchema,
})

export const knowledgeSchema = z.object({
  entities: z.array(entitySchema),
  relations: z.array(relationSchema),
});


// MCP Tools input schemas ---

export const searchEntityInputSchema = z.object({
  query: z.string().min(1).describe('Text to search for in entity names'),
  type: z.string().optional().describe('Optional entity type filter')
})

export const entityInputSchema = z.object({ entityId: z.string().min(1).describe('Knowledge graph entity ID') })

export const graphTraversalInputSchema = z.object({
  entityId: z.string().describe('ID of the entity from which graph traversal should start.'),
  maxDepth: z.number().int().min(0).max(10).default(2).describe('Maximum number of graph edges to traverse.')
})