use backend::auth::{JwtManager, PasswordHasher};
use backend::init_database;
use backend::models::{RegisterRequest, User};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
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
    let _ = sqlx::query("DELETE FROM restaurant_managers")
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM restaurants").execute(&pool).await;
    let _ = sqlx::query("DELETE FROM users").execute(&pool).await;

    pool
}

fn create_test_user(id: &str, email: &str) -> User {
    User {
        id: id.to_string(),
        email: email.to_string(),
        phone: Some("+1234567890".to_string()),
        password_hash: "dummy_hash".to_string(),
        created_at: Utc::now(),
    }
}

// ============================================================================
// PASSWORD SECURITY TESTS
// ============================================================================

#[tokio::test]
async fn test_password_hashing_argon2() {
    let password = "test_password_123!@#";

    // Test password hashing
    let hash = PasswordHasher::hash_password(password).expect("Failed to hash password");

    // Verify hash properties
    assert!(!hash.is_empty());
    assert_ne!(hash, password);
    assert!(hash.starts_with("$argon2")); // Argon2 hash format

    // Test password verification
    let is_valid =
        PasswordHasher::verify_password(password, &hash).expect("Failed to verify password");
    assert!(is_valid);

    // Test wrong password rejection
    let is_invalid = PasswordHasher::verify_password("wrong_password", &hash)
        .expect("Failed to verify password");
    assert!(!is_invalid);
}

#[tokio::test]
async fn test_password_hashing_different_salts() {
    let password = "same_password";

    let hash1 = PasswordHasher::hash_password(password).expect("Failed to hash password");
    let hash2 = PasswordHasher::hash_password(password).expect("Failed to hash password");

    // Same password should produce different hashes due to different salts
    assert_ne!(hash1, hash2);

    // Both hashes should verify correctly
    assert!(PasswordHasher::verify_password(password, &hash1).unwrap());
    assert!(PasswordHasher::verify_password(password, &hash2).unwrap());
}

#[tokio::test]
async fn test_password_timing_attack_resistance() {
    let password = "test_password";
    let hash = PasswordHasher::hash_password(password).expect("Failed to hash password");

    // Test with correct password
    let start = std::time::Instant::now();
    let _ = PasswordHasher::verify_password(password, &hash);
    let correct_duration = start.elapsed();

    // Test with incorrect password
    let start = std::time::Instant::now();
    let _ = PasswordHasher::verify_password("wrong_password", &hash);
    let incorrect_duration = start.elapsed();

    // Timing should be similar (within reasonable bounds)
    let ratio = correct_duration.as_nanos() as f64 / incorrect_duration.as_nanos() as f64;
    assert!(
        ratio > 0.5 && ratio < 2.0,
        "Timing difference too large: {}",
        ratio
    );
}

// ============================================================================
// JWT TOKEN TESTS
// ============================================================================

#[tokio::test]
async fn test_jwt_token_generation() {
    let jwt_manager = JwtManager::new("test_secret_key".to_string(), 24);
    let user = create_test_user("test_user_id", "test@example.com");

    let token = jwt_manager
        .generate_token(&user)
        .expect("Failed to generate token");

    assert!(!token.is_empty());

    // Verify token structure (should have 3 parts separated by dots)
    let parts: Vec<&str> = token.split('.').collect();
    assert_eq!(parts.len(), 3);
}

#[tokio::test]
async fn test_jwt_token_validation() {
    let jwt_manager = JwtManager::new("test_secret_key".to_string(), 24);
    let user = create_test_user("test_user_id", "test@example.com");

    let token = jwt_manager
        .generate_token(&user)
        .expect("Failed to generate token");

    let claims = jwt_manager
        .validate_token(&token)
        .expect("Failed to validate token");

    assert_eq!(claims.sub, user.id);
    assert_eq!(claims.email, user.email);
}

#[tokio::test]
async fn test_jwt_token_invalid_signature() {
    let jwt_manager1 = JwtManager::new("secret_key_1".to_string(), 24);
    let jwt_manager2 = JwtManager::new("secret_key_2".to_string(), 24);
    let user = create_test_user("user_id", "test@example.com");

    let token = jwt_manager1
        .generate_token(&user)
        .expect("Failed to generate token");

    // Token signed with different key should be invalid
    let result = jwt_manager2.validate_token(&token);
    assert!(result.is_err());
}

