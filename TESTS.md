# Testing Guide for LetsOrder Backend

## Current Status

⚠️ **No tests currently implemented** - This is a high priority item tracked in [GitHub Issue #9](https://github.com/brainless/letsorder/issues/9).

## Planned Testing Strategy

### Test Infrastructure
- **Framework**: Rust's built-in test framework + Actix Web test utilities
- **Database**: SQLite in-memory for isolated test runs
- **HTTP Testing**: Actix Web TestServer for integration tests
- **Test Data**: Factories and fixtures for consistent test data

### Test Categories

#### 1. Unit Tests
- Authentication service (JWT, password hashing)
- Database models and validation
- Business logic functions
- Utility functions

#### 2. Integration Tests
- **Authentication APIs**
  - POST /auth/register
  - POST /auth/login
  - JWT token validation

- **Restaurant Management APIs**
  - POST /restaurants (create)
  - GET /restaurants/:id (read)
  - PUT /restaurants/:id (update)
  - DELETE /restaurants/:id (delete)

- **Manager Management APIs**
  - POST /restaurants/:id/managers/invite
  - POST /restaurants/:id/managers/join/:token
  - GET /restaurants/:id/managers
  - DELETE /restaurants/:id/managers/:user_id
  - PUT /restaurants/:id/managers/:user_id

- **Menu Management APIs** (Partial implementation)
  - POST /restaurants/:id/menu/sections
  - GET /restaurants/:id/menu/sections
  - GET /menu/:restaurant_code/:table_code (public)

#### 3. Authorization Tests
- Role-based access control (super admin vs manager)
- Menu management permissions
- Restaurant ownership validation
- JWT token expiration and validation

## How to Run Tests (When Implemented)

### Prerequisites
```bash
# Ensure you have Rust and Cargo installed
rustc --version
cargo --version

# Set up test database URL
export DATABASE_URL="sqlite::memory:"
```

### Running Tests
```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test module
cargo test auth_tests

# Run integration tests only
cargo test --test integration_tests

# Run with coverage (requires cargo-tarpaulin)
cargo install cargo-tarpaulin
cargo tarpaulin --out Html
```

### Test Database Setup
Tests will use an in-memory SQLite database that is:
- Created fresh for each test
- Automatically cleaned up after tests
- Isolated between test runs
- Pre-populated with test fixtures

## Test Dependencies (To Be Added)

Add these to `Cargo.toml` under `[dev-dependencies]`:

```toml
[dev-dependencies]
tokio-test = "0.4"
actix-web-test = "4.4"
sqlx-test = "0.7"
serde_json = "1.0"
uuid = { version = "1.0", features = ["v4"] }
```

## Test Structure (Planned)

```
backend/
├── src/
│   ├── lib.rs
│   ├── handlers.rs
│   ├── auth.rs
│   ├── models.rs
│   └── menu_handlers.rs
├── tests/
│   ├── common/
│   │   ├── mod.rs
│   │   ├── fixtures.rs
│   │   └── test_app.rs
│   ├── integration_tests.rs
│   ├── auth_tests.rs
│   ├── restaurant_tests.rs
│   ├── menu_tests.rs
│   └── manager_tests.rs
└── Cargo.toml
```

## Test Coverage Goals

- **Minimum 80% code coverage** for all API endpoints
- **100% coverage** for authentication and authorization logic
- **All error scenarios** tested and validated
- **Database constraints** and edge cases covered

## Running Specific Test Scenarios

### Authentication Tests
```bash
# Test user registration
cargo test test_user_registration

# Test login flow
cargo test test_user_login

# Test JWT validation
cargo test test_jwt_validation
```

### Restaurant API Tests
```bash
# Test restaurant CRUD operations
cargo test restaurant_crud

# Test manager permissions
cargo test manager_permissions

# Test restaurant creation with 2 managers
cargo test restaurant_creation_flow
```

### Menu API Tests
```bash
# Test menu section management
cargo test menu_section_tests

# Test public menu access
cargo test public_menu_access
```

## Test Data Management

### Test Fixtures
- Pre-defined users, restaurants, and menu data
- Consistent test data across test runs
- Easy setup and teardown

### Database Migrations
- Tests run against the same schema as production
- Migration rollback testing
- Schema validation tests

## Continuous Integration

Tests should be configured to run on:
- Every pull request
- Every push to main branch
- Nightly builds for comprehensive testing

## Contributing to Tests

When adding new features:
1. Write tests first (TDD approach)
2. Ensure both happy path and error cases are covered
3. Add integration tests for new API endpoints
4. Update this documentation if test structure changes

## Current Implementation Status

| Component | Unit Tests | Integration Tests | Status |
|-----------|------------|-------------------|---------|
| Authentication | ❌ | ❌ | Not implemented |
| Restaurant CRUD | ❌ | ❌ | Not implemented |
| Manager System | ❌ | ❌ | Not implemented |
| Menu Management | ❌ | ❌ | Not implemented |
| Database Models | ❌ | ❌ | Not implemented |

## Next Steps

1. **Set up test infrastructure** (Issue #9)
2. **Add test dependencies** to Cargo.toml
3. **Create test database setup** utilities
4. **Implement authentication tests** first
5. **Add integration tests** for existing APIs
6. **Set up CI/CD pipeline** for automated testing

---

**Note**: This testing infrastructure is critical for maintaining code quality and preventing regressions as the application grows. Priority should be given to implementing the test suite before adding more features.