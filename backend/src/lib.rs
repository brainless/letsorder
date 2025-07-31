use actix_web::{web, App, HttpResponse, HttpServer, Result};
use actix_web_httpauth::middleware::HttpAuthentication;
use auth::JwtManager;
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};

pub mod auth;
pub mod handlers;
pub mod models;
pub mod seed;

#[derive(Debug, Deserialize)]
pub struct Settings {
    pub server: ServerSettings,
    pub database: DatabaseSettings,
    pub litestream: Option<LitestreamSettings>,
    pub jwt: JwtSettings,
}

#[derive(Debug, Deserialize)]
pub struct ServerSettings {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Deserialize)]
pub struct DatabaseSettings {
    pub url: String,
    pub max_connections: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct LitestreamSettings {
    pub replica_url: String,
    pub sync_interval: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct JwtSettings {
    pub secret: String,
    pub expiration_hours: u64,
}

impl Settings {
    pub fn new() -> Result<Self, config::ConfigError> {
        let settings = config::Config::builder()
            .add_source(config::File::with_name("settings").required(false))
            .add_source(config::File::with_name("local.settings").required(false))
            .build()?;

        settings.try_deserialize()
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            server: ServerSettings {
                host: "127.0.0.1".to_string(),
                port: 8080,
            },
            database: DatabaseSettings {
                url: "sqlite:./letsorder.db".to_string(),
                max_connections: Some(10),
            },
            litestream: None,
            jwt: JwtSettings {
                secret: "default-secret-change-in-production".to_string(),
                expiration_hours: 24,
            },
        }
    }
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    timestamp: String,
}

pub async fn init_database(database_url: &str) -> Result<Pool<Sqlite>, sqlx::Error> {
    let pool = sqlx::SqlitePool::connect(database_url).await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

pub async fn seed_database_if_empty(pool: &Pool<Sqlite>) -> Result<(), sqlx::Error> {
    // Check if database is empty by counting users
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    if user_count == 0 {
        info!("Database is empty, seeding with development data...");
        seed::seed_database(pool).await?;
    }

    Ok(())
}

pub async fn health() -> Result<HttpResponse> {
    let response = HealthResponse {
        status: "OK".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    Ok(HttpResponse::Ok().json(response))
}

pub fn create_app(
    pool: Pool<Sqlite>,
    jwt_manager: JwtManager,
) -> App<
    impl actix_web::dev::ServiceFactory<
        actix_web::dev::ServiceRequest,
        Config = (),
        Response = actix_web::dev::ServiceResponse,
        Error = actix_web::Error,
        InitError = (),
    >,
> {
    let auth_middleware = HttpAuthentication::bearer(auth::jwt_validator);

    App::new()
        .app_data(web::Data::new(pool))
        .app_data(web::Data::new(jwt_manager))
        .route("/health", web::get().to(health))
        .service(
            web::scope("/auth")
                .route("/register", web::post().to(handlers::register))
                .route("/login", web::post().to(handlers::login)),
        )
        .service(
            web::scope("/api")
                .wrap(auth_middleware)
                .route("/test", web::get().to(handlers::protected_test))
                // Restaurant CRUD routes
                .route("/restaurants", web::post().to(handlers::create_restaurant))
                .route("/restaurants/{id}", web::get().to(handlers::get_restaurant))
                .route("/restaurants/{id}", web::put().to(handlers::update_restaurant))
                .route("/restaurants/{id}", web::delete().to(handlers::delete_restaurant))
                // Manager management routes
                .route("/restaurants/{id}/managers/invite", web::post().to(handlers::invite_manager))
                .route("/restaurants/{id}/managers", web::get().to(handlers::list_managers))
                .route("/restaurants/{id}/managers/{user_id}", web::delete().to(handlers::remove_manager))
                .route("/restaurants/{id}/managers/{user_id}", web::put().to(handlers::update_manager_permissions)),
        )
        // Public routes for joining restaurant
        .route("/restaurants/{id}/managers/join/{token}", web::post().to(handlers::join_restaurant))
}

pub async fn run_server() -> std::io::Result<()> {
    env_logger::init();

    let settings = Settings::new().unwrap_or_else(|_| {
        info!("Could not load settings file, using defaults");
        Settings::default()
    });

    // Initialize database
    let pool = init_database(&settings.database.url)
        .await
        .expect("Failed to initialize database");

    info!("Database initialized successfully");

    // Seed database if empty (development only)
    if let Err(e) = seed_database_if_empty(&pool).await {
        log::warn!("Failed to seed database: {}", e);
    }

    // Initialize JWT manager
    let jwt_manager = JwtManager::new(settings.jwt.secret.clone(), settings.jwt.expiration_hours);

    let bind_address = format!("{}:{}", settings.server.host, settings.server.port);
    info!("Starting server at http://{bind_address}");

    HttpServer::new(move || create_app(pool.clone(), jwt_manager.clone()))
        .bind(&bind_address)?
        .run()
        .await
}
