# Development Status

Last updated: 2026-06-18

This file is the quick human-readable progress tracker for the project. The detailed story tracker lives in `_bmad-output/implementation-artifacts/sprint-status.yaml`, and detailed implementation notes live in `_bmad-output/implementation-artifacts/`.

## Current Focus

All Epics 1–9 complete. Awaiting next epic or production deployment.

## Overall Status

| Area | Status | Notes |
| --- | --- | --- |
| Epic 1: Project Foundation & Infrastructure Setup | In progress | Core project setup is mostly done; Supabase provisioning and some infrastructure tasks remain. |
| Epic 2: User Authentication & Role Management | Done | Registration, verification, login, OAuth, password reset, RBAC, auth rate limiting, and profile endpoints are complete. |
| Epic 3: User Onboarding Experience | Done | i18n, onboarding carousel, completion tracking, and translations are complete. |
| Epic 4: Bitcoin Data Pipeline & Calculation Engine | Done | Stories 4.1 through 4.8 are complete. |
| Epic 5: Chart Visualization System | Done | Stories 5.1 through 5.10 are complete. |
| Epic 6: Personalized Dashboard & KPI Widgets | Done | All stories 6.1 through 6.7 are complete. |
| Epic 7: Alert System & Notifications | Done | All stories 7.1 through 7.6 are complete. |
| Epic 8: Donation Flow & Premium Upgrade | Done | All stories 8.1 through 8.6 are complete. |
| Epic 9: Admin Management | Done | All stories 9.1 through 9.9 are complete. |

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
| 6.1 Create Dashboard Database Schema | Done | Added `user_dashboard_widgets` (position-ordered, JSONB config, 0-39 position bound) and `user_recent_charts` (per-user unique chart, most-recent-first index) tables via migration `008_create_dashboard_schema.sql`, both cascading on user delete and RLS-enabled; also backfilled `database/schema.sql` with the previously missing `006`/`007` migration references. |
| 6.2 Implement Default Dashboard Initialization | Done | Added `GET /api/dashboard/widgets`, which creates the 5 default widgets (BTC Price, 24h Change, MVRV Z-Score, Stock-to-Flow Ratio, Fear & Greed Index) for a user on first visit and returns each with a formatted value, up/down/flat trend, and last-updated time. Closed a real data gap found while building this: MVRV Z-Score and Fear & Greed Index had no data source anywhere in the codebase (Epic 4 only ever computed Stock-to-Flow/Rainbow/moving averages), so added `FearGreedClient` (alternative.me, free/no-key) and `BitcoinDataClient` (bitcoin-data.com, free/no-key) to `calculation-engines/data-sources` and wired both into the daily refresh job, storing `fear_greed_index`/`mvrv_zscore` rows in `bitcoin_metrics_daily`; a failure in either external source is logged and skipped rather than failing the whole refresh. The Angular dashboard page now renders a live 2-column (1-column on mobile) widget grid with a loading state and trend arrows, replacing the old static mock cards. |
| 6.3 Implement Predefined Widget Library | Done | Added an "Add Widget" modal (3 categories: Price Metrics, On-chain Metrics, Supply Metrics; 7 widgets: Realized Price, 200-day Moving Average, Hash Rate, Mining Difficulty, Total Supply, Circulating Supply, Market Cap) with case-insensitive real-time search and an "Added" disabled state for widgets already on the dashboard. Backend: `POST /api/dashboard/widgets` validates the widget type against a server-side catalog, enforces a 40-widget-per-dashboard cap (400 `Maximum 40 widgets per dashboard`), and appends at `max(position) + 1`. Extended the daily refresh job with 3 more real, free, no-key external metrics — `BitcoinDataClient.fetchRealizedPrice()` (bitcoin-data.com) and generalized `BlockchainInfoClient` with `fetchHashRate`/`fetchDifficulty` (api.blockchain.info, the same provider already used for price fallback) — and added a `ma_200_day` indicator (reusing the existing generic `calculateMovingAverage`) computed directly from price history already in `bitcoin_price_daily`, so all 7 catalog widgets show real data once the refresh job has run. Total Supply is rendered as the fixed 21,000,000 BTC constant (no external call); Circulating Supply and Market Cap read directly from existing `bitcoin_price_daily` columns. |
| 6.4 Implement Custom Formula Widget Creation | Done |
| 6.5 Implement Formula Parser Library | Done | Extracted `validateFormula` / `evaluateFormula` from `apps/api/src/services/formula-evaluator.ts` into the pre-scaffolded `libs/calculation-engines/formula-parser` library (`@crypto-market-analysis/calculation-engines/formula-parser`). Updated `dashboard.service.ts` to import from the library path alias. Deleted the now-redundant local `formula-evaluator.ts` and `formula-evaluator.spec.ts`; the 16 tests live in the library's spec file. |
| 6.6 Implement Widget Drag-and-Drop Reordering | Done | Added pointer-events based drag-and-drop reordering for dashboard widgets (works on desktop mouse and mobile touch via the unified Pointer Events API). Each widget card shows a ⠿ drag handle with `touch-action: none`. `onPointerDown` captures the pointer via `setPointerCapture`; `onPointerMove` uses `document.elementFromPoint` + `closest('[data-widget-id]')` to identify the drop target; `onPointerUp` calls `performReorder` which splices the widget array in-place and calls `reorderDashboardWidgets` to persist. On API failure, the widget list is reloaded from the server. Backend: `PATCH /api/dashboard/widgets/reorder` accepts `{ orderedIds: string[] }`, validates (non-empty, all strings, no duplicates, ≤20), and calls a new `DashboardWidgetRepository.reorderWidgets()` that uses a PostgreSQL `unnest($2::text[], $3::int[])` join for an efficient single-query bulk position update. Styles: `is-dragging` (opacity 0.4) and `drag-over` (blue border highlight) classes; grab/grabbing cursor. |
| 6.7 Implement Recent Charts Quick Access | Done | Each of the 3 chart pages (`bitcoin-rainbow`, `pi-cycle-top`, `stock-to-flow`) fires `recordRecentChart(chartId)` on load (fire-and-forget). Backend: `POST /api/users/me/recent-charts` upserts via `ON CONFLICT (user_id, chart_id) DO UPDATE SET viewed_at = NOW()` then prunes to 5 via subquery; `GET /api/users/me/recent-charts` returns up to 5 entries enriched with title/URL/thumbnail from a server-side CHART_CATALOG. `RecentChartsRepository` and `RecentChartsService` are new; `createUsersRouter` gains an optional 4th `recentChartsService` parameter. Dashboard: new "Recently Viewed Charts" section renders a horizontal scroll row of thumbnail cards (each is an `<a [routerLink]>` navigating to the chart); empty state shows "No charts viewed yet…" with an "Explore Charts" link; relative time formatter (`Just now / N minutes/hours/days ago`). Dashboard spec updated with `provideRouter([])` to satisfy `RouterLink`'s `ActivatedRoute` dependency. |

