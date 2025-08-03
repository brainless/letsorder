use crate::models::{Claims, CreateMenuSectionRequest, PublicMenu, PublicRestaurantInfo, RestaurantMenu, MenuSectionWithItems, MenuItem, MenuSection};
use actix_web::{web, HttpResponse, Result};
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

// Menu Section Handlers

pub async fn create_menu_section(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
    req: web::Json<CreateMenuSectionRequest>,
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
            log::error!("Database error checking menu permission: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Get next display order if not provided
    let display_order = match req.display_order {
        Some(order) => order as i64,
        None => {
            let max_order = sqlx::query!(
                "SELECT COALESCE(MAX(display_order), 0) as max_order FROM menu_sections WHERE restaurant_id = ?",
                restaurant_id
            )
            .fetch_one(pool.get_ref())
            .await;

            (match max_order {
                Ok(row) => row.max_order + 1,
                Err(_) => 1,
            }) as i64
        }
    };

    let section_id = Uuid::new_v4().to_string();
    let result = sqlx::query!(
        "INSERT INTO menu_sections (id, restaurant_id, name, display_order) VALUES (?, ?, ?, ?)",
        section_id,
        restaurant_id,
        req.name,
        display_order
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => {
            // Return success response
            Ok(HttpResponse::Created().json(serde_json::json!({
                "message": "Menu section created successfully",
                "section_id": section_id
            })))
        }
        Err(e) => {
            log::error!("Database error creating menu section: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create menu section"
            })))
        }
    }
}

pub async fn list_menu_sections(
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
            log::error!("Database error checking manager access: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Return simple response for now
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Menu sections listed successfully",
        "restaurant_id": restaurant_id
    })))
}

pub async fn get_restaurant_menu(
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
            log::error!("Database error checking manager access: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Fetch menu sections
    let sections_result = sqlx::query_as::<_, crate::models::MenuSectionRow>(
        "SELECT id, restaurant_id, name, display_order, created_at 
         FROM menu_sections 
         WHERE restaurant_id = ? 
         ORDER BY display_order ASC",
    )
    .bind(restaurant_id.clone())
    .fetch_all(pool.get_ref())
    .await;

    let sections = match sections_result {
        Ok(rows) => rows.into_iter().map(MenuSection::from).collect::<Vec<_>>(),
        Err(e) => {
            log::error!("Database error fetching menu sections: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    // Fetch menu items for all sections
    let mut sections_with_items = Vec::new();
    
    for section in sections {
        let items_result = sqlx::query_as::<_, crate::models::MenuItemRow>(
            "SELECT id, section_id, name, description, price, available, display_order, created_at 
             FROM menu_items 
             WHERE section_id = ? 
             ORDER BY display_order ASC",
        )
        .bind(&section.id)
        .fetch_all(pool.get_ref())
        .await;

        let items = match items_result {
            Ok(rows) => rows.into_iter().map(MenuItem::from).collect(),
            Err(e) => {
                log::error!("Database error fetching menu items for section {}: {}", section.id, e);
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Internal server error"
                })));
            }
        };

        sections_with_items.push(MenuSectionWithItems {
            id: section.id,
            restaurant_id: section.restaurant_id,
            name: section.name,
            display_order: section.display_order,
            created_at: section.created_at,
            items,
        });
    }

    let restaurant_menu = RestaurantMenu {
        restaurant_id,
        sections: sections_with_items,
    };

    Ok(HttpResponse::Ok().json(restaurant_menu))
}

// Public Menu Access

pub async fn get_public_menu(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse> {
    let (restaurant_code, table_code) = path.into_inner();

    // Find restaurant and table by codes
    let restaurant_table = sqlx::query!(
        "SELECT r.id as restaurant_id, r.name as restaurant_name, r.address, t.id as table_id 
         FROM restaurants r 
         JOIN tables t ON r.id = t.restaurant_id 
         WHERE r.id = ? AND t.unique_code = ?",
        restaurant_code,
        table_code
    )
    .fetch_optional(pool.get_ref())
    .await;

    let (_restaurant_id, restaurant_name, restaurant_address) = match restaurant_table {
        Ok(Some(row)) => (row.restaurant_id, row.restaurant_name, row.address),
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Restaurant or table not found"
            })));
        }
        Err(e) => {
            log::error!("Database error fetching restaurant/table: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    // Return simple public menu response for now
    let public_menu = PublicMenu {
        restaurant: PublicRestaurantInfo {
            name: restaurant_name,
            address: restaurant_address,
        },
        sections: vec![], // Empty for now
    };

    Ok(HttpResponse::Ok().json(public_menu))
}
