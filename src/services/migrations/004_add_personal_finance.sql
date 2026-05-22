-- ============================================================
-- Migration 004: Personal finance tables
-- Gasto Personal — Income, manual expenses, credit cards, fixed expenses
-- ============================================================

-- ───────────────────── 1. INCOMES ─────────────────────
-- Single income record per month-year per organization

CREATE TABLE IF NOT EXISTS incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT 'Salario',
  amount NUMERIC(12, 2) NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_incomes_org_month_year ON incomes (organization_id, month, year);
CREATE INDEX IF NOT EXISTS idx_incomes_org ON incomes (organization_id);

-- ───────────────────── 2. MANUAL EXPENSES ─────────────────────
-- Expenses entered manually (no receipt image)

CREATE TABLE IF NOT EXISTS manual_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT DEFAULT 'Otros',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'Efectivo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_expenses_org ON manual_expenses (organization_id);
CREATE INDEX IF NOT EXISTS idx_manual_expenses_org_date ON manual_expenses (organization_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_manual_expenses_org_category ON manual_expenses (organization_id, category);

-- ───────────────────── 3. CREDIT CARDS ─────────────────────

CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  credit_limit NUMERIC(12, 2),
  closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_cards_org ON credit_cards (organization_id);

-- ───────────────────── 4. CREDIT CARD PURCHASES (installments) ─────────────────────

CREATE TABLE IF NOT EXISTS credit_card_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  credit_card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  total_installments INTEGER NOT NULL CHECK (total_installments > 0),
  installment_value NUMERIC(12, 2) NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  first_installment_month INTEGER NOT NULL CHECK (first_installment_month BETWEEN 1 AND 12),
  first_installment_year INTEGER NOT NULL,
  category TEXT DEFAULT 'Otros',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_purchases_org ON credit_card_purchases (organization_id);
CREATE INDEX IF NOT EXISTS idx_cc_purchases_card ON credit_card_purchases (credit_card_id);
CREATE INDEX IF NOT EXISTS idx_cc_purchases_org_card ON credit_card_purchases (organization_id, credit_card_id);

-- ───────────────────── 5. FIXED EXPENSES ─────────────────────

CREATE TABLE IF NOT EXISTS fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT DEFAULT 'Servicios',
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_org ON fixed_expenses (organization_id);

-- ───────────────────── 6. FIXED EXPENSE PAYMENTS ─────────────────────
-- Monthly record of which fixed expenses were paid

CREATE TABLE IF NOT EXISTS fixed_expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fixed_expense_id UUID NOT NULL REFERENCES fixed_expenses(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount_paid NUMERIC(12, 2) NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fixed_payments_fe_month_year ON fixed_expense_payments (fixed_expense_id, month, year);
CREATE INDEX IF NOT EXISTS idx_fixed_payments_org ON fixed_expense_payments (organization_id);

-- ───────────────────── Trigger: auto-update updated_at ─────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_incomes_updated_at') THEN
    CREATE TRIGGER set_incomes_updated_at
      BEFORE UPDATE ON incomes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_manual_expenses_updated_at') THEN
    CREATE TRIGGER set_manual_expenses_updated_at
      BEFORE UPDATE ON manual_expenses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_credit_cards_updated_at') THEN
    CREATE TRIGGER set_credit_cards_updated_at
      BEFORE UPDATE ON credit_cards
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_credit_card_purchases_updated_at') THEN
    CREATE TRIGGER set_credit_card_purchases_updated_at
      BEFORE UPDATE ON credit_card_purchases
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_fixed_expenses_updated_at') THEN
    CREATE TRIGGER set_fixed_expenses_updated_at
      BEFORE UPDATE ON fixed_expenses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;
