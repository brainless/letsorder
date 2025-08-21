use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub phone: Option<String>,
    pub password_hash: String,
    pub email_verified: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct UserRow {
    pub id: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub password_hash: Option<String>,
    pub email_verified: Option<bool>,
    pub created_at: Option<NaiveDateTime>,
}

impl From<UserRow> for User {
    fn from(row: UserRow) -> Self {
        Self {
            id: row.id.unwrap_or_default(),
            email: row.email.unwrap_or_default(),
            phone: row.phone,
            password_hash: row.password_hash.unwrap_or_default(),
            email_verified: row.email_verified.unwrap_or(false),
            created_at: DateTime::from_naive_utc_and_offset(
                row.created_at.unwrap_or_default(),
                Utc,
            ),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
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

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Table {
    pub id: String,
    pub restaurant_id: String,
    pub name: String,
    pub unique_code: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct MenuSection {
    pub id: String,
    pub restaurant_id: String,
    pub name: String,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
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

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct Order {
    pub id: String,
    pub table_id: String,
    pub items: String, // JSON string
    pub total_amount: f64,
    pub status: String,
    pub customer_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct OrderRow {
    pub id: String,
    pub table_id: String,
    pub items: String,
    pub total_amount: f64,
    pub status: String,
    pub customer_name: Option<String>,
    pub created_at: NaiveDateTime,
}

impl From<OrderRow> for Order {
    fn from(row: OrderRow) -> Self {
        Self {
            id: row.id,
            table_id: row.table_id,
            items: row.items,
            total_amount: row.total_amount,
            status: row.status,
            customer_name: row.customer_name,
            created_at: DateTime::from_naive_utc_and_offset(row.created_at, Utc),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
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
pub struct CreateMenuItemFromSectionRequest {
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub display_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrderRequest {
    pub table_code: String,
    pub items: Vec<CreateOrderItem>,
    pub customer_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrderItem {
    pub menu_item_id: String,
    pub quantity: i32,
    pub special_requests: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMenuSectionRequest {
    pub name: Option<String>,
    pub display_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMenuItemRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub price: Option<f64>,
    pub display_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReorderSectionsRequest {
    pub section_orders: Vec<SectionOrder>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionOrder {
    pub section_id: String,
    pub display_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReorderItemsRequest {
    pub item_orders: Vec<ItemOrder>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemOrder {
    pub item_id: String,
    pub display_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToggleAvailabilityRequest {
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PublicMenu {
    pub restaurant: PublicRestaurantInfo,
    pub sections: Vec<PublicMenuSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PublicRestaurantInfo {
    pub name: String,
    pub address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PublicMenuSection {
    pub id: String,
    pub name: String,
    pub items: Vec<PublicMenuItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PublicMenuItem {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
}

#[derive(Debug, Clone, FromRow)]
pub struct MenuSectionRow {
    pub id: Option<String>,
    pub restaurant_id: Option<String>,
    pub name: Option<String>,
    pub display_order: Option<i64>,
    pub created_at: Option<NaiveDateTime>,
}

impl From<MenuSectionRow> for MenuSection {
    fn from(row: MenuSectionRow) -> Self {
        Self {
            id: row.id.unwrap_or_default(),
            restaurant_id: row.restaurant_id.unwrap_or_default(),
            name: row.name.unwrap_or_default(),
            display_order: row.display_order.unwrap_or(0) as i32,
            created_at: DateTime::from_naive_utc_and_offset(
                row.created_at.unwrap_or_default(),
                Utc,
            ),
        }
    }
}

#[derive(Debug, Clone, FromRow)]
pub struct MenuItemRow {
    pub id: Option<String>,
    pub section_id: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub price: Option<f64>,
    pub available: Option<bool>,
    pub display_order: Option<i64>,
    pub created_at: Option<NaiveDateTime>,
}

impl From<MenuItemRow> for MenuItem {
    fn from(row: MenuItemRow) -> Self {
        Self {
            id: row.id.unwrap_or_default(),
            section_id: row.section_id.unwrap_or_default(),
            name: row.name.unwrap_or_default(),
            description: row.description,
            price: row.price.unwrap_or(0.0),
            available: row.available.unwrap_or(true),
            display_order: row.display_order.unwrap_or(0) as i32,
            created_at: DateTime::from_naive_utc_and_offset(
                row.created_at.unwrap_or_default(),
                Utc,
            ),
        }
    }
}

// Restaurant menu response types
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RestaurantMenu {
    pub restaurant_id: String,
    pub sections: Vec<MenuSectionWithItems>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MenuSectionWithItems {
    pub id: String,
    pub restaurant_id: String,
    pub name: String,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
    pub items: Vec<MenuItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTableRequest {
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct QrCodeResponse {
    pub qr_url: String,
    pub table_name: String,
    pub unique_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkQrCodeRequest {
    pub table_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkQrCodeResponse {
    pub qr_codes: Vec<QrCodeResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshCodeResponse {
    pub table_id: String,
    pub new_unique_code: String,
    pub qr_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct OrderResponse {
    pub id: String,
    pub table_id: String,
    pub table_name: String,
    pub restaurant_name: String,
    pub items: Vec<OrderItemResponse>,
    pub total_amount: f64,
    pub status: String,
    pub customer_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct OrderItemResponse {
    pub menu_item_id: String,
    pub menu_item_name: String,
    pub quantity: i32,
    pub price: f64,
    pub special_requests: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CreateOrderResponse {
    pub order_id: String,
    pub total_amount: f64,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct TableRow {
    pub id: String,
    pub restaurant_id: String,
    pub name: String,
    pub unique_code: String,
    pub created_at: NaiveDateTime,
}

impl From<TableRow> for Table {
    fn from(row: TableRow) -> Self {
        Self {
            id: row.id,
            restaurant_id: row.restaurant_id,
            name: row.name,
            unique_code: row.unique_code,
            created_at: DateTime::from_naive_utc_and_offset(row.created_at, Utc),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct ContactSubmission {
    pub id: String,
    pub name: String,
    pub email: String,
    pub subject: Option<String>,
    pub message: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct ContactSubmissionRow {
    pub id: String,
    pub name: String,
    pub email: String,
    pub subject: Option<String>,
    pub message: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub status: String,
    pub created_at: NaiveDateTime,
}

impl From<ContactSubmissionRow> for ContactSubmission {
    fn from(row: ContactSubmissionRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            email: row.email,
            subject: row.subject,
            message: row.message,
            ip_address: row.ip_address,
            user_agent: row.user_agent,
            status: row.status,
            created_at: DateTime::from_naive_utc_and_offset(row.created_at, Utc),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CreateContactRequest {
    pub name: String,
    pub email: String,
    pub subject: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ContactResponse {
    pub message: String,
    pub submission_id: String,
}

// Email verification models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct EmailVerificationToken {
    pub id: String,
    pub user_id: String,
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow)]
pub struct EmailVerificationTokenRow {
    pub id: Option<String>,
    pub user_id: Option<String>,
    pub token: Option<String>,
    pub expires_at: Option<NaiveDateTime>,
    pub created_at: Option<NaiveDateTime>,
    pub used_at: Option<NaiveDateTime>,
}

impl From<EmailVerificationTokenRow> for EmailVerificationToken {
    fn from(row: EmailVerificationTokenRow) -> Self {
        Self {
            id: row.id.unwrap_or_default(),
            user_id: row.user_id.unwrap_or_default(),
            token: row.token.unwrap_or_default(),
            expires_at: DateTime::from_naive_utc_and_offset(
                row.expires_at.unwrap_or_default(),
                Utc,
            ),
            created_at: DateTime::from_naive_utc_and_offset(
                row.created_at.unwrap_or_default(),
                Utc,
            ),
            used_at: row
                .used_at
                .map(|dt| DateTime::from_naive_utc_and_offset(dt, Utc)),
        }
    }
}

// Password reset models
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, TS)]
#[ts(export)]
pub struct PasswordResetToken {
    pub id: String,
    pub user_id: String,
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow)]
pub struct PasswordResetTokenRow {
    pub id: Option<String>,
    pub user_id: Option<String>,
    pub token: Option<String>,
    pub expires_at: Option<NaiveDateTime>,
    pub created_at: Option<NaiveDateTime>,
    pub used_at: Option<NaiveDateTime>,
}

impl From<PasswordResetTokenRow> for PasswordResetToken {
    fn from(row: PasswordResetTokenRow) -> Self {
        Self {
            id: row.id.unwrap_or_default(),
            user_id: row.user_id.unwrap_or_default(),
            token: row.token.unwrap_or_default(),
            expires_at: DateTime::from_naive_utc_and_offset(
                row.expires_at.unwrap_or_default(),
                Utc,
            ),
            created_at: DateTime::from_naive_utc_and_offset(
                row.created_at.unwrap_or_default(),
                Utc,
            ),
            used_at: row
                .used_at
                .map(|dt| DateTime::from_naive_utc_and_offset(dt, Utc)),
        }
    }
}

// Request/response models for email operations
#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EmailVerificationRequest {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EmailVerificationResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ResendVerificationRequest {
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PasswordResetRequest {
    pub email: String,
}

#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PasswordResetConfirmRequest {
    pub token: String,
    #[serde(skip_serializing)]
    pub new_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PasswordResetResponse {
    pub success: bool,
    pub message: String,
}

// Support ticket models
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CreateSupportTicketRequest {
    pub name: String,
    pub email: String,
    pub subject: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SupportTicketResponse {
    pub success: bool,
    pub message: String,
    pub ticket_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SendSupportResponseRequest {
    pub ticket_id: String,
    pub user_email: String,
    pub user_name: String,
    pub response: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SupportResponseEmailResponse {
    pub success: bool,
    pub message: String,
}