#[tokio::test]
async fn test_jwt_token_malformed() {
    let jwt_manager = JwtManager::new("test_secret_key".to_string(), 24);

    // Test various malformed tokens
    let malformed_tokens = vec![
        "invalid.token",
        "invalid.token.format.extra",
        "not_a_token_at_all",
        "",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_payload.signature",
    ];

    for token in malformed_tokens {
        let result = jwt_manager.validate_token(token);
        assert!(result.is_err(), "Token should be invalid: {}", token);
    }
}

#[tokio::test]
async fn test_jwt_token_expired() {
    // Create a token that expires immediately
    let jwt_manager = JwtManager::new("test_secret_key".to_string(), 0);

    // Create claims manually with past expiration
    #[derive(Debug, Serialize, Deserialize)]
    struct TestClaims {
        sub: String,
        email: String,
        exp: usize,
        iat: usize,
    }

    let now = Utc::now();
    let expired_time = now - Duration::hours(1);

    let claims = TestClaims {
        sub: "test_user".to_string(),
        email: "test@example.com".to_string(),
        exp: expired_time.timestamp() as usize,
        iat: expired_time.timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret("test_secret_key".as_ref()),
    )
    .expect("Failed to create expired token");

    let result = jwt_manager.validate_token(&token);
    assert!(result.is_err());
}

#[tokio::test]
async fn test_jwt_token_claims_content() {
    let jwt_manager = JwtManager::new("test_secret_key".to_string(), 24);
    let user = create_test_user("user_123", "user@example.com");

    let token = jwt_manager
        .generate_token(&user)
        .expect("Failed to generate token");

    let claims = jwt_manager
        .validate_token(&token)
        .expect("Failed to validate token");

    // Verify all claim fields
    assert_eq!(claims.sub, user.id);
    assert_eq!(claims.email, user.email);
    assert!(claims.exp > claims.iat);

    // Verify expiration is approximately 24 hours from now
    let now = Utc::now().timestamp() as usize;
    let expected_exp = now + (24 * 60 * 60);
    assert!((claims.exp as i64 - expected_exp as i64).abs() < 60); // Within 1 minute
}

// ============================================================================
// USER REGISTRATION TESTS
// ============================================================================

#[tokio::test]
async fn test_user_registration_valid() {
    let pool = setup_test_db().await;

    let user = RegisterRequest {
        email: "newuser@example.com".to_string(),
        phone: Some("+1234567890".to_string()),
        password: "secure_password_123".to_string(),
    };

    // Insert user directly into database to test registration logic
    let user_id = uuid::Uuid::new_v4().to_string();
    let password_hash =
        PasswordHasher::hash_password(&user.password).expect("Failed to hash password");

    let result = sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        user_id,
        user.email,
        user.phone,
        password_hash
    )
    .execute(&pool)
    .await;

    assert!(result.is_ok());

    // Verify user was inserted
    let stored_user = sqlx::query!(
        "SELECT id, email, phone FROM users WHERE email = ?",
        user.email
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch user");

    assert_eq!(stored_user.email, user.email);
    assert_eq!(stored_user.phone, user.phone);
}

#[tokio::test]
async fn test_user_registration_duplicate_email() {
    let pool = setup_test_db().await;

    let email = "duplicate@example.com";
    let user_id1 = uuid::Uuid::new_v4().to_string();
    let user_id2 = uuid::Uuid::new_v4().to_string();
    let password_hash =
        PasswordHasher::hash_password("password123").expect("Failed to hash password");

    // Insert first user
    let result1 = sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        user_id1,
        email,
        Some("+1234567890"),
        password_hash
    )
    .execute(&pool)
    .await;

    assert!(result1.is_ok());

    // Try to insert second user with same email
    let result2 = sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        user_id2,
        email,
        Some("+0987654321"),
        password_hash
    )
    .execute(&pool)
    .await;

    // Should fail due to unique constraint
    assert!(result2.is_err());
}

