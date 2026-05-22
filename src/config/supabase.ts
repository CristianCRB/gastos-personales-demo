import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/shared/config/env.js';
import { logger } from '@/shared/utils/logger.js';

// ───────────────────── Database row types ─────────────────────
// These mirror the SQL schema in migrations/001_initial_schema.sql

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInsert {
  name: string;
  slug: string;
}

export interface UserRow {
  id: string;
  organization_id: string;
  email: string | null;
  phone_number: string;
  role: 'admin' | 'member';
  created_at: string;
  updated_at: string;
}

export interface UserInsert {
  organization_id: string;
  phone_number: string;
  email?: string | null;
  role?: 'admin' | 'member';
}

export interface ReceiptRow {
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
  ocr_confidence: number | null;
  raw_response: string | null;
  raw_message: string | null;
  created_at: string;
  updated_at: string;
  status: 'processed' | 'failed';
}

export interface ReceiptInsert {
  organization_id: string;
  user_id?: string | null;
  phone_number: string;
  vendor?: string | null;
  date?: string | null;
  total?: number | null;
  currency?: string;
  category?: string;
  invoice_number?: string | null;
  payment_method?: string | null;
  storage_path?: string | null;
  ocr_confidence?: number | null;
  raw_response?: string | null;
  raw_message?: string | null;
  status?: 'processed' | 'failed';
}

export interface ReceiptItemRow {
  id: string;
  receipt_id: string;
  organization_id: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  created_at: string;
}

export interface ReceiptItemInsert {
  receipt_id: string;
  organization_id: string;
  description: string;
  quantity?: number | null;
  unit_price?: number | null;
  amount: number;
}

// ───────────────────── 5. INCOMES ─────────────────────

export interface IncomeRow {
  id: string;
  organization_id: string;
  description: string;
  amount: number;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
}

export interface IncomeInsert {
  organization_id: string;
  description?: string;
  amount: number;
  month: number;
  year: number;
}

// ───────────────────── 6. MANUAL EXPENSES ─────────────────────

