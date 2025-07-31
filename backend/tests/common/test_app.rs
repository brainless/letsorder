use actix_web::{test, web, App};
use backend::{auth::JwtManager, init_database, seed_database_if_empty};
use sqlx::{Pool, Sqlite};
use std::sync::Once;

static INIT: Once = Once::new();

pub struct TestApp {
    pub pool: Pool<Sqlite>,
    pub jwt_manager: JwtManager,
}

impl TestApp {
    pub async fn new() -> Self {
        INIT.call_once(|| {
            env_logger::init();
        });

        // Create in-memory SQLite database for testing
        let pool = init_database("sqlite::memory:")
            .await
            .expect("Failed to create test database");

        // Seed the test database with initial data
        seed_database_if_empty(&pool)
            .await
            .expect("Failed to seed test database");

        let jwt_manager = JwtManager::new(
            "test-secret-key-for-testing-only".to_string(),
            24, // 24 hours expiration
        );

        Self { pool, jwt_manager }
    }

    pub async fn cleanup(&self) {
        // Clean up test data between tests
        let _ = sqlx::query("DELETE FROM orders").execute(&self.pool).await;
        let _ = sqlx::query("DELETE FROM menu_items").execute(&self.pool).await;
        let _ = sqlx::query("DELETE FROM menu_sections").execute(&self.pool).await;
        let _ = sqlx::query("DELETE FROM tables").execute(&self.pool).await;
        let _ = sqlx::query("DELETE FROM restaurant_managers").execute(&self.pool).await;
        let _ = sqlx::query("DELETE FROM manager_invites").execute(&self.pool).await;
        let _ = sqlx::query("DELETE FROM restaurants").execute(&self.pool).await;
        let _ = sqlx::query("DELETE FROM users").execute(&self.pool).await;

        // Re-seed with fresh test data
        let _ = seed_database_if_empty(&self.pool).await;
    }
}

pub async fn create_test_app() -> TestApp {
    TestApp::new().await
}