## Epic 7 Progress

| Story | Status | Summary |
| --- | --- | --- |
| 7.1 Create Alerts Database Schema | Done | Added `user_alerts` (id, user_id, chart_id, metric_name, condition, threshold_value, alert_name, status, created_at, last_evaluated_at, triggered_at) and `alert_triggers` (id, alert_id, triggered_at, metric_value, notification_sent, notification_sent_at) tables via migration `009_create_alerts_schema.sql`. `user_alerts` has CHECK constraints for `condition IN (…5 values…)` and `status IN ('active','triggered','paused')`. Two indexes: `idx_alerts_user_status(user_id, status)` for dashboard listing; `idx_alerts_evaluation(status, last_evaluated_at) WHERE status = 'active'` for the daily evaluation batch. `alert_triggers` has `idx_alert_triggers_alert(alert_id, triggered_at DESC)` for per-alert history. Both tables have RLS enabled and cascade-delete from `users`. Schema verified by 7 content-assertion tests in `alerts-schema.spec.ts` (same pattern as `dashboard-schema.spec.ts`). |
| 7.2 Implement Alert Creation from Chart Pages | Done | Backend: `AlertsRepository.create()` (INSERT returning full record) and `countActiveForUser()` (COUNT WHERE status='active'); `AlertsService.createAlert(userId, userRole, body)` validates chartId (3 allowed values), metricName (non-empty ≤100 chars), condition (5 allowed values), thresholdValue (finite number), alertName (non-empty ≤255 chars), and enforces a 5-alert cap on free_user role (403 with upgrade message); `POST /api/alerts` handler updated to use the service (replacing the stub). Frontend: added `CreateAlertRequest`, `AlertResponse`, `AlertCondition` types and `createAlert()` method to `AuthApiClient`; new standalone `CreateAlertModalComponent` with reactive form (alertName, metricName dropdown pre-selected by chart, condition dropdown with 5 options, thresholdValue number, email checkbox checked+disabled); on success navigates to `/alerts` passing a success message via router state; on error shows message inline keeping modal open. All 3 chart pages (`bitcoin-rainbow`, `pi-cycle-top`, `stock-to-flow`) gained a "Create Alert" button in the chart toolbar that toggles the modal, with chart-specific metric options. Added lazy-loaded `/alerts` route pointing to `AlertsPageComponent` (placeholder for Story 7.3) that reads and displays the router state success message. |
| 7.3 Implement Alerts Dashboard | Done | Backend: `AlertsRepository` extended with `listForUser`, `countForUser`, `deleteForUser`, `resetForUser`; `AlertsService` extended with `listAlerts` (returns alerts+alertLimit with used/max/unlimited), `deleteAlert` (404 if not found), `resetAlert` (404 if not triggered); route extended with `GET /api/alerts`, `DELETE /api/alerts/:alertId`, `PATCH /api/alerts/:alertId/reset`. Frontend: `AuthApiClient` extended with `getAlerts`, `deleteAlert`, `resetAlert`; `AlertsPageComponent` fully implemented with header count label ("N of 5 alerts used" free / "N alerts" premium), alert table (Name/Chart linked/Condition summary/Status badge/Created relative/Actions), inline row-level delete confirmation (Confirm+Cancel), Reset button for triggered alerts, and success message from router state. Status badges: Active (green), Triggered (yellow), Paused (gray). |
| 7.4 Implement Daily Alert Evaluation Job | Done | `AlertEvaluationService.evaluateAlerts(now)` fetches all active alerts, resolves current metric values (BTC price from `bitcoin_price_daily`; others from `bitcoin_metrics_daily` via `DISTINCT ON` latest-date; `ma_350x2_day` aliased to `ma_350_day` ×2), evaluates conditions (`crosses_above`/`greater_than` → value>threshold; `crosses_below`/`less_than` → value<threshold; `equals` → |diff|≤0.01), on trigger: UPDATEs `user_alerts` status→'triggered' and INSERTs into `alert_triggers`; on miss: updates `last_evaluated_at` only. Returns `{ evaluated, triggered, skipped }`. Exposed as `POST /api/jobs/evaluate-alerts` behind QStash signature middleware. `DailyDataRefreshService.run()` now calls `alertEvaluationService.evaluateAlerts()` after metrics are inserted. Both services accept injectable evaluation service for testability. 232 API tests pass. |
| 7.5 Implement Alert Notification Email | Done | Added `AlertTriggeredEmailInput`/`AlertTriggeredEmailSender` interface and `ResendEmailService.sendAlertTriggeredEmail()`. Email subject: "Alert Triggered: {alertName}"; HTML body shows chart title, metric/condition/threshold, current value, triggered-at timestamp, and a link to `/alerts`. Falls back to `console.info` log when `RESEND_API_KEY`/`RESEND_FROM_EMAIL` env vars are absent. `AlertEvaluationService` extended: SELECT now JOINs `users` to fetch `user_email`; after each trigger INSERT returns the trigger `id` (`RETURNING id`), then calls `emailService.sendAlertTriggeredEmail()` and on success UPDATEs `alert_triggers SET notification_sent=true, notification_sent_at=$1`. Email failure is caught and logged via injectable logger — evaluation result is unaffected. `ResendEmailService` injected as default `emailService` in both `createAlertEvaluationRouter` and `DailyDataRefreshService`. 236 API tests pass. |
| 7.6 Implement Email Template Editor | Done | Admin UI to view and override the two email templates (`alert_triggered_html` and `alert_triggered_subject`). Templates stored in `system_configuration` with `email_template_` prefix (no new migration). Backend: `EmailTemplateRepository` (get/set/delete/list backed by `system_configuration`); 3 new admin routes (`GET/PUT/DELETE /api/admin/email-templates/:key`) with key validation and default fallbacks; `AlertEvaluationService` loads custom templates via injectable `TemplateLoader` before the evaluation loop, passing them (or null) to `sendAlertTriggeredEmail`. Frontend: `EmailTemplateEditorComponent` at `/admin/email-templates` with template selector, monospace textarea, Custom/Default badge, Reset-to-Default button, and a variables reference panel showing all 8 `{{placeholder}}` names with descriptions. `substituteTemplateVars()` replaces `{{key}}` patterns before sending. 246 API tests, 72 web tests pass; both production builds succeed. |

