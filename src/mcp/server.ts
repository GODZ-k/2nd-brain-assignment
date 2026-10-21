import { McpServer } from '@modelcontextprotocol/server';
import { CallerContext } from '@/types';
import { KnowledgeGraphRepository } from '@/graph/knowledge.repository';
import { GraphAccessPolicy } from '@/graph/access.policy';
import { KnowledgeGraphService } from '@/core/knowledge-graph.service';
import { registerKnowledgeGraphTool } from './tools';

export function createMcpServer(context: CallerContext): McpServer {
  const server = new McpServer({
    name: 'financial-graph-mcp',
    version: '1.0.0',
  });

  const repository = new KnowledgeGraphRepository();

  const accessPolicy = new GraphAccessPolicy();

  const graphService =new KnowledgeGraphService(repository,accessPolicy);

  registerKnowledgeGraphTool(server,graphService,context);

  return server;
}