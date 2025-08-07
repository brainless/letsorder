use crate::models::{
    Claims, CreateOrderRequest, CreateOrderResponse, MenuItem, MenuItemRow, OrderItem,
    OrderItemResponse, OrderResponse, Restaurant, RestaurantRow, Table, TableRow,
};
use actix_web::{web, HttpResponse, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite};
use uuid::Uuid;

pub async fn create_order(
    pool: web::Data<Pool<Sqlite>>,
    req: web::Json<CreateOrderRequest>,
) -> Result<HttpResponse> {
    log::debug!("Received order request: {:?}", req);
    // Find table by unique code
    let table_row = sqlx::query_as::<_, TableRow>(
        "SELECT id, restaurant_id, name, unique_code, created_at FROM tables WHERE unique_code = ?",
    )
    .bind(&req.table_code)
    .fetch_optional(pool.get_ref())
    .await;

    let table = match table_row {
        Ok(Some(table_row)) => Table::from(table_row),
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "Invalid table code"
            })));
        }
        Err(e) => {
            log::error!("Database error finding table: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    // Validate menu items and calculate total
    let mut order_items = Vec::new();
    let mut total_amount = 0.0;

    for item in &req.items {
        log::debug!("Looking for menu item ID: {} in restaurant: {}", item.menu_item_id, table.restaurant_id);
        let menu_item_row = sqlx::query_as::<_, MenuItemRow>(
            "SELECT mi.id, mi.section_id, mi.name, mi.description, mi.price, mi.available, mi.display_order, mi.created_at 
             FROM menu_items mi 
             JOIN menu_sections ms ON mi.section_id = ms.id 
             WHERE mi.id = ? AND ms.restaurant_id = ? AND mi.available = TRUE"
        )
        .bind(&item.menu_item_id)
        .bind(&table.restaurant_id)
        .fetch_optional(pool.get_ref())
        .await;

        let menu_item = match menu_item_row {
            Ok(Some(menu_item_row)) => MenuItem::from(menu_item_row),
            Ok(None) => {
                return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                    "error": format!("Menu item {} not found or not available", item.menu_item_id)
                })));
            }
            Err(e) => {
                log::error!("Database error finding menu item: {e}");
                return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Internal server error"
                })));
            }
        };

        if item.quantity <= 0 {
            return Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Item quantity must be greater than 0"
            })));
        }

        let item_total = menu_item.price * item.quantity as f64;
        total_amount += item_total;

        order_items.push(OrderItem {
            menu_item_id: item.menu_item_id.clone(),
            quantity: item.quantity,
            price: menu_item.price,
            notes: item.special_requests.clone(),
        });
    }

    if order_items.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Order must contain at least one item"
        })));
    }

    // Create order
    let order_id = Uuid::new_v4().to_string();
    let items_json = match serde_json::to_string(&order_items) {
        Ok(json) => json,
        Err(e) => {
            log::error!("Error serializing order items: {e}");
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })));
        }
    };

    let result = sqlx::query(
        "INSERT INTO orders (id, table_id, items, total_amount, customer_name) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&order_id)
    .bind(&table.id)
    .bind(&items_json)
    .bind(total_amount)
    .bind(&req.customer_name)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(_) => {
            let response = CreateOrderResponse {
                order_id: order_id.clone(),
                total_amount,
                status: "pending".to_string(),
                created_at: Utc::now(),
            };
            Ok(HttpResponse::Created().json(response))
        }
        Err(e) => {
            log::error!("Database error creating order: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create order"
            })))
        }
    }
}

