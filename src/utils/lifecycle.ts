import { disconnectPrisma } from '@/graph/client';

export function onShutdown(cleanup: () => Promise<void> | void) {
    let shuttingDown = false;
    const shutdown = async (code: number) => {
        if (shuttingDown) return;
        shuttingDown = true;
        try {
            await cleanup();
        } catch (err) {
            console.error('[MCP] error during shutdown', err);
        }
        await disconnectPrisma();
        process.exit(code);
    };

    process.on('SIGINT', () => void shutdown(0));
    process.on('SIGTERM', () => void shutdown(0));
    return shutdown;
}

export async function fatal(err: unknown): Promise<never> {
    console.error('[MCP FATAL]', err);
    await disconnectPrisma();
    process.exit(1);
}