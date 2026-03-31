CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(15),
  email VARCHAR(150),
  gstin VARCHAR(15),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
