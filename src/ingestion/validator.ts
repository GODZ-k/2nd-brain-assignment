import { z } from 'zod';

export const CustomerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
});

export const MerchantSchema = z.object({
  id: z.string().min(1),
  businessName: z.string().min(1),
  category: z.string().min(1),
  email: z.string().email(),
});

export const TransactionSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  merchantId: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3),
  status: z.enum(['COMPLETED', 'PENDING', 'DECLINED']),
  createdAt: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
});

export type ValidatedCustomer = z.infer<typeof CustomerSchema>;
export type ValidatedMerchant = z.infer<typeof MerchantSchema>;
export type ValidatedTransaction = z.infer<typeof TransactionSchema>;

export function validateRecord<T>(schema: z.ZodType<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (result.success) return { isValid: true, data: result.data, errors: [] as string[] };
  return {
    isValid: false,
    data: undefined,
    errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}