pub async fn get_order(
    pool: web::Data<Pool<Sqlite>>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let order_id = path.into_inner();

    // Fetch order with table and restaurant info using dynamic query
    let order_data = sqlx::query(
        "SELECT o.id, o.table_id, o.items, o.total_amount, o.status, o.customer_name, o.created_at,
                t.name as table_name, r.name as restaurant_name
         FROM orders o
         JOIN tables t ON o.table_id = t.id
         JOIN restaurants r ON t.restaurant_id = r.id
         WHERE o.id = ?",
    )
    .bind(&order_id)
    .fetch_optional(pool.get_ref())
    .await;

    match order_data {
        Ok(Some(row)) => {
            // Parse order items
            let items: String = row.try_get("items").unwrap_or_default();
            let order_items: Vec<OrderItem> = match serde_json::from_str(&items) {
                Ok(items) => items,
                Err(e) => {
                    log::error!("Error parsing order items: {e}");
                    return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Internal server error"
                    })));
                }
            };

            // Get menu item details for response
            let mut response_items = Vec::new();
            for item in order_items {
                let menu_item = sqlx::query_as::<_, MenuItemRow>(
                    "SELECT id, section_id, name, description, price, available, display_order, created_at FROM menu_items WHERE id = ?"
                )
                .bind(&item.menu_item_id)
                .fetch_optional(pool.get_ref())
                .await;

                match menu_item {
                    Ok(Some(menu_item_row)) => {
                        let menu_item = MenuItem::from(menu_item_row);
                        response_items.push(OrderItemResponse {
                            menu_item_id: item.menu_item_id,
                            menu_item_name: menu_item.name,
                            quantity: item.quantity,
                            price: item.price,
                            special_requests: item.notes,
                        });
                    }
                    Ok(None) => {
                        response_items.push(OrderItemResponse {
                            menu_item_id: item.menu_item_id,
                            menu_item_name: "Unknown Item".to_string(),
                            quantity: item.quantity,
                            price: item.price,
                            special_requests: item.notes,
                        });
                    }
                    Err(e) => {
                        log::error!("Error fetching menu item details: {e}");
                        response_items.push(OrderItemResponse {
                            menu_item_id: item.menu_item_id,
                            menu_item_name: "Unknown Item".to_string(),
                            quantity: item.quantity,
                            price: item.price,
                            special_requests: item.notes,
                        });
                    }
                }
            }

            let response = OrderResponse {
                id: row.try_get("id").unwrap_or_default(),
                table_id: row.try_get("table_id").unwrap_or_default(),
                table_name: row.try_get("table_name").unwrap_or_default(),
                restaurant_name: row.try_get("restaurant_name").unwrap_or_default(),
                items: response_items,
                total_amount: row.try_get("total_amount").unwrap_or_default(),
                status: row.try_get("status").unwrap_or_default(),
                customer_name: row.try_get("customer_name").ok(),
                created_at: {
                    let created_at: chrono::NaiveDateTime =
                        row.try_get("created_at").unwrap_or_default();
                    chrono::DateTime::from_naive_utc_and_offset(created_at, Utc)
                },
            };

            Ok(HttpResponse::Ok().json(response))
        }
        Ok(None) => Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Order not found"
        }))),
        Err(e) => {
            log::error!("Database error fetching order: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })))
        }
    }
}

pub async fn list_restaurant_orders(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let restaurant_id = path.into_inner();

    // Check if user is a manager of this restaurant
    let manager_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
    )
    .bind(&restaurant_id)
    .bind(&claims.sub)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    if manager_count == 0 {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        })));
    }

    // Fetch orders for the restaurant
    let orders = sqlx::query(
        "SELECT o.id, o.table_id, o.items, o.total_amount, o.status, o.customer_name, o.created_at,
                t.name as table_name
         FROM orders o
         JOIN tables t ON o.table_id = t.id
         WHERE t.restaurant_id = ?
         ORDER BY o.created_at DESC",
    )
    .bind(&restaurant_id)
    .fetch_all(pool.get_ref())
    .await;

    match orders {
        Ok(orders) => {
            let mut order_responses = Vec::new();

            // Get restaurant name once
            let restaurant = sqlx::query_as::<_, RestaurantRow>(
                "SELECT id, name, address, establishment_year, google_maps_link, created_at FROM restaurants WHERE id = ?"
            )
            .bind(&restaurant_id)
            .fetch_optional(pool.get_ref())
            .await;

            let restaurant_name = match restaurant {
                Ok(Some(restaurant_row)) => Restaurant::from(restaurant_row).name,
                _ => "Unknown Restaurant".to_string(),
            };

            for row in orders {
                // Parse order items
                let items: String = row.try_get("items").unwrap_or_default();
                let order_items: Vec<OrderItem> = match serde_json::from_str(&items) {
                    Ok(items) => items,
                    Err(e) => {
                        log::error!("Error parsing order items: {e}");
                        continue;
                    }
                };

                // Get menu item details for response
                let mut response_items = Vec::new();
                for item in order_items {
                    let menu_item = sqlx::query_as::<_, MenuItemRow>(
                        "SELECT id, section_id, name, description, price, available, display_order, created_at FROM menu_items WHERE id = ?"
                    )
                    .bind(&item.menu_item_id)
                    .fetch_optional(pool.get_ref())
                    .await;

                    match menu_item {
                        Ok(Some(menu_item_row)) => {
                            let menu_item = MenuItem::from(menu_item_row);
                            response_items.push(OrderItemResponse {
                                menu_item_id: item.menu_item_id,
                                menu_item_name: menu_item.name,
                                quantity: item.quantity,
                                price: item.price,
                                special_requests: item.notes,
                            });
                        }
                        Ok(None) => {
                            response_items.push(OrderItemResponse {
                                menu_item_id: item.menu_item_id,
                                menu_item_name: "Unknown Item".to_string(),
                                quantity: item.quantity,
                                price: item.price,
                                special_requests: item.notes,
                            });
                        }
                        Err(_) => {
                            response_items.push(OrderItemResponse {
                                menu_item_id: item.menu_item_id,
                                menu_item_name: "Unknown Item".to_string(),
                                quantity: item.quantity,
                                price: item.price,
                                special_requests: item.notes,
                            });
                        }
                    }
                }

                order_responses.push(OrderResponse {
                    id: row.try_get("id").unwrap_or_default(),
                    table_id: row.try_get("table_id").unwrap_or_default(),
                    table_name: row.try_get("table_name").unwrap_or_default(),
                    restaurant_name: restaurant_name.clone(),
                    items: response_items,
                    total_amount: row.try_get("total_amount").unwrap_or_default(),
                    status: row.try_get("status").unwrap_or_default(),
                    customer_name: row.try_get("customer_name").ok(),
                    created_at: {
                        let created_at: chrono::NaiveDateTime =
                            row.try_get("created_at").unwrap_or_default();
                        chrono::DateTime::from_naive_utc_and_offset(created_at, Utc)
                    },
                });
            }

            Ok(HttpResponse::Ok().json(order_responses))
        }
        Err(e) => {
            log::error!("Database error fetching orders: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })))
        }
    }
}

