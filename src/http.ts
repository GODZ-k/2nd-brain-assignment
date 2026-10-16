import 'dotenv/config';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { fatal, onShutdown } from '@/utils/lifecycle';
import { loadIdentities } from '@/config/identify';
import mcpRoutes from "@/routes/mcp.route"
import { loadConfig } from './config/env';

async function main() {
    const config = loadConfig()
    const host = config.host
    const port = config.port
    const identities = loadIdentities();

    if (identities.length === 0) {
        throw new Error(
            'No tokens configured. Set at least one of MCP_TOKEN_ADMIN, MCP_TOKEN_MERCHANT, MCP_TOKEN_CUSTOMER in .env',
        );
    }

    const app = createMcpExpressApp({ host });

    app.use("/mcp", mcpRoutes)

    const httpServer = app.listen(port, host, () => {
        console.error(`[MCP http] listening on http://${host}:${port}/mcp`);
        console.error(`[MCP http] roles enabled: ${identities.map((i) => i.role).join(', ')}`);
    });

    onShutdown(
        () => new Promise<void>((resolve) => httpServer.close(() => resolve())),
    );
}

main().catch(fatal);