## Epic 8 Progress

| Story | Status | Summary |
| --- | --- | --- |
| 8.1 Create Donations Database Schema | Done | Added `donations` table with UUID PK, user_id FK (ON DELETE SET NULL), amount/currency/status/userUpgraded columns, unique index on `paypal_order_id`, and CHECK constraints for amount > 0, status IN (…), and currency length = 3. Migration `010_create_donations_schema.sql`. |
| 8.2 Implement PayPal REST API Integration | Done | `PayPalClient` (native `fetch`, no SDK): `getAccessToken()` (Basic auth), `createOrder()` (returns `{ id, approvalUrl }`), `captureOrder()` (returns `{ transactionId, status }`). `DonationsService.initiate()` creates PayPal order + pending DB record; `handleSuccess()` is idempotent; `handleCancel()` marks as cancelled. `DonationsRepository` with CRUD/list/export. |
| 8.3 Implement Automatic Premium Upgrade on Donation | Done | `DonationsService.upgradeUserRole()` checks `users.role`; if `free_user` → updates to `premium_user` + calls `TokenBlacklistRepository.invalidateUserTokens(userId)` to force re-login. Thank-you page detects 401 gracefully and shows re-login link. |
| 8.4 Implement Donation Thank-You Email | Done | `DonationThankYouEmailSender` interface + `ResendEmailService.sendDonationThankYouEmail()`. Sends amount, transaction ID, date, and premium-benefits list. Falls back to console.info when env vars absent. Sent from `DonationsService.handleSuccess()`. |
| 8.5 Implement Admin Donation View | Done | `GET /api/admin/donations` (paginated, admin-only) and `GET /api/admin/donations/export` (CSV download with `Content-Disposition` header). `DonationsServiceContract` pick type injected via `createAdminRouter` options. |
| 8.6 Implement Security and Encryption | Done | AES-256-GCM encryption of `paypal_transaction_id` in DB when `ENCRYPTION_KEY` env var is present (64 hex chars / 32 bytes). `crypto.utils.ts` with `encrypt()`/`decrypt()`. Idempotent `handleSuccess()` skips re-processing for already-completed donations. Angular donate modal (`DonateModalComponent`) + thank-you page (`DonateThankYouComponent`) + `/donate/thank-you` route (no authGuard since JWT may be invalidated). |

