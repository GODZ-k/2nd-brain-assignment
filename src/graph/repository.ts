import { CallerContext, TransactionFilters, TransactionStatus } from '@/types';
import { getPrismaClient } from '@/graph/client';

const TRANSACTION_STATUSES: TransactionStatus[] = ['COMPLETED', 'PENDING', 'DECLINED'];

export class GraphRepository {
  /**
   * Get a customer by ID.
   * - customer: only own profile
   * - merchant: only if that customer has transacted at their store
   * - admin: any customer
   */
  static async getCustomer(customerId: string, ctx: CallerContext) {
    const prisma = getPrismaClient();

    if (ctx.role === 'customer') {
      if (ctx.callerId !== customerId) {
        return { error: 'Access denied: you can only view your own profile.' };
      }
    }

    if (ctx.role === 'merchant') {
      // check if this customer has ever transacted at this merchant's store
      const txn = await prisma.transaction.findFirst({
        where: { merchantId: ctx.callerId, customerId },
      });
      if (!txn) {
        return { error: 'Access denied: this customer has not transacted at your store.' };
      }
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: 'Customer not found.' };
    return { data: customer };
  }

  /**
   * Get a merchant by ID.
   * - customer: public info only (name, category, email)
   * - merchant: only their own full profile
   * - admin: any merchant full profile
   */
  static async getMerchant(merchantId: string, ctx: CallerContext) {
    const prisma = getPrismaClient();

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) return { error: 'Merchant not found.' };

    if (ctx.role === 'merchant' && ctx.callerId !== merchantId) {
      // Can see public info only
      return {
        data: {
          id: merchant.id,
          businessName: merchant.businessName,
          category: merchant.category,
          email: merchant.email,
        },
      };
    }

    if (ctx.role === 'customer') {
      // Customers see public merchant directory
      return {
        data: {
          id: merchant.id,
          businessName: merchant.businessName,
          category: merchant.category,
          email: merchant.email,
        },
      };
    }

    return { data: merchant };
  }

  /**
   * Get a single transaction by ID.
   * - customer: only their own transactions
   * - merchant: only transactions at their store
   * - admin: any transaction
   */
  static async getTransaction(transactionId: string, ctx: CallerContext) {
    const prisma = getPrismaClient();

    const txn = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        merchant: { select: { id: true, businessName: true, category: true } },
      },
    });

    if (!txn) return { error: 'Transaction not found.' };

    if (ctx.role === 'customer' && txn.customerId !== ctx.callerId) {
      return { error: 'Access denied: you can only view your own transactions.' };
    }

    if (ctx.role === 'merchant' && txn.merchantId !== ctx.callerId) {
      return { error: 'Access denied: this transaction was not processed at your store.' };
    }

    return { data: txn };
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
    filters?: TransactionFilters
  ) {
    const prisma = getPrismaClient();

    const where: Record<string, string | undefined> = {};

    if (filters?.status) {
      if (!TRANSACTION_STATUSES.includes(filters.status)) {
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

    return { data: txns, count: txns.length };
  }

  /**
   * List customers.
   * - customer: only themselves
   * - merchant: only customers who bought at their store
   * - admin: all customers
   */
  static async listCustomers(ctx: CallerContext) {
    const prisma = getPrismaClient();

    if (ctx.role === 'customer') {
      const customer = await prisma.customer.findUnique({ where: { id: ctx.callerId } });
      return { data: customer ? [customer] : [], count: 1 };
    }

    if (ctx.role === 'merchant') {
      const txns = await prisma.transaction.findMany({
        where: { merchantId: ctx.callerId },
        select: { customerId: true },
        distinct: ['customerId'],
      });
      const customerIds = txns.map((t) => t.customerId);
      const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
      });
      return { data: customers, count: customers.length };
    }

    // admin
    const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
    return { data: customers, count: customers.length };
  }
}
