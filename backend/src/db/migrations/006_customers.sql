CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  email VARCHAR(150),
  vehicle_make VARCHAR(50),
  vehicle_model VARCHAR(50),
  vehicle_reg VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
