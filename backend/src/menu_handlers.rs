use crate::models::{
    Claims, CreateMenuItemFromSectionRequest, CreateMenuSectionRequest, MenuItem, MenuSection,
    MenuSectionWithItems, PublicMenu, PublicRestaurantInfo, ReorderItemsRequest, RestaurantMenu,
    ToggleAvailabilityRequest, UpdateMenuItemRequest,
};
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
            log::error!("Database error checking menu permission: {e}");
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
            log::error!("Database error creating menu section: {e}");
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
            log::error!("Database error checking manager access: {e}");
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
            log::error!("Database error checking manager access: {e}");
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
            log::error!("Database error fetching menu sections: {e}");
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
                log::error!(
                    "Database error fetching menu items for section {}: {}",
                    section.id,
                    e
                );
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
            log::error!("Database error fetching restaurant/table: {e}");
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

// Menu Item CRUD Handlers

pub async fn create_menu_item(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
    req: web::Json<CreateMenuItemFromSectionRequest>,
) -> Result<HttpResponse> {
    let section_id = path.into_inner();

    // First, check if the section exists and get the restaurant_id
    let section_check = sqlx::query!(
        "SELECT restaurant_id FROM menu_sections WHERE id = ?",
        section_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    let restaurant_id = match section_check {
        Ok(Some(row)) => row.restaurant_id,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Menu section not found"
            })));
        }
        Err(e) => {
            log::error!("Database error checking section: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

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

    // Get next display order if not provided
    let display_order = match req.display_order {
        Some(order) => order as i64,
        None => {
            let max_order = sqlx::query!(
                "SELECT COALESCE(MAX(display_order), 0) as max_order FROM menu_items WHERE section_id = ?",
                section_id
            )
            .fetch_one(pool.get_ref())
            .await;

            (match max_order {
                Ok(row) => row.max_order + 1,
                Err(_) => 1,
            }) as i64
        }
    };

    let item_id = Uuid::new_v4().to_string();
    let result = sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, available, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        item_id,
        section_id,
        req.name,
        req.description,
        req.price,
        true, // Default to available
        display_order
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => {
            // Return success response
            Ok(HttpResponse::Created().json(serde_json::json!({
                "message": "Menu item created successfully",
                "item_id": item_id
            })))
        }
        Err(e) => {
            log::error!("Database error creating menu item: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create menu item"
            })))
        }
    }
}

pub async fn update_menu_item(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
    req: web::Json<UpdateMenuItemRequest>,
) -> Result<HttpResponse> {
    let item_id = path.into_inner();

    // First, check if the item exists and get the restaurant_id
    let item_check = sqlx::query!(
        "SELECT ms.restaurant_id FROM menu_items mi 
         JOIN menu_sections ms ON mi.section_id = ms.id 
         WHERE mi.id = ?",
        item_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    let restaurant_id = match item_check {
        Ok(Some(row)) => row.restaurant_id,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Menu item not found"
            })));
        }
        Err(e) => {
            log::error!("Database error checking item: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

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

    // Check if there are any fields to update
    if req.name.is_none()
        && req.description.is_none()
        && req.price.is_none()
        && req.display_order.is_none()
    {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No fields to update"
        })));
    }

    // For now, let's handle each field separately to avoid complex dynamic binding
    let result = if let Some(ref name) = req.name {
        if let Some(ref description) = req.description {
            if let Some(ref price) = req.price {
                if let Some(ref display_order) = req.display_order {
                    // All fields
                    sqlx::query!(
                        "UPDATE menu_items SET name = ?, description = ?, price = ?, display_order = ? WHERE id = ?",
                        name, description, price, display_order, item_id
                    ).execute(pool.get_ref()).await
                } else {
                    // name, description, price
                    sqlx::query!(
                        "UPDATE menu_items SET name = ?, description = ?, price = ? WHERE id = ?",
                        name,
                        description,
                        price,
                        item_id
                    )
                    .execute(pool.get_ref())
                    .await
                }
            } else if let Some(ref display_order) = req.display_order {
                // name, description, display_order
                sqlx::query!(
                    "UPDATE menu_items SET name = ?, description = ?, display_order = ? WHERE id = ?",
                    name, description, display_order, item_id
                ).execute(pool.get_ref()).await
            } else {
                // name, description
                sqlx::query!(
                    "UPDATE menu_items SET name = ?, description = ? WHERE id = ?",
                    name,
                    description,
                    item_id
                )
                .execute(pool.get_ref())
                .await
            }
        } else if let Some(ref price) = req.price {
            if let Some(ref display_order) = req.display_order {
                // name, price, display_order
                sqlx::query!(
                    "UPDATE menu_items SET name = ?, price = ?, display_order = ? WHERE id = ?",
                    name,
                    price,
                    display_order,
                    item_id
                )
                .execute(pool.get_ref())
                .await
            } else {
                // name, price
                sqlx::query!(
                    "UPDATE menu_items SET name = ?, price = ? WHERE id = ?",
                    name,
                    price,
                    item_id
                )
                .execute(pool.get_ref())
                .await
            }
        } else if let Some(ref display_order) = req.display_order {
            // name, display_order
            sqlx::query!(
                "UPDATE menu_items SET name = ?, display_order = ? WHERE id = ?",
                name,
                display_order,
                item_id
            )
            .execute(pool.get_ref())
            .await
        } else {
            // name only
            sqlx::query!("UPDATE menu_items SET name = ? WHERE id = ?", name, item_id)
                .execute(pool.get_ref())
                .await
        }
    } else if let Some(ref description) = req.description {
        if let Some(ref price) = req.price {
            if let Some(ref display_order) = req.display_order {
                // description, price, display_order
                sqlx::query!(
                    "UPDATE menu_items SET description = ?, price = ?, display_order = ? WHERE id = ?",
                    description, price, display_order, item_id
                ).execute(pool.get_ref()).await
            } else {
                // description, price
                sqlx::query!(
                    "UPDATE menu_items SET description = ?, price = ? WHERE id = ?",
                    description,
                    price,
                    item_id
                )
                .execute(pool.get_ref())
                .await
            }
        } else if let Some(ref display_order) = req.display_order {
            // description, display_order
            sqlx::query!(
                "UPDATE menu_items SET description = ?, display_order = ? WHERE id = ?",
                description,
                display_order,
                item_id
            )
            .execute(pool.get_ref())
            .await
        } else {
            // description only
            sqlx::query!(
                "UPDATE menu_items SET description = ? WHERE id = ?",
                description,
                item_id
            )
            .execute(pool.get_ref())
            .await
        }
    } else if let Some(ref price) = req.price {
        if let Some(ref display_order) = req.display_order {
            // price, display_order
            sqlx::query!(
                "UPDATE menu_items SET price = ?, display_order = ? WHERE id = ?",
                price,
                display_order,
                item_id
            )
            .execute(pool.get_ref())
            .await
        } else {
            // price only
            sqlx::query!(
                "UPDATE menu_items SET price = ? WHERE id = ?",
                price,
                item_id
            )
            .execute(pool.get_ref())
            .await
        }
    } else if let Some(ref display_order) = req.display_order {
        // display_order only
        sqlx::query!(
            "UPDATE menu_items SET display_order = ? WHERE id = ?",
            display_order,
            item_id
        )
        .execute(pool.get_ref())
        .await
    } else {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No fields to update"
        })));
    };

    match result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(serde_json::json!({
                    "message": "Menu item updated successfully",
                    "item_id": item_id
                })))
            } else {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Menu item not found"
                })))
            }
        }
        Err(e) => {
            log::error!("Database error updating menu item: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update menu item"
            })))
        }
    }
}

