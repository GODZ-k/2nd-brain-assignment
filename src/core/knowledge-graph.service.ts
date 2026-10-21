import { GraphAccessPolicy } from '@/graph/access.policy';
import { GraphTraversal } from '@/graph/graph.traversal';
import { KnowledgeGraphRepository } from '@/graph/knowledge.repository';
import type { CallerContext } from '@/types';
import { AuditService } from './audit.service';


export class KnowledgeGraphService {

  private readonly traversal: GraphTraversal;

  constructor(
    private readonly repository:
      KnowledgeGraphRepository,

    private readonly accessPolicy:
      GraphAccessPolicy,
  ) {
    this.traversal = new GraphTraversal(this.repository, this.accessPolicy);
  }

  async getEntity(entityId: string, context: CallerContext) {
    const entity = await this.repository.getEntity(entityId);

    if (!entity) {
      await AuditService.log({
        callerId: context.callerId!,
        callerRole: context.role,
        action: 'READ',
        resourceType: 'Entity',
        resourceId: entityId,
        decision: 'DENIED',
        reason: 'Entity not found',
        toolName: 'get_entity',
      });
      return null;
    }

    const canRead = this.accessPolicy.canReadEntity(entity, context);

    await AuditService.log({
      callerId: context.callerId!,
      callerRole: context.role,
      action: 'READ',
      resourceType: 'Entity',
      resourceId: entityId,
      decision: canRead ? 'ALLOWED' : 'DENIED',
      reason: canRead
        ? 'Entity access granted'
        : 'Entity access policy denied access',
      toolName: 'get_entity',
    });

    if (!canRead) {
      return null;
    }

    return {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      properties: entity.properties,
    };
  }

  async searchEntities(
    query: string,
    context: CallerContext,
    type?: string,
  ) {
    const accessibleEntities = [];
    let deniedCount = 0;

    const entities = await this.repository.searchEntities(query, type);

    for (const entity of entities) {
      const canRead = this.accessPolicy.canReadEntity(entity, context)
      if (canRead) {
        accessibleEntities.push({
          id: entity.id,
          type: entity.type,
          name: entity.name,
          properties: entity.properties,
        });
      } else {
        deniedCount++
      }
    }

    await AuditService.log({
      callerId: context.callerId!,
      callerRole: context.role,
      action: 'LIST',
      resourceType: 'Entity',
      decision: 'ALLOWED',
      reason: 'Entity search completed',
      toolName: 'search_entities',
      metadata: {
        query,
        type: type ?? null,
        matchedCount: entities.length,
        returnedCount: accessibleEntities.length,
        deniedCount,
      },
    })

    return accessibleEntities
    // return entities.filter(entity => this.accessPolicy.canReadEntity(entity, context)).map(entity => ({
    //   id: entity.id,
    //   type: entity.type,
    //   name: entity.name,
    //   properties: entity.properties,
    // })); 
  }

  async query(startEntityId: string, context: CallerContext, maxDepth = 2) {
    try {
      const result = this.traversal.traverse(startEntityId, context, { maxDepth })
      await AuditService.log({
        callerId: context.callerId!,
        callerRole: context.role,
        action: 'READ',
        resourceType: 'KnowledgeGraph',
        resourceId: startEntityId,
        decision: 'ALLOWED',
        reason: 'Graph traversal completed',
        toolName: 'traverse_graph',
        metadata: { maxDepth },
      });
      return result
    } catch (error) {
      await AuditService.log({
        callerId: context.callerId!,
        callerRole: context.role,
        action: 'READ',
        resourceType: 'KnowledgeGraph',
        resourceId: startEntityId,
        decision: 'DENIED',
        reason: 'Graph traversal failed or was denied',
        toolName: 'traverse_graph',
        metadata: {
          maxDepth,
          error: error instanceof Error
            ? error.message
            : String(error),
        },
      });

      throw error;
    }
  }
}