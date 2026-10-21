import type { CallerContext } from '@/types';
import type {
    GraphTraversalOptions,
    GraphTraversalResult,
} from '@/types';
import { KnowledgeGraphRepository } from './knowledge.repository';
import { GraphAccessPolicy } from './access.policy';

function toProperties(value: unknown,): Record<string, unknown> {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    return {};
}

export class GraphTraversal {
    constructor(
        private readonly repository: KnowledgeGraphRepository,
        private readonly accessPolicy: GraphAccessPolicy
    ) { }

    async traverse(startEntityId: string, context: CallerContext, options: GraphTraversalOptions): Promise<GraphTraversalResult> {
        const nodes = [];
        const edges = [];

        const visited = new Set<string>();

        const queue: Array<{ entityId: string; depth: number; }> = [
            {
                entityId: startEntityId,
                depth: 0,
            },
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current.entityId)) {
                continue;
            }
            visited.add(current.entityId);
            const entity = await this.repository.getEntity(current.entityId,);
            
            if (!entity) {
                continue;
            }

            // AUTHORIZATION CHECK 1 - Can this caller see this node?

            const canRead = this.accessPolicy.canReadEntity(entity, context);

            if (!canRead) {
                continue;
            }

            nodes.push({
                entity: {
                    id: entity.id,
                    type: entity.type,
                    name: entity.name,
                    properties: toProperties(entity.properties),
                },
                depth: current.depth,
            });

            if (current.depth >= options.maxDepth) {
                continue;
            }

            const { outgoing: relations } =
                await this.repository.getNeighbors(
                    entity.id,
                );

            for (const relation of relations) {

                // AUTHORIZATION CHECK 2 - Can this caller follow this edge?

                const canFollow = this.accessPolicy.canFollowRelation(relation, context);

                if (!canFollow) {
                    continue;
                }

                // Target authorization

                const target = relation.target;

                const canReadTarget = this.accessPolicy.canReadEntity(target, context);

                console.log({
                    target: target.id,
                    type: target.type,
                    properties: target.properties,
                    context,
                    canReadTarget,
                });

                if (!canReadTarget) {
                    continue;
                }

                edges.push({
                    id: relation.id,
                    sourceId: relation.sourceId,
                    targetId: relation.targetId,
                    relationType: relation.relationType,
                });

                queue.push({
                    entityId: relation.targetId,
                    depth: current.depth + 1,
                });
            }
        }

        return {
            nodes,
            edges,
        };
    }
}