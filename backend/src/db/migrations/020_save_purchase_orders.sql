-- Migration 020: Save generated Purchase Orders
-- Stores a snapshot of each generated PO (like invoices for sales)

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(30) UNIQUE NOT NULL,
  po_data TEXT NOT NULL,
  supplier_phone VARCHAR(20),
  total_amount NUMERIC(12,2) DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON purchase_orders(created_at);
