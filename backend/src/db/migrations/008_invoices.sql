CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID UNIQUE REFERENCES sales(id),
  invoice_data JSONB NOT NULL,
  public_token VARCHAR(12) NOT NULL DEFAULT substring(md5(random()::text), 1, 12),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_invoices_public_token ON invoices(public_token);
