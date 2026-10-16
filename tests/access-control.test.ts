import { afterAll, describe, it, expect, beforeAll } from 'vitest';
import { GraphRepository } from '@/graph/repository';
import { disconnectPrisma, getPrismaClient } from '@/graph/client';
import { CallerContext } from '@/types';

const adminCtx: CallerContext = { role: 'admin', callerId: 'admin' };
const customerCtx: CallerContext = { role: 'customer', callerId: 'cust_001' };
const merchantCtx: CallerContext = { role: 'merchant', callerId: 'merch_001' };

type CustomerRow = { id: string };
type TransactionRow = { id: string; customerId: string; merchantId: string; status: string };

function rowsOf<T>(result: unknown, label: string): T[] {
  const data = (result as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) {
    throw new Error(`expected ${label} list, got: ${JSON.stringify(result)}`);
  }
  return data as T[];
}

beforeAll(async () => {
  const prisma = getPrismaClient();

  await prisma.$connect();

  console.log('✅ Test database connected');
});

afterAll(async () => {
  await disconnectPrisma();
});

describe('Access Control: Role-Based Gating', () => {
  it('customer can view own profile and is denied other customers', async () => {
    const own = await GraphRepository.getCustomer('cust_001', customerCtx);
    expect(own).toHaveProperty('data');

    const other = await GraphRepository.getCustomer('cust_002', customerCtx);
    expect(other).toEqual({
      error: 'Access Denied.',
    });
  });

  it('admin can view any customer', async () => {
    const result = await GraphRepository.getCustomer('cust_002', adminCtx);
    expect(result).toHaveProperty('data');
  });

  it('merchant is denied a customer who has not transacted at their store', async () => {
    const merchantCustomers = rowsOf<CustomerRow>(
      await GraphRepository.listCustomers(merchantCtx),
      'customer',
    );
    const allCustomers = rowsOf<CustomerRow>(
      await GraphRepository.listCustomers(adminCtx),
      'customer',
    );

    const allowed = new Set(merchantCustomers.map((c) => c.id));
    const outsider = allCustomers.find((c) => !allowed.has(c.id));
    expect(outsider).toBeDefined();

    const denied = await GraphRepository.getCustomer(outsider!.id, merchantCtx);
    expect(denied).toEqual({
      error: 'Access Denied.',
    });
  });

  it('customer cannot view another customer\'s transaction', async () => {
    const own = await GraphRepository.getTransaction('txn_001', customerCtx);
    expect(own).toHaveProperty('data');

    const other = await GraphRepository.getTransaction('txn_002', customerCtx);
    expect(other).toEqual({
      error: 'Access Denied.',
    });
  });

  it('merchant cannot view a transaction from another store', async () => {
    const denied = await GraphRepository.getTransaction('txn_002', merchantCtx);
    expect(denied).toEqual({
      error: 'Access Denied.',
    });
  });

  it('list_transactions is scoped to the caller', async () => {
    const customerList = rowsOf<TransactionRow>(
      await GraphRepository.listTransactions(customerCtx),
      'transaction',
    );
    expect(customerList.length).toBeGreaterThan(0);
    expect(customerList.every((t) => t.customerId === 'cust_001')).toBe(true);

    const merchantList = rowsOf<TransactionRow>(
      await GraphRepository.listTransactions(merchantCtx),
      'transaction',
    );
    expect(merchantList.length).toBeGreaterThan(0);
    expect(merchantList.every((t) => t.merchantId === 'merch_001')).toBe(true);
  });

  it('list_customers is scoped to the caller', async () => {
    const self = rowsOf<CustomerRow>(
      await GraphRepository.listCustomers(customerCtx),
      'customer',
    );
    expect(self.map((c) => c.id)).toEqual(['cust_001']);

    const store = rowsOf<CustomerRow>(
      await GraphRepository.listCustomers(merchantCtx),
      'customer',
    );
    expect(store.length).toBeGreaterThan(0);
    expect(store.some((c) => c.id === 'cust_001')).toBe(true);
  });

  it('admin can filter transactions by status without leaking across roles', async () => {
    const completed = rowsOf<TransactionRow>(
      await GraphRepository.listTransactions(adminCtx, { status: 'COMPLETED' }),
      'transaction',
    );
    expect(completed.length).toBeGreaterThan(0);
    expect(completed.every((t) => t.status === 'COMPLETED')).toBe(true);

    const customerCompleted = rowsOf<TransactionRow>(
      await GraphRepository.listTransactions(customerCtx, { status: 'COMPLETED' }),
      'transaction',
    );
    expect(
      customerCompleted.every(
        (t) => t.customerId === 'cust_001' && t.status === 'COMPLETED',
      ),
    ).toBe(true);
  });
});

describe('Validation: Zod Schemas', () => {
  it('rejects customer with invalid email', async () => {
    const { validateRecord, CustomerSchema } = await import('@/ingestion/validator.js');
    const result = validateRecord(CustomerSchema, {
      id: 'cust_bad',
      name: 'Bad User',
      email: 'not-an-email',
      phone: '+1-555-0000',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid email'))).toBe(true);
  });

  it('rejects transaction with negative amount', async () => {
    const { validateRecord, TransactionSchema } = await import('@/ingestion/validator.js');
    const result = validateRecord(TransactionSchema, {
      id: 'txn_bad',
      customerId: 'cust_001',
      merchantId: 'merch_001',
      amount: -50,
      currency: 'USD',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('positive'))).toBe(true);
  });

  it('accepts a valid transaction record', async () => {
    const { validateRecord, TransactionSchema } = await import('@/ingestion/validator.js');
    const result = validateRecord(TransactionSchema, {
      id: 'txn_001',
      customerId: 'cust_001',
      merchantId: 'merch_001',
      amount: 149.99,
      currency: 'USD',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    });
    expect(result.isValid).toBe(true);
    expect(result.data?.amount).toBe(149.99);
  });

  it('rejects transaction with invalid status enum', async () => {
    const { validateRecord, TransactionSchema } = await import('@/ingestion/validator.js');
    const result = validateRecord(TransactionSchema, {
      id: 'txn_bad',
      customerId: 'cust_001',
      merchantId: 'merch_001',
      amount: 99,
      currency: 'USD',
      status: 'INVALID_STATUS',
      createdAt: new Date().toISOString(),
    });
    expect(result.isValid).toBe(false);
  });
});

describe('Data Generator', () => {
  it('generates correct counts of merchants, customers, transactions', async () => {
    const { generateSyntheticDataset } = await import('@/data/generator.js');
    const tmpDir = './data/test_tmp';
    const result = generateSyntheticDataset(tmpDir);

    expect(result.merchants.length).toBe(10);
    expect(result.customers.length).toBe(20);
    expect(result.transactions.length).toBe(80);

    // Cleanup
    const fs = await import('fs');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});