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
    host: "127.0.0.1",
    GROQ_API_KEY:process.env.GROQ_API_KEY!,
    GROQ_MODEL:process.env.GROQ_MODEL!
  };
}
