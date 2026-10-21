import { z } from 'zod';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { KnowledgeGraphService } from '@/core/knowledge-graph.service';
import type { CallerContext } from '@/types';

async function run(fn: () => Promise<unknown> | unknown): Promise<CallToolResult> {
    try {
        const result = await fn();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };

    } catch (err: unknown) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2),
                },
            ],
        };
    }
}

export function registerKnowledgeGraphTool(
    server: McpServer,
    service: KnowledgeGraphService,
    context: CallerContext,
) {
    server.registerTool(
        'traverse_graph',
        {
            description: 'Traverse the knowledge graph from a starting entity. Results are automatically restricted by the caller access policy.',
            inputSchema: z.object({
                entityId: z.string().describe('ID of the entity from which graph traversal should start.'),
                maxDepth: z.number().int().min(0).max(10).default(2).describe('Maximum number of graph edges to traverse.')
            }),
        },
        async ({ entityId, maxDepth }) => {
            return run(() =>
                service.query(entityId, context, maxDepth),
            );
        },
    );

    server.registerTool(
        'whoami',
        {
            description: 'Returns the identity and role associated with the current MCP session.',
        },
        async () => run(() => ({ role: context.role, callerId: context.callerId })),
    );

    server.registerTool(
        'get_entity',
        {
            description: 'Get a knowledge graph entity by ID. Access is controlled by the entity access policy.',
            inputSchema: z.object({ entityId: z.string().min(1).describe('Knowledge graph entity ID') }),
        },

        async ({ entityId }) => run(() => service.getEntity(entityId, context)),
    );

    server.registerTool(
        'search_entities',
        {
            description: 'Search knowledge graph entities by name. Only entities the caller is authorized to read are returned.',
            inputSchema: z.object({
                query: z.string().min(1).describe('Text to search for in entity names'),
                type: z.string().optional().describe('Optional entity type filter')
            }),
        },
        async ({ query, type }) => run(() => service.searchEntities(query, context, type)
        ),
    );

}