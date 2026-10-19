import { NextFunction, Request, Response } from "express"
import { loadIdentity } from "@/config/identify"
import { CallerContext } from "@/types"
import { timingSafeEqual } from "node:crypto";

export type AuthedRequest = Request & { mcpContext?: CallerContext }

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const extractToken = (header:string): string | null => {
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

export function authenticate(req: Request): CallerContext | null {
  const header = req.get('authorization') ?? '';

  const presented = extractToken(header)
  if(!presented)  return null

  const identity = loadIdentity()

  if (identity.token && safeEqual(presented, identity.token)) {
    return { role: identity.role, callerId: identity.callerId };
  }
  return null;
}

export const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const context = authenticate(req);
  if (!context) {
    res.status(401).set('WWW-Authenticate', 'Bearer').json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: null,
    });
    return;
  }
  req.mcpContext = context;
  next();
};