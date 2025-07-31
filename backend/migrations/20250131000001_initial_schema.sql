-- Initial database schema for restaurant ordering system

-- Users table (managers)
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Restaurants table
CREATE TABLE restaurants (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    address TEXT,
    establishment_year INTEGER,
    google_maps_link TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Restaurant managers junction table
CREATE TABLE restaurant_managers (
    restaurant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'manager')),
    can_manage_menu BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (restaurant_id, user_id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tables/Rooms table
CREATE TABLE tables (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    unique_code TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Menu sections table
CREATE TABLE menu_sections (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Menu items table
CREATE TABLE menu_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    section_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES menu_sections(id) ON DELETE CASCADE
);

-- Orders table
CREATE TABLE orders (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    table_id TEXT NOT NULL,
    items TEXT NOT NULL, -- JSON array of order items
    total_amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_restaurant_managers_restaurant_id ON restaurant_managers(restaurant_id);
CREATE INDEX idx_restaurant_managers_user_id ON restaurant_managers(user_id);
CREATE INDEX idx_tables_restaurant_id ON tables(restaurant_id);
CREATE INDEX idx_tables_unique_code ON tables(unique_code);
CREATE INDEX idx_menu_sections_restaurant_id ON menu_sections(restaurant_id);
CREATE INDEX idx_menu_sections_display_order ON menu_sections(display_order);
CREATE INDEX idx_menu_items_section_id ON menu_items(section_id);
CREATE INDEX idx_menu_items_display_order ON menu_items(display_order);
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);