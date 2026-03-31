-- Migration to update invoices table schema
-- Run this if migrations 001-011 have already been applied

ALTER TABLE invoices
  DROP COLUMN IF EXISTS pdf_path,
  DROP COLUMN IF EXISTS sent_via_whatsapp,
  DROP COLUMN IF EXISTS sent_via_email,
  DROP COLUMN IF EXISTS whatsapp_sent_at,
  DROP COLUMN IF EXISTS email_sent_at;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_data JSONB,
  ADD COLUMN IF NOT EXISTS public_token VARCHAR(12) DEFAULT substring(md5(random()::text), 1, 12);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_public_token ON invoices(public_token);

-- Backfill invoice_data for existing invoices (if any)
-- This requires manual review as it depends on existing data structure
