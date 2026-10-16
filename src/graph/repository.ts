import { CallerContext, TransactionFilters, TransactionStatus } from '@/types';
import { getPrismaClient } from '@/graph/client';
import { AuditService } from '@/core/audit.service';
import { AccessControlService } from '@/core/access-control.service';

const TRANSACTION_STATUSES: TransactionStatus[] = ['COMPLETED', 'PENDING', 'DECLINED'];

export class GraphRepository {
  /**
   * Get a customer by ID.
   * - customer: only own profile
   * - merchant: only if that customer has transacted at their store
   * - admin: any customer
   */
  static async getCustomer(customerId: string, ctx: CallerContext, toolName: string = "get_customer") {
    const prisma = getPrismaClient();

    let hasTransactionWithMerchant = false;

    if (ctx.role === 'merchant') {
      // check if this customer has ever transacted at this merchant's store
      const txn = await prisma.transaction.findFirst({
        where: { merchantId: ctx.callerId, customerId },
        select: { id: true }
      });

      hasTransactionWithMerchant = !!txn;

    }

    const decision = AccessControlService.canReadCustomer(ctx, customerId, hasTransactionWithMerchant);

    if (!decision.allowed) {
      await AuditService.log({
        callerId: ctx.callerId!,
        callerRole: ctx.role,
        action: 'READ',
        resourceType: "Customer",
        resourceId: customerId,
        decision: 'DENIED',
        reason: decision.reason,
        toolName,
      });
      return { error: "Access Denied." };
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!customer) {
      await AuditService.log({
        callerId: ctx.callerId!,
        callerRole: ctx.role,
        action: 'READ',
        resourceType: "Customer",
        resourceId: customerId,
        decision: 'DENIED',
        reason: 'Customer not found.',
        toolName,
      });
      return { error: 'Customer not found.' };
    }

    const fields =
      AccessControlService.customerFields(ctx);

    const data = this.pickFields(customer, fields.allowed);

    await AuditService.log({
      callerId: ctx.callerId!,
      callerRole: ctx.role,
      action: "READ",
      resourceType: 'Customer',
      resourceId: customerId,
      decision: 'ALLOWED',
      reason: decision.reason,
      toolName,
      fields,
    });

    return {
      data,
    };
  }

  /**
   * Get a merchant by ID.
   * - customer: public info only (name, category, email)
   * - merchant: only their own full profile
   * - admin: any merchant full profile
   */

