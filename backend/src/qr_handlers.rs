use crate::models::{BulkQrCodeRequest, BulkQrCodeResponse, Claims};
use actix_web::{web, HttpResponse, Result};
use base64::{engine::general_purpose, Engine as _};
use qrcode::QrCode;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateQrCodeRequest {
    pub table_id: String,
    pub format: Option<String>, // "png" or "svg", defaults to "png"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrCodeImageResponse {
    pub table_id: String,
    pub table_name: String,
    pub unique_code: String,
    pub qr_url: String,
    pub qr_image_base64: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintSheetResponse {
    pub restaurant_name: String,
    pub qr_codes: Vec<QrCodeImageResponse>,
    pub html_content: String,
}

// Helper function to get full domain URL (in production this would come from config)
fn get_base_url() -> String {
    // TODO: This should come from configuration
    "https://yourdomain.com".to_string()
}

// Helper function to generate QR URL
fn generate_qr_url(restaurant_code: &str, table_code: &str) -> String {
    format!("{}/m/{}-{}", get_base_url(), restaurant_code, table_code)
}

// Helper function to generate QR code as PNG base64
fn generate_qr_code_png(url: &str) -> Result<String, Box<dyn std::error::Error>> {
    let code = QrCode::new(url)?;
    let image = code
        .render::<qrcode::render::unicode::Dense1x2>()
        .min_dimensions(200, 200)
        .max_dimensions(400, 400)
        .build();

    // For now, return a simple base64 encoded string representation
    // In a real implementation, you'd want to generate actual PNG bytes
    let qr_string = format!("QR Code for: {}", url);
    Ok(general_purpose::STANDARD.encode(qr_string.as_bytes()))
}

// Helper function to generate QR code as SVG
fn generate_qr_code_svg(url: &str) -> Result<String, Box<dyn std::error::Error>> {
    let code = QrCode::new(url)?;
    let svg_string = code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(200, 200)
        .max_dimensions(400, 400)
        .build();

    Ok(general_purpose::STANDARD.encode(svg_string.as_bytes()))
}

pub async fn generate_single_qr_code(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
    req: web::Json<GenerateQrCodeRequest>,
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
            log::error!("Database error checking manager access: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Get table information
    let table_result = sqlx::query!(
        "SELECT t.id, t.name, t.unique_code, r.id as restaurant_code 
         FROM tables t 
         JOIN restaurants r ON t.restaurant_id = r.id 
         WHERE t.id = ? AND t.restaurant_id = ?",
        req.table_id,
        restaurant_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match table_result {
        Ok(Some(table)) => {
            let restaurant_code = table
                .restaurant_code
                .unwrap_or_else(|| restaurant_id.clone());
            let table_id = table.id.unwrap_or_else(|| req.table_id.clone());
            let table_name = table.name;
            let unique_code = table.unique_code;

            let qr_url = generate_qr_url(&restaurant_code, &unique_code);
            let format = req.format.as_deref().unwrap_or("png");

            let qr_image_base64 = match format {
                "svg" => match generate_qr_code_svg(&qr_url) {
                    Ok(svg) => svg,
                    Err(e) => {
                        log::error!("Error generating SVG QR code: {}", e);
                        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                            "error": "Failed to generate QR code"
                        })));
                    }
                },
                _ => match generate_qr_code_png(&qr_url) {
                    Ok(png) => png,
                    Err(e) => {
                        log::error!("Error generating PNG QR code: {}", e);
                        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                            "error": "Failed to generate QR code"
                        })));
                    }
                },
            };

            let response = QrCodeImageResponse {
                table_id,
                table_name,
                unique_code,
                qr_url,
                qr_image_base64,
                format: format.to_string(),
            };

            Ok(HttpResponse::Ok().json(response))
        }
        Ok(None) => Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Table not found"
        }))),
        Err(e) => {
            log::error!("Database error fetching table: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })))
        }
    }
}

