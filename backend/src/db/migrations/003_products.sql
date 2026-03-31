CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  brand VARCHAR(100),
  category_id UUID REFERENCES categories(id),
  size_spec VARCHAR(50),
  hsn_code VARCHAR(10) DEFAULT '4011',
  unit_price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2),
  stock_qty INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
