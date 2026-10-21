import { createHash } from 'node:crypto';
import { ExtractedAccessPolicy, UserRole } from "@/types";
import { loadConfig } from "./env";


interface Identity {
    token: string;
    role: UserRole;
    callerId: string;
}

export function loadIdentity(): Identity {
    const env = loadConfig()
    const candidates: { token: string; role: UserRole; callerId: string } =  { token: env.MCP_TOKEN, role: env.MCP_ROLE as UserRole, callerId: env.MCP_CALLER_ID }
    return candidates
}


export function canonicalEntityId(type: string,name: string): string {
  const normalized = `${type}:${name}`.trim().toLowerCase();
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 24);
  return `entity_${hash}`;
}

export function relationId(sourceId: string,relationType: string, targetId: string) {
    const value = `${sourceId}:${relationType}:${targetId}`;

    return `relation_${createHash('sha256')
      .update(value)
      .digest('hex')
      .slice(0, 24)}`;
  }


export const accessPolicy: ExtractedAccessPolicy = {
  visibility: 'restricted',
  roles: ['manager'],
  ownerId: 'manager_001',
};