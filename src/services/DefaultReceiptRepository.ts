import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '@/services/SupabaseService.js';
import { organizationRepository } from '@/modules/organizations/index.js';
import { logger } from '@/shared/utils/logger.js';
import type { Expense, ExpenseStats } from '@/shared/types/index.js';
import type { GeminiReceiptResult } from '@/shared/types/index.js';

export function computeContentHash(data: GeminiReceiptResult): string {
  const normalized = {
    vendor: (data.vendor ?? '').trim().toLowerCase(),
    date: data.date ?? '',
    total: data.total != null ? Math.round(data.total * 100) / 100 : null,
    items: (data.items ?? []).map((i) => ({
      description: i.description.trim().toLowerCase(),
      quantity: i.quantity,
      unit_price: i.unit_price,
      amount: i.amount,
    })),
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

const DEFAULT_ORG_SLUG = 'default';
const DEFAULT_ORG_NAME = 'Default Organization';

interface ReceiptRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  phone_number: string;
  vendor: string | null;
  date: string | null;
  total: number | null;
  currency: string;
  subtotal: string | null;
  tax: string | null;
  category: string;
  invoice_number: string | null;
  payment_method: string | null;
  storage_path: string | null;
  image_hash: string | null;
  content_hash: string | null;
  ocr_confidence: number | null;
  raw_response: string | null;
  raw_message: string | null;
  created_at: string;
  updated_at: string;
  status: 'processed' | 'failed';
}

function rowToExpense(row: ReceiptRow): Expense {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    vendor: row.vendor,
    date: row.date,
    total: row.total,
    currency: row.currency,
    subtotal: row.subtotal,
    tax: row.tax,
    items: [],
    category: row.category,
    invoiceNumber: row.invoice_number,
    paymentMethod: row.payment_method,
    storagePath: row.storage_path,
    imageHash: row.image_hash,
    contentHash: row.content_hash,
    rawResponse: row.raw_response,
    rawMessage: row.raw_message ? JSON.parse(row.raw_message) : null,
    createdAt: row.created_at,
    status: row.status,
  };
}

