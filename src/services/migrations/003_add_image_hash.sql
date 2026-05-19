ALTER TABLE receipts ADD COLUMN IF NOT EXISTS image_hash TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_receipts_image_hash ON receipts (image_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_org_image_hash ON receipts (organization_id, image_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_content_hash ON receipts (content_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_org_content_hash ON receipts (organization_id, content_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_org_invoice ON receipts (organization_id, invoice_number) WHERE invoice_number IS NOT NULL;
