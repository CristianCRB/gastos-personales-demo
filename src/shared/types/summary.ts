import type { Expense } from './expense.js';
import type { ManualExpense } from './manual-expense.js';
import type { ActiveInstallment } from './credit-card.js';
import type { FixedExpenseWithPayment } from './fixed-expense.js';

export interface MonthlyIncomeInfo {
  id: string;
  description: string;
  amount: number;
}

export interface MonthlySummary {
  income: MonthlyIncomeInfo | null;
  whatsappExpenses: {
    total: number;
    count: number;
    items: Expense[];
  };
  manualExpenses: {
    total: number;
    count: number;
    items: ManualExpense[];
  };
  creditCardInstallments: {
    total: number;
    count: number;
    items: ActiveInstallment[];
  };
  fixedExpenses: {
    total: number;
    count: number;
    items: FixedExpenseWithPayment[];
  };
  totalExpenses: number;
  balance: number;
  usagePercent: number;
  byCategory: Record<string, number>;
  alerts: string[];
}

export interface MonthlySummaryQuery {
  month: number;
  year: number;
}