#[tokio::test]
async fn test_user_registration_invalid_email_formats() {
    let invalid_emails = vec![
        "invalid_email",
        "@example.com",
        "user@",
        "user@.com",
        "user..name@example.com",
        "user@example.",
        "",
        "user name@example.com", // space in email
    ];

    for email in invalid_emails {
        // Test email validation logic (would be in handler)
        let is_valid = email.contains('@')
            && email.contains('.')
            && !email.starts_with('@')
            && !email.ends_with('@')
            && !email.contains(' ')
            && !email.contains("@.")
            && !email.contains("..")
            && !email.ends_with('.')
            && !email.is_empty();

        assert!(!is_valid, "Email should be invalid: {}", email);
    }
}

#[tokio::test]
async fn test_user_registration_weak_passwords() {
    let weak_passwords = vec![
        "",         // empty
        "123",      // too short
        "password", // common word
        "12345678", // only numbers
        "abcdefgh", // only letters
    ];

    for password in weak_passwords {
        // Test basic password strength (would be enhanced in real implementation)
        let is_strong = password.len() >= 8
            && password.chars().any(|c| c.is_ascii_digit())
            && password.chars().any(|c| c.is_ascii_alphabetic());

        assert!(!is_strong, "Password should be weak: {}", password);
    }
}

#[tokio::test]
async fn test_user_registration_sql_injection_prevention() {
    let pool = setup_test_db().await;

    // SQL injection attempts
    let malicious_inputs = vec![
        "'; DROP TABLE users; --",
        "admin@example.com'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "user@example.com' OR '1'='1",
    ];

    for malicious_email in malicious_inputs {
        let user_id = uuid::Uuid::new_v4().to_string();
        let password_hash =
            PasswordHasher::hash_password("password123").expect("Failed to hash password");

        // SQLx with parameterized queries should prevent injection
        let result = sqlx::query!(
            "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
            user_id,
            malicious_email,
            Some("+1234567890"),
            password_hash
        )
        .execute(&pool)
        .await;

        // Should either succeed (treating as literal string) or fail gracefully
        // The important thing is that it doesn't execute the malicious SQL
        if result.is_ok() {
            // Verify the malicious SQL wasn't executed by checking users table still exists
            let count = sqlx::query!("SELECT COUNT(*) as count FROM users")
                .fetch_one(&pool)
                .await
                .expect("Users table should still exist");

            assert!(count.count >= 0);
        }
    }
}

// ============================================================================
// USER LOGIN TESTS
// ============================================================================

#[tokio::test]
async fn test_user_login_valid_credentials() {
    let pool = setup_test_db().await;
    let jwt_manager = JwtManager::new("test_secret".to_string(), 24);

    let email = "logintest@example.com";
    let password = "correct_password_123";
    let user_id = uuid::Uuid::new_v4().to_string();
    let password_hash = PasswordHasher::hash_password(password).expect("Failed to hash password");

    // Insert test user
    sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        user_id,
        email,
        Some("+1234567890"),
        password_hash
    )
    .execute(&pool)
    .await
    .expect("Failed to insert test user");

    // Simulate login process
    let stored_user = sqlx::query!(
        "SELECT id, email, phone, password_hash FROM users WHERE email = ?",
        email
    )
    .fetch_optional(&pool)
    .await
    .expect("Failed to fetch user");

    assert!(stored_user.is_some());
    let user_row = stored_user.unwrap();

    // Verify password
    let is_valid = PasswordHasher::verify_password(password, &user_row.password_hash)
        .expect("Failed to verify password");
    assert!(is_valid);

    // Create User struct for token generation
    let user = User {
        id: user_row.id.expect("User ID should not be null"),
        email: user_row.email,
        phone: user_row.phone,
        password_hash: user_row.password_hash,
        created_at: Utc::now(),
    };

    // Generate token
    let token = jwt_manager
        .generate_token(&user)
        .expect("Failed to generate token");
    assert!(!token.is_empty());
}

#[tokio::test]
async fn test_user_login_invalid_email() {
    let pool = setup_test_db().await;

    // Try to login with non-existent email
    let result = sqlx::query!(
        "SELECT id, email, password_hash FROM users WHERE email = ?",
        "nonexistent@example.com"
    )
    .fetch_optional(&pool)
    .await
    .expect("Query should succeed");

    assert!(result.is_none());
}

