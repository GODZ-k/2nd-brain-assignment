import { NextFunction, Request, Response } from "express"
import { loadIdentities } from "@/config/identify"
import { CallerContext } from "@/types"
import { timingSafeEqual } from "node:crypto";

export type AuthedRequest = Request & { mcpContext?: CallerContext }

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function authenticate(req: Request): CallerContext | null {
  const header = req.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const presented = match[1];

  for (const id of loadIdentities()) {
    if (id.token && safeEqual(presented, id.token)) {
      return { role: id.role, callerId: id.callerId };
    }
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