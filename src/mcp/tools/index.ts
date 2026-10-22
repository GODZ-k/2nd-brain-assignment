import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { KnowledgeGraphService } from '@/core/knowledge-graph.service';
import type { CallerContext } from '@/types';
import { entityInputSchema, graphTraversalInputSchema, searchEntityInputSchema } from '@/types/validations';

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
            inputSchema: graphTraversalInputSchema,
        },
        async ({ entityId, maxDepth }) =>  run(() => service.query(entityId, context, maxDepth))
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
            inputSchema: entityInputSchema,
        },

        async ({ entityId }) => run(() => service.getEntity(entityId, context)),
    );

    server.registerTool(
        'search_entities',
        {
            description: 'Search knowledge graph entities by name. Only entities the caller is authorized to read are returned.',
            inputSchema: searchEntityInputSchema,
        },
        async ({ query, type }) => run(() => service.searchEntities(query, context, type)
        ),
    );

}