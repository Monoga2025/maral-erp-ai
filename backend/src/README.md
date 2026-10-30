# src

Application code for the API.

- `index.ts`: Express app setup (CORS, 10 MB JSON limit, `/health`, static `/uploads`, all `/api/*` routers, and the SPA fallback when the frontend build is present). Starts background workers based on `STARTUP_SEED_ENABLED` and `BACKGROUND_JOBS_ENABLED`.
- `routes/`: HTTP endpoints, one router per module. See `routes/README.md`.
- `lib/`: business rules, integrations and AI clients. See `lib/README.md`.
- `middleware/auth.ts`: JWT authentication and role checks.
- `jobs/weekly-report.ts`: weekly management report, sent through WhatsApp to a configured number.
- `assets/logo.png`: default logo for printed documents.
