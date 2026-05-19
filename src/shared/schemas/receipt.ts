import { z } from 'zod/v4';

export const CATEGORIES = [
  'Alimentos',
  'Transporte',
  'Servicios',
  'Salud',
  'Educacion',
  'Entretenimiento',
  'Tecnologia',
  'Otros',
] as const;

export const CategorySchema = z.enum(CATEGORIES);

export const ReceiptLineItemSchema = z.object({
  description: z.string(),
  quantity: z.union([z.number().nonnegative(), z.null()]).optional(),
  unit_price: z.union([z.number().nonnegative(), z.null()]).optional(),
  amount: z.number().nonnegative(),
});

export const RawReceiptSchema = z.object({
  vendor: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  total: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  subtotal: z.union([z.string(), z.number()]).nullable().optional(),
  tax: z.union([z.string(), z.number()]).nullable().optional(),
  items: z.array(ReceiptLineItemSchema).nullable().optional(),
  category: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
});

export type RawReceiptInput = z.infer<typeof RawReceiptSchema>;
export type ValidatedLineItem = z.infer<typeof ReceiptLineItemSchema>;