  static async getMerchant(merchantId: string, ctx: CallerContext, toolName: string = "get_merchant") {
    const prisma = getPrismaClient();

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId }, select: {
        id: true,
        businessName: true,
        category: true,
        email: true,
        createdAt: true,
      },
    });

    if (!merchant) {
      await AuditService.log({
        callerId: ctx.callerId as string,
        callerRole: ctx.role,
        action: 'READ',
        resourceType: "Merchant",
        resourceId: merchantId,
        decision: 'DENIED',
        reason: 'Merchant not found.',
        toolName,
      });
      return { error: 'Merchant not found.' };
    }

    const decision =
      AccessControlService.canReadMerchant(
        ctx,
        merchantId,
      );

    if (!decision.allowed) {
      await AuditService.log({
        callerId: ctx.callerId!,
        callerRole: ctx.role,
        action: 'READ',
        resourceType: "Merchant",
        resourceId: merchantId,
        decision: 'DENIED',
        reason: decision.reason,
        toolName,
      });
      return { error: 'Access Denied.' };
    }

    const fields =
      AccessControlService.merchantFields(
        ctx,
        ctx.role === 'merchant' &&
        ctx.callerId === merchantId,
      );


    const data = this.pickFields(
      merchant,
      fields.allowed,
    );

    await AuditService.log({
      callerId: ctx.callerId!,
      callerRole: ctx.role,
      action: 'READ',
      resourceType: 'Merchant',
      resourceId: merchantId,
      decision: 'ALLOWED',
      reason: decision.reason,
      toolName,
      fields,
    });


    return { data };
  }

  /**
   * Get a single transaction by ID.
   * - customer: only their own transactions
   * - merchant: only transactions at their store
   * - admin: any transaction
   */
  static async getTransaction(transactionId: string, ctx: CallerContext, toolName: string = "get_transaction") {
    const prisma = getPrismaClient();

    const txn = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        merchant: { select: { id: true, businessName: true, category: true } },
      },
    });

    if (!txn) {
      await AuditService.log({
        callerId: ctx.callerId as string,
        callerRole: ctx.role,
        action: 'READ',
        resourceType: 'Transaction',
        resourceId: transactionId,
        decision: 'DENIED',
        reason: 'Transaction not found',
        toolName,
      });

      return {
        error: 'Transaction not found.',
      };
    }

    const decision =
      AccessControlService.canReadTransaction(
        ctx,
        txn,
      );

    if (!decision.allowed) {
      await AuditService.log({
        callerId: ctx.callerId as string,
        callerRole: ctx.role,
        action: 'READ',
        resourceType: 'Transaction',
        resourceId: transactionId,
        decision: 'DENIED',
        reason: decision.reason,
        toolName,
      });
      return { error: "Access Denied." };
    }

    const fields =
      AccessControlService.transactionFields(ctx);

    const data = this.pickFields(
      txn,
      fields.allowed,
    );

    await AuditService.log({
      callerId: ctx.callerId!,
      callerRole: ctx.role,
      action: 'READ',
      resourceType: 'Transaction',
      resourceId: transactionId,
      decision: 'ALLOWED',
      reason: decision.reason,
      toolName,
      fields,
    });

    return { data };
  }

  /**
   * List transactions.
   * - customer: only their own
   * - merchant: only their store's
   * - admin: all (optionally filtered by customerId, merchantId, or status)
   * Status filter applies to every role, always within that role's scope.
   */
  static async listTransactions(
    ctx: CallerContext,
    filters?: TransactionFilters,
    toolName: string = "list_transactions"
  ) {
    const prisma = getPrismaClient();

    const where: Record<string, string | undefined> = {};

    if (filters?.status) {
      if (!TRANSACTION_STATUSES.includes(filters.status)) {
        await AuditService.log({
          callerId: ctx.callerId as string,
          callerRole: ctx.role,
          action: 'LIST',
          resourceType: 'Transaction',
          resourceId: filters.customerId || filters.merchantId,
          decision: 'DENIED',
          reason: 'Invalid status. Use COMPLETED, PENDING, or DECLINED.',
          toolName,
          metadata: {
            filters
          }
        });
        return { error: 'Invalid status. Use COMPLETED, PENDING, or DECLINED.' };
      }
      where.status = filters.status;
    }

    if (ctx.role === 'customer') {
      where.customerId = ctx.callerId;
    } else if (ctx.role === 'merchant') {
      where.merchantId = ctx.callerId;
      if (filters?.customerId) where.customerId = filters.customerId;
    } else {
      if (filters?.customerId) where.customerId = filters.customerId;
      if (filters?.merchantId) where.merchantId = filters.merchantId;
    }

    const txns = await prisma.transaction.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        merchant: { select: { id: true, businessName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const fields =
      AccessControlService.transactionFields(ctx);

    const data = txns.map((txn) =>
      this.pickFields(txn, fields.allowed),
    )

    await AuditService.log({
      callerId: ctx.callerId!,
      callerRole: ctx.role,
      action: 'LIST',
      resourceType: 'Transaction',
      resourceId: filters?.customerId || filters?.merchantId,
      decision: 'ALLOWED',
      reason:
        ctx.role === 'admin'
          ? 'Admin transaction listing.'
          : 'Transaction listing restricted to caller scope.',
      toolName,
      fields,
      metadata: {
        filters,
        returnedCount: data.length,
      }
    });

    return { data, count: txns.length };
  }

  /**
   * List customers.
   * - customer: only themselves
   * - merchant: only customers who bought at their store
   * - admin: all customers
   */
  static async listCustomers(ctx: CallerContext, toolName: string = "list_customers") {
    const prisma = getPrismaClient();

    let customers;

    if (ctx.role === 'customer') {
      const customer = await prisma.customer.findUnique({
        where: { id: ctx.callerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
        },
      });

      customers =
        customer
          ? [customer]
          : [];
    } else if (ctx.role === 'merchant') {
      const txns = await prisma.transaction.findMany({
        where: { merchantId: ctx.callerId },
        select: { customerId: true },
        distinct: ['customerId'],
      });
      const customerIds = txns.map((t) => t.customerId);
      customers = await prisma.customer.findMany({
        where: {
          id: { in: customerIds },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
        },
      });
    } else {
      // admin
      customers = await prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
        },
      });
    }

    const fields =
      AccessControlService.customerFields(ctx);

    const data = customers.map((customer) =>
      this.pickFields(customer, fields.allowed),
    );

    await AuditService.log({
      callerId: ctx.callerId!,
      callerRole: ctx.role,
      action: 'LIST',
      resourceType: 'Customer',
      resourceId: ctx.callerId,
      decision: 'ALLOWED',
      reason:
        ctx.role === 'admin'
          ? 'Admin customer listing.'
          : 'Customer listing restricted to caller scope.',
      toolName,
      fields,
      metadata: {
        returnedCount: data.length,
      }
    });


    return { data, count: customers.length };
  };



  private static pickFields<T extends object>(
    object: T,
    allowedFields: string[],
  ) {
    const result: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          object,
          field,
        )
      ) {
        result[field] =
          (object as Record<string, unknown>)[
          field
          ];
      }
    }

    return result;
  }
}
