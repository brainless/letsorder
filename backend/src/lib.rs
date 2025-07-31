use actix_web::{web, App, HttpResponse, HttpServer, Result};
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};

pub mod models;
pub mod seed;

#[derive(Debug, Deserialize)]
pub struct Settings {
    pub server: ServerSettings,
    pub database: DatabaseSettings,
    pub litestream: Option<LitestreamSettings>,
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
) -> App<
    impl actix_web::dev::ServiceFactory<
        actix_web::dev::ServiceRequest,
        Config = (),
        Response = actix_web::dev::ServiceResponse,
        Error = actix_web::Error,
        InitError = (),
    >,
> {
    App::new()
        .app_data(web::Data::new(pool))
        .route("/health", web::get().to(health))
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

    let bind_address = format!("{}:{}", settings.server.host, settings.server.port);
    info!("Starting server at http://{bind_address}");

    HttpServer::new(move || create_app(pool.clone()))
        .bind(&bind_address)?
        .run()
        .await
}
