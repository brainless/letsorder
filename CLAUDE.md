# CLAUDE.md

## Project Overview
Restaurant menu management and ordering system with QR code support.

## Development Workflow
- Create a new branch for each task
- Branch names should start with chore/ or feature/ or fix/
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
