import { afterAll, describe, it, expect } from 'vitest';
import { GraphRepository } from '@/graph/repository';
import { disconnectPrisma } from '@/graph/client';
import { CallerContext } from '@/types';

const adminCtx: CallerContext = { role: 'admin', callerId: 'admin' };
const customerCtx: CallerContext = { role: 'customer', callerId: 'cust_001' };
const merchantCtx: CallerContext = { role: 'merchant', callerId: 'merch_001' };

afterAll(async () => {
  await disconnectPrisma();
});

describe('Access Control: Role-Based Gating', () => {
  it('customer can view own profile and is denied other customers', async () => {
    const own = await GraphRepository.getCustomer('cust_001', customerCtx);
    expect(own).toHaveProperty('data');

    const other = await GraphRepository.getCustomer('cust_002', customerCtx);
    expect(other).toEqual({
      error: 'Access denied: you can only view your own profile.',
    });
  });

  it('admin can view any customer', async () => {
    const result = await GraphRepository.getCustomer('cust_002', adminCtx);
    expect(result).toHaveProperty('data');
  });

  it('merchant is denied a customer who has not transacted at their store', async () => {
    const merchantCustomers = await GraphRepository.listCustomers(merchantCtx);
    const allCustomers = await GraphRepository.listCustomers(adminCtx);
    if (!('data' in merchantCustomers) || !('data' in allCustomers)) {
      throw new Error('expected customer lists');
    }
    const allowed = new Set(merchantCustomers.data.map((c: { id: string }) => c.id));
    const outsider = allCustomers.data.find((c: { id: string }) => !allowed.has(c.id));
    expect(outsider).toBeDefined();

    const denied = await GraphRepository.getCustomer(outsider!.id, merchantCtx);
    expect(denied).toEqual({
      error: 'Access denied: this customer has not transacted at your store.',
    });
  });

  it('customer cannot view another customer\'s transaction', async () => {
    const own = await GraphRepository.getTransaction('txn_001', customerCtx);
    expect(own).toHaveProperty('data');

    const other = await GraphRepository.getTransaction('txn_002', customerCtx);
    expect(other).toEqual({
      error: 'Access denied: you can only view your own transactions.',
    });
  });

  it('merchant cannot view a transaction from another store', async () => {
    const denied = await GraphRepository.getTransaction('txn_002', merchantCtx);
    expect(denied).toEqual({
      error: 'Access denied: this transaction was not processed at your store.',
    });
  });

  it('list_transactions is scoped to the caller', async () => {
    const customerList = await GraphRepository.listTransactions(customerCtx);
    expect(customerList).toHaveProperty('data');
    if (!('data' in customerList)) throw new Error('expected transaction list');
    expect(customerList.data.length).toBeGreaterThan(0);
    expect(customerList.data.every((t: { customerId: string }) => t.customerId === 'cust_001')).toBe(true);

    const merchantList = await GraphRepository.listTransactions(merchantCtx);
    expect(merchantList).toHaveProperty('data');
    if (!('data' in merchantList)) throw new Error('expected transaction list');
    expect(merchantList.data.length).toBeGreaterThan(0);
    expect(merchantList.data.every((t: { merchantId: string }) => t.merchantId === 'merch_001')).toBe(true);
  });

  it('list_customers is scoped to the caller', async () => {
    const self = await GraphRepository.listCustomers(customerCtx);
    expect(self).toHaveProperty('data');
    if (!('data' in self)) throw new Error('expected customer list');
    expect(self.data.map((c: { id: string }) => c.id)).toEqual(['cust_001']);

    const store = await GraphRepository.listCustomers(merchantCtx);
    expect(store).toHaveProperty('data');
    if (!('data' in store)) throw new Error('expected customer list');
    expect(store.data.length).toBeGreaterThan(0);
    expect(store.data.some((c: { id: string }) => c.id === 'cust_001')).toBe(true);
  });

  it('admin can filter transactions by status without leaking across roles', async () => {
    const completed = await GraphRepository.listTransactions(adminCtx, {
      status: 'COMPLETED',
    });
    expect(completed).toHaveProperty('data');
    if (!('data' in completed)) throw new Error('expected transaction list');
    expect(completed.data.length).toBeGreaterThan(0);
    expect(completed.data.every((t: { status: string }) => t.status === 'COMPLETED')).toBe(true);

    const customerCompleted = await GraphRepository.listTransactions(customerCtx, {
      status: 'COMPLETED',
    });
    if (!('data' in customerCompleted)) throw new Error('expected transaction list');
    expect(
      customerCompleted.data.every(
        (t: { customerId: string; status: string }) =>
          t.customerId === 'cust_001' && t.status === 'COMPLETED',
      ),
    ).toBe(true);
  });
});

describe('Validation: Zod Schemas', () => {
  it('rejects customer with invalid email', async () => {
    const { validateRecord, CustomerSchema } = await import('@/ingestion/validator');
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
    const { validateRecord, TransactionSchema } = await import('@/ingestion/validator');
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
    const { validateRecord, TransactionSchema } = await import('@/ingestion/validator');
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
    const { validateRecord, TransactionSchema } = await import('@/ingestion/validator');
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
    const { generateSyntheticDataset } = await import('@/data/generator');
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
