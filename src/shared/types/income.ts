export interface Income {
  id: string;
  organizationId: string;
  description: string;
  amount: number;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeCreateInput {
  description?: string;
  amount: number;
  month: number;
  year: number;
}
