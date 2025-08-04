use backend::{auth::PasswordHasher, init_database};
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

async fn setup_test_db() -> Pool<Sqlite> {
    let pool = init_database("sqlite::memory:")
        .await
        .expect("Failed to create test database");
    pool
}

async fn create_test_user_and_restaurant(pool: &Pool<Sqlite>) -> (String, String, String) {
    let user_id = Uuid::new_v4().to_string();
    let restaurant_id = Uuid::new_v4().to_string();
    let section_id = Uuid::new_v4().to_string();

    let password_hash =
        PasswordHasher::hash_password("password123").expect("Failed to hash password");

    // Create user
    sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        user_id,
        "test@example.com",
        Some("+1234567890"),
        password_hash
    )
    .execute(pool)
    .await
    .expect("Failed to create test user");

    // Create restaurant
    sqlx::query!(
        "INSERT INTO restaurants (id, name, address, establishment_year) VALUES (?, ?, ?, ?)",
        restaurant_id,
        "Test Restaurant",
        "123 Test St",
        2024
    )
    .execute(pool)
    .await
    .expect("Failed to create test restaurant");

    // Make user a manager with menu permissions
    sqlx::query!(
        "INSERT INTO restaurant_managers (restaurant_id, user_id, role, can_manage_menu) VALUES (?, ?, ?, ?)",
        restaurant_id,
        user_id,
        "manager",
        true
    )
    .execute(pool)
    .await
    .expect("Failed to create manager relationship");

    // Create a test menu section
    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section_id,
        restaurant_id,
        "Test Section",
        1
    )
    .execute(pool)
    .await
    .expect("Failed to create test section");

    (user_id, restaurant_id, section_id)
}

#[tokio::test]
async fn test_create_menu_item() {
    let pool = setup_test_db().await;
    let (_user_id, _restaurant_id, section_id) = create_test_user_and_restaurant(&pool).await;

    // Test data
    let item_name = "Test Item";
    let description = Some("Test Description");
    let price = 12.99;

    // Create menu item
    let item_id = Uuid::new_v4().to_string();
    let result = sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item_id,
        section_id,
        item_name,
        description,
        price,
        true,
        1
    )
    .execute(&pool)
    .await;

    assert!(result.is_ok());

    // Verify the item was created
    let items = sqlx::query!(
        "SELECT name, description, price as \"price: f64\", available, display_order FROM menu_items WHERE section_id = ?",
        section_id
    )
    .fetch_all(&pool)
    .await
    .expect("Failed to fetch menu items");

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].name, item_name);
    assert_eq!(items[0].description, description.map(|s| s.to_string()));
    assert_eq!(items[0].price, price);
    assert!(items[0].available);
    assert_eq!(items[0].display_order, 1);
}

#[tokio::test]
async fn test_update_menu_item() {
    let pool = setup_test_db().await;
    let (_user_id, _restaurant_id, section_id) = create_test_user_and_restaurant(&pool).await;

    // Create initial menu item
    let item_id = Uuid::new_v4().to_string();
    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item_id,
        section_id,
        "Original Item",
        Some("Original Description"),
        10.99,
        true,
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test item");

    // Update the item
    let new_name = "Updated Item";
    let new_price = 15.99;

    let result = sqlx::query!(
        "UPDATE menu_items SET name = ?, price = ? WHERE id = ?",
        new_name,
        new_price,
        item_id
    )
    .execute(&pool)
    .await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().rows_affected(), 1);

    // Verify the update
    let item = sqlx::query!(
        "SELECT name, description, price as \"price: f64\" FROM menu_items WHERE id = ?",
        item_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch updated item");

    assert_eq!(item.name, new_name);
    assert_eq!(item.price, new_price);
    assert_eq!(item.description, Some("Original Description".to_string())); // Should remain unchanged
}

#[tokio::test]
async fn test_delete_menu_item() {
    let pool = setup_test_db().await;
    let (_user_id, _restaurant_id, section_id) = create_test_user_and_restaurant(&pool).await;

    // Create menu item
    let item_id = Uuid::new_v4().to_string();
    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item_id,
        section_id,
        "Item to Delete",
        Some("Description"),
        8.99,
        true,
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test item");

    // Verify item exists
    let items_before = sqlx::query!(
        "SELECT COUNT(*) as count FROM menu_items WHERE id = ?",
        item_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to count items");
    assert_eq!(items_before.count, 1);

    // Delete the item
    let result = sqlx::query!("DELETE FROM menu_items WHERE id = ?", item_id)
        .execute(&pool)
        .await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().rows_affected(), 1);

    // Verify item is deleted
    let items_after = sqlx::query!(
        "SELECT COUNT(*) as count FROM menu_items WHERE id = ?",
        item_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to count items after deletion");
    assert_eq!(items_after.count, 0);
}

#[tokio::test]
async fn test_toggle_menu_item_availability() {
    let pool = setup_test_db().await;
    let (_user_id, _restaurant_id, section_id) = create_test_user_and_restaurant(&pool).await;

    // Create menu item (initially available)
    let item_id = Uuid::new_v4().to_string();
    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item_id,
        section_id,
        "Test Item",
        Some("Description"),
        12.99,
        true, // Initially available
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test item");

    // Toggle to unavailable
    let result = sqlx::query!(
        "UPDATE menu_items SET available = ? WHERE id = ?",
        false,
        item_id
    )
    .execute(&pool)
    .await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().rows_affected(), 1);

    // Verify it's now unavailable
    let item = sqlx::query!("SELECT available FROM menu_items WHERE id = ?", item_id)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch item");
    assert!(!item.available);

    // Toggle back to available
    let result = sqlx::query!(
        "UPDATE menu_items SET available = ? WHERE id = ?",
        true,
        item_id
    )
    .execute(&pool)
    .await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().rows_affected(), 1);

    // Verify it's available again
    let item = sqlx::query!("SELECT available FROM menu_items WHERE id = ?", item_id)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch item");
    assert!(item.available);
}

