CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_low_stock ON products(stock_qty) WHERE is_deleted = false;
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
