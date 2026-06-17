# Development Status

Last updated: 2026-06-17

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
| Epic 6: Personalized Dashboard & KPI Widgets | In progress | Stories 6.1 through 6.3 are complete; Story 6.4 is next. |
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
| 6.2 Implement Default Dashboard Initialization | Done | Added `GET /api/dashboard/widgets`, which creates the 5 default widgets (BTC Price, 24h Change, MVRV Z-Score, Stock-to-Flow Ratio, Fear & Greed Index) for a user on first visit and returns each with a formatted value, up/down/flat trend, and last-updated time. Closed a real data gap found while building this: MVRV Z-Score and Fear & Greed Index had no data source anywhere in the codebase (Epic 4 only ever computed Stock-to-Flow/Rainbow/moving averages), so added `FearGreedClient` (alternative.me, free/no-key) and `BitcoinDataClient` (bitcoin-data.com, free/no-key) to `calculation-engines/data-sources` and wired both into the daily refresh job, storing `fear_greed_index`/`mvrv_zscore` rows in `bitcoin_metrics_daily`; a failure in either external source is logged and skipped rather than failing the whole refresh. The Angular dashboard page now renders a live 2-column (1-column on mobile) widget grid with a loading state and trend arrows, replacing the old static mock cards. |
| 6.3 Implement Predefined Widget Library | Done | Added an "Add Widget" modal (3 categories: Price Metrics, On-chain Metrics, Supply Metrics; 7 widgets: Realized Price, 200-day Moving Average, Hash Rate, Mining Difficulty, Total Supply, Circulating Supply, Market Cap) with case-insensitive real-time search and an "Added" disabled state for widgets already on the dashboard. Backend: `POST /api/dashboard/widgets` validates the widget type against a server-side catalog, enforces a 20-widget-per-dashboard cap (400 `Maximum 20 widgets per dashboard`), and appends at `max(position) + 1`. Extended the daily refresh job with 3 more real, free, no-key external metrics — `BitcoinDataClient.fetchRealizedPrice()` (bitcoin-data.com) and generalized `BlockchainInfoClient` with `fetchHashRate`/`fetchDifficulty` (api.blockchain.info, the same provider already used for price fallback) — and added a `ma_200_day` indicator (reusing the existing generic `calculateMovingAverage`) computed directly from price history already in `bitcoin_price_daily`, so all 7 catalog widgets show real data once the refresh job has run. Total Supply is rendered as the fixed 21,000,000 BTC constant (no external call); Circulating Supply and Market Cap read directly from existing `bitcoin_price_daily` columns. |
| 6.4 Implement Custom Formula Widget Creation | Done |
| 6.5 Implement Formula Parser Library | Done | Extracted `validateFormula` / `evaluateFormula` from `apps/api/src/services/formula-evaluator.ts` into the pre-scaffolded `libs/calculation-engines/formula-parser` library (`@crypto-market-analysis/calculation-engines/formula-parser`). Updated `dashboard.service.ts` to import from the library path alias. Deleted the now-redundant local `formula-evaluator.ts` and `formula-evaluator.spec.ts`; the 16 tests live in the library's spec file. |
| 6.6 Implement Widget Drag-and-Drop Reordering | Done | Added pointer-events based drag-and-drop reordering for dashboard widgets (works on desktop mouse and mobile touch via the unified Pointer Events API). Each widget card shows a ⠿ drag handle with `touch-action: none`. `onPointerDown` captures the pointer via `setPointerCapture`; `onPointerMove` uses `document.elementFromPoint` + `closest('[data-widget-id]')` to identify the drop target; `onPointerUp` calls `performReorder` which splices the widget array in-place and calls `reorderDashboardWidgets` to persist. On API failure, the widget list is reloaded from the server. Backend: `PATCH /api/dashboard/widgets/reorder` accepts `{ orderedIds: string[] }`, validates (non-empty, all strings, no duplicates, ≤20), and calls a new `DashboardWidgetRepository.reorderWidgets()` that uses a PostgreSQL `unnest($2::text[], $3::int[])` join for an efficient single-query bulk position update. Styles: `is-dragging` (opacity 0.4) and `drag-over` (blue border highlight) classes; grab/grabbing cursor. |

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
- `npm exec nx -- run-many --target=test --projects=api,web,data-access-api-client,data-sources --skip-nx-cache` passed (201 tests total: api 128, web 31, data-access-api-client 15, data-sources 27).
- `npm exec nx -- run api:build:production --skip-nx-cache` passed.
- `npm exec nx -- run api:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run data-sources:build --skip-nx-cache` passed.
- `npm exec nx -- run data-sources:eslint:lint --skip-nx-cache` passed.
- `npm exec nx -- run-many --target=test --projects=api,web,data-access-api-client,data-sources,indicators --skip-nx-cache` passed (237 tests total: api 142, web 38, data-access-api-client 16, data-sources 30, indicators 11).
- `npm exec nx -- run-many --target=build --projects=api,web,data-access-api-client,data-sources,indicators --skip-nx-cache` passed.
- `npm exec nx -- run-many --target=eslint:lint --projects=api,web,data-access-api-client,data-sources,indicators --skip-nx-cache` passed.
- `npm exec nx -- run api:test --skip-nx-cache` passed with 166 tests.
- `npm exec nx -- run api:build:production --skip-nx-cache` passed.
- `npm exec nx -- run-many --target=eslint:lint --projects=api,data-access-api-client,data-sources,indicators --skip-nx-cache` passed (web has pre-existing lint errors in lazy-loaded component imports not caused by this story).
- `npm exec nx -- run web:test --skip-nx-cache` passed with 42 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
- `npm exec nx -- run api:test --skip-nx-cache` passed with 159 tests.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 46 tests.
- `npm exec nx -- run data-access-api-client:test --skip-nx-cache` passed with 18 tests.
- `npm exec nx -- run-many --target=build --projects=api,web,data-access-api-client --skip-nx-cache` passed.
- `npm exec nx -- run-many --target=eslint:lint --projects=api,data-access-api-client --skip-nx-cache` passed (web has pre-existing lint errors).

