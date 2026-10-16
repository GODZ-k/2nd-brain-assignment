export type UserRole = 'admin' | 'merchant' | 'customer';

export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'DECLINED';

export interface CallerContext {
  role: UserRole;
  callerId?: string; // cust_xxx | merch_xxx | admin
}

export interface TransactionFilters {
  customerId?: string;
  merchantId?: string;
  status?: TransactionStatus;
}
