use backend::auth::PasswordHasher;

#[tokio::test]
async fn test_password_hashing() {
    let password = "test_password_123";
    let hash = PasswordHasher::hash_password(password).expect("Failed to hash password");

    assert!(!hash.is_empty());
    assert_ne!(hash, password);

    let is_valid =
        PasswordHasher::verify_password(password, &hash).expect("Failed to verify password");
    assert!(is_valid);

    let is_invalid = PasswordHasher::verify_password("wrong_password", &hash)
        .expect("Failed to verify password");
    assert!(!is_invalid);
}

#[tokio::test]
async fn test_database_connection() {
    use backend::init_database;

    let pool = init_database("sqlite::memory:")
        .await
        .expect("Failed to create test database");

    // Test basic query
    let result = sqlx::query("SELECT 1 as test").fetch_one(&pool).await;

    assert!(result.is_ok());
}
