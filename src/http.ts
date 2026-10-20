import 'dotenv/config';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { fatal, onShutdown } from '@/utils/lifecycle';
import mcpRoutes from "@/routes/mcp.route"
import { loadConfig } from './config/env';
import { AuthedRequest } from './types';
import { ClerkAuthService } from './core/clerk-auth.service';
import { NextFunction, Request, Response } from 'express';
import { authInfoOf, loadClerkConfig } from './config/clerk.config';

async function main() {
    const config = loadConfig()
    const { host, port }= config

    const clerkConfig = loadClerkConfig();
    const clerk = new ClerkAuthService(clerkConfig)

    await clerk.initialize()

    const forbidden = (res: Response) => {
        res.status(403).json({
            jsonrpc: '2.0',
            error: {
                code: -32003,
                message: 'Signed in, but this account has no access. Ask the admin to set its role.',
            },
            id: null,
        });
    };


    const allowedHosts = [
        clerkConfig.mcpUrl.hostname,
        'localhost',
        '127.0.0.1',
        'https://zenithal-overprecisely-aditya.ngrok-free.dev',
        ...(process.env.MCP_ALLOWED_HOSTS ?? '')
            .split(',')
            .map((h) => h.trim())
            .filter(Boolean),
    ];

    const app = createMcpExpressApp({ host: '0.0.0.0', allowedHosts });


    app.use(clerk.metadataRouter)

    app.get('/healthz', (_req: Request, res: Response) => {
        res.json({ ok: true });
    });

    const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
        clerk.gate(req, res, (err?: unknown) => { 
             if (err) {
                next(err);
                return;
            }
            clerk.resolveContext(authInfoOf(req)).then((context) => {
                    if (!context) {
                        forbidden(res);
                        return;
                    }
                    req.mcpContext = context;
                    next();
                }).catch(next);
        });
    };

    app.use("/mcp", requireAuth, mcpRoutes)

    const httpServer = app.listen(port, host, () => {
        console.error(`[MCP http] listening on http://${host}:${port}/mcp`);
    });

    onShutdown(
        () => new Promise<void>((resolve) => httpServer.close(() => resolve())),
    );
}

main().catch(fatal);