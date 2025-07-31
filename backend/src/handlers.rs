use crate::auth::{JwtManager, PasswordHasher};
use crate::models::{
    AuthResponse, Claims, CreateMenuItemRequest, CreateMenuSectionRequest, CreateRestaurantRequest, 
    InviteManagerRequest, InviteResponse, JoinRestaurantRequest, LoginRequest, 
    ManagerInfo, ManagerInvite, ManagerInviteRow, MenuItem, MenuItemRow, MenuSection, MenuSectionRow,
    PublicMenu, PublicMenuItem, PublicMenuSection, PublicRestaurantInfo, RegisterRequest, 
    ReorderItemsRequest, ReorderSectionsRequest, Restaurant, RestaurantRow, ToggleAvailabilityRequest,
    UpdateManagerPermissionsRequest, UpdateMenuItemRequest, UpdateMenuSectionRequest, 
    UpdateRestaurantRequest, User, UserResponse, UserRow,
};
use actix_web::{web, HttpResponse, Result};
use chrono::{Duration, Utc};
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

pub async fn protected_test(claims: web::ReqData<Claims>) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "This is a protected endpoint",
        "user_id": claims.sub,
        "email": claims.email
    })))
}

// Restaurant CRUD handlers

pub async fn create_restaurant(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    req: web::Json<CreateRestaurantRequest>,
) -> Result<HttpResponse> {
    let restaurant_id = Uuid::new_v4().to_string();
    
    // Start a transaction
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            log::error!("Failed to start transaction: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    // Create the restaurant
    let result = sqlx::query!(
        "INSERT INTO restaurants (id, name, address, establishment_year, google_maps_link) VALUES (?, ?, ?, ?, ?)",
        restaurant_id,
        req.name,
        req.address,
        req.establishment_year,
        req.google_maps_link
    )
    .execute(&mut *tx)
    .await;

    if let Err(e) = result {
        log::error!("Failed to create restaurant: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to create restaurant"
        })));
    }

    // Add the creating user as super admin
    let result = sqlx::query!(
        "INSERT INTO restaurant_managers (restaurant_id, user_id, role, can_manage_menu) VALUES (?, ?, 'super_admin', TRUE)",
        restaurant_id,
        claims.sub
    )
    .execute(&mut *tx)
    .await;

    if let Err(e) = result {
        log::error!("Failed to add super admin: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to create restaurant"
        })));
    }

    // Commit transaction
    if let Err(e) = tx.commit().await {
        log::error!("Failed to commit transaction: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to create restaurant"
        })));
    }

    // Fetch the created restaurant
    let restaurant_row = sqlx::query_as::<_, RestaurantRow>(
        "SELECT id, name, address, establishment_year, google_maps_link, created_at FROM restaurants WHERE id = ?"
    )
    .bind(&restaurant_id)
    .fetch_one(pool.get_ref())
    .await;

    match restaurant_row {
        Ok(restaurant_row) => {
            let restaurant = Restaurant::from(restaurant_row);
            Ok(HttpResponse::Created().json(restaurant))
        }
        Err(e) => {
            log::error!("Failed to fetch created restaurant: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Restaurant created but failed to fetch details"
            })))
        }
    }
}

pub async fn get_restaurant(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let restaurant_id = path.into_inner();

    // Check if user is a manager of this restaurant
    let manager_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
        restaurant_id,
        claims.sub
    )
    .fetch_optional(pool.get_ref())
    .await;

    match manager_check {
        Ok(Some(_)) => {}, // User is a manager
        Ok(None) => {
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

    // Fetch restaurant details
    let restaurant_row = sqlx::query_as::<_, RestaurantRow>(
        "SELECT id, name, address, establishment_year, google_maps_link, created_at FROM restaurants WHERE id = ?"
    )
    .bind(&restaurant_id)
    .fetch_optional(pool.get_ref())
    .await;

    match restaurant_row {
        Ok(Some(restaurant_row)) => {
            let restaurant = Restaurant::from(restaurant_row);
            Ok(HttpResponse::Ok().json(restaurant))
        }
        Ok(None) => Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Restaurant not found"
        }))),
        Err(e) => {
            log::error!("Database error fetching restaurant: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })))
        }
    }
}

