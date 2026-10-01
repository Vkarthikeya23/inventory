-- ============================================================
-- TyreShop Pro — Supabase (PostgreSQL) initial schema
--
-- APPLIED to Supabase via migration: supabase_initial_schema
-- (20261001172506)
--
-- This file is the reference copy for the schema that actually exists in
-- Supabase. It is intentionally NOT loaded by `npm run migrate` (that reads
-- the legacy SQLite schema.sql). Apply it manually if you ever need to rebuild.
--
-- Notes on why this shape (reconstructed from live route SQL):
--   * products.is_deleted is BOOLEAN — routes filter `is_deleted = false`
--   * products.low_stock_threshold is required by the low_stock query
--   * products has NO display_name column — routes compute it as a SQL alias
--   * customers.phone is UNIQUE — sales.js upserts customers by phone
--   * invoices.invoice_data is TEXT (JSONB caused a [object Object] bug)
--   * sales carries legacy cgst/sgst/total/balance columns for safety
--   * access is REVOKED from anon/authenticated: server-side only, the browser
--     never talks to the database directly (it uses the backend API + JWT)
-- ============================================================

CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('owner','manager','cashier')),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.products (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name           VARCHAR(100),
  size_spec              VARCHAR(50) NOT NULL DEFAULT '',
  cost_price             NUMERIC(10,2) DEFAULT 0,
  selling_price_excl_gst NUMERIC(10,2) DEFAULT 0,
  selling_price_incl_gst NUMERIC(10,2) DEFAULT 0,
  gst_rate               NUMERIC(5,2) DEFAULT 12.00,
  cgst_rate              NUMERIC(5,2) DEFAULT 6,
  sgst_rate              NUMERIC(5,2) DEFAULT 6,
  price_entry_mode       VARCHAR(10) DEFAULT 'excl' CHECK (price_entry_mode IN ('excl','incl')),
  stock_qty              INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold    INTEGER NOT NULL DEFAULT 4,
  hsn_code               TEXT,
  mfg_date               TEXT,
  is_deleted             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  phone       TEXT UNIQUE NOT NULL,
  email       VARCHAR(150),
  vehicle_reg VARCHAR(20),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.sales (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name     VARCHAR(100) NOT NULL,
  customer_phone    VARCHAR(15),
  vehicle_reg       VARCHAR(20),
  vehicle_type      TEXT,
  km_reading        TEXT,
  next_alignment_km TEXT,
  next_service_km   TEXT,
  user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invoice_number    VARCHAR(30) UNIQUE NOT NULL,
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- legacy aliases kept for safety
  cgst              NUMERIC(12,2) DEFAULT 0,
  sgst              NUMERIC(12,2) DEFAULT 0,
  total             NUMERIC(12,2) DEFAULT 0,
  balance           NUMERIC(12,2) DEFAULT 0,
  sale_date         TIMESTAMPTZ DEFAULT NOW(),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.sale_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES public.products(id) ON DELETE SET NULL,
  service_name TEXT,
  qty          INTEGER NOT NULL,
  unit_price   NUMERIC(12,2) NOT NULL,
  unit_cost    NUMERIC(12,2) DEFAULT 0,
  hsn_code     TEXT,
  gst_rate     NUMERIC(5,2) DEFAULT 12,
  subtotal     NUMERIC(12,2) DEFAULT 0,
  gst_amount   NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  amount       NUMERIC(12,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  invoice_data TEXT,
  public_token VARCHAR(12) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  price        NUMERIC(12,2) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.purchase_orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number      VARCHAR(30) UNIQUE NOT NULL,
  po_data        TEXT NOT NULL,
  supplier_phone VARCHAR(20),
  total_amount   NUMERIC(12,2) DEFAULT 0,
  item_count     INTEGER DEFAULT 0,
  created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_stock          ON public.products(stock_qty) WHERE is_deleted = FALSE;
CREATE INDEX idx_sales_created_at        ON public.sales(created_at);
CREATE INDEX idx_sale_items_sale         ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product      ON public.sale_items(product_id);
CREATE UNIQUE INDEX idx_invoices_token    ON public.invoices(public_token);
CREATE INDEX idx_purchase_orders_number  ON public.purchase_orders(po_number);
CREATE INDEX idx_purchase_orders_created ON public.purchase_orders(created_at);

-- SERVER-SIDE ONLY: block browser/PostgREST access.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;