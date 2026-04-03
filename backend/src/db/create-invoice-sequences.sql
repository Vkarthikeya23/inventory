-- Create missing invoice_sequences table
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yymm VARCHAR(4) UNIQUE NOT NULL,
  last_sequence INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial sequence for current period
INSERT INTO invoice_sequences (yymm, last_sequence)
SELECT DISTINCT 
  SUBSTRING(invoice_number FROM 5 FOR 4) as yymm,
  0 as last_sequence
FROM sales
WHERE invoice_number LIKE 'TYR-%'
ON CONFLICT (yymm) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_yymm ON invoice_sequences(yymm);

SELECT 'invoice_sequences table created' as status;
