# Technical Overview

## Architecture
Monorepo with Actix Web backend, SolidJS admin, and Astro menu app.

```
letsorder/
├── backend/           # Actix Web REST API
│   ├── src/
│   ├── migrations/
│   └── tests/
├── admin/             # SolidJS + TypeScript
├── menu/              # Astro + TypeScript
└── shared/            # Shared types and utilities
```

## Data Model
- SQLite with litestream backup
- Core entities: Restaurant, Manager, Table, MenuSection, MenuItem, Order
- JWT auth with `settings.ini`

## API Endpoints
- `/auth/*` - Registration, login, invite links
- `/restaurants/*` - CRUD operations
- `/menu/*` - Menu management
- `/orders/*` - Order placement and viewing
- `/qr/*` - QR code generation

## Deployment
- Backend: VPS via SSH
- Web apps: CloudFlare Pages
- Backups: S3-compatible storage
- Monitoring: Sentry