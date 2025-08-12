# CLAUDE.md

## Project Overview
Restaurant menu management and ordering system with QR code support.

# Development Workflow
- Create a new branch for each task
- Branch names should start with `feature/`, `chore/` or `fix/`
- Please add tests for any new features added, particularly integration tests
- Please run formatters, linters and tests before committing changes
- When finished please commit and push to the new branch
- Please mention GitHub issue if provided
- After working on an issue from GitHub, update issue's tasks and open PR

## Stack
- **Backend**: Rust + Actix Web + SQLite + Litestream
- **Admin**: SolidJS + TypeScript + Tailwind + solid-ui
- **Menu**: Astro + TypeScript + Tailwind
- **Auth**: JWT with settings.ini config
- **Monitoring**: Sentry

## Structure
```
backend/    # Actix Web API
admin/      # Restaurant management app
menu/       # Guest ordering app
shared/     # Common types/utils
```

## Key Features
- Restaurant registration (2+ managers required)
- Menu management with sections/items
- Table/room QR code generation
- Guest ordering without login
- Real-time order viewing for managers

## Core Entities
Restaurant → Manager → Table → MenuSection → MenuItem → Order

## Config
- Settings in `settings.ini` or `local.settings.ini`
- No Docker, plain SSH deployment
- CloudFlare for web apps, VPS for backend

## TypeScript Type Generation
The backend uses `ts-rs` to automatically generate TypeScript types from Rust structs, ensuring type safety between backend and frontend applications.

### Generating Types
Run the type generation command from the backend directory:
```bash
cd backend
SQLX_OFFLINE=true cargo run --bin generate_types
```

This will:
- Export all API-facing Rust structs to TypeScript types
- Generate `admin/src/types/api.ts` for the admin app
- Generate `menu/src/types/api.ts` for the menu app

### Adding New Types
When adding new API structs in Rust:
1. Add `TS` to the derive macro: `#[derive(..., TS)]`
2. Add the export annotation: `#[ts(export)]`
3. Run the generation script to update frontend types

Example:
```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MyApiType {
    pub id: String,
    pub name: String,
}
```
