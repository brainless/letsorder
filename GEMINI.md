This is my understanding of the project.

## Project: letsorder

Complete menu management, browsing and ordering app for restaurants and guests.

## Development Workflow
- Create a new branch for each task
- Branch names should start with chore/ or feature/ or fix/
- Please add tests for any new features added, particularly integration tests
- Please run formatters, linters and tests before committing changes
- When finished please commit and push to the new branch
- Please mention GitHub issue if provided
- After working on an issue from GitHub, update issue's tasks and open PR

### Users

*   **Restaurant Managers:** Manage restaurant details, menus, and orders.
*   **Guests:** Browse the menu, place and modify orders. No login required.

### Core Features

*   **Menu Access:** Guests access menus via QR codes on tables, leading to a URL like `/m/unique-restaurant-and-table-code`.
*   **Ordering:** Guests can add items to an order, view a summary, and place the order.
*   **Restaurant Management:**
    *   Managers can register a restaurant after authentication.
    *   Requires at least two managers for registration.
    *   Managers can create menu sections and items.
    *   Each table/room gets a unique QR code.
*   **Manager Roles:**
    *   The first manager is a "super admin" with full control.
    *   Super admins can invite other managers and assign permissions.

### Technical Stack

*   **Backend:** Rust with Actix Web.
*   **Admin App:** SolidJS with TypeScript, Tailwind CSS, and shadcn/solid-ui.
*   **Menu App:** Astro with TypeScript and Tailwind CSS.
*   **Database:** SQLite with `litestream` for continuous backup to S3-compatible storage.
*   **Authentication:** JWT-based.
*   **Deployment:**
    *   Backend on a VPS.
    *   Web apps on CloudFlare Pages.
*   **CI/CD:** GitHub Actions.
*   **Monitoring:** Sentry.
*   **Configuration:** `settings.ini` file.

### Architecture

*   Monorepo structure with `backend`, `admin`, `menu`, and `shared` directories.
*   REST API for communication between frontend and backend.

### Key Decisions

*   **Simplicity:** No payment integration, social login, real-time features, menu variants, or inventory tracking in the initial version.
*   **Local Storage:** Images are stored locally.
*   **Manual Invites:** Managers are invited via generated links.
*   **No Approval:** Restaurants can go live without approval.
*   **Focus on Backend Testing:** Thorough testing of the backend API is a priority.
