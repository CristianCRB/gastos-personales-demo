export interface FixedExpense {
  id: string;
  organizationId: string;
  name: string;
  amount: number;
  category: string;
  dueDay: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FixedExpenseCreateInput {
  name: string;
  amount: number;
  category?: string;
  dueDay?: number | null;
  isActive?: boolean;
}

export interface FixedExpensePayment {
  id: string;
  organizationId: string;
  fixedExpenseId: string;
  month: number;
  year: number;
  amountPaid: number;
  isPaid: boolean;
  paidDate: string | null;
  createdAt: string;
}

export interface FixedExpenseWithPayment extends FixedExpense {
  payment: FixedExpensePayment | null;
}

export interface MonthlyFixedSummary {
  totalPaid: number;
  totalPending: number;
  allPaid: boolean;
  items: FixedExpenseWithPayment[];
}
