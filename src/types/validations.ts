import { z } from 'zod';

export const propertiesSchema = z.array(z.object({
  key: z.string(),
  value: z.string(),
}))

export const accessVisibility = z.enum(['public','restricted'])

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
  id:z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  relationType: z.string(),
  properties: propertiesSchema,
})

export const knowledgeSchema = z.object({
  entities: z.array(entitySchema),
  relations: z.array(relationSchema),
});