pub async fn list_today_orders(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let restaurant_id = path.into_inner();

    // Check if user is a manager of this restaurant
    let manager_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
    )
    .bind(&restaurant_id)
    .bind(&claims.sub)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    if manager_count == 0 {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        })));
    }

    // Fetch today's orders for the restaurant
    let orders = sqlx::query(
        "SELECT o.id, o.table_id, o.items, o.total_amount, o.status, o.customer_name, o.created_at,
                t.name as table_name
         FROM orders o
         JOIN tables t ON o.table_id = t.id
         WHERE t.restaurant_id = ? AND date(o.created_at) = date('now')
         ORDER BY o.created_at DESC",
    )
    .bind(&restaurant_id)
    .fetch_all(pool.get_ref())
    .await;

    match orders {
        Ok(orders) => {
            let mut order_responses = Vec::new();

            // Get restaurant name once
            let restaurant = sqlx::query_as::<_, RestaurantRow>(
                "SELECT id, name, address, establishment_year, google_maps_link, created_at FROM restaurants WHERE id = ?"
            )
            .bind(&restaurant_id)
            .fetch_optional(pool.get_ref())
            .await;

            let restaurant_name = match restaurant {
                Ok(Some(restaurant_row)) => Restaurant::from(restaurant_row).name,
                _ => "Unknown Restaurant".to_string(),
            };

            for row in orders {
                // Parse order items
                let items: String = row.try_get("items").unwrap_or_default();
                let order_items: Vec<OrderItem> = match serde_json::from_str(&items) {
                    Ok(items) => items,
                    Err(e) => {
                        log::error!("Error parsing order items: {e}");
                        continue;
                    }
                };

                // Get menu item details for response
                let mut response_items = Vec::new();
                for item in order_items {
                    let menu_item = sqlx::query_as::<_, MenuItemRow>(
                        "SELECT id, section_id, name, description, price, available, display_order, created_at FROM menu_items WHERE id = ?"
                    )
                    .bind(&item.menu_item_id)
                    .fetch_optional(pool.get_ref())
                    .await;

                    match menu_item {
                        Ok(Some(menu_item_row)) => {
                            let menu_item = MenuItem::from(menu_item_row);
                            response_items.push(OrderItemResponse {
                                menu_item_id: item.menu_item_id,
                                menu_item_name: menu_item.name,
                                quantity: item.quantity,
                                price: item.price,
                                special_requests: item.notes,
                            });
                        }
                        Ok(None) => {
                            response_items.push(OrderItemResponse {
                                menu_item_id: item.menu_item_id,
                                menu_item_name: "Unknown Item".to_string(),
                                quantity: item.quantity,
                                price: item.price,
                                special_requests: item.notes,
                            });
                        }
                        Err(_) => {
                            response_items.push(OrderItemResponse {
                                menu_item_id: item.menu_item_id,
                                menu_item_name: "Unknown Item".to_string(),
                                quantity: item.quantity,
                                price: item.price,
                                special_requests: item.notes,
                            });
                        }
                    }
                }

                order_responses.push(OrderResponse {
                    id: row.try_get("id").unwrap_or_default(),
                    table_id: row.try_get("table_id").unwrap_or_default(),
                    table_name: row.try_get("table_name").unwrap_or_default(),
                    restaurant_name: restaurant_name.clone(),
                    items: response_items,
                    total_amount: row.try_get("total_amount").unwrap_or_default(),
                    status: row.try_get("status").unwrap_or_default(),
                    customer_name: row.try_get("customer_name").ok(),
                    created_at: {
                        let created_at: chrono::NaiveDateTime =
                            row.try_get("created_at").unwrap_or_default();
                        chrono::DateTime::from_naive_utc_and_offset(created_at, Utc)
                    },
                });
            }

            Ok(HttpResponse::Ok().json(order_responses))
        }
        Err(e) => {
            log::error!("Database error fetching today's orders: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })))
        }
    }
}

