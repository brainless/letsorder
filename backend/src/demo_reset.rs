use backend::auth::PasswordHasher;
use clap::{Arg, Command};
use sqlx::{Pool, Sqlite, SqlitePool};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let matches = Command::new("demo_reset")
        .about("Reset demo restaurant data for LetsOrder")
        .arg(
            Arg::new("database-url")
                .long("database-url")
                .short('d')
                .value_name("URL")
                .help("Database URL (default: sqlite:./letsorder.db)")
                .default_value("sqlite:./letsorder.db"),
        )
        .arg(
            Arg::new("password")
                .long("password")
                .short('p')
                .value_name("PASSWORD")
                .help("Demo password to hash")
                .default_value("demo123"),
        )
        .arg(
            Arg::new("hash-only")
                .long("hash-only")
                .help("Only generate password hash, don't reset database")
                .action(clap::ArgAction::SetTrue),
        )
        .get_matches();

    let database_url = matches.get_one::<String>("database-url").unwrap();
    let password = matches.get_one::<String>("password").unwrap();
    let hash_only = matches.get_flag("hash-only");

    // Generate password hash
    let password_hash = PasswordHasher::hash_password(password)
        .map_err(|e| format!("Password hashing failed: {e}"))?;

    if hash_only {
        println!("{}", password_hash);
        return Ok(());
    }

    // Connect to database
    let pool = SqlitePool::connect(database_url).await?;

    // Reset demo data
    reset_demo_data(&pool, &password_hash).await?;

    println!("Demo data reset completed successfully");
    println!("Demo Access Information:");
    println!("  Restaurant ID: demo-restaurant-123");
    println!("  Table ID: demo-table-456");
    println!("  Manager Email: demo@letsorder.app");
    println!("  Manager Password: {}", password);
    println!("  Table Code: DEMO001");
    println!("  Admin URL: https://a.letsorder.app");
    println!("  Menu URL: https://m.letsorder.app/restaurant/demo-restaurant-123/table/demo-table-456");

    Ok(())
}

