# Upstash Redis and QStash Provisioning

## Target

Provision serverless-compatible Redis and background job infrastructure for CryptoMarketAnalysis.

## Redis

- Database name: `crypto-market-analysis-cache`
- Plan: free tier where possible
- REST API: enabled
- Intended use: session storage, API rate limiting, chart data cache

## QStash

- Intended use: scheduled data refresh and alert evaluation HTTP jobs
- Runtime pattern: QStash calls API endpoints protected by signing/token validation in later stories

## Environment Variables

Copy `apps/api/.env.example` to `apps/api/.env` locally and fill:

- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`
- `QSTASH_URL`
- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `QSTASH_DAILY_REFRESH_URL` (`https://<api-domain>/api/jobs/daily-data-refresh`)
- `QSTASH_DAILY_REFRESH_SCHEDULE_ID` if replacing an existing schedule from the admin panel

Do not commit real `.env` files.

## Verification Checklist

- Upstash Redis database exists as `crypto-market-analysis-cache`.
- REST URL and token are available.
- QStash token is available.
- QStash signing keys are configured in the API runtime.
- Daily refresh destination points to `/api/jobs/daily-data-refresh`.
- A test QStash publish request returns 200 OK.
- Deployment secrets are configured in Vercel when deployment begins.
