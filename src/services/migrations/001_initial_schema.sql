-- ============================================================
-- Migration 001: Initial multi-tenant schema
-- ExpenseFlow — Receipt processing platform
-- Run in Supabase SQL Editor or via migration runner.
-- ============================================================

-- ───────────────────── 1. ORGANIZATIONS ─────────────────────
-- Root tenant entity. Every business entity references this.

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations (slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created ON organizations (created_at DESC);

-- ───────────────────── 2. USERS ─────────────────────
-- App users scoped to a single organization.
-- Authentication will be added later (auth provider agnostic).

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT,
  phone_number TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org_phone ON users (organization_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone_number);

-- ───────────────────── 3. RECEIPTS ─────────────────────
-- Core business entity. Each receipt belongs to an organization
-- and optionally links to the app user who uploaded it.

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  vendor TEXT,
  date TEXT,
  total NUMERIC(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'COP',
  subtotal NUMERIC(12, 2) DEFAULT 0,
  tax NUMERIC(12, 2) DEFAULT 0,
  category TEXT DEFAULT 'Otros',
  invoice_number TEXT,
  payment_method TEXT,
  storage_path TEXT,
  ocr_confidence REAL,
  raw_response TEXT,
  raw_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed'))
);

-- Composite indexes for multi-tenant queries:
-- organization_id is always the first column for row-level security.
CREATE INDEX IF NOT EXISTS idx_receipts_organization_id ON receipts (organization_id);
CREATE INDEX IF NOT EXISTS idx_receipts_org_created ON receipts (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_org_vendor ON receipts (organization_id, vendor);
CREATE INDEX IF NOT EXISTS idx_receipts_org_category ON receipts (organization_id, category);
CREATE INDEX IF NOT EXISTS idx_receipts_org_date ON receipts (organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_org_status ON receipts (organization_id, status);

-- ───────────────────── 4. RECEIPT ITEMS ─────────────────────
-- Individual line items extracted from receipts via OCR.
-- Stored in normalized form for querying and aggregation.

CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12, 2) DEFAULT 1,
  unit_price NUMERIC(12, 2),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items (receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_org ON receipt_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_org_receipt ON receipt_items (organization_id, receipt_id);

-- ───────────────────── Trigger: auto-update updated_at ─────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_organizations_updated_at') THEN
    CREATE TRIGGER set_organizations_updated_at
      BEFORE UPDATE ON organizations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_users_updated_at') THEN
    CREATE TRIGGER set_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_receipts_updated_at') THEN
    CREATE TRIGGER set_receipts_updated_at
      BEFORE UPDATE ON receipts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ───────────────────── Notes ─────────────────────
-- Multi-tenant strategy: shared database, shared schema, row-level isolation.
-- Every business table includes organization_id as a foreign key.
-- All queries MUST filter by organization_id to prevent cross-tenant leakage.
-- Row-Level Security policies should be added after authentication is implemented.
