export interface GeminiLineItem {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
}

export interface GeminiReceiptResult {
  vendor: string | null;
  date: string | null;
  total: number | null;
  currency: string | null;
  subtotal: string | null;
  tax: string | null;
  items: GeminiLineItem[];
  category: string | null;
  invoiceNumber: string | null;
  paymentMethod: string | null;
}
