use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Result};
use actix_web_httpauth::middleware::HttpAuthentication;
use auth::JwtManager;
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};

pub mod auth;
pub mod handlers;
pub mod menu_handlers;
pub mod models;
pub mod order_handlers;
pub mod qr_handlers;
pub mod seed;
pub mod table_handlers;

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
        Response = actix_web::dev::ServiceResponse<
            actix_web::body::EitherBody<actix_web::body::BoxBody>,
        >,
        Error = actix_web::Error,
        InitError = (),
    >,
> {
    let auth_middleware = HttpAuthentication::bearer(auth::jwt_validator);

    App::new()
        .wrap(
            Cors::default()
                .allowed_origin("http://localhost:3000")
                .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
                .allowed_headers(vec!["Content-Type", "Authorization"])
                .max_age(3600),
        )
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
                .route(
                    "/restaurants/{id}",
                    web::put().to(handlers::update_restaurant),
                )
                .route(
                    "/restaurants/{id}",
                    web::delete().to(handlers::delete_restaurant),
                )
                // Manager management routes
                .route(
                    "/restaurants/{id}/managers/invite",
                    web::post().to(handlers::invite_manager),
                )
                .route(
                    "/restaurants/{id}/managers",
                    web::get().to(handlers::list_managers),
                )
                .route(
                    "/restaurants/{id}/managers/{user_id}",
                    web::delete().to(handlers::remove_manager),
                )
                .route(
                    "/restaurants/{id}/managers/{user_id}",
                    web::put().to(handlers::update_manager_permissions),
                )
                // Menu section routes
                .route(
                    "/restaurants/{id}/menu/sections",
                    web::post().to(menu_handlers::create_menu_section),
                )
                .route(
                    "/restaurants/{id}/menu/sections",
                    web::get().to(menu_handlers::list_menu_sections),
                )
                // Menu management route
                .route(
                    "/restaurants/{id}/menu",
                    web::get().to(menu_handlers::get_restaurant_menu),
                )
                // Menu item CRUD routes
                .route(
                    "/sections/{id}/items",
                    web::post().to(menu_handlers::create_menu_item),
                )
                .route(
                    "/items/{id}",
                    web::put().to(menu_handlers::update_menu_item),
                )
                .route(
                    "/items/{id}",
                    web::delete().to(menu_handlers::delete_menu_item),
                )
                .route(
                    "/items/{id}/availability",
                    web::put().to(menu_handlers::toggle_menu_item_availability),
                )
                .route(
                    "/items/reorder",
                    web::post().to(menu_handlers::reorder_menu_items),
                )
                // Table management routes
                .route(
                    "/restaurants/{id}/tables",
                    web::post().to(table_handlers::create_table),
                )
                .route(
                    "/restaurants/{id}/tables",
                    web::get().to(table_handlers::list_tables),
                )
                .route(
                    "/restaurants/{id}/tables/{table_id}",
                    web::put().to(table_handlers::update_table),
                )
                .route(
                    "/restaurants/{id}/tables/{table_id}",
                    web::delete().to(table_handlers::delete_table),
                )
                .route(
                    "/restaurants/{id}/tables/{table_id}/refresh-code",
                    web::post().to(table_handlers::refresh_table_code),
                )
                // QR code routes
                .route(
                    "/restaurants/{id}/tables/{table_id}/qr-url",
                    web::get().to(table_handlers::get_table_qr_url),
                )
                .route(
                    "/restaurants/{id}/qr-codes/generate",
                    web::post().to(qr_handlers::generate_single_qr_code),
                )
                .route(
                    "/restaurants/{id}/qr-codes/bulk",
                    web::post().to(qr_handlers::generate_bulk_qr_codes),
                )
                .route(
                    "/restaurants/{id}/qr-codes/print-sheet",
                    web::get().to(qr_handlers::generate_print_sheet),
                )
                // Order management routes (authenticated)
                .route(
                    "/restaurants/{id}/orders",
                    web::get().to(order_handlers::list_restaurant_orders),
                )
                .route(
                    "/restaurants/{id}/orders/today",
                    web::get().to(order_handlers::list_today_orders),
                )
                .route(
                    "/restaurants/{id}/tables/{table_id}/orders",
                    web::get().to(order_handlers::list_table_orders),
                ),
        )
        // Public routes for joining restaurant
        .route(
            "/restaurants/{id}/managers/join/{token}",
            web::post().to(handlers::join_restaurant),
        )
        // Public menu access
        .route(
            "/menu/{restaurant_code}/{table_code}",
            web::get().to(menu_handlers::get_public_menu),
        )
        // Public order routes (no auth required)
        .route("/orders", web::post().to(order_handlers::create_order))
        .route(
            "/orders/{order_id}",
            web::get().to(order_handlers::get_order),
        )
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
        log::warn!("Failed to seed database: {e}");
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
