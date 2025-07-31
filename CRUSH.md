# Development Workflow
- Create a new branch for each task
- Branch names should start with chore/ or feature/ or fix/
- Please add tests for any new features added, particularly integration tests
- Please run formatters, linters and tests before committing changes
- When finished please commit and push to the new branch
- Please mention GitHub issue if provided
- After working on an issue from GitHub, update issue's tasks and open PR

# Development Commands

## Backend
```bash
cd backend
cargo run --release
cargo test
cargo clippy
```

## Admin App
```bash
cd admin
npm run dev
npm run build
```

## Menu App
```bash
cd menu
npm run dev
npm run build
```

## Database
```bash
# Backup
cd backend
litestream replicate

# Restore
litestream restore -o db.sqlite3
```

## Style Guide
- Rust: Standard formatting
- TypeScript: Strict mode, no any
- Tailwind: shadcn components
- API: RESTful conventions
