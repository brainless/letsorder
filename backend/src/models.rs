use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub phone: Option<String>,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct UserRow {
    pub id: String,
    pub email: String,
    pub phone: Option<String>,
    pub password_hash: String,
    pub created_at: NaiveDateTime,
}

impl From<UserRow> for User {
    fn from(row: UserRow) -> Self {
        Self {
            id: row.id,
            email: row.email,
            phone: row.phone,
            password_hash: row.password_hash,
            created_at: DateTime::from_naive_utc_and_offset(row.created_at, Utc),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Restaurant {
    pub id: String,
    pub name: String,
    pub address: Option<String>,
    pub establishment_year: Option<i32>,
    pub google_maps_link: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct RestaurantRow {
    pub id: String,
    pub name: String,
    pub address: Option<String>,
    pub establishment_year: Option<i32>,
    pub google_maps_link: Option<String>,
    pub created_at: NaiveDateTime,
}

impl From<RestaurantRow> for Restaurant {
    fn from(row: RestaurantRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            address: row.address,
            establishment_year: row.establishment_year,
            google_maps_link: row.google_maps_link,
            created_at: DateTime::from_naive_utc_and_offset(row.created_at, Utc),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RestaurantManager {
    pub restaurant_id: String,
    pub user_id: String,
    pub role: String,
    pub can_manage_menu: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Table {
    pub id: String,
    pub restaurant_id: String,
    pub name: String,
    pub unique_code: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MenuSection {
    pub id: String,
    pub restaurant_id: String,
    pub name: String,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MenuItem {
    pub id: String,
    pub section_id: String,
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub available: bool,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Order {
    pub id: String,
    pub table_id: String,
    pub items: String, // JSON string
    pub total_amount: f64,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderItem {
    pub menu_item_id: String,
    pub quantity: i32,
    pub price: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserRequest {
    pub email: String,
    pub phone: Option<String>,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRestaurantRequest {
    pub name: String,
    pub address: Option<String>,
    pub establishment_year: Option<i32>,
    pub google_maps_link: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTableRequest {
    pub restaurant_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMenuSectionRequest {
    pub restaurant_id: String,
    pub name: String,
    pub display_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMenuItemRequest {
    pub section_id: String,
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub display_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrderRequest {
    pub table_id: String,
    pub items: Vec<OrderItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub phone: Option<String>,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub phone: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user id
    pub email: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateRestaurantRequest {
    pub name: Option<String>,
    pub address: Option<String>,
    pub establishment_year: Option<i32>,
    pub google_maps_link: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InviteManagerRequest {
    pub email: String,
    pub can_manage_menu: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InviteResponse {
    pub invite_token: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinRestaurantRequest {
    pub email: String,
    pub phone: Option<String>,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateManagerPermissionsRequest {
    pub can_manage_menu: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ManagerInvite {
    pub id: String,
    pub restaurant_id: String,
    pub email: String,
    pub can_manage_menu: bool,
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct ManagerInviteRow {
    pub id: String,
    pub restaurant_id: String,
    pub email: String,
    pub can_manage_menu: bool,
    pub token: String,
    pub expires_at: NaiveDateTime,
    pub created_at: NaiveDateTime,
}

impl From<ManagerInviteRow> for ManagerInvite {
    fn from(row: ManagerInviteRow) -> Self {
        Self {
            id: row.id,
            restaurant_id: row.restaurant_id,
            email: row.email,
            can_manage_menu: row.can_manage_menu,
            token: row.token,
            expires_at: DateTime::from_naive_utc_and_offset(row.expires_at, Utc),
            created_at: DateTime::from_naive_utc_and_offset(row.created_at, Utc),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestaurantWithManagers {
    pub restaurant: Restaurant,
    pub managers: Vec<ManagerInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagerInfo {
    pub user_id: String,
    pub email: String,
    pub phone: Option<String>,
    pub role: String,
    pub can_manage_menu: bool,
    pub created_at: DateTime<Utc>,
}