#[tokio::test]
async fn test_reorder_menu_items() {
    let pool = setup_test_db().await;
    let (_user_id, _restaurant_id, section_id) = create_test_user_and_restaurant(&pool).await;

    // Create multiple menu items
    let item1_id = Uuid::new_v4().to_string();
    let item2_id = Uuid::new_v4().to_string();
    let item3_id = Uuid::new_v4().to_string();

    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item1_id,
        section_id,
        "Item 1",
        Some("First item"),
        10.99,
        true,
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create item 1");

    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item2_id,
        section_id,
        "Item 2",
        Some("Second item"),
        12.99,
        true,
        2
    )
    .execute(&pool)
    .await
    .expect("Failed to create item 2");

    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item3_id,
        section_id,
        "Item 3",
        Some("Third item"),
        14.99,
        true,
        3
    )
    .execute(&pool)
    .await
    .expect("Failed to create item 3");

    // Reorder: item3 -> 1, item1 -> 2, item2 -> 3
    let reorder_updates = vec![
        (item3_id.clone(), 1),
        (item1_id.clone(), 2),
        (item2_id.clone(), 3),
    ];

    for (item_id, new_order) in reorder_updates {
        let result = sqlx::query!(
            "UPDATE menu_items SET display_order = ? WHERE id = ?",
            new_order,
            item_id
        )
        .execute(&pool)
        .await;
        assert!(result.is_ok());
    }

    // Verify the new order
    let items = sqlx::query!(
        "SELECT id, name, display_order FROM menu_items WHERE section_id = ? ORDER BY display_order",
        section_id
    )
    .fetch_all(&pool)
    .await
    .expect("Failed to fetch reordered items");

    assert_eq!(items.len(), 3);
    assert_eq!(items[0].id, Some(item3_id));
    assert_eq!(items[0].display_order, 1);
    assert_eq!(items[1].id, Some(item1_id));
    assert_eq!(items[1].display_order, 2);
    assert_eq!(items[2].id, Some(item2_id));
    assert_eq!(items[2].display_order, 3);
}

#[tokio::test]
async fn test_menu_item_display_order_auto_increment() {
    let pool = setup_test_db().await;
    let (_user_id, _restaurant_id, section_id) = create_test_user_and_restaurant(&pool).await;

    // Create first item (should get display_order = 1)
    let item1_id = Uuid::new_v4().to_string();

    // Get next display order (should be 1)
    let max_order = sqlx::query!(
        "SELECT COALESCE(MAX(display_order), 0) as max_order FROM menu_items WHERE section_id = ?",
        section_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to get max order");

    let next_order = max_order.max_order + 1;
    assert_eq!(next_order, 1);

    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item1_id,
        section_id,
        "First Item",
        Some("Description"),
        10.99,
        true,
        next_order
    )
    .execute(&pool)
    .await
    .expect("Failed to create first item");

    // Create second item (should get display_order = 2)
    let item2_id = Uuid::new_v4().to_string();

    let max_order = sqlx::query!(
        "SELECT COALESCE(MAX(display_order), 0) as max_order FROM menu_items WHERE section_id = ?",
        section_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to get max order");

    let next_order = max_order.max_order + 1;
    assert_eq!(next_order, 2);

    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item2_id,
        section_id,
        "Second Item",
        Some("Description"),
        12.99,
        true,
        next_order
    )
    .execute(&pool)
    .await
    .expect("Failed to create second item");

    // Verify both items have correct display orders
    let items = sqlx::query!(
        "SELECT id, display_order FROM menu_items WHERE section_id = ? ORDER BY display_order",
        section_id
    )
    .fetch_all(&pool)
    .await
    .expect("Failed to fetch items");

    assert_eq!(items.len(), 2);
    assert_eq!(items[0].id, Some(item1_id));
    assert_eq!(items[0].display_order, 1);
    assert_eq!(items[1].id, Some(item2_id));
    assert_eq!(items[1].display_order, 2);
}

#[tokio::test]
async fn test_menu_item_validation() {
    let pool = setup_test_db().await;
    let (_user_id, _restaurant_id, section_id) = create_test_user_and_restaurant(&pool).await;

    // Test creating item with invalid section_id should fail
    let invalid_section_id = Uuid::new_v4().to_string();
    let invalid_item_id = Uuid::new_v4().to_string();
    let result = sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        invalid_item_id,
        invalid_section_id,
        "Test Item",
        Some("Description"),
        10.99,
        true,
        1
    )
    .execute(&pool)
    .await;

    // This should fail due to foreign key constraint
    assert!(result.is_err());

    // Test creating item with valid section_id should succeed
    let valid_item_id = Uuid::new_v4().to_string();
    let result = sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        valid_item_id,
        section_id,
        "Valid Item",
        Some("Description"),
        10.99,
        true,
        1
    )
    .execute(&pool)
    .await;

    assert!(result.is_ok());
}
