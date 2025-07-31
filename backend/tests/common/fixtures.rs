use backend::models::{
    CreateRestaurantRequest, CreateTableRequest, JoinRestaurantRequest, LoginRequest,
    RegisterRequest,
};

pub struct TestUser {
    pub email: String,
    pub password: String,
    pub phone: Option<String>,
}

impl TestUser {
    pub fn new(email: &str, password: &str) -> Self {
        Self {
            email: email.to_string(),
            password: password.to_string(),
            phone: Some("+1234567890".to_string()),
        }
    }

    pub fn to_register_request(&self) -> RegisterRequest {
        RegisterRequest {
            email: self.email.clone(),
            password: self.password.clone(),
            phone: self.phone.clone(),
        }
    }

    pub fn to_login_request(&self) -> LoginRequest {
        LoginRequest {
            email: self.email.clone(),
            password: self.password.clone(),
        }
    }

    pub fn to_join_request(&self) -> JoinRestaurantRequest {
        JoinRestaurantRequest {
            email: self.email.clone(),
            password: self.password.clone(),
            phone: self.phone.clone(),
        }
    }
}

pub struct TestRestaurant {
    pub name: String,
    pub address: Option<String>,
    pub establishment_year: Option<i32>,
    pub google_maps_link: Option<String>,
}

impl TestRestaurant {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            address: Some("123 Test Street, Test City".to_string()),
            establishment_year: Some(2020),
            google_maps_link: Some("https://maps.google.com/test".to_string()),
        }
    }

    pub fn to_create_request(&self) -> CreateRestaurantRequest {
        CreateRestaurantRequest {
            name: self.name.clone(),
            address: self.address.clone(),
            establishment_year: self.establishment_year,
            google_maps_link: self.google_maps_link.clone(),
        }
    }
}

pub struct TestTable {
    pub name: String,
}

impl TestTable {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
        }
    }

    pub fn to_create_request(&self, restaurant_id: &str) -> CreateTableRequest {
        CreateTableRequest {
            restaurant_id: restaurant_id.to_string(),
            name: self.name.clone(),
        }
    }
}

// Common test data
pub fn test_user_admin() -> TestUser {
    TestUser::new("admin@test.com", "password123")
}

pub fn test_user_manager() -> TestUser {
    TestUser::new("manager@test.com", "password123")
}

pub fn test_restaurant() -> TestRestaurant {
    TestRestaurant::new("Test Restaurant")
}

pub fn test_table() -> TestTable {
    TestTable::new("Table 1")
}

// Helper function to create authorization header
pub fn auth_header(token: &str) -> (&'static str, String) {
    ("Authorization", format!("Bearer {}", token))
}

// Helper function to create JSON content type header
pub fn json_content_type() -> (&'static str, &'static str) {
    ("Content-Type", "application/json")
}