pub async fn delete_menu_item(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse> {
    let item_id = path.into_inner();

    // First, check if the item exists and get the restaurant_id
    let item_check = sqlx::query!(
        "SELECT ms.restaurant_id FROM menu_items mi 
         JOIN menu_sections ms ON mi.section_id = ms.id 
         WHERE mi.id = ?",
        item_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    let restaurant_id = match item_check {
        Ok(Some(row)) => row.restaurant_id,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Menu item not found"
            })));
        }
        Err(e) => {
            log::error!("Database error checking item: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

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

    let result = sqlx::query!("DELETE FROM menu_items WHERE id = ?", item_id)
        .execute(pool.get_ref())
        .await;

    match result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(serde_json::json!({
                    "message": "Menu item deleted successfully"
                })))
            } else {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Menu item not found"
                })))
            }
        }
        Err(e) => {
            log::error!("Database error deleting menu item: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete menu item"
            })))
        }
    }
}

pub async fn toggle_menu_item_availability(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
    req: web::Json<ToggleAvailabilityRequest>,
) -> Result<HttpResponse> {
    let item_id = path.into_inner();

    // First, check if the item exists and get the restaurant_id
    let item_check = sqlx::query!(
        "SELECT ms.restaurant_id FROM menu_items mi 
         JOIN menu_sections ms ON mi.section_id = ms.id 
         WHERE mi.id = ?",
        item_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    let restaurant_id = match item_check {
        Ok(Some(row)) => row.restaurant_id,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Menu item not found"
            })));
        }
        Err(e) => {
            log::error!("Database error checking item: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

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
        "UPDATE menu_items SET available = ? WHERE id = ?",
        req.available,
        item_id
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(HttpResponse::Ok().json(serde_json::json!({
                    "message": "Menu item availability updated successfully",
                    "item_id": item_id,
                    "available": req.available
                })))
            } else {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Menu item not found"
                })))
            }
        }
        Err(e) => {
            log::error!("Database error updating menu item availability: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update menu item availability"
            })))
        }
    }
}

pub async fn reorder_menu_items(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    req: web::Json<ReorderItemsRequest>,
) -> Result<HttpResponse> {
    if req.item_orders.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No items to reorder"
        })));
    }

    // Check each item individually to verify they exist and get restaurant IDs

    // This is complex with dynamic binding, so let's check each item individually
    let mut restaurant_ids = std::collections::HashSet::new();
    for item_order in &req.item_orders {
        let item_check = sqlx::query!(
            "SELECT ms.restaurant_id FROM menu_items mi 
             JOIN menu_sections ms ON mi.section_id = ms.id 
             WHERE mi.id = ?",
            item_order.item_id
        )
        .fetch_optional(pool.get_ref())
        .await;

        match item_check {
            Ok(Some(row)) => {
                restaurant_ids.insert(row.restaurant_id);
            }
            Ok(None) => {
                return Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": format!("Menu item not found: {}", item_order.item_id)
                })));
            }
            Err(e) => {
                log::error!("Database error checking item {}: {}", item_order.item_id, e);
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Internal server error"
                })));
            }
        }
    }

    // Check permissions for all restaurants
    for restaurant_id in &restaurant_ids {
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
    }

    // Update display orders
    for item_order in &req.item_orders {
        let result = sqlx::query!(
            "UPDATE menu_items SET display_order = ? WHERE id = ?",
            item_order.display_order,
            item_order.item_id
        )
        .execute(pool.get_ref())
        .await;

        if let Err(e) = result {
            log::error!(
                "Database error updating item order {}: {}",
                item_order.item_id,
                e
            );
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update item orders"
            })));
        }
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Menu items reordered successfully",
        "updated_count": req.item_orders.len()
    })))
}
