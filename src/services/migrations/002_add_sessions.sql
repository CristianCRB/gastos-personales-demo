-- ============================================================
-- Migration 002: WhatsApp Session Storage (v2)
-- ExpenseFlow - Multi-device session persistence
-- ============================================================

-- Note: This migration reflects the ACTUAL schema deployed in Supabase
-- The sessions table was updated manually and is now the source of truth

-- Sessions table - stores WhatsApp authentication state for multi-device support
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL DEFAULT 'main',
  phone_number TEXT NOT NULL,
  session_data JSONB NOT NULL DEFAULT '{}',
  device_info JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────── CONSTRAINTS ─────────────────────
-- Primary lookup: organization + session name (unique)
-- NOTE: PostgREST/Supabase .upsert() with onConflict requires a
-- UNIQUE CONSTRAINT (not just a unique index). The constraint
-- automatically creates a backing unique index.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_sessions_org_name'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT uq_sessions_org_name
      UNIQUE (organization_id, session_name);
  END IF;
END
$$;

-- Phone number lookup (for reconnection)
CREATE INDEX IF NOT EXISTS idx_sessions_phone_number ON sessions (phone_number);

-- Active sessions filter
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status) WHERE status = 'active';

-- Recently updated sessions
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions (updated_at DESC);

-- ───────────────────── TRIGGER: updated_at ─────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_sessions_updated_at') THEN
    CREATE TRIGGER set_sessions_updated_at
      BEFORE UPDATE ON sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;