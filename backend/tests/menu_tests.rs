use backend::init_database;
use backend::models::{MenuItem, MenuItemRow, MenuSection, MenuSectionRow};
use sqlx::{Pool, Sqlite};
use std::sync::Once;

static INIT: Once = Once::new();

async fn setup_test_db() -> Pool<Sqlite> {
    INIT.call_once(|| {
        env_logger::init();
    });

    let pool = init_database("sqlite::memory:")
        .await
        .expect("Failed to create test database");

    // Clean database
    let _ = sqlx::query("DELETE FROM menu_items").execute(&pool).await;
    let _ = sqlx::query("DELETE FROM menu_sections")
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM restaurant_managers")
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM restaurants").execute(&pool).await;
    let _ = sqlx::query("DELETE FROM users").execute(&pool).await;

    pool
}

#[tokio::test]
async fn test_menu_section_creation_and_retrieval() {
    let pool = setup_test_db().await;

    // Create a restaurant
    let restaurant_id = "restaurant-1";
    sqlx::query!(
        "INSERT INTO restaurants (id, name, address, establishment_year) VALUES (?, ?, ?, ?)",
        restaurant_id,
        "Test Restaurant",
        "123 Test St",
        2024
    )
    .execute(&pool)
    .await
    .expect("Failed to create test restaurant");

    // Create menu sections
    let section1_id = "section-1";
    let section2_id = "section-2";

    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section1_id,
        restaurant_id,
        "Appetizers",
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section 1");

    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section2_id,
        restaurant_id,
        "Main Course",
        2
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section 2");

    // Test menu section retrieval with proper type handling
    let sections = sqlx::query_as::<_, MenuSectionRow>(
        "SELECT id, restaurant_id, name, display_order, created_at 
         FROM menu_sections 
         WHERE restaurant_id = ? 
         ORDER BY display_order ASC",
    )
    .bind(restaurant_id)
    .fetch_all(&pool)
    .await
    .expect("Failed to fetch menu sections");

    assert_eq!(sections.len(), 2);

    // Convert to domain models and verify
    let section_models: Vec<MenuSection> = sections.into_iter().map(MenuSection::from).collect();

    assert_eq!(section_models[0].name, "Appetizers");
    assert_eq!(section_models[0].display_order, 1);
    assert_eq!(section_models[1].name, "Main Course");
    assert_eq!(section_models[1].display_order, 2);
}

#[tokio::test]
async fn test_menu_item_creation_and_retrieval() {
    let pool = setup_test_db().await;

    // Create a restaurant
    let restaurant_id = "restaurant-1";
    sqlx::query!(
        "INSERT INTO restaurants (id, name, address, establishment_year) VALUES (?, ?, ?, ?)",
        restaurant_id,
        "Test Restaurant",
        "123 Test St",
        2024
    )
    .execute(&pool)
    .await
    .expect("Failed to create test restaurant");

    // Create a menu section
    let section_id = "section-1";
    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section_id,
        restaurant_id,
        "Appetizers",
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section");

    // Create menu items
    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        "item-1",
        section_id,
        "Garlic Bread",
        "Fresh bread with garlic butter",
        5.99,
        true,
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test item 1");

    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        "item-2",
        section_id,
        "Caesar Salad",
        "Crispy lettuce with caesar dressing",
        8.50,
        true,
        2
    )
    .execute(&pool)
    .await
    .expect("Failed to create test item 2");

    // Test menu item retrieval
    let items = sqlx::query_as::<_, MenuItemRow>(
        "SELECT id, section_id, name, description, price, available, display_order, created_at 
         FROM menu_items 
         WHERE section_id = ? 
         ORDER BY display_order ASC",
    )
    .bind(section_id)
    .fetch_all(&pool)
    .await
    .expect("Failed to fetch menu items");

    assert_eq!(items.len(), 2);

    // Convert to domain models and verify
    let item_models: Vec<MenuItem> = items.into_iter().map(MenuItem::from).collect();

    assert_eq!(item_models[0].name, "Garlic Bread");
    assert_eq!(item_models[0].price, 5.99);
    assert_eq!(item_models[0].available, true);

    assert_eq!(item_models[1].name, "Caesar Salad");
    assert_eq!(item_models[1].price, 8.50);
    assert_eq!(item_models[1].available, true);
}

#[tokio::test]
async fn test_complete_menu_structure() {
    let pool = setup_test_db().await;

    // Create a restaurant
    let restaurant_id = "restaurant-1";
    sqlx::query!(
        "INSERT INTO restaurants (id, name, address, establishment_year) VALUES (?, ?, ?, ?)",
        restaurant_id,
        "Test Restaurant",
        "123 Test St",
        2024
    )
    .execute(&pool)
    .await
    .expect("Failed to create test restaurant");

    // Create menu sections
    let section1_id = "section-1";
    let section2_id = "section-2";

    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section1_id,
        restaurant_id,
        "Appetizers",
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section 1");

    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section2_id,
        restaurant_id,
        "Main Course",
        2
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section 2");

    // Create menu items for section 1
    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        "item-1",
        section1_id,
        "Garlic Bread",
        "Fresh bread with garlic butter",
        5.99,
        true,
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test item 1");

    // Create menu items for section 2
    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        "item-2",
        section2_id,
        "Pasta Carbonara",
        "Classic Italian pasta dish",
        14.99,
        true,
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test item 2");

    // Test complete menu retrieval logic (similar to what the handler does)
    let sections = sqlx::query_as::<_, MenuSectionRow>(
        "SELECT id, restaurant_id, name, display_order, created_at 
         FROM menu_sections 
         WHERE restaurant_id = ? 
         ORDER BY display_order ASC",
    )
    .bind(restaurant_id)
    .fetch_all(&pool)
    .await
    .expect("Failed to fetch menu sections");

    let section_models: Vec<MenuSection> = sections.into_iter().map(MenuSection::from).collect();

    // For each section, fetch items
    let mut complete_menu = Vec::new();

    for section in section_models {
        let items = sqlx::query_as::<_, MenuItemRow>(
            "SELECT id, section_id, name, description, price, available, display_order, created_at 
             FROM menu_items 
             WHERE section_id = ? 
             ORDER BY display_order ASC",
        )
        .bind(&section.id)
        .fetch_all(&pool)
        .await
        .expect("Failed to fetch menu items");

        let item_models: Vec<MenuItem> = items.into_iter().map(MenuItem::from).collect();

        complete_menu.push((section, item_models));
    }

    // Verify complete menu structure
    assert_eq!(complete_menu.len(), 2);

    // Check first section (Appetizers)
    assert_eq!(complete_menu[0].0.name, "Appetizers");
    assert_eq!(complete_menu[0].1.len(), 1);
    assert_eq!(complete_menu[0].1[0].name, "Garlic Bread");

    // Check second section (Main Course)
    assert_eq!(complete_menu[1].0.name, "Main Course");
    assert_eq!(complete_menu[1].1.len(), 1);
    assert_eq!(complete_menu[1].1[0].name, "Pasta Carbonara");
}