pub async fn update_restaurant(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    path: web::Path<String>,
    req: web::Json<UpdateRestaurantRequest>,
) -> Result<HttpResponse> {
    let restaurant_id = path.into_inner();

    // Check if user is super admin of this restaurant
    let super_admin_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND role = 'super_admin'",
        restaurant_id,
        claims.sub
    )
    .fetch_optional(pool.get_ref())
    .await;

    match super_admin_check {
        Ok(Some(_)) => {}, // User is super admin
        Ok(None) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Only super admin can update restaurant details"
            })));
        }
        Err(e) => {
            log::error!("Database error checking super admin access: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Build dynamic update query
    let mut query_parts = Vec::new();
    let mut params: Vec<&(dyn sqlx::Encode<sqlx::Sqlite> + Send + Sync)> = Vec::new();

    if let Some(ref name) = req.name {
        query_parts.push("name = ?");
        params.push(name);
    }
    if let Some(ref address) = req.address {
        query_parts.push("address = ?");
        params.push(address);
    }
    if let Some(ref year) = req.establishment_year {
        query_parts.push("establishment_year = ?");
        params.push(year);
    }
    if let Some(ref maps_link) = req.google_maps_link {
        query_parts.push("google_maps_link = ?");
        params.push(maps_link);
    }

    if query_parts.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No fields to update"
        })));
    }

    let query = format!(
        "UPDATE restaurants SET {} WHERE id = ?",
        query_parts.join(", ")
    );

    // Execute update with proper parameter binding
    let mut query_builder = sqlx::query(&query);
    
    if let Some(ref name) = req.name {
        query_builder = query_builder.bind(name);
    }
    if let Some(ref address) = req.address {
        query_builder = query_builder.bind(address);
    }
    if let Some(ref year) = req.establishment_year {
        query_builder = query_builder.bind(year);
    }
    if let Some(ref maps_link) = req.google_maps_link {
        query_builder = query_builder.bind(maps_link);
    }
    
    query_builder = query_builder.bind(&restaurant_id);

    let result = query_builder.execute(pool.get_ref()).await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Restaurant not found"
                })))
            } else {
                // Fetch updated restaurant
                let restaurant_row = sqlx::query_as::<_, RestaurantRow>(
                    "SELECT id, name, address, establishment_year, google_maps_link, created_at FROM restaurants WHERE id = ?"
                )
                .bind(&restaurant_id)
                .fetch_one(pool.get_ref())
                .await;

                match restaurant_row {
                    Ok(restaurant_row) => {
                        let restaurant = Restaurant::from(restaurant_row);
                        Ok(HttpResponse::Ok().json(restaurant))
                    }
                    Err(e) => {
                        log::error!("Failed to fetch updated restaurant: {}", e);
                        Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                            "error": "Restaurant updated but failed to fetch details"
                        })))
        }
    }
}

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
        Ok(row) if row.count > 0 => {}, // User has menu permission
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
        Some(order) => order,
        None => {
            let max_order = sqlx::query!(
                "SELECT COALESCE(MAX(display_order), 0) as max_order FROM menu_sections WHERE restaurant_id = ?",
                restaurant_id
            )
            .fetch_one(pool.get_ref())
            .await;

            match max_order {
                Ok(row) => row.max_order + 1,
                Err(_) => 1,
            }
        }
    };

    let section_id = uuid::Uuid::new_v4().to_string();
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
            // Fetch the created section
            let section = sqlx::query_as!(
                MenuSectionRow,
                "SELECT id, restaurant_id, name, display_order, created_at FROM menu_sections WHERE id = ?",
                section_id
            )
            .fetch_one(pool.get_ref())
            .await;

            match section {
                Ok(section_row) => {
                    let section = MenuSection::from(section_row);
                    Ok(HttpResponse::Created().json(section))
                },
                Err(e) => {
                    log::error!("Database error fetching created section: {}", e);
                    Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to fetch created section"
                    })))
                }
            }
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
        Ok(row) if row.count > 0 => {}, // User is a manager
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

    let sections = sqlx::query_as!(
        MenuSection,
        "SELECT id, restaurant_id, name, display_order, created_at FROM menu_sections WHERE restaurant_id = ? ORDER BY display_order ASC",
        restaurant_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match sections {
        Ok(sections) => Ok(HttpResponse::Ok().json(sections)),
        Err(e) => {
            log::error!("Database error fetching menu sections: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch menu sections"
            })))
        }
    }
}

