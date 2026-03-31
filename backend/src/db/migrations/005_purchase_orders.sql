CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  qty_ordered INTEGER NOT NULL,
  qty_received INTEGER DEFAULT 0,
  unit_cost NUMERIC(10,2)
);
