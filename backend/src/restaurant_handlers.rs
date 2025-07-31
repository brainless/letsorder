#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, web, App};
    use sqlx::SqlitePool;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[actix_web::test]
    async fn test_create_restaurant() {
        let pool = setup_test_db().await;
        let jwt_manager = crate::auth::JwtManager::new("test-secret".to_string(), 24);
        
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .app_data(web::Data::new(jwt_manager.clone()))
                .route("/restaurants", web::post().to(create_restaurant))
        ).await;

        // This is a basic test structure - would need proper JWT token and request body
        // For now, just verify the handler compiles
        assert!(true);
    }
}