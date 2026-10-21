import z from "zod";
import { accessPolicySchema, accessVisibility, entitySchema, knowledgeSchema, propertiesSchema, relationSchema } from "./validations";


export type UserRole = 'admin' | 'merchant' | 'customer';

export interface CallerContext {
  role: UserRole;
  callerId?: string;
}

export interface TextChunk {
  index: number;
  content: string;
}


export interface ParsedDocument {
  text: string;
  pageCount: number;
  contentHash: string;
}

// graph types --
export interface TraversalStep {
  relationType?: string;
  entityType?: string;
}


export interface GraphTraversalOptions {
  maxDepth: number;
  steps?: TraversalStep[];
}

export type TraversedNode = {
  entity: Pick<ExtractedEntity,'id' | 'type' | 'name'>;
  depth: number;
};

export type GraphEntity = ExtractedEntity & {
  documentId: string;
  accessPolicy: ExtractedAccessPolicy;
};

export type GraphRelation = ExtractedRelation & {
  accessPolicy: ExtractedAccessPolicy;
};

export type TraversedRelation = Pick< ExtractedRelation,'id' | 'sourceId' | 'targetId' | 'relationType'>

export interface GraphTraversalResult {
  nodes: TraversedNode[];
  edges: TraversedRelation[];
}

export type EntityVisibility = z.infer<typeof accessVisibility>
export type ExtractedKnowledge = z.infer<typeof knowledgeSchema>;
export type ExtractedEntity = z.infer<typeof entitySchema>
export type ExtractedRelation = z.infer<typeof relationSchema>
export type ExtractedAccessPolicy = z.infer<typeof accessPolicySchema>;
export type ExtractedProperty = z.infer<typeof propertiesSchema>