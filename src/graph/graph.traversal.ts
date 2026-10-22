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

type GraphEntity = NonNullable<
    Awaited<ReturnType<KnowledgeGraphRepository['getEntity']>>
>;

export class GraphTraversal {
    constructor(
        private readonly repository: KnowledgeGraphRepository,
        private readonly accessPolicy: GraphAccessPolicy
    ) { }

    async traverse(startEntityId: string, context: CallerContext, options: GraphTraversalOptions): Promise<GraphTraversalResult> {
        const nodes: GraphTraversalResult['nodes'] = [];
        const edges: GraphTraversalResult['edges'] = [];

        const visited = new Set<string>();
        const authorizedEntities = new Map<string, GraphEntity>();
        const startEntity = await this.repository.getEntity(startEntityId);

        if (!startEntity || !this.accessPolicy.canReadEntity(startEntity, context)) {
            return { nodes, edges };
        }

        authorizedEntities.set(startEntity.id, startEntity)

        const queue: Array<{ entity: GraphEntity; depth: number; }> = [{ entity: startEntity, depth: 0 }];

        let head = 0;

        while (head < queue.length) {
            const current = queue[head++];

            if (visited.has(current.entity.id)) {
                continue;
            }

            visited.add(current.entity.id);

            // AUTHORIZATION CHECK 1 - Can this caller see this node?
            const canRead = this.accessPolicy.canReadEntity(current.entity, context);

            if (!canRead) {
                continue;
            }

            nodes.push({
                entity: {
                    id: current.entity.id,
                    type: current.entity.type,
                    name: current.entity.name,
                    properties: toProperties(current.entity.properties),
                },
                depth: current.depth,
            });

            if (current.depth >= options.maxDepth) {
                continue;
            }

            const { outgoing: relations } = await this.repository.getNeighbors(current.entity.id);


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

                authorizedEntities.set(target.id, target);

                if (!visited.has(target.id)) {
                    queue.push({
                        entity: authorizedEntities.get(target.id)!,
                        depth: current.depth + 1,
                    });
                }
            }
        }

        return {
            nodes,
            edges,
        };
    }
}