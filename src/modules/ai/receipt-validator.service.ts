import { z } from 'zod/v4';
import { RawReceiptSchema, CATEGORIES } from '@/shared/schemas/receipt.js';
import type { GeminiReceiptResult } from '@/shared/types/gemini.js';

export class ReceiptValidatorService {
  validate(data: Record<string, unknown>): GeminiReceiptResult {
    const parsed = this.safeParse(data);
    return this.normalize(parsed);
  }

  private safeParse(data: Record<string, unknown>): z.infer<typeof RawReceiptSchema> {
    const result = RawReceiptSchema.safeParse(data);

    if (!result.success) {
      try {
        const fallback: Record<string, unknown> = {};
        for (const key of Object.keys(data)) {
          fallback[key] = data[key] ?? null;
        }
        if (Array.isArray(fallback['items'])) {
          fallback['items'] = fallback['items'].map((item: Record<string, unknown>) => ({
            ...item,
            unit_price: typeof item['unit_price'] === 'number' ? item['unit_price'] : null,
            amount: typeof item['amount'] === 'number' ? item['amount'] : 0,
          }));
        }
        return RawReceiptSchema.parse(fallback);
      } catch {
        return { vendor: null, date: null, total: null, currency: null, subtotal: null, tax: null, items: [], category: null, invoiceNumber: null, paymentMethod: null };
      }
    }

    return result.data;
  }

  private normalize(raw: z.infer<typeof RawReceiptSchema>): GeminiReceiptResult {
    return {
      vendor: raw.vendor ?? null,
      date: raw.date ?? null,
      total: this.normalizeNumeric(raw.total),
      currency: raw.currency ?? 'COP',
      subtotal: raw.subtotal != null ? String(raw.subtotal) : null,
      tax: raw.tax != null ? String(raw.tax) : null,
      items: this.normalizeItems(raw.items),
      category: this.normalizeCategory(raw.category),
      invoiceNumber: raw.invoiceNumber ?? null,
      paymentMethod: raw.paymentMethod ?? null,
    };
  }

  private normalizeNumeric(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private normalizeCategory(category: string | null | undefined): string {
    if (!category) return 'Otros';
    const trimmed = category.trim();
    return (CATEGORIES as readonly string[]).includes(trimmed) ? trimmed : 'Otros';
  }

  private normalizeItems(
    items: { description: string; quantity?: number | null; unit_price?: number | null; amount: number }[] | null | undefined,
  ): { description: string; quantity: number | null; unit_price: number | null; amount: number }[] {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      description: typeof item.description === 'string' ? item.description : '',
      quantity: item.quantity != null && item.quantity >= 0 ? item.quantity : null,
      unit_price: item.unit_price != null ? item.unit_price : null,
      amount: typeof item.amount === 'number' ? item.amount : 0,
    }));
  }
}

export const receiptValidatorService = new ReceiptValidatorService();