pub async fn update_menu_section(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
    req: web::Json<UpdateMenuSectionRequest>,
) -> Result<HttpResponse> {
    let (restaurant_id, section_id) = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {}, // User has menu permission
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

    // Build dynamic update query
    let mut query_parts = Vec::new();
    let mut params: Vec<&(dyn sqlx::Encode<sqlx::Sqlite> + Send + Sync)> = Vec::new();

    if let Some(ref name) = req.name {
        query_parts.push("name = ?");
        params.push(name);
    }
    if let Some(ref display_order) = req.display_order {
        query_parts.push("display_order = ?");
        params.push(display_order);
    }

    if query_parts.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No fields to update"
        })));
    }

    let query_str = format!(
        "UPDATE menu_sections SET {} WHERE id = ? AND restaurant_id = ?",
        query_parts.join(", ")
    );

    params.push(&section_id);
    params.push(&restaurant_id);

    let mut query = sqlx::query(&query_str);
    for param in params {
        query = query.bind(param);
    }

    let result = query.execute(pool.get_ref()).await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Menu section not found"
                })))
            } else {
                // Fetch updated section
                let section = sqlx::query_as!(
                    MenuSection,
                    "SELECT id, restaurant_id, name, display_order, created_at FROM menu_sections WHERE id = ?",
                    section_id
                )
                .fetch_one(pool.get_ref())
                .await;

                match section {
                    Ok(section) => Ok(HttpResponse::Ok().json(section)),
                    Err(e) => {
                        log::error!("Database error fetching updated section: {}", e);
                        Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                            "error": "Failed to fetch updated section"
                        })))
                    }
                }
            }
        }
        Err(e) => {
            log::error!("Database error updating menu section: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update menu section"
            })))
        }
    }
}

pub async fn delete_menu_section(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse> {
    let (restaurant_id, section_id) = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {}, // User has menu permission
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

    let result = sqlx::query!(
        "DELETE FROM menu_sections WHERE id = ? AND restaurant_id = ?",
        section_id,
        restaurant_id
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Menu section not found"
                })))
            } else {
                Ok(HttpResponse::Ok().json(serde_json::json!({
                    "message": "Menu section deleted successfully"
                })))
            }
        }
        Err(e) => {
            log::error!("Database error deleting menu section: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete menu section"
            })))
        }
    }
}

pub async fn reorder_menu_sections(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
    claims: web::ReqData<Claims>,
    req: web::Json<ReorderSectionsRequest>,
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
        Ok(row) if row.count > 0 => {}, // User has menu permission
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

    // Update display orders for each section
    for section_order in &req.section_orders {
        let result = sqlx::query!(
            "UPDATE menu_sections SET display_order = ? WHERE id = ? AND restaurant_id = ?",
            section_order.display_order,
            section_order.section_id,
            restaurant_id
        )
        .execute(pool.get_ref())
        .await;

        if let Err(e) = result {
            log::error!("Database error updating section order: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update section order"
            })));
        }
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Menu sections reordered successfully"
    })))
}

// Menu Item Handlers

