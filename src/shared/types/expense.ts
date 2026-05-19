import type { GeminiReceiptResult } from './gemini.js';

export interface Expense extends GeminiReceiptResult {
  id: string;
  phoneNumber: string;
  storagePath: string | null;
  imageHash: string | null;
  contentHash: string | null;
  rawResponse: string | null;
  rawMessage: unknown;
  createdAt: string;
  status: 'processed' | 'failed';
}

export interface ExpenseStats {
  totalExpenses: number;
  totalCount: number;
  byCategory: Record<string, number>;
  byVendor: Record<string, number>;
  lastExpense: Expense | null;
}
