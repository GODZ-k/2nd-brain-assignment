import { getPrismaClient } from '@/config/prisma';
import { Prisma } from '@prisma/client';

type AuditInput = {
  callerId: string;
  callerRole: string;
  action: 'READ' | 'LIST';
  resourceType:
    | 'Entity'
    | 'GraphRelation'
    | 'KnowledgeGraph'
    | 'Customer'
    | 'Transaction'
    | 'Merchant'
    | 'Customer-Transactions'
    | 'Merchant-Customers'
    | 'Merchant-Transactions';
  resourceId?: string;
  decision: 'ALLOWED' | 'DENIED';
  reason?: string;
  toolName?: string;
  requestId?: string;
  fields?: {
    allowed?: string[];
    denied?: string[];
  };
  metadata?: Record<string, unknown>;
};

export class AuditService {
  static async log(input: AuditInput): Promise<void> {
    const prisma = getPrismaClient();

    try {
      await prisma.auditLog.create({
        data: {
          callerId: input.callerId,
          callerRole: input.callerRole,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          decision: input.decision,
          reason: input.reason,
          toolName: input.toolName,
          requestId: input.requestId,
          fields: input.fields as Prisma.InputJsonObject,
          metadata: input.metadata as Prisma.InputJsonObject,
        },
      });
    } catch (error) {
      // Audit failures should be visible to operators.
      console.error(
        '[AuditService] Failed to write audit log',
        error,
      );
    }
  }
}