pub async fn create_menu_item(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
    req: web::Json<CreateMenuItemRequest>,
) -> Result<HttpResponse> {
    let (restaurant_id, section_id) = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {}, // User has menu permission
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

    // Verify section belongs to restaurant
    let section_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM menu_sections WHERE id = ? AND restaurant_id = ?",
        section_id,
        restaurant_id
    )
    .fetch_one(pool.get_ref())
    .await;

    match section_check {
        Ok(row) if row.count > 0 => {}, // Section exists
        Ok(_) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Menu section not found"
            })));
        }
        Err(e) => {
            log::error!("Database error checking section: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Get next display order if not provided
    let display_order = match req.display_order {
        Some(order) => order,
        None => {
            let max_order = sqlx::query!(
                "SELECT COALESCE(MAX(display_order), 0) as max_order FROM menu_items WHERE section_id = ?",
                section_id
            )
            .fetch_one(pool.get_ref())
            .await;

            match max_order {
                Ok(row) => row.max_order + 1,
                Err(_) => 1,
            }
        }
    };

    let item_id = uuid::Uuid::new_v4().to_string();
    let result = sqlx::query!(
        "INSERT INTO menu_items (id, section_id, name, description, price, display_order) VALUES (?, ?, ?, ?, ?, ?)",
        item_id,
        section_id,
        req.name,
        req.description,
        req.price,
        display_order
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => {
            // Fetch the created item
            let item = sqlx::query_as!(
                MenuItem,
                "SELECT id, section_id, name, description, price, available, display_order, created_at FROM menu_items WHERE id = ?",
                item_id
            )
            .fetch_one(pool.get_ref())
            .await;

            match item {
                Ok(item) => Ok(HttpResponse::Created().json(item)),
                Err(e) => {
                    log::error!("Database error fetching created item: {}", e);
                    Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to fetch created item"
                    })))
                }
            }
        }
        Err(e) => {
            log::error!("Database error creating menu item: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create menu item"
            })))
        }
    }
}

pub async fn list_menu_items(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse> {
    let (restaurant_id, section_id) = path.into_inner();

    // Check if user is a manager of this restaurant
    let manager_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match manager_check {
        Ok(row) if row.count > 0 => {}, // User is a manager
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

    let items = sqlx::query_as!(
        MenuItem,
        "SELECT mi.id, mi.section_id, mi.name, mi.description, mi.price, mi.available, mi.display_order, mi.created_at 
         FROM menu_items mi 
         JOIN menu_sections ms ON mi.section_id = ms.id 
         WHERE mi.section_id = ? AND ms.restaurant_id = ? 
         ORDER BY mi.display_order ASC",
        section_id,
        restaurant_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match items {
        Ok(items) => Ok(HttpResponse::Ok().json(items)),
        Err(e) => {
            log::error!("Database error fetching menu items: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch menu items"
            })))
        }
    }
}

pub async fn update_menu_item(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
    req: web::Json<UpdateMenuItemRequest>,
) -> Result<HttpResponse> {
    let (restaurant_id, item_id) = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {}, // User has menu permission
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

    // Build dynamic update query
    let mut query_parts = Vec::new();
    let mut params: Vec<&(dyn sqlx::Encode<sqlx::Sqlite> + Send + Sync)> = Vec::new();

    if let Some(ref name) = req.name {
        query_parts.push("name = ?");
        params.push(name);
    }
    if let Some(ref description) = req.description {
        query_parts.push("description = ?");
        params.push(description);
    }
    if let Some(ref price) = req.price {
        query_parts.push("price = ?");
        params.push(price);
    }
    if let Some(ref display_order) = req.display_order {
        query_parts.push("display_order = ?");
        params.push(display_order);
    }

    if query_parts.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No fields to update"
        })));
    }

    let query_str = format!(
        "UPDATE menu_items SET {} WHERE id = ? AND section_id IN (SELECT id FROM menu_sections WHERE restaurant_id = ?)",
        query_parts.join(", ")
    );

    params.push(&item_id);
    params.push(&restaurant_id);

    let mut query = sqlx::query(&query_str);
    for param in params {
        query = query.bind(param);
    }

    let result = query.execute(pool.get_ref()).await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Menu item not found"
                })))
            } else {
                // Fetch updated item
                let item = sqlx::query_as!(
                    MenuItem,
                    "SELECT id, section_id, name, description, price, available, display_order, created_at FROM menu_items WHERE id = ?",
                    item_id
                )
                .fetch_one(pool.get_ref())
                .await;

                match item {
                    Ok(item) => Ok(HttpResponse::Ok().json(item)),
                    Err(e) => {
                        log::error!("Database error fetching updated item: {}", e);
                        Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                            "error": "Failed to fetch updated item"
                        })))
                    }
                }
            }
        }
        Err(e) => {
            log::error!("Database error updating menu item: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update menu item"
            })))
        }
    }
}

