use crate::auth::PasswordHasher;
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

pub async fn seed_database(pool: &Pool<Sqlite>) -> Result<(), sqlx::Error> {
    // Create a test user with password "password123"
    let user_id = Uuid::new_v4().to_string();
    let password_hash = PasswordHasher::hash_password("password123")
        .map_err(|e| sqlx::Error::Protocol(format!("Password hashing failed: {}", e)))?;
    
    sqlx::query!(
        r#"
        INSERT INTO users (id, email, phone, password_hash)
        VALUES (?, ?, ?, ?)
        "#,
        user_id,
        "manager@example.com",
        "+1234567890",
        password_hash
    )
    .execute(pool)
    .await?;

    // Create a test restaurant
    let restaurant_id = Uuid::new_v4().to_string();
    sqlx::query!(
        r#"
        INSERT INTO restaurants (id, name, address, establishment_year, google_maps_link)
        VALUES (?, ?, ?, ?, ?)
        "#,
        restaurant_id,
        "Demo Restaurant",
        "123 Main St, Demo City, DC 12345",
        2020,
        "https://maps.google.com/demo"
    )
    .execute(pool)
    .await?;

    // Link user as restaurant manager
    sqlx::query!(
        r#"
        INSERT INTO restaurant_managers (restaurant_id, user_id, role, can_manage_menu)
        VALUES (?, ?, ?, ?)
        "#,
        restaurant_id,
        user_id,
        "super_admin",
        true
    )
    .execute(pool)
    .await?;

    // Create test tables
    let table1_id = Uuid::new_v4().to_string();
    let table2_id = Uuid::new_v4().to_string();

    sqlx::query!(
        r#"
        INSERT INTO tables (id, restaurant_id, name, unique_code)
        VALUES (?, ?, ?, ?)
        "#,
        table1_id,
        restaurant_id,
        "Table 1",
        "TBL001"
    )
    .execute(pool)
    .await?;

    sqlx::query!(
        r#"
        INSERT INTO tables (id, restaurant_id, name, unique_code)
        VALUES (?, ?, ?, ?)
        "#,
        table2_id,
        restaurant_id,
        "Table 2",
        "TBL002"
    )
    .execute(pool)
    .await?;

    // Create menu sections
    let appetizers_id = Uuid::new_v4().to_string();
    let mains_id = Uuid::new_v4().to_string();
    let desserts_id = Uuid::new_v4().to_string();

    sqlx::query!(
        r#"
        INSERT INTO menu_sections (id, restaurant_id, name, display_order)
        VALUES (?, ?, ?, ?)
        "#,
        appetizers_id,
        restaurant_id,
        "Appetizers",
        1
    )
    .execute(pool)
    .await?;

    sqlx::query!(
        r#"
        INSERT INTO menu_sections (id, restaurant_id, name, display_order)
        VALUES (?, ?, ?, ?)
        "#,
        mains_id,
        restaurant_id,
        "Main Courses",
        2
    )
    .execute(pool)
    .await?;

    sqlx::query!(
        r#"
        INSERT INTO menu_sections (id, restaurant_id, name, display_order)
        VALUES (?, ?, ?, ?)
        "#,
        desserts_id,
        restaurant_id,
        "Desserts",
        3
    )
    .execute(pool)
    .await?;

    // Create menu items
    let items = vec![
        (
            appetizers_id.clone(),
            "Caesar Salad",
            "Fresh romaine lettuce with parmesan and croutons",
            12.99,
            1,
        ),
        (
            appetizers_id.clone(),
            "Garlic Bread",
            "Toasted bread with garlic butter",
            8.99,
            2,
        ),
        (
            mains_id.clone(),
            "Grilled Salmon",
            "Fresh Atlantic salmon with seasonal vegetables",
            24.99,
            1,
        ),
        (
            mains_id.clone(),
            "Chicken Parmesan",
            "Breaded chicken breast with marinara and mozzarella",
            19.99,
            2,
        ),
        (
            mains_id.clone(),
            "Vegetarian Pasta",
            "Penne with seasonal vegetables in olive oil",
            16.99,
            3,
        ),
        (
            desserts_id.clone(),
            "Chocolate Cake",
            "Rich chocolate cake with vanilla ice cream",
            8.99,
            1,
        ),
        (
            desserts_id.clone(),
            "Tiramisu",
            "Classic Italian dessert",
            9.99,
            2,
        ),
    ];

    for (section_id, name, description, price, display_order) in items {
        let item_id = Uuid::new_v4().to_string();
        sqlx::query!(
            r#"
            INSERT INTO menu_items (id, section_id, name, description, price, available, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
            item_id,
            section_id,
            name,
            description,
            price,
            true,
            display_order
        )
        .execute(pool)
        .await?;
    }

    println!("Database seeded successfully!");
    println!("Test user: manager@example.com");
    println!("Test password: password123");
    println!("Test restaurant: Demo Restaurant");
    println!("Test tables: TBL001, TBL002");

    Ok(())
}
