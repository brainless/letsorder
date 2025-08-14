-- Demo Data Reset SQL Script
-- Resets demo restaurant data while preserving structure for consistent demo URLs

-- Demo restaurant and table constants
-- Restaurant ID: demo-restaurant-123
-- Table ID: demo-table-456

-- First, clear all orders for the demo restaurant
DELETE FROM orders 
WHERE table_id IN (
    SELECT id FROM tables WHERE restaurant_id = 'demo-restaurant-123'
);

-- Clear existing menu items for demo restaurant
DELETE FROM menu_items 
WHERE section_id IN (
    SELECT id FROM menu_sections WHERE restaurant_id = 'demo-restaurant-123'
);

-- Clear existing menu sections for demo restaurant
DELETE FROM menu_sections 
WHERE restaurant_id = 'demo-restaurant-123';

-- Clear existing tables (except the demo table) for demo restaurant
DELETE FROM tables 
WHERE restaurant_id = 'demo-restaurant-123' AND id != 'demo-table-456';

-- Clear existing manager associations (we'll recreate them)
DELETE FROM restaurant_managers 
WHERE restaurant_id = 'demo-restaurant-123';

-- Clear the demo user if it exists
DELETE FROM users WHERE email = 'demo@letsorder.app';

-- Clear the demo restaurant if it exists (will be recreated)
DELETE FROM restaurants WHERE id = 'demo-restaurant-123';

-- Create demo user with fixed credentials
INSERT OR REPLACE INTO users (id, email, phone, password_hash) 
VALUES (
    'demo-user-789', 
    'demo@letsorder.app', 
    '+1234567890',
    -- This will need to be updated by the script with properly hashed password
    'PLACEHOLDER_HASH'
);

-- Create demo restaurant with fixed ID
INSERT OR REPLACE INTO restaurants (id, name, address, establishment_year, google_maps_link) 
VALUES (
    'demo-restaurant-123',
    'Demo Restaurant',
    '123 Demo Street, Demo City, DC 12345',
    2024,
    'https://maps.google.com/demo'
);

-- Link demo user as restaurant manager
INSERT OR REPLACE INTO restaurant_managers (restaurant_id, user_id, role, can_manage_menu) 
VALUES (
    'demo-restaurant-123',
    'demo-user-789',
    'super_admin',
    1
);

-- Create demo table with fixed ID
INSERT OR REPLACE INTO tables (id, restaurant_id, name, unique_code) 
VALUES (
    'demo-table-456',
    'demo-restaurant-123',
    'Demo Table',
    'DEMO001'
);

-- Create menu sections for demo restaurant
INSERT OR REPLACE INTO menu_sections (id, restaurant_id, name, display_order) VALUES
    ('demo-section-appetizers', 'demo-restaurant-123', 'Appetizers', 1),
    ('demo-section-mains', 'demo-restaurant-123', 'Main Courses', 2),
    ('demo-section-desserts', 'demo-restaurant-123', 'Desserts', 3);

-- Create sample menu items for demo
INSERT OR REPLACE INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES
    -- Appetizers
    ('demo-item-caesar', 'demo-section-appetizers', 'Caesar Salad', 'Fresh romaine lettuce with parmesan cheese and croutons', 12.99, 1, 1),
    ('demo-item-garlic-bread', 'demo-section-appetizers', 'Garlic Bread', 'Toasted artisan bread with garlic butter and herbs', 8.99, 1, 2),
    ('demo-item-wings', 'demo-section-appetizers', 'Buffalo Wings', 'Spicy chicken wings served with celery and ranch', 14.99, 1, 3),
    
    -- Main Courses
    ('demo-item-salmon', 'demo-section-mains', 'Grilled Salmon', 'Fresh Atlantic salmon with seasonal vegetables and lemon butter', 24.99, 1, 1),
    ('demo-item-chicken', 'demo-section-mains', 'Chicken Parmesan', 'Breaded chicken breast with marinara sauce and mozzarella', 19.99, 1, 2),
    ('demo-item-pasta', 'demo-section-mains', 'Vegetarian Pasta', 'Penne pasta with seasonal vegetables in olive oil and garlic', 16.99, 1, 3),
    ('demo-item-burger', 'demo-section-mains', 'Classic Burger', 'Beef patty with lettuce, tomato, onion, and house sauce', 15.99, 1, 4),
    
    -- Desserts
    ('demo-item-chocolate-cake', 'demo-section-desserts', 'Chocolate Cake', 'Rich chocolate layer cake with vanilla ice cream', 8.99, 1, 1),
    ('demo-item-tiramisu', 'demo-section-desserts', 'Tiramisu', 'Traditional Italian dessert with coffee and mascarpone', 9.99, 1, 2),
    ('demo-item-cheesecake', 'demo-section-desserts', 'New York Cheesecake', 'Classic cheesecake with berry compote', 7.99, 1, 3);