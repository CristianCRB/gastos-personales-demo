export interface CreditCard {
  id: string;
  organizationId: string;
  name: string;
  creditLimit: number | null;
  closingDay: number;
  dueDay: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCardCreateInput {
  name: string;
  creditLimit?: number | null;
  closingDay: number;
  dueDay: number;
  isActive?: boolean;
}

export interface CreditCardPurchase {
  id: string;
  organizationId: string;
  creditCardId: string;
  description: string;
  totalAmount: number;
  totalInstallments: number;
  installmentValue: number;
  purchaseDate: string;
  firstInstallmentMonth: number;
  firstInstallmentYear: number;
  category: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCardPurchaseCreateInput {
  description: string;
  totalAmount: number;
  totalInstallments: number;
  installmentValue: number;
  purchaseDate?: string;
  firstInstallmentMonth: number;
  firstInstallmentYear: number;
  category?: string;
  notes?: string | null;
}

export interface ActiveInstallment {
  purchaseId: string;
  creditCardId: string;
  creditCardName: string;
  description: string;
  totalAmount: number;
  totalInstallments: number;
  installmentValue: number;
  currentInstallment: number;
  remainingInstallments: number;
  category: string;
}
