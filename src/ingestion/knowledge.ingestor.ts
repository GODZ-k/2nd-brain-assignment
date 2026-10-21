import { KnowledgeGraphRepository } from '@/graph/knowledge.repository';
import type { ExtractedAccessPolicy, ExtractedKnowledge, GraphEntity, GraphRelation } from '@/types';
import { canonicalEntityId, relationId } from '@/config/identify';

export class KnowledgeIngestor {
  constructor(
    private readonly repository =
      new KnowledgeGraphRepository(),
  ) { }

  async ingest(knowledge: ExtractedKnowledge, documentId: string, accessPolicy: ExtractedAccessPolicy,) {
    const entityIdMap = new Map<string, string>();

    for (const entity of knowledge.entities) {
      const existing = await this.repository.findEntity(entity.type, entity.name);

      const id = existing?.id ?? canonicalEntityId(entity.type, entity.name);

      if (!existing) {
        const persistedEntity: GraphEntity = {
          ...entity,
          id,
          documentId,
          accessPolicy,
        };

        await this.repository.createEntity(persistedEntity);
      }

      entityIdMap.set(
        entity.id,
        id,
      );
    }

    let relationsProcessed = 0;

    for (const relation of knowledge.relations) {
      const sourceId = entityIdMap.get(relation.sourceId);
      const targetId = entityIdMap.get(relation.targetId);

      if (!sourceId || !targetId) {
        console.warn(`Skipping invalid relation ${relation.id}`);
        continue;
      }

      const id = relationId(sourceId, relation.relationType, targetId);

      const existingRelation = await this.repository.getRelation(id)

      if (!existingRelation) {
        const persistedRelation: GraphRelation= {
          ...relation,
          id,
          sourceId,
          targetId,
          accessPolicy,
        };

        await this.repository.createRelation(persistedRelation);
      }

      relationsProcessed = relationsProcessed + 1
    }

    return {
      entities: entityIdMap.size,
      relationsProcessed,
    };
  }
}