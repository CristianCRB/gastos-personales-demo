export interface ReceiptItem {
  id: string;
  receiptId: string;
  organizationId: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
}
