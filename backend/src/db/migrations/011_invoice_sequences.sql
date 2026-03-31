CREATE TABLE invoice_sequences (
  yymm VARCHAR(4) PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
