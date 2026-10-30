# scripts

Python helper for maintenance work on existing data.

- `merlin-backfill.py`: backfills records from a legacy source. It parses a PostgreSQL URL from the environment (`DATABASE_URL`), so keep that value outside the repository.

Keep credentials in environment variables only.