pub async fn delete_menu_item(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse> {
    let (restaurant_id, item_id) = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {}, // User has menu permission
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

    let result = sqlx::query!(
        "DELETE FROM menu_items WHERE id = ? AND section_id IN (SELECT id FROM menu_sections WHERE restaurant_id = ?)",
        item_id,
        restaurant_id
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Menu item not found"
                })))
            } else {
                Ok(HttpResponse::Ok().json(serde_json::json!({
                    "message": "Menu item deleted successfully"
                })))
            }
        }
        Err(e) => {
            log::error!("Database error deleting menu item: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete menu item"
            })))
        }
    }
}

pub async fn toggle_item_availability(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
    req: web::Json<ToggleAvailabilityRequest>,
) -> Result<HttpResponse> {
    let (restaurant_id, item_id) = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {}, // User has menu permission
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

    let result = sqlx::query!(
        "UPDATE menu_items SET available = ? WHERE id = ? AND section_id IN (SELECT id FROM menu_sections WHERE restaurant_id = ?)",
        req.available,
        item_id,
        restaurant_id
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Menu item not found"
                })))
            } else {
                // Fetch updated item
                let item = sqlx::query_as!(
                    MenuItem,
                    "SELECT id, section_id, name, description, price, available, display_order, created_at FROM menu_items WHERE id = ?",
                    item_id
                )
                .fetch_one(pool.get_ref())
                .await;

                match item {
                    Ok(item) => Ok(HttpResponse::Ok().json(item)),
                    Err(e) => {
                        log::error!("Database error fetching updated item: {}", e);
                        Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                            "error": "Failed to fetch updated item"
                        })))
                    }
                }
            }
        }
        Err(e) => {
            log::error!("Database error updating item availability: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update item availability"
            })))
        }
    }
}

pub async fn reorder_menu_items(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<(String, String)>,
    claims: web::ReqData<Claims>,
    req: web::Json<ReorderItemsRequest>,
) -> Result<HttpResponse> {
    let (restaurant_id, section_id) = path.into_inner();

    // Check if user has menu management permission for this restaurant
    let permission_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND can_manage_menu = TRUE",
        restaurant_id,
        claims.sub
    )
    .fetch_one(pool.get_ref())
    .await;

    match permission_check {
        Ok(row) if row.count > 0 => {}, // User has menu permission
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

    // Update display orders for each item
    for item_order in &req.item_orders {
        let result = sqlx::query!(
            "UPDATE menu_items SET display_order = ? WHERE id = ? AND section_id = ? AND section_id IN (SELECT id FROM menu_sections WHERE restaurant_id = ?)",
            item_order.display_order,
            item_order.item_id,
            section_id,
            restaurant_id
        )
        .execute(pool.get_ref())
        .await;

        if let Err(e) = result {
            log::error!("Database error updating item order: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update item order"
            })));
        }
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Menu items reordered successfully"
    })))
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

    let (restaurant_id, restaurant_name, restaurant_address) = match restaurant_table {
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

    // Fetch menu sections with available items
    let sections = sqlx::query!(
        "SELECT ms.id, ms.name, ms.display_order,
                mi.id as item_id, mi.name as item_name, mi.description as item_description, 
                mi.price as item_price, mi.display_order as item_display_order
         FROM menu_sections ms
         LEFT JOIN menu_items mi ON ms.id = mi.section_id AND mi.available = TRUE
         WHERE ms.restaurant_id = ?
         ORDER BY ms.display_order ASC, mi.display_order ASC",
        restaurant_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match sections {
        Ok(rows) => {
            let mut sections_map: std::collections::HashMap<String, PublicMenuSection> = std::collections::HashMap::new();

            for row in rows {
                let section = sections_map.entry(row.id.clone()).or_insert_with(|| PublicMenuSection {
                    id: row.id.clone(),
                    name: row.name.clone(),
                    items: Vec::new(),
                });

                if let (Some(item_id), Some(item_name), Some(item_price)) = (row.item_id, row.item_name, row.item_price) {
                    section.items.push(PublicMenuItem {
                        id: item_id,
                        name: item_name,
                        description: row.item_description,
                        price: item_price,
                    });
                }
            }

            let mut sections: Vec<PublicMenuSection> = sections_map.into_values().collect();
            sections.sort_by_key(|s| {
                rows.iter()
                    .find(|r| r.id == s.id)
                    .map(|r| r.display_order)
                    .unwrap_or(0)
            });

            let public_menu = PublicMenu {
                restaurant: PublicRestaurantInfo {
                    name: restaurant_name,
                    address: restaurant_address,
                },
                sections,
            };

            Ok(HttpResponse::Ok().json(public_menu))
        }
        Err(e) => {
            log::error!("Database error fetching menu: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch menu"
            })))
        }
    }
}        }
        Err(e) => {
            log::error!("Database error updating restaurant: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update restaurant"
            })))
        }
    }
}

