# Supabase PostgreSQL Provisioning

## Target

Provision a Supabase PostgreSQL 15+ database for CryptoMarketAnalysis with serverless-compatible connection pooling.

## Required Project Settings

- Project name: `crypto-market-analysis`
- Database: PostgreSQL 15 or newer
- Region: choose the closest production user region
- Pooling: Supavisor transaction mode
- Backups: daily backups with 30-day retention where the Supabase plan supports it

## Environment Variables

Copy `apps/api/.env.example` to `apps/api/.env` locally and fill:

- `SUPABASE_DATABASE_URL`: Supavisor transaction-mode pooler URL for application runtime
- `SUPABASE_DIRECT_DATABASE_URL`: direct database URL for migrations/admin-only local tasks

Do not commit real `.env` files.

## Verification Checklist

- Supabase project exists and is named `crypto-market-analysis`.
- PostgreSQL version is 15 or newer.
- Transaction-mode pooler connection string is available.
- Local `apps/api/.env` contains `SUPABASE_DATABASE_URL`.
- Direct URL is available locally for migrations if needed.
- Database can be reached from local development tooling.
- Backup retention is configured according to the chosen Supabase plan.
