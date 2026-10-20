import 'dotenv/config';

import { UserRole } from '@/types';

export function loadConfig() {
  const role = (process.env.MCP_ROLE || 'admin') as UserRole;
  const callerId = process.env.MCP_CALLER_ID || 'admin';

  return {
    databaseUrl: process.env.DATABASE_URL!,
    role,
    callerId,
    port: parseInt(process.env.PORT || '8000', 10),
    MCP_TOKEN: process.env.MCP_TOKEN!,
    MCP_CALLER_ID: process.env.MCP_CALLER_ID!,
    MCP_ROLE: process.env.MCP_ROLE!,
    CLERK_SECRET_KEY:process.env.CLERK_SECRET_KEY,
    CLERK_FRONTEND_API:process.env.CLERK_FRONTEND_API,
    MCP_PUBLIC_URL:process.env.MCP_PUBLIC_URL,
    CLERK_API:process.env.CLERK_API,
    host: "127.0.0.1"
  };
}
