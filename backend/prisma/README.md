# prisma

Data model and database tooling for the backend.

- `schema.prisma`: PostgreSQL datasource (`DATABASE_URL`) and about 40 models covering clients, catalog, quotations, orders, production, inventory, purchasing, invoicing (DIAN), expenses, tasks, WhatsApp, campaigns, AI usage and drip sequences. Enums cover roles (`GERENTE`, `VENTAS`, `LOGISTICA`, `CONTADORA`), order and campaign states, and lead temperature.
- `migrations/`: one migration (`20260425000000_safe_enum_to_text`). The schema is normally applied with `prisma db push`, so a full migration baseline is still missing.
- `seed.ts`: demo users and sample data. The seed password comes from `SEED_PASSWORD`. Automatic seeding at boot lives in `src/lib/autoSeed.ts`.
- `sync_catalog.ts`: loads the product catalog into the database.
- Other one-off scripts (`add-janneth.ts`, `update-team-2026.ts`, `set-user-phones.ts`, `set-quotation-number.ts`, `check-seq.ts`, `seed-team-tasks.ts`, `import-john-tasks.js`, `bootstrap-maral-users.js`, `test-task-notify.ts`) are data maintenance helpers. Read them before running them against a real database.
