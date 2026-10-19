import 'dotenv/config';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { fatal, onShutdown } from '@/utils/lifecycle';
import mcpRoutes from "@/routes/mcp.route"
import { loadConfig } from './config/env';

async function main() {
    const config = loadConfig()
    const host = config.host
    const port = config.port

    const app = createMcpExpressApp({ host });

    app.use("/mcp", mcpRoutes)

    const httpServer = app.listen(port, host, () => {
        console.error(`[MCP http] listening on http://${host}:${port}/mcp`);
    });

    onShutdown(
        () => new Promise<void>((resolve) => httpServer.close(() => resolve())),
    );
}

main().catch(fatal);