pub async fn delete_restaurant(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let restaurant_id = path.into_inner();

    // Check if user is super admin of this restaurant
    let super_admin_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND role = 'super_admin'",
        restaurant_id,
        claims.sub
    )
    .fetch_optional(pool.get_ref())
    .await;

    match super_admin_check {
        Ok(Some(_)) => {}, // User is super admin
        Ok(None) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Only super admin can delete restaurant"
            })));
        }
        Err(e) => {
            log::error!("Database error checking super admin access: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Delete restaurant (cascade will handle related records)
    let result = sqlx::query!("DELETE FROM restaurants WHERE id = ?", restaurant_id)
        .execute(pool.get_ref())
        .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Restaurant not found"
                })))
            } else {
                Ok(HttpResponse::NoContent().finish())
            }
        }
        Err(e) => {
            log::error!("Database error deleting restaurant: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete restaurant"
            })))
        }
    }
}

pub async fn invite_manager(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    path: web::Path<String>,
    req: web::Json<InviteManagerRequest>,
) -> Result<HttpResponse> {
    let restaurant_id = path.into_inner();

    // Check if user is super admin of this restaurant
    let super_admin_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND role = 'super_admin'",
        restaurant_id,
        claims.sub
    )
    .fetch_optional(pool.get_ref())
    .await;

    match super_admin_check {
        Ok(Some(_)) => {}, // User is super admin
        Ok(None) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Only super admin can invite managers"
            })));
        }
        Err(e) => {
            log::error!("Database error checking super admin access: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Check if user is already a manager
    let existing_manager = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers rm JOIN users u ON rm.user_id = u.id WHERE rm.restaurant_id = ? AND u.email = ?",
        restaurant_id,
        req.email
    )
    .fetch_optional(pool.get_ref())
    .await;

    match existing_manager {
        Ok(Some(_)) => {
            return Ok(HttpResponse::Conflict().json(serde_json::json!({
                "error": "User is already a manager of this restaurant"
            })));
        }
        Ok(None) => {}
        Err(e) => {
            log::error!("Database error checking existing manager: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Check for existing invite
    let existing_invite = sqlx::query!(
        "SELECT COUNT(*) as count FROM manager_invites WHERE restaurant_id = ? AND email = ? AND expires_at > datetime('now')",
        restaurant_id,
        req.email
    )
    .fetch_optional(pool.get_ref())
    .await;

    match existing_invite {
        Ok(Some(_)) => {
            return Ok(HttpResponse::Conflict().json(serde_json::json!({
                "error": "Active invite already exists for this email"
            })));
        }
        Ok(None) => {}
        Err(e) => {
            log::error!("Database error checking existing invite: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Generate invite token and expiration
    let invite_token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::days(7); // 7 days expiration

    // Create invite
    let result = sqlx::query!(
        "INSERT INTO manager_invites (restaurant_id, email, can_manage_menu, token, expires_at) VALUES (?, ?, ?, ?, ?)",
        restaurant_id,
        req.email,
        req.can_manage_menu,
        invite_token,
        expires_at
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => {
            let response = InviteResponse {
                invite_token,
                expires_at,
            };
            Ok(HttpResponse::Created().json(response))
        }
        Err(e) => {
            log::error!("Database error creating invite: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create invite"
            })))
        }
    }
}

pub async fn join_restaurant(
    pool: web::Data<Pool<Sqlite>>,
    jwt_manager: web::Data<JwtManager>,
    path: web::Path<(String, String)>,
    req: web::Json<JoinRestaurantRequest>,
) -> Result<HttpResponse> {
    let (restaurant_id, token) = path.into_inner();

    // Find valid invite
    let invite_row = sqlx::query_as::<_, ManagerInviteRow>(
        "SELECT id, restaurant_id, email, can_manage_menu, token, expires_at, created_at FROM manager_invites WHERE restaurant_id = ? AND token = ? AND expires_at > datetime('now')"
    )
    .bind(&restaurant_id)
    .bind(&token)
    .fetch_optional(pool.get_ref())
    .await;

    let invite = match invite_row {
        Ok(Some(invite_row)) => ManagerInvite::from(invite_row),
        Ok(None) => {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid or expired invite token"
            })));
        }
        Err(e) => {
            log::error!("Database error fetching invite: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    // Verify email matches
    if invite.email != req.email {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Email does not match invite"
        })));
    }

    // Start transaction
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            log::error!("Failed to start transaction: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    // Check if user already exists
    let existing_user = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, phone, password_hash, created_at FROM users WHERE email = ?"
    )
    .bind(&req.email)
    .fetch_optional(&mut *tx)
    .await;

    let user_id = match existing_user {
        Ok(Some(user)) => {
            // User exists, verify they're not already a manager
            let existing_manager = sqlx::query!(
                "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
                restaurant_id,
                user.id
            )
            .fetch_optional(&mut *tx)
            .await;

            match existing_manager {
                Ok(Some(_)) => {
                    return Ok(HttpResponse::Conflict().json(serde_json::json!({
                        "error": "User is already a manager of this restaurant"
                    })));
                }
                Ok(None) => user.id,
                Err(e) => {
                    log::error!("Database error checking existing manager: {}", e);
                    return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Internal server error"
                    })));
                }
            }
        }
        Ok(None) => {
            // Create new user
            let password_hash = match PasswordHasher::hash_password(&req.password) {
                Ok(hash) => hash,
                Err(e) => {
                    log::error!("Password hashing error: {}", e);
                    return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Internal server error"
                    })));
                }
            };

            let new_user_id = Uuid::new_v4().to_string();
            let result = sqlx::query!(
                "INSERT INTO users (id, email, phone, password_hash) VALUES (?, ?, ?, ?)",
                new_user_id,
                req.email,
                req.phone,
                password_hash
            )
            .execute(&mut *tx)
            .await;

            match result {
                Ok(_) => new_user_id,
                Err(e) => {
                    log::error!("Database error creating user: {}", e);
                    return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to create user"
                    })));
                }
            }
        }
        Err(e) => {
            log::error!("Database error checking existing user: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    // Add user as manager
    let result = sqlx::query!(
        "INSERT INTO restaurant_managers (restaurant_id, user_id, role, can_manage_menu) VALUES (?, ?, 'manager', ?)",
        restaurant_id,
        user_id,
        invite.can_manage_menu
    )
    .execute(&mut *tx)
    .await;

    if let Err(e) = result {
        log::error!("Database error adding manager: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to add manager"
        })));
    }

    // Delete the invite
    let result = sqlx::query!("DELETE FROM manager_invites WHERE id = ?", invite.id)
        .execute(&mut *tx)
        .await;

    if let Err(e) = result {
        log::error!("Database error deleting invite: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to process invite"
        })));
    }

    // Commit transaction
    if let Err(e) = tx.commit().await {
        log::error!("Failed to commit transaction: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to join restaurant"
        })));
    }

    // Fetch user and generate token
    let user_row = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, phone, password_hash, created_at FROM users WHERE id = ?"
    )
    .bind(&user_id)
    .fetch_one(pool.get_ref())
    .await;

    match user_row {
        Ok(user_row) => {
            let user = User::from(user_row);
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
        Err(e) => {
            log::error!("Database error fetching user: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })))
        }
    }
}

pub async fn list_managers(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let restaurant_id = path.into_inner();

    // Check if user is a manager of this restaurant
    let manager_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
        restaurant_id,
        claims.sub
    )
    .fetch_optional(pool.get_ref())
    .await;

    match manager_check {
        Ok(Some(_)) => {}, // User is a manager
        Ok(None) => {
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

    // Fetch managers
    let managers = sqlx::query!(
        "SELECT u.id as user_id, u.email, u.phone, rm.role, rm.can_manage_menu, rm.created_at 
         FROM restaurant_managers rm 
         JOIN users u ON rm.user_id = u.id 
         WHERE rm.restaurant_id = ? 
         ORDER BY rm.created_at ASC",
        restaurant_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match managers {
        Ok(managers) => {
            let manager_infos: Vec<ManagerInfo> = managers
                .into_iter()
                .map(|row| ManagerInfo {
                    user_id: row.user_id.unwrap_or_default(),
                    email: row.email,
                    phone: row.phone,
                    role: row.role,
                    can_manage_menu: row.can_manage_menu,
                    created_at: chrono::DateTime::from_naive_utc_and_offset(row.created_at, Utc),
                })
                .collect();
            Ok(HttpResponse::Ok().json(manager_infos))
        }
        Err(e) => {
            log::error!("Database error fetching managers: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })))
        }
    }
}

pub async fn remove_manager(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse> {
    let (restaurant_id, user_id) = path.into_inner();

    // Check if requesting user is super admin of this restaurant
    let super_admin_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND role = 'super_admin'",
        restaurant_id,
        claims.sub
    )
    .fetch_optional(pool.get_ref())
    .await;

    match super_admin_check {
        Ok(Some(_)) => {}, // User is super admin
        Ok(None) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Only super admin can remove managers"
            })));
        }
        Err(e) => {
            log::error!("Database error checking super admin access: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Prevent removing self
    if user_id == claims.sub {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Cannot remove yourself"
        })));
    }

    // Remove manager
    let result = sqlx::query!(
        "DELETE FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
        restaurant_id,
        user_id
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Manager not found"
                })))
            } else {
                Ok(HttpResponse::NoContent().finish())
            }
        }
        Err(e) => {
            log::error!("Database error removing manager: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to remove manager"
            })))
        }
    }
}

