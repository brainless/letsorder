use crate::models::{
    BulkQrCodeRequest, BulkQrCodeResponse, Claims, CreateTableRequest, QrCodeResponse,
    RefreshCodeResponse, UpdateTableRequest,
};
use actix_web::{web, HttpResponse, Result};
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

// Helper function to generate secure unique codes
fn generate_unique_code() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();

    (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

// Helper function to generate QR URL
fn generate_qr_url(restaurant_id: &str, table_code: &str) -> String {
    format!("/m/{restaurant_id}/{table_code}")
}

// Table CRUD Handlers

pub async fn create_table(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
    req: web::Json<CreateTableRequest>,
) -> Result<HttpResponse> {
    let restaurant_id = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {} // User has menu permission
        Ok(_) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Menu management permission required"
            })));
        }
        Err(e) => {
            log::error!("Database error checking menu permission: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Generate unique code (ensure it's unique)
    let mut unique_code = generate_unique_code();
    let mut attempts = 0;

    while attempts < 10 {
        let existing = sqlx::query!(
            "SELECT COUNT(*) as count FROM tables WHERE unique_code = ?",
            unique_code
        )
        .fetch_one(pool.get_ref())
        .await;

        match existing {
            Ok(row) if row.count == 0 => break, // Code is unique
            Ok(_) => {
                unique_code = generate_unique_code();
                attempts += 1;
            }
            Err(e) => {
                log::error!("Database error checking unique code: {e}");
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Internal server error"
                })));
            }
        }
    }

    if attempts >= 10 {
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to generate unique code"
        })));
    }

    let table_id = Uuid::new_v4().to_string();
    let result = sqlx::query!(
        "INSERT INTO tables (id, restaurant_id, name, unique_code) VALUES (?, ?, ?, ?)",
        table_id,
        restaurant_id,
        req.name,
        unique_code
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => {
            // Fetch the created table to return complete data
            let created_table = sqlx::query!(
                "SELECT id, restaurant_id, name, unique_code, created_at FROM tables WHERE id = ?",
                table_id
            )
            .fetch_one(pool.get_ref())
            .await;

            match created_table {
                Ok(table_row) => {
                    Ok(HttpResponse::Created().json(serde_json::json!({
                        "id": table_row.id,
                        "restaurant_id": table_row.restaurant_id,
                        "name": table_row.name,
                        "unique_code": table_row.unique_code,
                        "created_at": table_row.created_at
                    })))
                }
                Err(e) => {
                    log::error!("Database error fetching created table: {e}");
                    Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to fetch created table"
                    })))
                }
            }
        }
        Err(e) => {
            log::error!("Database error creating table: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create table"
            })))
        }
    }
}

pub async fn list_tables(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse> {
    let restaurant_id = path.into_inner();

    // Check if user is a manager of this restaurant
    let manager_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match manager_check {
        Ok(row) if row.count > 0 => {} // User is a manager
        Ok(_) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Access denied"
            })));
        }
        Err(e) => {
            log::error!("Database error checking manager access: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Fetch tables for this restaurant
    let tables = sqlx::query!(
        "SELECT id, restaurant_id, name, unique_code, created_at FROM tables WHERE restaurant_id = ? ORDER BY created_at DESC",
        restaurant_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match tables {
        Ok(table_rows) => {
            let tables_json: Vec<serde_json::Value> = table_rows
                .into_iter()
                .map(|row| {
                    serde_json::json!({
                        "id": row.id,
                        "restaurant_id": row.restaurant_id,
                        "name": row.name,
                        "unique_code": row.unique_code,
                        "created_at": row.created_at
                    })
                })
                .collect();

            Ok(HttpResponse::Ok().json(tables_json))
        }
        Err(e) => {
            log::error!("Database error fetching tables: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch tables"
            })))
        }
    }
}

pub async fn update_table(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
    req: web::Json<UpdateTableRequest>,
) -> Result<HttpResponse> {
    let (restaurant_id, table_id) = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {} // User has menu permission
        Ok(_) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Menu management permission required"
            })));
        }
        Err(e) => {
            log::error!("Database error checking menu permission: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Only name can be updated for now
    if let Some(ref name) = req.name {
        let result = sqlx::query!(
            "UPDATE tables SET name = ? WHERE id = ? AND restaurant_id = ?",
            name,
            table_id,
            restaurant_id
        )
        .execute(pool.get_ref())
        .await;

        match result {
            Ok(result) => {
                if result.rows_affected() == 0 {
                    Ok(HttpResponse::NotFound().json(serde_json::json!({
                        "error": "Table not found"
                    })))
                } else {
                    // Return success response
                    Ok(HttpResponse::Ok().json(serde_json::json!({
                        "message": "Table updated successfully",
                        "table_id": table_id
                    })))
                }
            }
            Err(e) => {
                log::error!("Database error updating table: {e}");
                Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to update table"
                })))
            }
        }
    } else {
        Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No fields to update"
        })))
    }
}

