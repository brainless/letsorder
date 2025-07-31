use actix_web::{web, App, HttpResponse, HttpServer, Result};
use log::info;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct Settings {
    pub server: ServerSettings,
}

#[derive(Debug, Deserialize)]
pub struct ServerSettings {
    pub host: String,
    pub port: u16,
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
        }
    }
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    timestamp: String,
}

pub async fn health() -> Result<HttpResponse> {
    let response = HealthResponse {
        status: "OK".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    
    Ok(HttpResponse::Ok().json(response))
}

pub fn create_app() -> App<impl actix_web::dev::ServiceFactory<
    actix_web::dev::ServiceRequest,
    Config = (),
    Response = actix_web::dev::ServiceResponse,
    Error = actix_web::Error,
    InitError = (),
>> {
    App::new()
        .route("/health", web::get().to(health))
}

pub async fn run_server() -> std::io::Result<()> {
    env_logger::init();
    
    let settings = Settings::new().unwrap_or_else(|_| {
        info!("Could not load settings file, using defaults");
        Settings::default()
    });
    
    let bind_address = format!("{}:{}", settings.server.host, settings.server.port);
    info!("Starting server at http://{bind_address}");
    
    HttpServer::new(create_app)
        .bind(&bind_address)?
        .run()
        .await
}