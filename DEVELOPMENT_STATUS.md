# Development Status

Last updated: 2026-06-16

This file is the quick human-readable progress tracker for the project. The detailed story tracker lives in `_bmad-output/implementation-artifacts/sprint-status.yaml`, and detailed implementation notes live in `_bmad-output/implementation-artifacts/`.

## Current Focus

Epic 6: Personalized Dashboard & KPI Widgets

## Overall Status

| Area | Status | Notes |
| --- | --- | --- |
| Epic 1: Project Foundation & Infrastructure Setup | In progress | Core project setup is mostly done; Supabase provisioning and some infrastructure tasks remain. |
| Epic 2: User Authentication & Role Management | Done | Registration, verification, login, OAuth, password reset, RBAC, auth rate limiting, and profile endpoints are complete. |
| Epic 3: User Onboarding Experience | Done | i18n, onboarding carousel, completion tracking, and translations are complete. |
| Epic 4: Bitcoin Data Pipeline & Calculation Engine | Done | Stories 4.1 through 4.8 are complete. |
| Epic 5: Chart Visualization System | Done | Stories 5.1 through 5.10 are complete. |
| Epic 6: Personalized Dashboard & KPI Widgets | In progress | Story 6.1 is complete; Story 6.2 is next. |
| Epics 7-9 | Backlog | Alerts, donation, and admin management work remain. |

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

## Epic 5 Progress

| Story | Status | Summary |
| --- | --- | --- |
| 5.1 Create Chart Data API Endpoints | Done | Bitcoin Rainbow, Pi Cycle Top, and Stock-to-Flow chart data endpoints. |
| 5.2 Implement Chart Library Navigation Page | Done | Filterable chart library with category grouping. |
| 5.3 Create Chart.js Visualization Component | Done | Shared zoom/pan-enabled chart viewer with PNG export support. |
| 5.4 Implement Bitcoin Rainbow Price Chart Page | Done | Logarithmic rainbow-band chart page with annotations and export. |
| 5.5 Implement Pi Cycle Top Indicator Chart Page | Done | Moving-average crossover chart page with signal annotations. |
| 5.6 Implement Stock-to-Flow Model Chart Page | Done | Scarcity-model chart page with halving and divergence annotations. |
| 5.7 Implement Chart Export (PNG and CSV) | Done | Shared export utility used by all chart pages. |
| 5.8 Implement Chart Annotations (Text Notes and Trend Lines) | Done | Persisted per-user chart annotations component and API. |
| 5.9 Implement Chart Information Panel | Done | Shared info panel showing current values, interpretation, and data sources. |
| 5.10 Implement Timeframe Selection and URL State | Done | Timeframe selection now syncs with the `timeframe` URL query param across all three chart pages: selecting a timeframe pushes a new URL/history entry, loading a URL with a timeframe pre-selects and highlights it, invalid timeframe values are corrected to `all` via a replaced URL entry, and zoom/pan state is intentionally not persisted to the URL. |

## Epic 6 Progress

| Story | Status | Summary |
| --- | --- | --- |
| 6.1 Create Dashboard Database Schema | Done | Added `user_dashboard_widgets` (position-ordered, JSONB config, 0-19 position bound) and `user_recent_charts` (per-user unique chart, most-recent-first index) tables via migration `008_create_dashboard_schema.sql`, both cascading on user delete and RLS-enabled; also backfilled `database/schema.sql` with the previously missing `006`/`007` migration references. |

## Latest Verification

- `npm exec nx -- test web --runInBand` passed with 20 tests.
- `npm exec nx -- build web --configuration=production` passed.
- `npm exec nx -- lint web` passed.
- `npm exec nx -- run api:test --skip-nx-cache` passed with 110 tests on rerun; Nx marked the first parallel run as flaky.
- `npm exec nx -- run api:build:production --skip-nx-cache` passed.
- `npm exec nx -- run api:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 19 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run data-access-api-client:test --skip-nx-cache` passed with 14 tests.
- `npm exec nx -- run data-access-api-client:build:production --skip-nx-cache` passed.
- `npm exec nx -- run data-access-api-client:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 18 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 14 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run data-access-api-client:test --skip-nx-cache` passed with 13 tests.
- `npm exec nx -- run data-access-api-client:build:production --skip-nx-cache` passed.
- `npm exec nx -- run data-access-api-client:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 14 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run data-access-api-client:test --skip-nx-cache` passed with 12 tests.
- `npm exec nx -- run data-access-api-client:build:production --skip-nx-cache` passed.
- `npm exec nx -- run data-access-api-client:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 14 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run data-access-api-client:test --skip-nx-cache` passed with 11 tests.
- `npm exec nx -- run data-access-api-client:build:production --skip-nx-cache` passed.
- `npm exec nx -- run data-access-api-client:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 14 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 10 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run api:test --skip-nx-cache` passed with 107 tests.
- `npm exec nx -- run api:build:production --skip-nx-cache` passed.
- `npm exec nx -- run api:eslint:lint --skip-nx-cache` passed.
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
- `npm exec nx -- run web:test --skip-nx-cache` passed with 28 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run api:test --skip-nx-cache` passed with 113 tests.
- `npm exec nx -- run api:build:production --skip-nx-cache` passed.
- `npm exec nx -- run api:eslint:lint --skip-nx-cache` passed.

## Next Step

Begin Epic 6, Story 6.2: Implement Default Dashboard Initialization.

## Notes

- The current working tree contains uncommitted development work from Epic 4, Epic 5, and Epic 6 stories.
- Live external API calls are limited in the local sandbox, so network-dependent smoke tests may fail with `fetch failed` even when the code path is correct.
- Story 5.10 was verified with component-level tests that mock `ActivatedRoute`/`Router`/`AuthApiClient` rather than a live browser run, since the app's API depends on a real remote Supabase database that should not be exercised from this sandbox.
- Story 6.1's new migration was verified by schema-content assertions (mirroring the existing `bitcoin-metrics-schema.spec.ts` pattern) rather than against a live database, for the same reason.
