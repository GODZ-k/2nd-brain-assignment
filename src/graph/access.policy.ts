import type { CallerContext } from '@/types';
import { accessPolicySchema } from '@/types/validations';

function parseAccessPolicy(value: unknown) {
  const result = accessPolicySchema.safeParse(value);
  return result.success ? result.data : null;
}


export class GraphAccessPolicy {

  canReadEntity(entity: {
    id: string;
    type: string;
    name: string;
    properties: unknown;
    accessPolicy: unknown;
  }, context: CallerContext): boolean {
    const policy = parseAccessPolicy(entity.accessPolicy);

    if (!policy) {
      return false;
    }

    if (context.role === 'admin') {
      return true;
    }

    if (policy.visibility === 'public') {
      return true;
    }

    const ownsResource = policy.ownerId !== undefined && policy.ownerId === context.callerId;

    const hasAllowedRole = policy.roles?.includes(context.role) ?? false;

    return ownsResource || hasAllowedRole
  }

  canFollowRelation(relation: {
    id: string;
    sourceId: string;
    targetId: string;
    relationType: string;
    properties: unknown;
    accessPolicy: unknown;
  }, context: CallerContext): boolean {
    if (context.role === 'admin') {
      return true;
    }

    const policy = parseAccessPolicy(relation.accessPolicy);

    // No policy = deny
    if (!policy) return false;

    if (policy.visibility === 'public') return true;

    if (policy.roles?.includes(context.role)) {
      if (!policy.ownerId) return true;


      return policy.ownerId === context.callerId
    }

    return false
  }

}