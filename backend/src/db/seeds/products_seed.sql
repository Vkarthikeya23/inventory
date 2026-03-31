-- 20 realistic tyre products
-- Categories: Car Tyres (1), Truck Tyres (2), Two-Wheeler Tyres (3), SUV Tyres (4), Tubes (5)

INSERT INTO products (name, brand, category_id, size_spec, hsn_code, unit_price, cost_price, stock_qty, low_stock_threshold) VALUES
-- MRF Car Tyres
('MRF Wanderer', 'MRF', (SELECT id FROM categories WHERE name = 'Car Tyres'), '185/65 R15', '4011', 4500.00, 3150.00, 12, 4),
('MRF ZVTV', 'MRF', (SELECT id FROM categories WHERE name = 'Car Tyres'), '195/55 R16', '4011', 5200.00, 3640.00, 8, 4),
('MRF ZSLK', 'MRF', (SELECT id FROM categories WHERE name = 'Car Tyres'), '205/55 R16', '4011', 6100.00, 4270.00, 15, 4),

-- Apollo Car Tyres
('Apollo Alnac 4G', 'Apollo', (SELECT id FROM categories WHERE name = 'Car Tyres'), '185/65 R15', '4011', 4200.00, 2940.00, 10, 4),
('Apollo Alnac 4G HP', 'Apollo', (SELECT id FROM categories WHERE name = 'Car Tyres'), '195/55 R16', '4011', 4800.00, 3360.00, 6, 4),
('Apollo Amazer 4G Life', 'Apollo', (SELECT id FROM categories WHERE name = 'Car Tyres'), '165/80 R14', '4011', 3500.00, 2450.00, 20, 4),

-- CEAT Car Tyres
('CEAT Milaze X3', 'CEAT', (SELECT id FROM categories WHERE name = 'Car Tyres'), '185/65 R15', '4011', 4100.00, 2870.00, 14, 4),
('CEAT SecuraDrive', 'CEAT', (SELECT id FROM categories WHERE name = 'Car Tyres'), '195/55 R16', '4011', 4600.00, 3220.00, 3, 4),
('CEAT FuelSmarrt', 'CEAT', (SELECT id FROM categories WHERE name = 'Car Tyres'), '205/55 R16', '4011', 5500.00, 3850.00, 9, 4),

-- Bridgestone Car Tyres
('Bridgestone B290', 'Bridgestone', (SELECT id FROM categories WHERE name = 'Car Tyres'), '195/55 R16', '4011', 5800.00, 4060.00, 7, 4),
('Bridgestone B250', 'Bridgestone', (SELECT id FROM categories WHERE name = 'Car Tyres'), '185/65 R15', '4011', 5100.00, 3570.00, 11, 4),
('Bridgestone Turanza', 'Bridgestone', (SELECT id FROM categories WHERE name = 'Car Tyres'), '205/55 R16', '4011', 6800.00, 4760.00, 5, 4),

-- Michelin Car Tyres
('Michelin Energy', 'Michelin', (SELECT id FROM categories WHERE name = 'Car Tyres'), '185/65 R15', '4011', 5500.00, 3850.00, 6, 4),
('Michelin Pilot Sport', 'Michelin', (SELECT id FROM categories WHERE name = 'Car Tyres'), '205/55 R16', '4011', 7200.00, 5040.00, 4, 4),

-- SUV Tyres
('MRF Wanderer SUV', 'MRF', (SELECT id FROM categories WHERE name = 'SUV Tyres'), '215/60 R17', '4011', 7500.00, 5250.00, 8, 4),
('Apollo Apterra AT', 'Apollo', (SELECT id FROM categories WHERE name = 'SUV Tyres'), '235/70 R16', '4011', 8200.00, 5740.00, 5, 4),
('Bridgestone Dueler', 'Bridgestone', (SELECT id FROM categories WHERE name = 'SUV Tyres'), '215/60 R17', '4011', 8500.00, 5950.00, 2, 4),

-- Two-Wheeler Tyres
('MRF Revz', 'MRF', (SELECT id FROM categories WHERE name = 'Two-Wheeler Tyres'), '90/90-12', '4011', 1200.00, 840.00, 25, 4),
('CEAT Gripp', 'CEAT', (SELECT id FROM categories WHERE name = 'Two-Wheeler Tyres'), '100/80-14', '4011', 1400.00, 980.00, 18, 4),
('Michelin City Pro', 'Michelin', (SELECT id FROM categories WHERE name = 'Two-Wheeler Tyres'), '90/90-12', '4011', 1350.00, 945.00, 15, 4),

-- Tubes
('MRF Tube 185/65 R15', 'MRF', (SELECT id FROM categories WHERE name = 'Tubes'), '185/65 R15', '4013', 350.00, 245.00, 30, 4),
('CEAT Tube Universal', 'CEAT', (SELECT id FROM categories WHERE name = 'Tubes'), 'Universal', '4013', 300.00, 210.00, 22, 4);