pub async fn list_table_orders(
    pool: web::Data<Pool<Sqlite>>,
    claims: web::ReqData<Claims>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse> {
    let (restaurant_id, table_id) = path.into_inner();

    // Check if user is a manager of this restaurant
    let manager_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM restaurant_managers WHERE restaurant_id = ? AND user_id = ?",
    )
    .bind(&restaurant_id)
    .bind(&claims.sub)
    .fetch_one(pool.get_ref())
    .await
    .unwrap_or(0);

    if manager_count == 0 {
        return Ok(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        })));
    }

    // Verify table belongs to restaurant
    let table_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM tables WHERE id = ? AND restaurant_id = ?")
            .bind(&table_id)
            .bind(&restaurant_id)
            .fetch_one(pool.get_ref())
            .await
            .unwrap_or(0);

    if table_count == 0 {
        return Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Table not found"
        })));
    }

    // Fetch orders for the specific table
    let orders = sqlx::query(
        "SELECT o.id, o.table_id, o.items, o.total_amount, o.status, o.customer_name, o.created_at,
                t.name as table_name
         FROM orders o
         JOIN tables t ON o.table_id = t.id
         WHERE o.table_id = ?
         ORDER BY o.created_at DESC",
    )
    .bind(&table_id)
    .fetch_all(pool.get_ref())
    .await;

    match orders {
        Ok(orders) => {
            let mut order_responses = Vec::new();

            // Get restaurant name once
            let restaurant = sqlx::query_as::<_, RestaurantRow>(
                "SELECT id, name, address, establishment_year, google_maps_link, created_at FROM restaurants WHERE id = ?"
            )
            .bind(&restaurant_id)
            .fetch_optional(pool.get_ref())
            .await;

            let restaurant_name = match restaurant {
                Ok(Some(restaurant_row)) => Restaurant::from(restaurant_row).name,
                _ => "Unknown Restaurant".to_string(),
            };

            for row in orders {
                // Parse order items
                let items: String = row.try_get("items").unwrap_or_default();
                let order_items: Vec<OrderItem> = match serde_json::from_str(&items) {
                    Ok(items) => items,
                    Err(e) => {
                        log::error!("Error parsing order items: {e}");
                        continue;
                    }
                };

                // Get menu item details for response
                let mut response_items = Vec::new();
                for item in order_items {
                    let menu_item = sqlx::query_as::<_, MenuItemRow>(
                        "SELECT id, section_id, name, description, price, available, display_order, created_at FROM menu_items WHERE id = ?"
                    )
                    .bind(&item.menu_item_id)
                    .fetch_optional(pool.get_ref())
                    .await;

                    match menu_item {
                        Ok(Some(menu_item_row)) => {
                            let menu_item = MenuItem::from(menu_item_row);
                            response_items.push(OrderItemResponse {
                                menu_item_id: item.menu_item_id,
                                menu_item_name: menu_item.name,
                                quantity: item.quantity,
                                price: item.price,
                                special_requests: item.notes,
                            });
                        }
                        Ok(None) => {
                            response_items.push(OrderItemResponse {
                                menu_item_id: item.menu_item_id,
                                menu_item_name: "Unknown Item".to_string(),
                                quantity: item.quantity,
                                price: item.price,
                                special_requests: item.notes,
                            });
                        }
                        Err(_) => {
                            response_items.push(OrderItemResponse {
                                menu_item_id: item.menu_item_id,
                                menu_item_name: "Unknown Item".to_string(),
                                quantity: item.quantity,
                                price: item.price,
                                special_requests: item.notes,
                            });
                        }
                    }
                }

                order_responses.push(OrderResponse {
                    id: row.try_get("id").unwrap_or_default(),
                    table_id: row.try_get("table_id").unwrap_or_default(),
                    table_name: row.try_get("table_name").unwrap_or_default(),
                    restaurant_name: restaurant_name.clone(),
                    items: response_items,
                    total_amount: row.try_get("total_amount").unwrap_or_default(),
                    status: row.try_get("status").unwrap_or_default(),
                    customer_name: row.try_get("customer_name").ok(),
                    created_at: {
                        let created_at: chrono::NaiveDateTime =
                            row.try_get("created_at").unwrap_or_default();
                        chrono::DateTime::from_naive_utc_and_offset(created_at, Utc)
                    },
                });
            }

            Ok(HttpResponse::Ok().json(order_responses))
        }
        Err(e) => {
            log::error!("Database error fetching table orders: {e}");
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal server error"
            })))
        }
    }
}
