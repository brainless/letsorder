# Backend Work Plan

## Development Order

The backend issues should be tackled in the following order based on dependencies and logical progression:

### Phase 1: Foundation (Issues #1-3)
**Priority: Critical - Must be completed first**

1. **Issue #1: Initial Actix Web project setup**
   - Creates the basic Rust project structure
   - Sets up dependencies and configuration
   - Establishes health check endpoint
   - **Dependencies**: None
   - **Estimated effort**: 1-2 days

2. **Issue #2: Database setup**
   - SQLite schema and migrations
   - Database models and connection pooling
   - Litestream backup configuration
   - **Dependencies**: Issue #1
   - **Estimated effort**: 2-3 days

3. **Issue #3: JWT authentication system**
   - User registration and login
   - Password hashing and JWT tokens
   - Authentication middleware
   - **Dependencies**: Issues #1, #2
   - **Estimated effort**: 2-3 days

### Phase 2: Core Business Logic (Issues #4-6)
**Priority: High - Core restaurant management features**

4. **Issue #4: Restaurant CRUD APIs**
   - Restaurant creation and management
   - Manager invitation system
   - Permission and role management
   - **Dependencies**: Issues #1-3
   - **Estimated effort**: 3-4 days

5. **Issue #6: Table and QR code management**
   - Table/room management endpoints
   - Unique code generation for tables
   - QR URL generation
   - **Dependencies**: Issue #4
   - **Estimated effort**: 2-3 days

6. **Issue #5: Menu management APIs**
   - Menu sections and items CRUD
   - Public menu access for guests
   - Menu ordering and availability
   - **Dependencies**: Issues #4, #6
   - **Estimated effort**: 3-4 days

### Phase 3: Guest Experience (Issue #7)
**Priority: High - Guest ordering functionality**

7. **Issue #7: Order placement and viewing**
   - Guest order placement (no auth)
   - Manager order viewing
   - Order confirmation system
   - **Dependencies**: Issues #5, #6
   - **Estimated effort**: 2-3 days

### Phase 4: Enhanced Features (Issue #8)
**Priority: Medium - Nice to have features**

8. **Issue #8: QR code generation service**
   - Printable QR code generation
   - Bulk QR code creation
   - Multiple output formats
   - **Dependencies**: Issue #6
   - **Estimated effort**: 2-3 days

### Phase 5: Quality Assurance (Issue #9)
**Priority: High - Should be done throughout development**

9. **Issue #9: API testing suite**
   - Comprehensive test coverage
   - Integration and unit tests
   - CI/CD test integration
   - **Dependencies**: All previous issues
   - **Estimated effort**: 3-4 days (ongoing)

## Development Guidelines

### Branch Strategy
- Create feature branches for each issue: `feature/issue-N-description`
- Example: `feature/issue-1-actix-setup`

### Testing Strategy
- Write tests incrementally during development
- Issue #9 should be worked on in parallel with other issues
- Aim for 80% test coverage on restaurant admin APIs

### Configuration Management
- All settings in `settings.ini` or `local.settings.ini`
- Include database URL, JWT secret, Sentry DSN
- Separate test configuration

### Key Dependencies Between Issues
```
Issue #1 (Setup)
    ↓
Issue #2 (Database) ← Issue #3 (Auth)
    ↓                      ↓
Issue #4 (Restaurants) ←---┘
    ↓
Issue #6 (Tables) ← Issue #5 (Menu)
    ↓                    ↓
Issue #7 (Orders) ←------┘
    ↓
Issue #8 (QR Generation)

Issue #9 (Tests) - Parallel to all above
```

## Total Estimated Timeline
- **Phase 1**: 5-8 days (Foundation)
- **Phase 2**: 7-11 days (Core Features)
- **Phase 3**: 2-3 days (Guest Experience)
- **Phase 4**: 2-3 days (Enhanced Features)
- **Phase 5**: 3-4 days (Testing - ongoing)

**Total: 19-29 days** (approximately 4-6 weeks)

## Notes
- Issue #9 (testing) should be worked on continuously during development
- Issues #5 and #6 can potentially be worked on in parallel after Issue #4
- Issue #8 is lower priority and can be deferred if needed
- Each issue should include proper error handling and validation