## Next Step

Begin Epic 6, Story 6.7: Implement Recent Charts Quick Access.

## Notes

- The current working tree contains uncommitted development work from Epic 4, Epic 5, and Epic 6 stories.
- Live external API calls are limited in the local sandbox, so network-dependent smoke tests may fail with `fetch failed` even when the code path is correct.
- Story 5.10 was verified with component-level tests that mock `ActivatedRoute`/`Router`/`AuthApiClient` rather than a live browser run, since the app's API depends on a real remote Supabase database that should not be exercised from this sandbox.
- Story 6.1's new migration was verified by schema-content assertions (mirroring the existing `bitcoin-metrics-schema.spec.ts` pattern) rather than against a live database, for the same reason.
- Story 6.2's `FearGreedClient` and what is now `BitcoinDataClient` (renamed from `MvrvZScoreClient` in 6.3 once it grew a second method) real-endpoint shapes (alternative.me, bitcoin-data.com) were confirmed by live `curl` against the actual third-party APIs before writing the client code, then all subsequent tests mock `fetch` for determinism — no live calls happen during `nx test`.
- Story 6.3's `hash-rate`/`difficulty` blockchain.info endpoints were likewise confirmed live via `curl` before implementation; `BlockchainInfoClient` was refactored to a shared `fetchChart` helper so `fetchMarketPrice`/`fetchHashRate`/`fetchDifficulty` share one retry/parsing path.
- Historical backfill does not populate `mvrv_zscore`/`fear_greed_index`/`realized_price`/`hash_rate`/`mining_difficulty`/`ma_200_day` (or the other derived metrics) for past dates, only going forward from each daily refresh run; this mirrors the pre-existing behavior for `rainbow_band`/`ma_111_day`/`ma_350_day`/`stock_to_flow_ratio`, which also only get backfilled from whenever the refresh job starts running, not retroactively.