async fn reset_demo_data(pool: &Pool<Sqlite>, password_hash: &str) -> Result<(), sqlx::Error> {
    // Start a transaction
    let mut tx = pool.begin().await?;

    // Clear all orders for the demo restaurant
    sqlx::query!(
        "DELETE FROM orders 
         WHERE table_id IN (
             SELECT id FROM tables WHERE restaurant_id = 'demo-restaurant-123'
         )"
    )
    .execute(&mut *tx)
    .await?;

    // Clear existing menu items for demo restaurant
    sqlx::query!(
        "DELETE FROM menu_items 
         WHERE section_id IN (
             SELECT id FROM menu_sections WHERE restaurant_id = 'demo-restaurant-123'
         )"
    )
    .execute(&mut *tx)
    .await?;

    // Clear existing menu sections for demo restaurant
    sqlx::query!(
        "DELETE FROM menu_sections WHERE restaurant_id = 'demo-restaurant-123'"
    )
    .execute(&mut *tx)
    .await?;

    // Clear existing tables (except the demo table) for demo restaurant
    sqlx::query!(
        "DELETE FROM tables 
         WHERE restaurant_id = 'demo-restaurant-123' AND id != 'demo-table-456'"
    )
    .execute(&mut *tx)
    .await?;

    // Clear existing manager associations
    sqlx::query!(
        "DELETE FROM restaurant_managers WHERE restaurant_id = 'demo-restaurant-123'"
    )
    .execute(&mut *tx)
    .await?;

    // Clear the demo user if it exists
    sqlx::query!("DELETE FROM users WHERE email = 'demo@letsorder.app'")
        .execute(&mut *tx)
        .await?;

    // Clear the demo restaurant if it exists
    sqlx::query!("DELETE FROM restaurants WHERE id = 'demo-restaurant-123'")
        .execute(&mut *tx)
        .await?;

    // Create demo user with fixed credentials
    sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        "demo-user-789",
        "demo@letsorder.app",
        "+1234567890",
        password_hash
    )
    .execute(&mut *tx)
    .await?;

    // Create demo restaurant with fixed ID
    sqlx::query!(
        "INSERT INTO restaurants (id, name, address, establishment_year, google_maps_link) 
         VALUES (?, ?, ?, ?, ?)",
        "demo-restaurant-123",
        "Demo Restaurant",
        "123 Demo Street, Demo City, DC 12345",
        2024,
        "https://maps.google.com/demo"
    )
    .execute(&mut *tx)
    .await?;

    // Link demo user as restaurant manager
    sqlx::query!(
        "INSERT INTO restaurant_managers (restaurant_id, user_id, role, can_manage_menu) 
         VALUES (?, ?, ?, ?)",
        "demo-restaurant-123",
        "demo-user-789",
        "super_admin",
        true
    )
    .execute(&mut *tx)
    .await?;

    // Create demo table with fixed ID
    sqlx::query!(
        "INSERT INTO tables (id, restaurant_id, name, unique_code) VALUES (?, ?, ?, ?)",
        "demo-table-456",
        "demo-restaurant-123",
        "Demo Table",
        "DEMO001"
    )
    .execute(&mut *tx)
    .await?;

    // Create menu sections for demo restaurant
    let sections = vec![
        ("demo-section-appetizers", "Appetizers", 1),
        ("demo-section-mains", "Main Courses", 2),
        ("demo-section-desserts", "Desserts", 3),
    ];

    for (section_id, name, display_order) in sections {
        sqlx::query!(
            "INSERT INTO menu_sections (id, restaurant_id, name, display_order) 
             VALUES (?, ?, ?, ?)",
            section_id,
            "demo-restaurant-123",
            name,
            display_order
        )
        .execute(&mut *tx)
        .await?;
    }

    // Create sample menu items for demo
    let menu_items = vec![
        // Appetizers
        (
            "demo-item-caesar",
            "demo-section-appetizers",
            "Caesar Salad",
            "Fresh romaine lettuce with parmesan cheese and croutons",
            12.99,
            1,
        ),
        (
            "demo-item-garlic-bread",
            "demo-section-appetizers",
            "Garlic Bread",
            "Toasted artisan bread with garlic butter and herbs",
            8.99,
            2,
        ),
        (
            "demo-item-wings",
            "demo-section-appetizers",
            "Buffalo Wings",
            "Spicy chicken wings served with celery and ranch",
            14.99,
            3,
        ),
        // Main Courses
        (
            "demo-item-salmon",
            "demo-section-mains",
            "Grilled Salmon",
            "Fresh Atlantic salmon with seasonal vegetables and lemon butter",
            24.99,
            1,
        ),
        (
            "demo-item-chicken",
            "demo-section-mains",
            "Chicken Parmesan",
            "Breaded chicken breast with marinara sauce and mozzarella",
            19.99,
            2,
        ),
        (
            "demo-item-pasta",
            "demo-section-mains",
            "Vegetarian Pasta",
            "Penne pasta with seasonal vegetables in olive oil and garlic",
            16.99,
            3,
        ),
        (
            "demo-item-burger",
            "demo-section-mains",
            "Classic Burger",
            "Beef patty with lettuce, tomato, onion, and house sauce",
            15.99,
            4,
        ),
        // Desserts
        (
            "demo-item-chocolate-cake",
            "demo-section-desserts",
            "Chocolate Cake",
            "Rich chocolate layer cake with vanilla ice cream",
            8.99,
            1,
        ),
        (
            "demo-item-tiramisu",
            "demo-section-desserts",
            "Tiramisu",
            "Traditional Italian dessert with coffee and mascarpone",
            9.99,
            2,
        ),
        (
            "demo-item-cheesecake",
            "demo-section-desserts",
            "New York Cheesecake",
            "Classic cheesecake with berry compote",
            7.99,
            3,
        ),
    ];

    for (item_id, section_id, name, description, price, display_order) in menu_items {
        sqlx::query!(
            "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) 
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            item_id,
            section_id,
            name,
            description,
            price,
            true,
            display_order
        )
        .execute(&mut *tx)
        .await?;
    }

    // Commit the transaction
    tx.commit().await?;

    Ok(())
}