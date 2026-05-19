import type { GeminiReceiptResult } from './gemini.js';

export type ReceiptStatus = 'processed' | 'failed';

export interface TenantReceipt extends GeminiReceiptResult {
  id: string;
  organizationId: string;
  userId: string | null;
  phoneNumber: string;
  rawResponse: string | null;
  rawMessage: unknown;
  createdAt: string;
  status: ReceiptStatus;
}

export interface TenantReceiptStats {
  totalExpenses: number;
  totalCount: number;
  byCategory: Record<string, number>;
  byVendor: Record<string, number>;
  lastExpense: TenantReceipt | null;
}
