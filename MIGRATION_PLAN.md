# Admin App Type Migration Plan

## Generated Types Available (from backend)
- `Restaurant` ✅
- `Table` ✅
- `MenuSection` ✅
- `MenuItem` ✅
- `Order` ✅
- `OrderItem` ✅
- `AuthResponse` ✅
- `UserResponse` ✅
- `QrCodeResponse` ✅
- `OrderResponse` ✅
- `OrderItemResponse` ✅
- `CreateOrderResponse` ✅
- `RestaurantMenu` ✅
- `MenuSectionWithItems` ✅
- `PublicMenu` ✅
- `PublicMenuSection` ✅
- `PublicMenuItem` ✅
- `PublicRestaurantInfo` ✅

## Manual Types to Replace
### auth.ts
- `User` → Replace with `UserResponse` ✅
- `AuthResponse` → Use generated `AuthResponse` ✅
- Keep: `LoginRequest`, `RegisterRequest`, `AuthState` (frontend-specific)

### restaurant.ts
- `Restaurant` → Use generated `Restaurant` ✅
- Keep: `CreateRestaurantRequest`, `UpdateRestaurantRequest`, `ManagerInfo`, `RestaurantWithManagers`, `InviteManagerRequest`, `UpdateManagerPermissionsRequest`, `InviteResponse`, `RestaurantState` (frontend-specific)

### table.ts
- `Table` → Use generated `Table` ✅
- `QrCodeResponse` → Use generated `QrCodeResponse` ✅
- Keep: `CreateTableRequest`, `UpdateTableRequest`, `BulkQrCodeRequest`, `BulkQrCodeResponse`, `RefreshCodeResponse`, `TableState`, `TableFilters`, `TableViewMode`, `TableFormData`, `BulkOperationData` (frontend-specific)

### menu.ts
- `MenuSection` → Use generated `MenuSection` ✅
- `MenuItem` → Use generated `MenuItem` ✅
- `MenuSectionWithItems` → Use generated `MenuSectionWithItems` ✅
- `RestaurantMenu` → Use generated `RestaurantMenu` ✅
- Keep: All request types and frontend-specific types

### order.ts
- `OrderItem` → Use generated `OrderItemResponse` ✅
- `Order` → Use generated `OrderResponse` ✅
- Keep: `OrderStatus`, `UpdateOrderStatusRequest`, `OrderFilters`, `OrderStats`, `OrderContextType` (frontend-specific)

## Migration Steps
1. Update imports in all service files
2. Update imports in all context files
3. Update imports in all component files
4. Remove duplicate type definitions
5. Test the application