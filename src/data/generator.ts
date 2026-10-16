import fs from 'fs';
import path from 'path';
import { faker } from '@faker-js/faker';

faker.seed(42);

export function generateSyntheticDataset(outputDir = path.resolve(__dirname, '../../data/raw')) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // 10 Merchants
  const merchants = [
    { id: 'merch_001', businessName: 'Apex Electronics', category: 'Retail', email: 'support@apex.store' },
    { id: 'merch_002', businessName: 'CloudPulse SaaS', category: 'SaaS', email: 'support@cloudpulse.io' },
    { id: 'merch_003', businessName: 'Urban Roast Cafe', category: 'Dining', email: 'hello@urbanroast.cafe' },
    { id: 'merch_004', businessName: 'Zenith Airlines', category: 'Travel', email: 'support@zenith.air' },
    { id: 'merch_005', businessName: 'Nexus Gaming', category: 'Digital Goods', email: 'hi@nexusgaming.gg' },
    { id: 'merch_006', businessName: 'Lumina Home', category: 'Retail', email: 'care@luminahome.com' },
    { id: 'merch_007', businessName: 'BioVital Health', category: 'Healthcare', email: 'help@biovital.health' },
    { id: 'merch_008', businessName: 'GreenRoots Market', category: 'Grocery', email: 'hello@greenroots.market' },
    { id: 'merch_009', businessName: 'Atlas Car Rental', category: 'Travel', email: 'fleet@atlascars.com' },
    { id: 'merch_010', businessName: 'Starlight Cinema', category: 'Entertainment', email: 'tickets@starlight.cinema' },
  ];

  // 20 Customers
  const customers = Array.from({ length: 20 }, (_, i) => {
    const id = `cust_${String(i + 1).padStart(3, '0')}`;
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      id,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@shoppers.com`,
      phone: faker.phone.number(),
    };
  });

  // 80 Transactions
  const statuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'PENDING', 'DECLINED'];
  const currencies = ['USD'];
  const transactions = Array.from({ length: 80 }, (_, i) => {
    const id = `txn_${String(i + 1).padStart(3, '0')}`;
    const customer = customers[(i * 3) % customers.length];
    const merchant = merchants[(i * 7) % merchants.length];
    return {
      id,
      customerId: customer.id,
      merchantId: merchant.id,
      amount: Number((10 + (i * 17.5) % 990).toFixed(2)),
      currency: currencies[0],
      status: statuses[i % statuses.length],
      createdAt: faker.date.recent({ days: 60 }).toISOString(),
    };
  });

  fs.writeFileSync(path.join(outputDir, 'merchants.json'), JSON.stringify(merchants, null, 2));
  fs.writeFileSync(path.join(outputDir, 'customers.json'), JSON.stringify(customers, null, 2));
  fs.writeFileSync(path.join(outputDir, 'transactions.json'), JSON.stringify(transactions, null, 2));

  console.log(`Generated: ${merchants.length} merchants, ${customers.length} customers, ${transactions.length} transactions`);
  return { merchants, customers, transactions };
}

if (require.main === module) {
  generateSyntheticDataset();
}
