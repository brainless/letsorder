-- Manager invites table for restaurant manager invitation system
CREATE TABLE manager_invites (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    can_manage_menu BOOLEAN NOT NULL DEFAULT FALSE,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_manager_invites_restaurant_id ON manager_invites(restaurant_id);
CREATE INDEX idx_manager_invites_token ON manager_invites(token);
CREATE INDEX idx_manager_invites_email ON manager_invites(email);
CREATE INDEX idx_manager_invites_expires_at ON manager_invites(expires_at);