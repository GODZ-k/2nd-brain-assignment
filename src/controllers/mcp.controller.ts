import { createMcpServer } from "@/mcp/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node"
import { AuthedRequest } from "@/types"
import { Response } from "express"

class MCPController {
    static async handle(req: AuthedRequest, res: Response) {
        const server = createMcpServer(req.mcpContext!);
        const transport = new NodeStreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        res.on('close', () => {
            void transport.close();
            void server.close();
        });

        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            console.error('[MCP http] request failed', err);
            if (!res.headersSent) {
                return res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal server error' },
                    id: null,
                });
            }
        }
    };

    static async NotAllowed(_req: AuthedRequest, res: Response) {
        return res.status(405).set('Allow', 'POST').json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed' },
            id: null,
        });
    }
}

export default MCPController