export class DefaultReceiptRepository {
  private defaultOrgId: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
      logger.warn('DefaultReceiptRepository: Supabase not available');
      return;
    }

    let org = await organizationRepository.findBySlug(DEFAULT_ORG_SLUG);
    if (!org) {
      logger.info('Creating default organization...');
      org = await organizationRepository.createOrganization({
        name: DEFAULT_ORG_NAME,
        slug: DEFAULT_ORG_SLUG,
      });
    }

    if (org) {
      this.defaultOrgId = org.id;
      this.initialized = true;
      logger.info('DefaultReceiptRepository initialized', { organizationId: this.defaultOrgId });
    } else {
      logger.error('Failed to initialize default organization');
    }
  }

  isReady(): boolean {
    return this.initialized && this.defaultOrgId !== null;
  }

  private ensureOrg(): string {
    if (!this.defaultOrgId) {
      throw new Error('DefaultReceiptRepository not initialized');
    }
    return this.defaultOrgId;
  }

  async findByImageHash(hash: string): Promise<Expense | null> {
    if (!hash) return null;

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('organization_id', this.ensureOrg())
      .eq('image_hash', hash)
      .maybeSingle();

    if (error) {
      logger.error('DefaultReceiptRepository.findByImageHash:', error.message);
      return null;
    }

    return data ? rowToExpense(data as ReceiptRow) : null;
  }

  async isExactDuplicate(
    vendor: string | null,
    date: string | null,
    total: number | null,
  ): Promise<boolean> {
    if (!date && !total && !vendor) return false;

    const supabase = getSupabaseClient();
    if (!supabase) return false;

    let query = supabase
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', this.ensureOrg());

    if (date) query = query.eq('date', date);
    if (total !== null && total !== undefined) query = query.eq('total', total);
    if (vendor) query = query.eq('vendor', vendor);

    const { data, error } = await query;

    if (error) {
      logger.error('DefaultReceiptRepository.isExactDuplicate:', error.message);
      return false;
    }

    return (data?.length ?? 0) > 0;
  }

  async findByContentHash(hash: string): Promise<Expense | null> {
    if (!hash) return null;

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('organization_id', this.ensureOrg())
      .eq('content_hash', hash)
      .maybeSingle();

    if (error) {
      logger.error('DefaultReceiptRepository.findByContentHash:', error.message);
      return null;
    }

    return data ? rowToExpense(data as ReceiptRow) : null;
  }

  async addReceipt(expense: Expense): Promise<Expense | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      logger.error('DefaultReceiptRepository.addReceipt: Supabase unavailable');
      return null;
    }

    const orgId = this.ensureOrg();

    const { data, error } = await supabase
      .from('receipts')
      .insert({
        id: expense.id,
        organization_id: orgId,
        phone_number: expense.phoneNumber,
        vendor: expense.vendor,
        date: expense.date,
        total: expense.total,
        currency: expense.currency,
        subtotal: expense.subtotal,
        tax: expense.tax,
        category: expense.category,
        invoice_number: expense.invoiceNumber,
        payment_method: expense.paymentMethod,
        storage_path: expense.storagePath,
        image_hash: expense.imageHash,
        content_hash: expense.contentHash,
        raw_response: expense.rawResponse,
        raw_message: expense.rawMessage ? JSON.stringify(expense.rawMessage) : null,
        created_at: expense.createdAt,
        status: expense.status,
      })
      .select()
      .single();

    if (error || !data) {
      logger.error('DefaultReceiptRepository.addReceipt: Failed to add receipt', error?.message);
      return null;
    }

    if (expense.items && expense.items.length > 0) {
      await this.addReceiptItems(expense.id, orgId, expense.items);
    }

    logger.info('Receipt saved to Supabase', { receiptId: expense.id });
    return rowToExpense(data as ReceiptRow);
  }

  private async addReceiptItems(
    receiptId: string,
    organizationId: string,
    items: GeminiReceiptResult['items'],
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const rows = items.map((item) => ({
      receipt_id: receiptId,
      organization_id: organizationId,
      description: item.description,
      quantity: item.quantity ?? null,
      unit_price: item.unit_price ?? null,
      amount: item.amount,
    }));

    const { error } = await supabase.from('receipt_items').insert(rows);

    if (error) {
      logger.error('DefaultReceiptRepository.addReceiptItems: Failed to save items', error?.message);
    } else {
      logger.info('Receipt items saved', { receiptId, count: rows.length });
    }
  }

  async getAllReceipts(): Promise<Expense[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('organization_id', this.ensureOrg())
      .order('created_at', { ascending: false });

    if (error || !data) {
      logger.error('DefaultReceiptRepository.getAllReceipts:', error?.message);
      return [];
    }

    const receipts = (data as ReceiptRow[]).map(rowToExpense);

    if (receipts.length > 0) {
      const receiptIds = receipts.map((r) => r.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('receipt_items')
        .select('receipt_id, description, quantity, unit_price, amount')
        .in('receipt_id', receiptIds);

      if (!itemsError && itemsData) {
        const itemsByReceiptId: Record<string, GeminiReceiptResult['items']> = {};
        for (const item of itemsData) {
          const rid = item.receipt_id;
          if (!itemsByReceiptId[rid]) itemsByReceiptId[rid] = [];
          itemsByReceiptId[rid].push({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
          });
        }
        for (const r of receipts) {
          r.items = itemsByReceiptId[r.id] || [];
        }
      }
    }

    return receipts;
  }

  async getStats(): Promise<ExpenseStats> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { totalExpenses: 0, totalCount: 0, byCategory: {}, byVendor: {}, lastExpense: null };
    }

    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('organization_id', this.ensureOrg());

    if (error || !data) {
      logger.error('DefaultReceiptRepository.getStats:', error?.message);
      return { totalExpenses: 0, totalCount: 0, byCategory: {}, byVendor: {}, lastExpense: null };
    }

    const rows = data as ReceiptRow[];
    const totalExpenses = rows.reduce((sum, r) => sum + (r.total ?? 0), 0);
    const byCategory: Record<string, number> = {};
    const byVendor: Record<string, number> = {};

    for (const r of rows) {
      const cat = r.category || 'Sin categoria';
      byCategory[cat] = (byCategory[cat] ?? 0) + (r.total ?? 0);
      const v = r.vendor || 'Desconocido';
      byVendor[v] = (byVendor[v] ?? 0) + 1;
    }

    const lastExpense = rows.length > 0 ? rowToExpense(rows[0]!) : null;

    return {
      totalExpenses,
      totalCount: rows.length,
      byCategory,
      byVendor,
      lastExpense,
    };
  }

  async initializeDedup(): Promise<Set<string>> {
    const processedKeys = new Set<string>();
    const receipts = await this.getAllReceipts();

    for (const receipt of receipts) {
      if (receipt.rawMessage && typeof receipt.rawMessage === 'object') {
        const obj = receipt.rawMessage as Record<string, unknown>;
        const rJid = obj['remoteJid'];
        const msgId = obj['id'];
        if (rJid && msgId) {
          processedKeys.add(`${rJid}_${msgId}`);
        }
      }
    }

    logger.info(`Dedup set initialized with ${processedKeys.size} existing receipts`);
    return processedKeys;
  }
}

export const defaultReceiptRepository = new DefaultReceiptRepository();