pub async fn generate_bulk_qr_codes(
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
            log::error!("Database error checking manager access: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    let mut qr_codes = Vec::new();

    // Get restaurant code for URL generation
    let restaurant_result = sqlx::query!("SELECT id FROM restaurants WHERE id = ?", restaurant_id)
        .fetch_optional(pool.get_ref())
        .await;

    let restaurant_code = match restaurant_result {
        Ok(Some(restaurant)) => restaurant.id,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Restaurant not found"
            })));
        }
        Err(e) => {
            log::error!("Database error fetching restaurant: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    // Generate QR codes for each table
    for table_id in &req.table_ids {
        let table_result = sqlx::query!(
            "SELECT id, name, unique_code FROM tables WHERE id = ? AND restaurant_id = ?",
            table_id,
            restaurant_id
        )
        .fetch_optional(pool.get_ref())
        .await;

        match table_result {
            Ok(Some(table)) => {
                let table_id_str = table.id.unwrap_or_else(|| table_id.clone());
                let table_name = table.name;
                let unique_code = table.unique_code;

                let qr_url = generate_qr_url(
                    restaurant_code.as_ref().unwrap_or(&restaurant_id),
                    &unique_code,
                );

                match generate_qr_code_png(&qr_url) {
                    Ok(qr_image_base64) => {
                        qr_codes.push(QrCodeImageResponse {
                            table_id: table_id_str,
                            table_name,
                            unique_code,
                            qr_url,
                            qr_image_base64,
                            format: "png".to_string(),
                        });
                    }
                    Err(e) => {
                        log::error!("Error generating QR code for table {}: {}", table_id, e);
                        // Continue with other tables instead of failing completely
                    }
                }
            }
            Ok(None) => {
                log::warn!("Table {} not found", table_id);
                // Continue with other tables
            }
            Err(e) => {
                log::error!("Database error fetching table {}: {}", table_id, e);
                // Continue with other tables
            }
        }
    }

    // Convert QrCodeImageResponse to QrCodeResponse for compatibility
    let qr_codes_response: Vec<crate::models::QrCodeResponse> = qr_codes
        .into_iter()
        .map(|qr| crate::models::QrCodeResponse {
            qr_url: qr.qr_url,
            table_name: qr.table_name,
            unique_code: qr.unique_code,
        })
        .collect();

    let response = BulkQrCodeResponse {
        qr_codes: qr_codes_response,
    };
    Ok(HttpResponse::Ok().json(response))
}

pub async fn generate_print_sheet(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
    query: web::Query<BulkQrCodeRequest>,
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
            log::error!("Database error checking manager access: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Get restaurant information
    let restaurant_result =
        sqlx::query!("SELECT name FROM restaurants WHERE id = ?", restaurant_id)
            .fetch_optional(pool.get_ref())
            .await;

    let restaurant_name = match restaurant_result {
        Ok(Some(restaurant)) => restaurant.name,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Restaurant not found"
            })));
        }
        Err(e) => {
            log::error!("Database error fetching restaurant: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    let mut qr_codes = Vec::new();

    // Generate QR codes for each table
    for table_id in &query.table_ids {
        let table_result = sqlx::query!(
            "SELECT id, name, unique_code FROM tables WHERE id = ? AND restaurant_id = ?",
            table_id,
            restaurant_id
        )
        .fetch_optional(pool.get_ref())
        .await;

        match table_result {
            Ok(Some(table)) => {
                let table_id_str = table.id.unwrap_or_else(|| table_id.clone());
                let table_name = table.name;
                let unique_code = table.unique_code;

                let qr_url = generate_qr_url(&restaurant_id, &unique_code);

                match generate_qr_code_png(&qr_url) {
                    Ok(qr_image_base64) => {
                        qr_codes.push(QrCodeImageResponse {
                            table_id: table_id_str,
                            table_name,
                            unique_code,
                            qr_url,
                            qr_image_base64,
                            format: "png".to_string(),
                        });
                    }
                    Err(e) => {
                        log::error!("Error generating QR code for table {}: {}", table_id, e);
                    }
                }
            }
            Ok(None) => {
                log::warn!("Table {} not found", table_id);
            }
            Err(e) => {
                log::error!("Database error fetching table {}: {}", table_id, e);
            }
        }
    }

    // Generate HTML content for printing
    let mut html_content = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <title>QR Codes - {}</title>
    <style>
        @media print {{
            body {{ margin: 0; }}
            .page-break {{ page-break-after: always; }}
        }}
        body {{
            font-family: Arial, sans-serif;
            margin: 20px;
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .qr-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 30px;
            margin-bottom: 30px;
        }}
        .qr-item {{
            text-align: center;
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 8px;
        }}
        .qr-code {{
            margin-bottom: 15px;
        }}
        .table-name {{
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
        }}
        .table-code {{
            font-size: 14px;
            color: #666;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{}</h1>
        <h2>Table QR Codes</h2>
    </div>
    <div class="qr-grid">"#,
        restaurant_name, restaurant_name
    );

    for qr_code in &qr_codes {
        html_content.push_str(&format!(
            r#"
        <div class="qr-item">
            <div class="qr-code">
                <img src="data:image/png;base64,{}" alt="QR Code for {}" style="width: 150px; height: 150px;">
            </div>
            <div class="table-name">{}</div>
            <div class="table-code">Code: {}</div>
        </div>"#,
            qr_code.qr_image_base64, qr_code.table_name, qr_code.table_name, qr_code.unique_code
        ));
    }

    html_content.push_str(
        r#"
    </div>
</body>
</html>"#,
    );

    let response = PrintSheetResponse {
        restaurant_name,
        qr_codes,
        html_content,
    };

    Ok(HttpResponse::Ok().json(response))
}
