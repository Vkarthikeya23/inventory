CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  user_id UUID REFERENCES users(id),
  invoice_number VARCHAR(30) UNIQUE NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  cgst NUMERIC(10,2) NOT NULL,
  sgst NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  qty INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(10,2),
  amount NUMERIC(10,2) NOT NULL
);
