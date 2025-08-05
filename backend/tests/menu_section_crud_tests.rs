use backend::init_database;
use backend::models::{MenuSection, MenuSectionRow};
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

async fn create_test_restaurant_and_user(pool: &Pool<Sqlite>) -> (String, String) {
    let restaurant_id = "restaurant-1";
    let user_id = "user-1";

    // Create a user
    sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        user_id,
        "test@example.com",
        "1234567890",
        "hashed_password"
    )
    .execute(pool)
    .await
    .expect("Failed to create test user");

    // Create a restaurant
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

    // Create manager relationship with menu permissions
    sqlx::query!(
        "INSERT INTO restaurant_managers (restaurant_id, user_id, role, can_manage_menu) VALUES (?, ?, ?, ?)",
        restaurant_id,
        user_id,
        "owner",
        true
    )
    .execute(pool)
    .await
    .expect("Failed to create manager relationship");

    (restaurant_id.to_string(), user_id.to_string())
}

#[tokio::test]
async fn test_update_menu_section_name() {
    let pool = setup_test_db().await;
    let (restaurant_id, _user_id) = create_test_restaurant_and_user(&pool).await;

    // Create a menu section
    let section_id = "section-1";
    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section_id,
        restaurant_id,
        "Original Name",
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section");

    // Test updating section name
    let result = sqlx::query!(
        "UPDATE menu_sections SET name = ? WHERE id = ?",
        "Updated Name",
        section_id
    )
    .execute(&pool)
    .await
    .expect("Failed to update section name");

    assert_eq!(result.rows_affected(), 1);

    // Verify the update
    let section = sqlx::query_as::<_, MenuSectionRow>(
        "SELECT id, restaurant_id, name, display_order, created_at FROM menu_sections WHERE id = ?",
    )
    .bind(section_id)
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch updated section");

    let section_model = MenuSection::from(section);
    assert_eq!(section_model.name, "Updated Name");
    assert_eq!(section_model.display_order, 1); // Should remain unchanged
}

#[tokio::test]
async fn test_update_menu_section_display_order() {
    let pool = setup_test_db().await;
    let (restaurant_id, _user_id) = create_test_restaurant_and_user(&pool).await;

    // Create a menu section
    let section_id = "section-1";
    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section_id,
        restaurant_id,
        "Test Section",
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section");

    // Test updating display order
    let result = sqlx::query!(
        "UPDATE menu_sections SET display_order = ? WHERE id = ?",
        5,
        section_id
    )
    .execute(&pool)
    .await
    .expect("Failed to update section display order");

    assert_eq!(result.rows_affected(), 1);

    // Verify the update
    let section = sqlx::query_as::<_, MenuSectionRow>(
        "SELECT id, restaurant_id, name, display_order, created_at FROM menu_sections WHERE id = ?",
    )
    .bind(section_id)
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch updated section");

    let section_model = MenuSection::from(section);
    assert_eq!(section_model.name, "Test Section"); // Should remain unchanged
    assert_eq!(section_model.display_order, 5);
}

#[tokio::test]
async fn test_update_menu_section_both_fields() {
    let pool = setup_test_db().await;
    let (restaurant_id, _user_id) = create_test_restaurant_and_user(&pool).await;

    // Create a menu section
    let section_id = "section-1";
    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section_id,
        restaurant_id,
        "Original Name",
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section");

    // Test updating both name and display order
    let result = sqlx::query!(
        "UPDATE menu_sections SET name = ?, display_order = ? WHERE id = ?",
        "Updated Name",
        3,
        section_id
    )
    .execute(&pool)
    .await
    .expect("Failed to update section");

    assert_eq!(result.rows_affected(), 1);

    // Verify the update
    let section = sqlx::query_as::<_, MenuSectionRow>(
        "SELECT id, restaurant_id, name, display_order, created_at FROM menu_sections WHERE id = ?",
    )
    .bind(section_id)
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch updated section");

    let section_model = MenuSection::from(section);
    assert_eq!(section_model.name, "Updated Name");
    assert_eq!(section_model.display_order, 3);
}

