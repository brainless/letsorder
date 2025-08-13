# letsorder
Complete menu management, browsing and ordering app for restaurants and guests

## Overview
letsorder has two main types of users: restaurant managers and guests who come to eat or drink. Guests do not need to login. They see the menu as planned by the restaurant's manager. They can select items, see their order, modify the order and place it. Restaurants can be created by any user after email/password based registration or login. Restaurant data, including menu can be viewed or updated only after authentication.

## Menu and order
- Restaurant's menu is available through QR code on table that links to a url like `/m/unique-restaurant-and-table-code`
- Each table or room (of hotel) will have a unique URL with the same menu
- Menu has search on top and items listed by sections
- For each item, user can tap `Add to order` along with a quantity
- User can see summary, and place the order
- The placed orders are visible to the restaurant managers instantly

## Registering a restaurant
- User needs to authenticate with email, password or phone number and password
- At least 2 managers are needed (same authentication) to register a restaurant
- Restaurant's name, address, establishment year are needed
- Restaurant's picture and link to Google Maps listing is needed

## Menu management
- Managers can create sections and items in menu
- There can be multiple tables or rooms (of hotel) - each having a unique name
- Each location (table, room) gets a unique code that becomes part of the URL that users see
- Each location URL can be printed as QR
- We should generate page(s) containing selected QRs that can be printed

## Technical preferences
- Rust in the backend
- GitHub Actions based CI/CD
- Thorough tests for restaurant side of the API
- Solid JS based web admin app for restaurants - TypeScript and Tailwind CSS with shadcn components (solid-ui)
- Astro based menu selection and ordering app - (minimal) TypeScript and Tailwind CSS

## Clarifying Questions
**Database & Storage:**
- What database should we use? (PostgreSQL, SQLite, etc.)
SQLite with `litestream` based continuous backup

- Should we store images locally or use a cloud service?
Locally with S3 separate backup scripts

- Do we need data backup and recovery features?
Yes, continuous backup of SQLite DB and separate recovery scripts

**Authentication & Security:**
- Should we use JWT tokens or session-based authentication?
JWT based authentication

- Do we need password reset functionality?
Yes

- Should we support social login (Google, Facebook)?
No

- Do we need rate limiting for API endpoints?
No

**Restaurant Management:**
- Can a restaurant have multiple managers with different permission levels?
The first manager is super admin and they can send invites to others via link to email or phone number. Super admin can remove managers. Menu management permission has to be given by super admin to managers. Every manager can view all orders for current day.

- Should we support menu item variants (sizes, add-ons, special requests)?
Not now

- Do we need support for dietary restrictions/allergens?
Not now

- Should we track inventory/stock levels?
Not now

- Do we need support for multiple menus (breakfast, lunch, dinner)?
Not now, lets keep menu simple for now

**Ordering & Payment:**
- Do we need to integrate with payment processors (Stripe, PayPal)?
No

- Should we support order modifications after placement?
No

- Do we need order status tracking (preparing, ready, delivered)?
No

- Should guests receive order confirmations via email/SMS?
Only in the UI of the menu app

**QR Code & Table Management:**
- How many QR codes per table/room?
One per table/room

- Should QR codes be regenerated periodically for security?
Managers can refresh QR codes and print as needed

- Do we need to track which table placed which order?
Yes, that is why each table/room gets a unique code/URL

- Should we support dynamic table names (e.g., "Table 5" vs "Patio Table")?
Table/room names should be given by managers and not be dynamic

**Deployment & Infrastructure:**
- Where should we deploy? (Render, AWS, DigitalOcean, etc.)
Any SSH based VPS provider for backend, S3 compatible storage for DB backups. Web apps to be hosted by CloudFlare.

- Do we need staging/production environments?
Not nows

- Should we use Docker containers?
No

- Do we need monitoring and logging?
Yes, Sentry. I will share their URL/API key in config file

**Additional Features:**
- Do we need analytics/dashboard for restaurant performance?
No

- Should we support customer feedback/ratings?
No

- Do we need multi-language support?
No

- Should we support promotional codes/discounts?
No

- Do we need offline capability for the ordering app?
No

**Technical Details:**
- What's the expected max concurrent users per restaurant?
Below 100

- Should we use a specific Rust framework (Actix, Rocket, Axum)?
Actix Web

- Do you want REST or GraphQL API?
REST API

- For JWT secret - should I use environment variable or generate a config file?
A `settings.ini` or `local.settings.ini` file for this and all other settings

**Restaurant Setup:**
- When inviting managers, should we send actual email/SMS or just generate invite links?
Lets just generate links that super admin can copy

- Do we need restaurant approval/validation before going live?
No, a restaurtant does not need any approval. They choose to make their menu live.

- Should we support restaurant logo upload?
Not now

**QR Codes:**
- What format for QR codes (PNG, SVG, PDF)?
Whatever is easy for us to build and to for restaurants to print

- Should QR codes include table numbers on them when printed?
Each QR code is for the unique link that has restaurant and table/room reference but we can also show the table/room name below the code for guests

**File Structure:**
- Should I create a monorepo with backend and frontend folders, or separate repos?
Monorepo
