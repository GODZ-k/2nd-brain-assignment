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
    MCP_TOKEN_ADMIN: process.env.MCP_TOKEN_ADMIN!,
    MCP_TOKEN_MERCHANT: process.env.MCP_TOKEN_MERCHANT!,
    MCP_TOKEN_CUSTOMER: process.env.MCP_TOKEN_CUSTOMER!,
    MCP_MERCHANT_ID: process.env.MCP_MERCHANT_ID!,
    MCP_CUSTOMER_ID: process.env.MCP_CUSTOMER_ID!,
    host: "127.0.0.1"
  };
}