export interface ManualExpenseRow {
  id: string;
  organization_id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManualExpenseInsert {
  organization_id: string;
  description: string;
  amount: number;
  category?: string;
  expense_date?: string;
  payment_method?: string;
  notes?: string | null;
}

// ───────────────────── 7. CREDIT CARDS ─────────────────────

export interface CreditCardRow {
  id: string;
  organization_id: string;
  name: string;
  credit_limit: number | null;
  closing_day: number;
  due_day: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditCardInsert {
  organization_id: string;
  name: string;
  credit_limit?: number | null;
  closing_day: number;
  due_day: number;
  is_active?: boolean;
}

// ───────────────────── 8. CREDIT CARD PURCHASES ─────────────────────

export interface CreditCardPurchaseRow {
  id: string;
  organization_id: string;
  credit_card_id: string;
  description: string;
  total_amount: number;
  total_installments: number;
  installment_value: number;
  purchase_date: string;
  first_installment_month: number;
  first_installment_year: number;
  category: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditCardPurchaseInsert {
  organization_id: string;
  credit_card_id: string;
  description: string;
  total_amount: number;
  total_installments: number;
  installment_value: number;
  purchase_date?: string;
  first_installment_month: number;
  first_installment_year: number;
  category?: string;
  notes?: string | null;
}

// ───────────────────── 9. FIXED EXPENSES ─────────────────────

export interface FixedExpenseRow {
  id: string;
  organization_id: string;
  name: string;
  amount: number;
  category: string;
  due_day: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FixedExpenseInsert {
  organization_id: string;
  name: string;
  amount: number;
  category?: string;
  due_day?: number | null;
  is_active?: boolean;
}

// ───────────────────── 10. FIXED EXPENSE PAYMENTS ─────────────────────

export interface FixedExpensePaymentRow {
  id: string;
  organization_id: string;
  fixed_expense_id: string;
  month: number;
  year: number;
  amount_paid: number;
  is_paid: boolean;
  paid_date: string | null;
  created_at: string;
}

export interface FixedExpensePaymentInsert {
  organization_id: string;
  fixed_expense_id: string;
  month: number;
  year: number;
  amount_paid: number;
  is_paid?: boolean;
  paid_date?: string | null;
}

// ───────────────────── Typed Database shape for Supabase client ─────────────────────

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: OrganizationInsert;
        Update: Partial<OrganizationInsert>;
      };
      users: {
        Row: UserRow;
        Insert: UserInsert;
        Update: Partial<UserInsert>;
      };
      receipts: {
        Row: ReceiptRow;
        Insert: ReceiptInsert;
        Update: Partial<ReceiptInsert>;
      };
      receipt_items: {
        Row: ReceiptItemRow;
        Insert: ReceiptItemInsert;
        Update: Partial<ReceiptItemInsert>;
      };
      incomes: {
        Row: IncomeRow;
        Insert: IncomeInsert;
        Update: Partial<IncomeInsert>;
      };
      manual_expenses: {
        Row: ManualExpenseRow;
        Insert: ManualExpenseInsert;
        Update: Partial<ManualExpenseInsert>;
      };
      credit_cards: {
        Row: CreditCardRow;
        Insert: CreditCardInsert;
        Update: Partial<CreditCardInsert>;
      };
      credit_card_purchases: {
        Row: CreditCardPurchaseRow;
        Insert: CreditCardPurchaseInsert;
        Update: Partial<CreditCardPurchaseInsert>;
      };
      fixed_expenses: {
        Row: FixedExpenseRow;
        Insert: FixedExpenseInsert;
        Update: Partial<FixedExpenseInsert>;
      };
      fixed_expense_payments: {
        Row: FixedExpensePaymentRow;
        Insert: FixedExpensePaymentInsert;
        Update: Partial<FixedExpensePaymentInsert>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      update_updated_at_column: {
        Args: Record<string, never>;
        Returns: 'trigger';
      };
    };
    Enums: Record<string, never>;
  };
}

// ───────────────────── Client singleton management ─────────────────────

type TypedClient = SupabaseClient<Database>;

let adminClient: TypedClient | null = null;
let publicClient: TypedClient | null = null;

function validateConfig(): { url: string; serviceRole: string; anonKey: string } | null {
  if (!env.SUPABASE_URL) {
    logger.warn('Supabase not configured — SUPABASE_URL is missing');
    return null;
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('Supabase admin client unavailable — SUPABASE_SERVICE_ROLE_KEY is missing');
  }
  if (!env.SUPABASE_ANON_KEY) {
    logger.warn('Supabase public client unavailable — SUPABASE_ANON_KEY is missing');
  }
  return { url: env.SUPABASE_URL, serviceRole: env.SUPABASE_SERVICE_ROLE_KEY, anonKey: env.SUPABASE_ANON_KEY };
}

// ───────────────────── Admin client (service_role) ─────────────────────
// Uses SUPABASE_SERVICE_ROLE_KEY — bypasses Row-Level Security.
// Intended for backend-only operations: migrations, cross-tenant queries,
// webhook handlers, and server-to-server operations.
// NEVER expose this client to the frontend or client-side code.

export function getAdminClient(): TypedClient {
  if (adminClient) return adminClient;

  const config = validateConfig();
  if (!config || !config.serviceRole) {
    throw new Error(
      'Supabase admin client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  adminClient = createClient<Database>(config.url, config.serviceRole, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });

  logger.info('Supabase admin client initialized');
  return adminClient;
}

// ───────────────────── Public client (anon_key) ─────────────────────
// Uses SUPABASE_ANON_KEY — respects Row-Level Security.
// Suitable for frontend requests where each user can only access
// their own organization's data via RLS policies.

export function getPublicClient(): TypedClient | null {
  if (publicClient) return publicClient;

  const config = validateConfig();
  if (!config || !config.anonKey) return null;

  publicClient = createClient<Database>(config.url, config.anonKey, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });

  logger.info('Supabase public client initialized');
  return publicClient;
}

// ───────────────────── Connection health check ─────────────────────

export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const client = getAdminClient();
    const { error } = await client.from('organizations').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      logger.error('Supabase connection failed:', error.message);
      return false;
    }
    logger.info('Supabase connection verified');
    return true;
  } catch (err) {
    logger.error('Supabase connection error:', err);
    return false;
  }
}
