-- Create invoices table for PostgreSQL
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  invoice_data JSONB NOT NULL,
  public_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on public_token for fast lookup
CREATE INDEX IF NOT EXISTS idx_invoices_token ON invoices(public_token);

-- Create index on sale_id
CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id);

SELECT 'invoices table created' as status;
