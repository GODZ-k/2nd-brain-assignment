import fs from 'fs';
import path from 'path';
import { getPrismaClient, disconnectPrisma } from '@/graph/client';
import { CustomerSchema, MerchantSchema, TransactionSchema, validateRecord } from '@/ingestion/validator';
import { generateSyntheticDataset } from '@/data/generator';

export async function runIngestionPipeline(
  dataDir = path.resolve(__dirname, '../../data/raw')
) {
  const prisma = getPrismaClient();

  if (!fs.existsSync(path.join(dataDir, 'customers.json'))) {
    console.log('Generating synthetic data...');
    generateSyntheticDataset(dataDir);
  }

  const load = (file: string) => {
    const p = path.join(dataDir, file);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  };

  let ok = 0, fail = 0;

  // Ingest Merchants
  for (const raw of load('merchants.json')) {
    const v = validateRecord(MerchantSchema, raw);
    if (!v.isValid || !v.data) { console.warn('BAD Merchant:', raw.id, v.errors); fail++; continue; }
    const m = v.data;
    await prisma.merchant.upsert({
      where: { id: m.id },
      update: { businessName: m.businessName, category: m.category, email: m.email },
      create: { id: m.id, businessName: m.businessName, category: m.category, email: m.email },
    });
    ok++;
  }

  // Ingest Customers
  for (const raw of load('customers.json')) {
    const v = validateRecord(CustomerSchema, raw);
    if (!v.isValid || !v.data) { console.warn('BAD Customer:', raw.id, v.errors); fail++; continue; }
    const c = v.data;
    await prisma.customer.upsert({
      where: { id: c.id },
      update: { name: c.name, email: c.email, phone: c.phone },
      create: { id: c.id, name: c.name, email: c.email, phone: c.phone },
    });
    ok++;
  }

  // Ingest Transactions
  for (const raw of load('transactions.json')) {
    const v = validateRecord(TransactionSchema, raw);
    if (!v.isValid || !v.data) { console.warn('BAD Transaction:', raw.id, v.errors); fail++; continue; }
    const t = v.data;
    await prisma.transaction.upsert({
      where: { id: t.id },
      update: { amount: t.amount, currency: t.currency, status: t.status },
      create: {
        id: t.id,
        customerId: t.customerId,
        merchantId: t.merchantId,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        createdAt: new Date(t.createdAt),
      },
    });
    ok++;
  }

  console.log(`Ingestion done: ${ok} ok, ${fail} failed`);
}

if (require.main === module) {
  runIngestionPipeline()
    .then(() => disconnectPrisma())
    .catch(async (e) => { console.error(e); await disconnectPrisma(); process.exit(1); });
}