## Latest Verification (Epic 9 complete)

- `npm exec nx -- run api:test --skip-nx-cache` passed with 330 tests.
- `npm exec nx -- run api:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 83 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.

## Epic 9 Progress

| Story | Status | Summary |
| --- | --- | --- |
| 9.1 User Management Dashboard | Done | `GET /api/admin/users` with search/role/showDeleted filters + pagination. `AdminUsersPageComponent` with reactive search (300ms debounce), role filter, show-deleted toggle. |
| 9.2 User Editing and Role Management | Done | `PATCH /api/admin/users/:userId` validates role/language, pauses excess alerts when downgrading premium→free (keeps oldest 5 active), invalidates tokens on role change. Edit modal with full form. |
| 9.3 Soft Delete and Account Restoration | Done | `DELETE /api/admin/users/:userId` (soft-delete via `deleted_at`), `PATCH /api/admin/users/:userId/restore`. Login blocked for deleted accounts (403 with message). Deleted rows highlighted in UI. |
| 9.4 Force Password Reset | Done | `POST /api/admin/users/:userId/force-password-reset` generates 64-hex base64url token, sends reset email, invalidates sessions. |
| 9.5 Audit Logging | Done | `audit_logs` table with JSONB changes. All mutating admin actions log admin ID, action type, target, changes, IP, user-agent. `GET /api/admin/audit-logs` with filters. `AdminAuditLogsPageComponent` with expandable JSON changes. |
| 9.6 Email Template Preview | Done | `POST /api/admin/email-templates/:key/preview` renders template with `TEMPLATE_SAMPLE_DATA` + optional custom data override. Returns `{ html }`. |
| 9.7 Email Template Test Send | Done | `POST /api/admin/email-templates/:key/send-test` validates `recipientEmail`, renders template with banner, sends via Resend API (or logs when no key). |
| 9.8 Chart Configuration Management | Done | `chart_configs` table. Full CRUD: `GET /api/admin/charts`, `POST /api/admin/charts`, `PATCH /api/admin/charts/:chartId`, `DELETE /api/admin/charts/:chartId`. `AdminChartsPageComponent` with create/edit/delete modals. |
| 9.9 Last Login Tracking | Done | `last_login_at` column on `users`, updated via `UserRepository.recordLastLogin()` (fire-and-forget after successful login). Shown in admin user table. |

## Previous Verification (Epic 8 complete)

- `npm exec nx -- run api:test --skip-nx-cache` passed with 266 tests.
- `npm exec nx -- run api:build:production --skip-nx-cache` passed.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 83 tests.
- `npm exec nx -- run web:build:production --skip-nx-cache` passed.
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
- `npm exec nx -- run api:test --skip-nx-cache` passed with 173 tests.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 49 tests.
- `npm exec nx -- run data-access-api-client:test --skip-nx-cache` passed with 20 tests.
- `npm exec nx -- run-many --target=build --projects=api,web,data-access-api-client --skip-nx-cache` passed.
- `npm exec nx -- run-many --target=eslint:lint --projects=api,data-access-api-client --skip-nx-cache` passed.
- `npm exec nx -- run api:test --skip-nx-cache` passed with 180 tests (7 new alerts-schema spec tests).
- `npm exec nx -- run api:test --skip-nx-cache` passed with 194 tests (14 new: 4 repo, 8 service, 2 route).
- `npm exec nx -- run data-access-api-client:test --skip-nx-cache` passed with 21 tests.
- `npm exec nx -- run web:test --skip-nx-cache` passed with 56 tests (7 new: create-alert-modal).
- `npm exec nx -- run-many --target=build --projects=api,web,data-access-api-client --skip-nx-cache` passed.
- `npm exec nx -- run-many --target=eslint:lint --projects=api,data-access-api-client --skip-nx-cache` passed.

## Next Step

Begin Epic 9: Admin Management.

## Notes

- The current working tree contains uncommitted development work from Epic 4, Epic 5, and Epic 6 stories.
- Live external API calls are limited in the local sandbox, so network-dependent smoke tests may fail with `fetch failed` even when the code path is correct.
- Story 5.10 was verified with component-level tests that mock `ActivatedRoute`/`Router`/`AuthApiClient` rather than a live browser run, since the app's API depends on a real remote Supabase database that should not be exercised from this sandbox.
- Story 6.1's new migration was verified by schema-content assertions (mirroring the existing `bitcoin-metrics-schema.spec.ts` pattern) rather than against a live database, for the same reason.
- Story 6.2's `FearGreedClient` and what is now `BitcoinDataClient` (renamed from `MvrvZScoreClient` in 6.3 once it grew a second method) real-endpoint shapes (alternative.me, bitcoin-data.com) were confirmed by live `curl` against the actual third-party APIs before writing the client code, then all subsequent tests mock `fetch` for determinism — no live calls happen during `nx test`.
- Story 6.3's `hash-rate`/`difficulty` blockchain.info endpoints were likewise confirmed live via `curl` before implementation; `BlockchainInfoClient` was refactored to a shared `fetchChart` helper so `fetchMarketPrice`/`fetchHashRate`/`fetchDifficulty` share one retry/parsing path.
- Historical backfill does not populate `mvrv_zscore`/`fear_greed_index`/`realized_price`/`hash_rate`/`mining_difficulty`/`ma_200_day` (or the other derived metrics) for past dates, only going forward from each daily refresh run; this mirrors the pre-existing behavior for `rainbow_band`/`ma_111_day`/`ma_350_day`/`stock_to_flow_ratio`, which also only get backfilled from whenever the refresh job starts running, not retroactively.