#[tokio::test]
async fn test_delete_menu_section_without_items() {
    let pool = setup_test_db().await;
    let (restaurant_id, _user_id) = create_test_restaurant_and_user(&pool).await;

    // Create a menu section
    let section_id = "section-1";
    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section_id,
        restaurant_id,
        "Test Section",
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section");

    // Verify section exists
    let sections_before = sqlx::query!(
        "SELECT COUNT(*) as count FROM menu_sections WHERE id = ?",
        section_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to count sections");
    assert_eq!(sections_before.count, 1);

    // Delete the section
    let result = sqlx::query!("DELETE FROM menu_sections WHERE id = ?", section_id)
        .execute(&pool)
        .await
        .expect("Failed to delete section");

    assert_eq!(result.rows_affected(), 1);

    // Verify section is deleted
    let sections_after = sqlx::query!(
        "SELECT COUNT(*) as count FROM menu_sections WHERE id = ?",
        section_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to count sections");
    assert_eq!(sections_after.count, 0);
}

#[tokio::test]
async fn test_delete_menu_section_with_items_cascade() {
    let pool = setup_test_db().await;
    let (restaurant_id, _user_id) = create_test_restaurant_and_user(&pool).await;

    // Create a menu section
    let section_id = "section-1";
    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section_id,
        restaurant_id,
        "Test Section",
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section");

    // Create menu items in the section
    let item1_id = "item-1";
    let item2_id = "item-2";

    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item1_id,
        section_id,
        "Test Item 1",
        "Description 1",
        10.99,
        true,
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test item 1");

    sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item2_id,
        section_id,
        "Test Item 2",
        "Description 2",
        15.99,
        true,
        2
    )
    .execute(&pool)
    .await
    .expect("Failed to create test item 2");

    // Verify items exist
    let items_before = sqlx::query!(
        "SELECT COUNT(*) as count FROM menu_items WHERE section_id = ?",
        section_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to count items");
    assert_eq!(items_before.count, 2);

    // Verify section exists
    let sections_before = sqlx::query!(
        "SELECT COUNT(*) as count FROM menu_sections WHERE id = ?",
        section_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to count sections");
    assert_eq!(sections_before.count, 1);

    // Use transaction to delete items first, then section (simulating the handler logic)
    let mut tx = pool.begin().await.expect("Failed to start transaction");

    // Delete items first
    let delete_items_result =
        sqlx::query!("DELETE FROM menu_items WHERE section_id = ?", section_id)
            .execute(&mut *tx)
            .await
            .expect("Failed to delete items");

    assert_eq!(delete_items_result.rows_affected(), 2);

    // Delete section
    let delete_section_result = sqlx::query!("DELETE FROM menu_sections WHERE id = ?", section_id)
        .execute(&mut *tx)
        .await
        .expect("Failed to delete section");

    assert_eq!(delete_section_result.rows_affected(), 1);

    // Commit transaction
    tx.commit().await.expect("Failed to commit transaction");

    // Verify both section and items are deleted
    let sections_after = sqlx::query!(
        "SELECT COUNT(*) as count FROM menu_sections WHERE id = ?",
        section_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to count sections");
    assert_eq!(sections_after.count, 0);

    let items_after = sqlx::query!(
        "SELECT COUNT(*) as count FROM menu_items WHERE section_id = ?",
        section_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to count items");
    assert_eq!(items_after.count, 0);
}

#[tokio::test]
async fn test_delete_nonexistent_section() {
    let pool = setup_test_db().await;

    // Try to delete a section that doesn't exist
    let result = sqlx::query!("DELETE FROM menu_sections WHERE id = ?", "nonexistent-id")
        .execute(&pool)
        .await
        .expect("Failed to execute delete query");

    assert_eq!(result.rows_affected(), 0);
}

#[tokio::test]
async fn test_update_nonexistent_section() {
    let pool = setup_test_db().await;

    // Try to update a section that doesn't exist
    let result = sqlx::query!(
        "UPDATE menu_sections SET name = ? WHERE id = ?",
        "New Name",
        "nonexistent-id"
    )
    .execute(&pool)
    .await
    .expect("Failed to execute update query");

    assert_eq!(result.rows_affected(), 0);
}

#[tokio::test]
async fn test_menu_permissions_check() {
    let pool = setup_test_db().await;
    let (restaurant_id, user_id) = create_test_restaurant_and_user(&pool).await;

    // Test that user has menu management permission
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        user_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to check permissions");

    assert_eq!(permission_check.count, 1);

    // Test with user who doesn't have menu permission
    let user_id_no_permission = "user-2";
    sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        user_id_no_permission,
        "noperm@example.com",
        "9876543210",
        "hashed_password"
    )
    .execute(&pool)
    .await
    .expect("Failed to create test user without permission");

    sqlx::query!(
        "INSERT INTO restaurant_managers (restaurant_id, user_id, role, can_manage_menu) VALUES (?, ?, ?, ?)",
        restaurant_id,
        user_id_no_permission,
        "manager",
        false
    )
    .execute(&pool)
    .await
    .expect("Failed to create manager without menu permission");

    let no_permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        user_id_no_permission
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to check permissions");

    assert_eq!(no_permission_check.count, 0);
}

#[tokio::test]
async fn test_section_exists_check() {
    let pool = setup_test_db().await;
    let (restaurant_id, _user_id) = create_test_restaurant_and_user(&pool).await;

    // Create a menu section
    let section_id = "section-1";
    sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section_id,
        restaurant_id,
        "Test Section",
        1
    )
    .execute(&pool)
    .await
    .expect("Failed to create test section");

    // Test checking if section exists and getting restaurant_id
    let section_check = sqlx::query!(
        "SELECT restaurant_id FROM menu_sections WHERE id = ?",
        section_id
    )
    .fetch_optional(&pool)
    .await
    .expect("Failed to check section");

    assert!(section_check.is_some());
    assert_eq!(section_check.unwrap().restaurant_id, restaurant_id);

    // Test with nonexistent section
    let nonexistent_check = sqlx::query!(
        "SELECT restaurant_id FROM menu_sections WHERE id = ?",
        "nonexistent-id"
    )
    .fetch_optional(&pool)
    .await
    .expect("Failed to check nonexistent section");

    assert!(nonexistent_check.is_none());
}