pub async fn delete_table(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse> {
    let (restaurant_id, table_id) = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {} // User has menu permission
        Ok(_) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Menu management permission required"
            })));
        }
        Err(e) => {
            log::error!("Database error checking menu permission: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    let result = sqlx::query!(
        "DELETE FROM tables WHERE id = ? AND restaurant_id = ?",
        table_id,
        restaurant_id
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Table not found"
                })))
            } else {
                Ok(HttpResponse::Ok().json(serde_json::json!({
                    "message": "Table deleted successfully"
                })))
            }
        }
        Err(e) => {
            log::error!("Database error deleting table: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete table"
            })))
        }
    }
}

// QR Code Handlers

pub async fn get_table_qr_url(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse> {
    let (restaurant_id, table_id) = path.into_inner();

    // Check if user is a manager of this restaurant
    let manager_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match manager_check {
        Ok(row) if row.count > 0 => {} // User is a manager
        Ok(_) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Access denied"
            })));
        }
        Err(e) => {
            log::error!("Database error checking manager access: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Fetch the actual table data
    let table = sqlx::query!(
        "SELECT id, name, unique_code FROM tables WHERE id = ? AND restaurant_id = ?",
        table_id,
        restaurant_id
    )
    .fetch_one(pool.get_ref())
    .await;

    match table {
        Ok(table_row) => {
            let qr_url = generate_qr_url(&restaurant_id, &table_row.unique_code);
            let response = QrCodeResponse {
                qr_url,
                table_name: table_row.name,
                unique_code: table_row.unique_code,
            };
            Ok(HttpResponse::Ok().json(response))
        }
        Err(sqlx::Error::RowNotFound) => {
            Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Table not found"
            })))
        }
        Err(e) => {
            log::error!("Database error fetching table: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch table data"
            })))
        }
    }
}

pub async fn refresh_table_code(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse> {
    let (restaurant_id, table_id) = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {} // User has menu permission
        Ok(_) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Menu management permission required"
            })));
        }
        Err(e) => {
            log::error!("Database error checking menu permission: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Generate new unique code
    let mut new_unique_code = generate_unique_code();
    let mut attempts = 0;

    while attempts < 10 {
        let existing = sqlx::query!(
            "SELECT COUNT(*) as count FROM tables WHERE unique_code = ?",
            new_unique_code
        )
        .fetch_one(pool.get_ref())
        .await;

        match existing {
            Ok(row) if row.count == 0 => break, // Code is unique
            Ok(_) => {
                new_unique_code = generate_unique_code();
                attempts += 1;
            }
            Err(e) => {
                log::error!("Database error checking unique code: {e}");
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Internal server error"
                })));
            }
        }
    }

    if attempts >= 10 {
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to generate unique code"
        })));
    }

    // Update table with new code
    let result = sqlx::query!(
        "UPDATE tables SET unique_code = ? WHERE id = ? AND restaurant_id = ?",
        new_unique_code,
        table_id,
        restaurant_id
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Table not found"
                })))
            } else {
                let qr_url = generate_qr_url(&restaurant_id, &new_unique_code);
                let response = RefreshCodeResponse {
                    table_id,
                    new_unique_code,
                    qr_url,
                };
                Ok(HttpResponse::Ok().json(response))
            }
        }
        Err(e) => {
            log::error!("Database error updating table code: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to refresh table code"
            })))
        }
    }
}

pub async fn bulk_qr_codes(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
    req: web::Json<BulkQrCodeRequest>,
) -> Result<HttpResponse> {
    let restaurant_id = path.into_inner();

    // Check if user is a manager of this restaurant
    let manager_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match manager_check {
        Ok(row) if row.count > 0 => {} // User is a manager
        Ok(_) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Access denied"
            })));
        }
        Err(e) => {
            log::error!("Database error checking manager access: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    let mut qr_codes = Vec::new();

    // Generate sample QR codes for now
    for (i, _table_id) in req.table_ids.iter().enumerate() {
        let sample_code = format!("SAMPLE{:03}", i + 1);
        let qr_url = generate_qr_url(&restaurant_id, &sample_code);
        qr_codes.push(QrCodeResponse {
            qr_url,
            table_name: format!("Table {}", i + 1),
            unique_code: sample_code,
        });
    }

    let response = BulkQrCodeResponse { qr_codes };
    Ok(HttpResponse::Ok().json(response))
}