pub async fn update_manager_permissions(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    path: web::Path<(String, String)>,
    req: web::Json<UpdateManagerPermissionsRequest>,
) -> Result<HttpResponse> {
    let (restaurant_id, user_id) = path.into_inner();

    // Check if requesting user is super admin of this restaurant
    let super_admin_check = sqlx::query!(
        "SELECT COUNT(*) as count FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ? AND role = 'super_admin'",
        restaurant_id,
        claims.sub
    )
    .fetch_optional(pool.get_ref())
    .await;

    match super_admin_check {
        Ok(Some(_)) => {}, // User is super admin
        Ok(None) => {
            return Ok(HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Only super admin can update manager permissions"
            })));
        }
        Err(e) => {
            log::error!("Database error checking super admin access: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    }

    // Update manager permissions
    let result = sqlx::query!(
        "UPDATE restaurant_managers SET can_manage_menu = ? WHERE restaurant_id = ? AND user_id = ?",
        req.can_manage_menu,
        restaurant_id,
        user_id
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(result) => {
            if result.rows_affected() == 0 {
                Ok(HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Manager not found"
                })))
            } else {
                Ok(HttpResponse::NoContent().finish())
            }
        }
        Err(e) => {
            log::error!("Database error updating manager permissions: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update manager permissions"
            })))
        }
    }
}
