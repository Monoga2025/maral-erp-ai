# backend

Node.js 20 + Express 4 + TypeScript API for MARAL OS. Talks to PostgreSQL through Prisma 5.

- `src/`: application code (routes, business rules, AI clients, background workers). See `src/README.md`.
- `prisma/`: `schema.prisma` (the data model) and the migration history. See `prisma/README.md`.
- `scripts/`: Python helper for backfilling merged data. See `scripts/README.md`.
- `Dockerfile`: multi-stage build that runs `node dist/index.js` on port 3001.
- `.env.example`: every variable the API reads, with placeholders only.

Scripts (`package.json`): `dev` (tsx watch), `build` (tsc), `start`, `db:generate`, `db:push`, `db:migrate`, `db:seed`.
