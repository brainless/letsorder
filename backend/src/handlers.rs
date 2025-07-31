use crate::auth::{JwtManager, PasswordHasher};
use crate::models::{AuthResponse, LoginRequest, RegisterRequest, User, UserResponse, UserRow};
use actix_web::{web, HttpResponse, Result};
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

pub async fn register(
    pool: web::Data<Pool<Sqlite>>,
    jwt_manager: web::Data<JwtManager>,
    req: web::Json<RegisterRequest>,
) -> Result<HttpResponse> {
    // Check if user already exists
    let existing_user = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, phone, password_hash, created_at FROM users WHERE email = ?"
    )
    .bind(&req.email)
    .fetch_optional(pool.get_ref())
    .await;

    match existing_user {
        Ok(Some(_)) => {
            return Ok(HttpResponse::Conflict().json(serde_json::json!({
                "error": "User with this email already exists"
            })));
        }
        Ok(None) => {}
        Err(e) => {
            log::error!("Database error during user lookup: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Hash the password
    let password_hash = match PasswordHasher::hash_password(&req.password) {
        Ok(hash) => hash,
        Err(e) => {
            log::error!("Password hashing error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    // Create new user
    let user_id = Uuid::new_v4().to_string();
    let result = sqlx::query!(
        "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        user_id,
        req.email,
        req.phone,
        password_hash
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => {
            // Fetch the created user
            let user_row = sqlx::query_as::<_, UserRow>(
                "SELECT id, email, phone, password_hash, created_at FROM users WHERE id = ?"
            )
            .bind(&user_id)
            .fetch_one(pool.get_ref())
            .await;

            match user_row {
                Ok(user_row) => {
                    let user = User::from(user_row);
                    // Generate JWT token
                    match jwt_manager.generate_token(&user) {
                        Ok(token) => {
                            let response = AuthResponse {
                                token,
                                user: UserResponse::from(user),
                            };
                            Ok(HttpResponse::Created().json(response))
                        }
                        Err(e) => {
                            log::error!("JWT generation error: {}", e);
                            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                                "error": "Internal server error"
                            })))
                        }
                    }
                }
                Err(e) => {
                    log::error!("Database error fetching created user: {}", e);
                    Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Internal server error"
                    })))
                }
            }
        }
        Err(e) => {
            log::error!("Database error creating user: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })))
        }
    }
}

pub async fn login(
    pool: web::Data<Pool<Sqlite>>,
    jwt_manager: web::Data<JwtManager>,
    req: web::Json<LoginRequest>,
) -> Result<HttpResponse> {
    // Find user by email
    let user_row = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, phone, password_hash, created_at FROM users WHERE email = ?"
    )
    .bind(&req.email)
    .fetch_optional(pool.get_ref())
    .await;

    match user_row {
        Ok(Some(user_row)) => {
            let user = User::from(user_row);
            // Verify password
            match PasswordHasher::verify_password(&req.password, &user.password_hash) {
                Ok(true) => {
                    // Generate JWT token
                    match jwt_manager.generate_token(&user) {
                        Ok(token) => {
                            let response = AuthResponse {
                                token,
                                user: UserResponse::from(user),
                            };
                            Ok(HttpResponse::Ok().json(response))
                        }
                        Err(e) => {
                            log::error!("JWT generation error: {}", e);
                            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                                "error": "Internal server error"
                            })))
                        }
                    }
                }
                Ok(false) => Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                    "error": "Invalid credentials"
                }))),
                Err(e) => {
                    log::error!("Password verification error: {}", e);
                    Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Internal server error"
                    })))
                }
            }
        }
        Ok(None) => Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid credentials"
        }))),
        Err(e) => {
            log::error!("Database error during login: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })))
        }
    }
}

pub async fn protected_test(claims: web::ReqData<crate::models::Claims>) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "This is a protected endpoint",
        "user_id": claims.sub,
        "email": claims.email
    })))
}