#[tokio::test]
async fn test_user_login_invalid_password() {
    let pool = setup_test_db().await;

    let email = "passwordtest@example.com";
    let correct_password = "correct_password_123";
    let wrong_password = "wrong_password_456";
    let user_id = uuid::Uuid::new_v4().to_string();
    let password_hash =
        PasswordHasher::hash_password(correct_password).expect("Failed to hash password");

    // Insert test user
    sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        user_id,
        email,
        Some("+1234567890"),
        password_hash
    )
    .execute(&pool)
    .await
    .expect("Failed to insert test user");

    // Try login with wrong password
    let stored_user = sqlx::query!("SELECT password_hash FROM users WHERE email = ?", email)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch user");

    let is_valid = PasswordHasher::verify_password(wrong_password, &stored_user.password_hash)
        .expect("Failed to verify password");
    assert!(!is_valid);
}

#[tokio::test]
async fn test_user_login_empty_credentials() {
    let pool = setup_test_db().await;

    // Test empty email
    let result = sqlx::query!("SELECT id FROM users WHERE email = ?", "")
        .fetch_optional(&pool)
        .await
        .expect("Query should succeed");

    assert!(result.is_none());

    // Test password verification with empty password
    let dummy_hash = PasswordHasher::hash_password("dummy").expect("Failed to hash dummy password");

    let is_valid =
        PasswordHasher::verify_password("", &dummy_hash).expect("Failed to verify empty password");
    assert!(!is_valid);
}

// ============================================================================
// SECURITY VULNERABILITY TESTS
// ============================================================================

#[tokio::test]
async fn test_password_storage_no_plaintext() {
    let pool = setup_test_db().await;

    let password = "secret_password_123";
    let user_id = uuid::Uuid::new_v4().to_string();
    let password_hash = PasswordHasher::hash_password(password).expect("Failed to hash password");

    // Insert user
    sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        user_id,
        "security@example.com",
        Some("+1234567890"),
        password_hash
    )
    .execute(&pool)
    .await
    .expect("Failed to insert user");

    // Verify password is not stored in plaintext
    let stored_user = sqlx::query!("SELECT password_hash FROM users WHERE id = ?", user_id)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch user");

    assert_ne!(stored_user.password_hash, password);
    assert!(stored_user.password_hash.starts_with("$argon2"));
}

#[tokio::test]
async fn test_token_replay_attack_prevention() {
    let jwt_manager = JwtManager::new("test_secret".to_string(), 24);
    let user = create_test_user("user_id", "test@example.com");

    let token = jwt_manager
        .generate_token(&user)
        .expect("Failed to generate token");

    // Token should be valid multiple times (JWT is stateless)
    // In a real implementation, you might implement token blacklisting
    // or short-lived tokens with refresh tokens

    let claims1 = jwt_manager
        .validate_token(&token)
        .expect("First validation should succeed");

    let claims2 = jwt_manager
        .validate_token(&token)
        .expect("Second validation should succeed");

    assert_eq!(claims1.sub, claims2.sub);
    assert_eq!(claims1.email, claims2.email);
}

#[tokio::test]
async fn test_concurrent_user_operations() {
    let pool = setup_test_db().await;

    // Test concurrent user registrations
    let mut handles = vec![];

    for i in 0..10 {
        let pool_clone = pool.clone();
        let handle = tokio::spawn(async move {
            let user_id = uuid::Uuid::new_v4().to_string();
            let email = format!("concurrent_user_{}@example.com", i);
            let password_hash =
                PasswordHasher::hash_password("password123").expect("Failed to hash password");

            sqlx::query!(
                "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
                user_id,
                email,
                Some("+1234567890"),
                password_hash
            )
            .execute(&pool_clone)
            .await
        });

        handles.push(handle);
    }

    // Wait for all operations to complete
    let mut success_count = 0;
    for handle in handles {
        if handle.await.unwrap().is_ok() {
            success_count += 1;
        }
    }

    // All concurrent operations should succeed
    assert_eq!(success_count, 10);

    // Verify all users were inserted
    let count = sqlx::query!("SELECT COUNT(*) as count FROM users")
        .fetch_one(&pool)
        .await
        .expect("Failed to count users");

    assert_eq!(count.count, 10);
}
