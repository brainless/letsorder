# Menu App - Guest Ordering System

A fast, mobile-first Astro-based web application for guests to browse restaurant menus and place orders via QR codes.

## Features

- **Mobile-First Design**: Optimized for mobile devices with responsive layout
- **TypeScript**: Strict type checking enabled
- **Tailwind CSS**: Utility-first CSS framework
- **Dynamic Routes**: Supports `/m/{restaurant_code}/{table_code}` URL structure
- **CloudFlare Pages Ready**: Configured for static site deployment
- **API Integration**: Ready for backend API integration

## URL Structure

- `/m/{restaurant_code}/{table_code}` - Menu page for specific restaurant and table

## API Endpoints

The app is configured to use these backend endpoints:

- `GET /menu/{restaurant_code}/{table_code}` - Get public menu
- `POST /orders` - Create order (no auth required)  
- `GET /orders/{order_id}` - Get order details (no auth required)

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
PUBLIC_API_BASE_URL=http://localhost:8080
PUBLIC_API_VERSION=v1
PUBLIC_ENVIRONMENT=development
```

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`     |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 🚀 Project Structure

```text
src/
├── components/     # Reusable components
├── layouts/        # Page layouts
├── lib/           # Utilities (API calls, etc.)
├── pages/         # Routes
│   ├── index.astro
│   └── m/
│       └── [restaurant_code]/
│           └── [table_code].astro
└── styles/        # Global styles
```

## Key Components

- `Layout.astro` - Base layout with mobile-first design
- `MenuItem.astro` - Individual menu item component
- `api.ts` - API utility functions for menu and orders

## Deployment

Configured for CloudFlare Pages deployment with static output and mobile-responsive design.
