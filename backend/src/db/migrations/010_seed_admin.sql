-- Password: admin123 (bcrypt hash, replace in production)
INSERT INTO users (name, email, password_hash, role) VALUES
('Shop Owner', 'owner@tyreshop.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/./.og/at2.uheWG/igi', 'owner'),
('Manager One', 'manager@tyreshop.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/./.og/at2.uheWG/igi', 'manager'),
('Cashier One', 'cashier@tyreshop.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/./.og/at2.uheWG/igi', 'cashier');
-- NOTE: The hash above is for 'password' from bcrypt. Replace with real hashes before production.
