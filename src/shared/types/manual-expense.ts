export interface ManualExpense {
  id: string;
  organizationId: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManualExpenseCreateInput {
  description: string;
  amount: number;
  category?: string;
  expenseDate?: string;
  paymentMethod?: string;
  notes?: string | null;
}
