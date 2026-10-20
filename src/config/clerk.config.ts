import type { UserRole } from "@/types";
import { ClerkConfig } from "@/types/clerk.types";
import type { AuthInfo } from "@modelcontextprotocol/server";

export const VALID_ROLES: UserRole[] = [
  'admin',
  'merchant',
  'customer',
];

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const CACHE_TTL_MS = 60_000;

export function authInfoOf(req: Request): AuthInfo | undefined {
    return (req as Request & { auth?: AuthInfo; }).auth;
}

function frontendApiFromKey(publishableKey: string): string {
  const match = /^pk_(?:test|live)_(.+)$/.exec(publishableKey);
  if (!match) throw new Error('CLERK_PUBLISHABLE_KEY is not a valid Clerk publishable key');
  const host = Buffer.from(match[1], 'base64').toString('utf8').replace(/\$$/, '');
  if (!host.includes('.')) throw new Error('Could not read the Frontend API from CLERK_PUBLISHABLE_KEY');
  return `https://${host}`;
}

export function loadClerkConfig(): ClerkConfig {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publicUrl = process.env.MCP_PUBLIC_URL;
  if (!publishableKey) throw new Error('CLERK_PUBLISHABLE_KEY is required');
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is required');
  if (!publicUrl) throw new Error('MCP_PUBLIC_URL is required (e.g. https://mcp.example.com/mcp)');

  const mcpUrl = new URL(publicUrl);
  const isLocal = mcpUrl.hostname === 'localhost' || mcpUrl.hostname === '127.0.0.1';
  if (mcpUrl.protocol !== 'https:' && !isLocal) {
    throw new Error('MCP_PUBLIC_URL must be an https:// URL (http is only allowed for localhost)');
  }

  return { secretKey, frontendApi: frontendApiFromKey(publishableKey), mcpUrl };
}