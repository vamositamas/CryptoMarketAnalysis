# Development Status

Last updated: 2026-06-15

This file is the quick human-readable progress tracker for the project. The detailed story tracker lives in `_bmad-output/implementation-artifacts/sprint-status.yaml`, and detailed implementation notes live in `_bmad-output/implementation-artifacts/`.

## Current Focus

Epic 5: Chart Visualization System

## Overall Status

| Area | Status | Notes |
| --- | --- | --- |
| Epic 1: Project Foundation & Infrastructure Setup | In progress | Core project setup is mostly done; Supabase provisioning and some infrastructure tasks remain. |
| Epic 2: User Authentication & Role Management | Done | Registration, verification, login, OAuth, password reset, RBAC, auth rate limiting, and profile endpoints are complete. |
| Epic 3: User Onboarding Experience | Done | i18n, onboarding carousel, completion tracking, and translations are complete. |
| Epic 4: Bitcoin Data Pipeline & Calculation Engine | Done | Stories 4.1 through 4.8 are complete. |
| Epic 5: Chart Visualization System | Backlog | Story 5.1 is next. |
| Epics 6-9 | Backlog | Dashboard, alerts, donation, and admin management work remain. |

## Epic 4 Progress

| Story | Status | Summary |
| --- | --- | --- |
| 4.1 Create Bitcoin Metrics Database Schema | Done | Added Bitcoin daily price and metrics tables. |
| 4.2 Implement CoinGecko API Client with Rate Limiting | Done | Added rate-limited CoinGecko historical market data client. |
| 4.3 Implement Blockchain.info API Client Fallback | Done | Added Blockchain.info market price fallback client. |
| 4.4 Implement Historical Data Initialization Job | Done | Added historical backfill CLI with chunking, fallback, retry, and batch upsert. |
| 4.5 Implement Daily Data Refresh Background Job | Done | Added QStash-protected daily refresh endpoint with fallback and failure alerting. |
| 4.6 Implement Indicator Calculation Library | Done | Added moving averages, Stock-to-Flow, Rainbow bands, and daily metric upserts. |
| 4.7 Create Data Refresh Configuration Admin Panel | Done | Added admin configuration API, persistence, optional QStash schedule updates, and guarded Angular admin panel. |
| 4.8 Implement API Retry Logic with Exponential Backoff | Done | Added reusable exponential backoff retry handling and wired both Bitcoin data providers through it. |

## Latest Verification

- `npm exec nx -- run api:test --skip-nx-cache` passed with 99 tests.
- `npm exec nx -- run api:build:production --skip-nx-cache` passed.
- `npm exec nx -- run api:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 7 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run indicators:test --skip-nx-cache` passed with 11 tests.
- `npm exec nx -- run indicators:build --skip-nx-cache` passed.
- `npm exec nx -- run indicators:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run data-sources:test --skip-nx-cache` passed with 17 tests.
- `npm exec nx -- run data-sources:build --skip-nx-cache` passed.
- `npm exec nx -- run data-sources:eslint:lint --skip-nx-cache` passed.

## Next Step

Begin Epic 5, Story 5.1: Create Chart Data API Endpoints.

Expected work:

- Add chart data API endpoints for Bitcoin Rainbow, Pi Cycle Top, and Stock-to-Flow.
- Query `bitcoin_price_daily` and `bitcoin_metrics_daily` with timeframe filtering.
- Return Chart.js-friendly data contracts.
- Update this file and the sprint tracker when complete.

## Notes

- The current working tree contains uncommitted development work from Epic 4 stories.
- Live external API calls are limited in the local sandbox, so network-dependent smoke tests may fail with `fetch failed` even when the code path is correct.
