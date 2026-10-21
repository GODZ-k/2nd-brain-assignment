import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from '@/mcp/server';
import { loadConfig } from '@/config/env';
import { CallerContext, UserRole } from '@/types';
import { fatal, onShutdown } from './utils/lifecycle';

const VALID_ROLES: UserRole = 'admin';

function parseArgs(): CallerContext {
  const config = loadConfig();
  const args = process.argv.slice(2);

  let role: UserRole = config.role;
  let callerId = config.callerId;

  for (const arg of args) {
    if (arg.startsWith('--role=')) {
      const val = arg.slice('--role='.length) as UserRole;
      if (!VALID_ROLES.includes(val)) {
        throw new Error(
          `Invalid --role "${val}". Expected one of: ${VALID_ROLES}`,
        );
      }
      role = val;
    } else if (arg.startsWith('--caller=')) {
      callerId = arg.slice('--caller='.length);
    }
  }

  if (role !== 'admin' && !callerId) {
    throw new Error(`callerId is required for role "${role}" (use --caller=<id>)`);
  }

  return { role, callerId };
}

async function main() {
  const context = parseArgs();

  console.error(`MCP: role=${context.role} caller=${context.callerId}`);

  const server = createMcpServer(context);
  const transport = new StdioServerTransport();

  const shutdown = onShutdown(() => server.close())
  process.stdin.on('close', () => void shutdown(0));

  await server.connect(transport);
}

main().catch(fatal);