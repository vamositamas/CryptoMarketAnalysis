# Bitcoin Cycle Analysis — Coverage & Gap Roadmap

This document tracks what the chart library already covers for Bitcoin cycle
buy/sell decision-making, what's missing, and the plan to close the gaps using
only free data sources. It is a living roadmap, not a one-time spec — update
the status column as items ship.

## Current coverage (37 charts, as of 2026-07-02)

- **Valuation vs cost basis:** MVRV Z-Score, Realized Price, Realized Cap,
  Stock-to-Flow, Bitcoin Power Law, 200-Week MA Heatmap, Mayer Multiple,
  2yr MA Multiplier, Thermocap Multiple, NVT Ratio
- **Holder profit/loss & flows:** NUPL, SOPR Ratio (LTH/STH), LTH-SOPR / STH-SOPR
  Split, Exchange Reserve, Exchange Netflow,
  CVDD / VDD Multiple / Balanced Price / Terminal Price (Price Forecast Tools)
- **Cycle pattern models:** Bitcoin Rainbow, Pi Cycle Top, Halving Spiral,
  Halving Progress, Compare Bull Markets
- **Network fundamentals:** Active Addresses
- **Mining/security:** Hash Ribbons, Difficulty Ribbon, Puell Multiple, Hash Rate
- **Sentiment:** Fear & Greed Index, Google Trends: Bitcoin Search Interest
- **Derivatives/leverage:** Funding Rate & Open Interest
- **Volatility:** Realized Volatility, Implied Volatility (DVOL)
- **Macro overlays:** Excess Liquidity, SPX Liquidity, Global M2 vs Bitcoin,
  DXY vs Bitcoin, Midterm Cycles

This is a strong on-chain + valuation + macro base, now including a first
derivatives/leverage signal, a first dedicated volatility pair (realized +
implied), and the full Tier 1 and Tier 2 gap lists. The Tier 3 wishlist (HODL
waves, miner reserve, options put/call ratio) was investigated and confirmed
infeasible with free data sources — see the table below — so it was not
built. The four "beyond Tier 3" charts (Realized Volatility, Active Addresses,
Hash Rate, BTC DVOL) were added instead after a fresh feasibility pass turned
up genuinely free, real-history alternatives not on the original wishlist.

## Gap analysis

### Tier 1 — biggest blind spots, all free to source

| # | Chart | Why it matters for cycle timing | Free data source | Status |
|---|-------|----------------------------------|-------------------|--------|
| 1 | **Funding Rate & Open Interest** | Derivatives leverage is the sharpest short/mid-term top signal available: euphoric (very positive) funding + surging open interest precede most local tops and the long-squeeze cascades that follow; deeply negative funding marks short-heavy, squeeze-prone bottoms. The app has zero derivatives coverage today. | Binance Futures public REST API — `fapi.binance.com/fapi/v1/fundingRate` (funding rate, full history since 2019-09-10, no key) for the funding-rate leg. Open interest switched to **Bybit's** `v5/market/open-interest` instead of Binance's `openInterestHist`: Binance hard-caps that endpoint to a rolling 30-day window, while Bybit retains daily open-interest history back to 2020-08-05 (converted from BTC to USD using each day's own price), giving the chart genuine multi-year history immediately rather than a 30-day mitigation window. | **Shipped** |
| 2 | **Bitcoin Dominance & Total Market Cap** | Tells you whether capital is rotating into alts (late-cycle/euphoria signature) or consolidating into BTC (risk-off or accumulation phase) — a classic cycle-stage marker independent of BTC's own price action. | CoinGecko `/api/v3/global` (current snapshot only, no key) — **CoinGecko's historical global market-cap-chart endpoint is Pro/paid-only, so there is no free historical backfill**; this metric could only ever have started accumulating from the day it was first ingested, with years of blank history before that point | **Removed** — built and shipped, then pulled after review: a chart that shows years of full BTC price history next to a metric with only a single real data point (growing one day at a time) reads as broken, not "building up." Revisit only if a free historical-backfill source for global market cap surfaces. |
| 3 | **Exchange Netflow (daily in/out)** | Exchange Reserve (already shipped) shows the cumulative balance; the daily flow rate is the leading edge of that same signal and catches sudden whale-to-exchange deposits before they show up as a reserve trend. | CoinMetrics Community API, `FlowInExNtv` / `FlowOutExNtv` metrics — free, full history, same client already built for Exchange Reserve (`CoinMetricsClient`) | **Shipped** |

### Tier 2 — real value, smaller lift or partial overlap with existing charts

| # | Chart | Why it matters | Free data source | Status |
|---|-------|-----------------|-------------------|--------|
| 4 | **Realized Cap (standalone)** | Market Cap vs Realized Cap growth is a zero-new-source addition — the backend already computes realized price/MVRV internally; this just exposes a different lens on data already ingested. | Derived from existing DB data — no new provider | **Shipped** |
| 5 | **Google Trends "bitcoin" search interest** | Classic retail-euphoria proxy, complements Fear & Greed. | Google Trends' unofficial `explore` + `widgetdata/multiline` endpoints (same technique as the `google-trends-api` package). Undocumented and can change or rate-limit without notice — see implementation notes below. | **Shipped** |
| 6 | **LTH-SOPR / STH-SOPR split** | Sharper than the combined SOPR ratio already shipped — short-term-holder panic-selling and long-term-holder distribution mean very different things for cycle stage. | CoinMetrics' free/community tier does not expose LTH/STH SOPR split metrics (confirmed — not in their community catalog). Sourced instead from bitcoin-data.com's `/v1/lth-sopr` and `/v1/sth-sopr` endpoints, the same source the existing combined SOPR Ratio chart already uses client-side, now promoted to the standard server-side ingestion pipeline. | **Shipped** |

### Tier 3 — nice-to-have, lower priority or harder to source free
    
| # | Chart | Note | Status |
|---|-------|------|--------|
| 7 | HODL Waves / UTXO age bands | CoinMetrics' community API catalog (`/v4/catalog-v2/asset-metrics?assets=btc`) confirms the free tier only exposes `SplyCur`, `SplyExNtv`, `SplyExUSD`, `SplyExpFut10yr` — no `SplyAct1yr`/`SplyAct2yr`/etc. age-band family. Live-querying those metric IDs returns `403 forbidden` ("not available with supplied credentials"). Age-band supply is Pro/paid-tier only. | **Confirmed infeasible free** |
| 8 | Miner Reserve / Netflow | No keyless/free source exists. CryptoQuant and Glassnode both expose this metric class but require a paid API key; miner-wallet attribution is proprietary heuristic work these vendors monetize. | **Confirmed infeasible free** |
| 9 | Options put/call ratio (Deribit) | Deribit's `GET /public/get_book_summary_by_currency?currency=BTC&kind=option` is genuinely public/keyless and does return put/call-split open interest and volume (via `-C`/`-P` instrument name suffix). But it takes no `start_timestamp`/`end_timestamp` — it's a live snapshot of currently-open contracts only, no historical time-series. Building this would repeat the exact failure mode that got Tier 1 #2 (Bitcoin Dominance) shipped then pulled: years of BTC price history next to a metric with no backfill. | **Confirmed infeasible free (snapshot-only trap)** |

All three Tier 3 items are now confirmed dead ends for a free-data-only implementation, not just "unverified." Revisit only if the project decides to take on a paid data vendor (CoinMetrics Pro, Glassnode, or CryptoQuant), or accept a hard-capped "no history" chart for Deribit put/call with an explicit caveat.

### Beyond Tier 3 — new candidates found during the Tier 3 feasibility pass

With Tier 3 ruled out, a fresh feasibility pass looked for chart ideas not on
the original roadmap at all. Two clear zero/low-cost wins and two solid
second-tier additions turned up; all four were built.

| # | Chart | Why it matters | Free data source | Status |
|---|-------|-----------------|-------------------|--------|
| 10 | **Realized Volatility** | Annualized 30-day/90-day standard deviation of daily log returns. Not a directional signal (both tops and bottoms show high volatility), but volatility compression has historically preceded large moves in either direction. | Zero new source — derived entirely from `bitcoin_price_daily`, already ingested for every other chart. Same "no new client, no new ingestion" pattern as Realized Cap. | **Shipped** |
| 11 | **Active Addresses** | Unique daily active BTC addresses — a fundamentals-based network-usage/adoption trend, uncorrelated with the valuation-ratio charts (MVRV, NVT, etc.) already in the library. Divergence (falling usage while price rises) is a classic late-cycle warning. | CoinMetrics Community API, `AdrActCnt` metric — free, full daily history since 2009-01-03, same `CoinMetricsClient` already used for Exchange Reserve/Netflow. | **Shipped** |
| 12 | **Hash Rate** | Raw network computational power — the same underlying series behind the already-shipped Hash Ribbons (30/60-day MA crossover) and Puell Multiple (revenue ratio) charts, but exposed directly rather than only as a derived signal. | Zero new source — already ingested via `BlockchainInfoClient.fetchHashRate()` for Hash Ribbons/Puell Multiple, stored under `hash_rate` in `bitcoin_metrics_daily` since those charts shipped. | **Shipped** |
| 13 | **Implied Volatility (BTC DVOL, Deribit)** | Options-implied, forward-looking counterpart to Realized Volatility — reflects what options markets expect volatility to be over the next 30 days, versus realized volatility's backward-looking measure. | Deribit's public, keyless `GET /public/get_volatility_index_data?currency=BTC&resolution=1D` endpoint. Unlike the put/call-ratio endpoint ruled out in Tier 3 #9, this one genuinely supports historical time-series queries via `start_timestamp`/`end_timestamp` — confirmed live back to the DVOL index's 2021-03-24 launch. History is real but short (~5 years vs. most other charts' decade-plus), flagged explicitly in the chart's UI copy so it doesn't repeat the Tier 1 #2 (Bitcoin Dominance) sparse-history mistake. | **Shipped** |

## Implementation notes for Tier 1 #1

Funding Rate & Open Interest follows the same architectural pattern as every
other chart in this app (see `ExchangeReserve.md` for the reference
write-up): a data-source client method, daily-refresh-job ingestion into
`bitcoin_metrics_daily`, a repository join, a `chart-data.service.ts` branch,
an API route, and a frontend chart page registered in routing, the chart
library, and the landing page model strip — localized in both `en.json` and
`hu.json`.

Both legs of this chart have full free history: Funding Rate (Binance, since
2019-09-10) and Open Interest (Bybit, since 2020-08-05) show years of data
immediately, via `chart-data.service.ts`'s `getFundingRateHistory` /
`getOpenInterestHistory` helpers, which top up stored `bitcoin_metrics_daily`
values with a live full-history call to each provider whenever DB coverage is
sparse.

## Implementation notes for Tier 1 #3

Exchange Netflow follows the same architectural pattern as Exchange Reserve (see
`ExchangeNetflow.md` for the reference write-up), reusing the same
`CoinMetricsClient` used for `SplyExNtv`. It adds `fetchExchangeNetflowHistory()` /
`fetchExchangeNetflowLatest()`, which pull `FlowInExNtv` and `FlowOutExNtv` in a
single request and compute netflow client-side as inflow minus outflow, since the
Community API doesn't expose a combined net metric directly. The daily value is
persisted to `bitcoin_metrics_daily` under `exchange_netflow`, joined into
`findBitcoinChartData` alongside the other metrics, and exposed at
`GET /api/charts/exchange-netflow`. The frontend renders it as a bar chart
(colored red for net inflow, green for net outflow) against a BTC price line,
with the buy/sell signal derived from the trailing 7-day average rather than a
single noisy day.

## Implementation notes for Tier 2 #4 (Realized Cap)

Realized Cap needed no new data-source client, no new daily-refresh ingestion, and no
new `bitcoin_metrics_daily` column — it's a `chart-data.service.ts`-only addition. The
`realized-cap` branch reuses the existing `getRealizedPriceHistory()` helper (already
built for the Realized Price chart) and the existing `estimateSupplyFromHalvings()`
helper (already used by NVT Ratio, Thermocap Multiple, and Price Forecast Tools) to
compute `marketCap = priceUsd × supply` and `realizedCap = realizedPrice × supply` on
the fly. The frontend renders both as a dual log-scale line chart, functionally the
same underlying ratio as the MVRV Z-Score chart, but presented as raw dollar caps
instead of a standardized score.

## Implementation notes for Tier 2 #6 (LTH-SOPR / STH-SOPR split)

Follows the standard architectural pattern end-to-end. `BitcoinDataClient` gained
`fetchLthSopr()` / `fetchSthSopr()` (single latest value, for the daily-refresh job)
and `fetchLthSoprHistory()` / `fetchSthSoprHistory()` (full history, for the
`chart-data.service.ts` DB-first/live-fallback pattern), calling bitcoin-data.com's
`lth-sopr` and `sth-sopr` endpoints — the same source the existing combined SOPR
Ratio chart already fetches directly from the browser. Values are persisted to
`bitcoin_metrics_daily` under `lth_sopr` / `sth_sopr`, joined into
`findBitcoinChartData`, and exposed at `GET /api/charts/lth-sth-sopr-split`. Unlike
the existing SOPR Ratio chart (which only shows the LTH/STH *ratio*), this chart
plots both cohorts as separate lines against a SOPR-equals-1 reference line, since
LTH capitulation (SOPR < 1 for long-term holders) and STH stress carry very different
implications for cycle stage that get blurred together in a single ratio.

## Implementation notes for Tier 2 #5 (Google Trends)

A new `GoogleTrendsClient` (`libs/calculation-engines/data-sources/src/lib/google-trends.client.ts`)
replicates the two-step flow used by the unofficial `google-trends-api` npm package:
an `explore` request returns a widget token, then a `widgetdata/multiline` request
using that token returns the actual "interest over time" series for the worldwide
"bitcoin" search term, scaled 0-100 relative to the requested date range's peak.

The client always requests the **full history in one call** (2010-01-01 to today)
rather than a short "latest" window, and re-fetches (and fully overwrites, not
merges) the whole series whenever DB coverage is thin. This is a deliberate
deviation from every other chart's incremental-merge pattern: Google Trends
normalizes values 0-100 *relative to whatever date range is requested*, so a
short daily "latest" fetch would use a different normalization basis than a
multi-year historical fetch and the two would not be comparable if merged
point-by-point. Google Trends returns daily/weekly/monthly granularity depending
on the requested range length (monthly for the full 2010-present range used
here), so the frontend chart uses `spanGaps: true` to draw a continuous line
across the sparser points on a daily x-axis.

**Session cookie requirement (found during rollout):** the endpoint initially
returned HTTP 429 on every request, including from a residential/office IP, not
just cloud datacenter IPs as originally assumed. The actual cause: Google Trends'
unofficial API rejects "cold" requests with no prior session — but even a
rejected first request still returns a `Set-Cookie: NID=...` header. The client
now keeps an in-memory cookie jar (`captureCookies`/`buildHeaders` in
`google-trends.client.ts`) that captures that cookie from any response (success
or failure) and replays it on subsequent requests. The existing retry-with-backoff
wrapper naturally self-heals: attempt 1 has no cookie and gets 429 (but captures
one), attempt 2 carries it and succeeds. A `Referer` header matching a real
explore-page URL is also sent. Separately, the `widgetdata/multiline` response
turned out to prefix its JSON body with `)]}',` (comma included) while `explore`
uses just `)]}'` (no comma) — `parseGoogleTrendsJson` strips both forms.
Verified end-to-end against the live endpoint after these fixes: 199 monthly
points returned covering 2010-01 through the current month.

This endpoint remains unofficial and undocumented, so it can still change or
tighten its bot detection without notice. The daily-refresh job wraps it in the
same best-effort `fetchExternalMetric` pattern used for every other external
metric: a failure logs a warning and skips that day rather than failing the
whole refresh run. If it starts failing consistently in production, the chart
will simply stop accumulating new points rather than break — revisit the cookie
logic or drop the chart if that happens.

## Implementation notes for Beyond-Tier-3 #10 (Realized Volatility)

Like Realized Cap, this chart needed no new data-source client, no new daily-refresh
ingestion, and no new `bitcoin_metrics_daily` column — it's a `chart-data.service.ts`-only
addition, computed entirely from `bitcoin_price_daily.price_usd`. The `realized-volatility`
branch fetches full-history rows (`findBitcoinChartData('all', ...)`, mirroring the pattern
Hash Ribbons and the 200-Week MA Heatmap use for their own rolling-window computations),
takes the daily log return between consecutive closes, then computes a rolling annualized
standard deviation (`stdev × √365 × 100`) over trailing 30-day and 90-day windows. Both
series are plotted against BTC price on a dual-axis line chart. The chart's UI explicitly
frames volatility as non-directional — both cycle tops and capitulation bottoms show
elevated readings — with regime bands (Low/Normal/High) rather than a buy/sell signal.

## Implementation notes for Beyond-Tier-3 #11 (Active Addresses)

Follows the standard DB-first/live-fallback architectural pattern end-to-end.
`CoinMetricsClient` gained `fetchActiveAddressesHistory()` / `fetchActiveAddressesLatest()`,
calling the community tier's `AdrActCnt` metric — the same client already used for Exchange
Reserve/Netflow. Values are persisted to `bitcoin_metrics_daily` under `active_addresses`,
joined into `findBitcoinChartData`, and exposed at `GET /api/charts/active-addresses`. The
frontend derives its signal from 30-day growth: >+5% reads "Rising — Growing network usage",
<-5% reads "Falling — Declining network usage" (a late-cycle divergence warning if price is
still rising), otherwise "Stable — Neutral".

## Implementation notes for Beyond-Tier-3 #12 (Hash Rate)

Zero new source, zero new ingestion, zero new repository column — `hash_rate` has been
fully ingested into `bitcoin_metrics_daily` via `BlockchainInfoClient.fetchHashRate()` since
the Hash Ribbons and Puell Multiple charts shipped, and `chart-data.repository.ts` already
exposed it as `ChartDataRow.hashRate`. The `hash-rate` branch in `chart-data.service.ts`
simply reads that existing field directly (same pattern as the `realized-cap` branch).
The frontend converts the stored TH/s values to EH/s for display and derives its signal
from 30-day growth, framed as a long-run miner-investment/security trend — deliberately a
different read than Hash Ribbons' short-term 30/60-day MA capitulation/recovery crossover,
even though both charts are built from the same underlying series.

## Implementation notes for Beyond-Tier-3 #13 (BTC DVOL)

A new `DeribitClient` (`libs/calculation-engines/data-sources/src/lib/deribit.client.ts`)
calls Deribit's public, keyless `get_volatility_index_data` endpoint. This client's
pagination is the odd one out in the codebase: every other client here paginates *forward*
via a next-page cursor, but Deribit caps each response at 1000 daily candles and paginates
*backward in time* via a `continuation` timestamp (the cutoff to use as the next request's
`end_timestamp`) — confirmed by live-testing the endpoint directly. `fetchBtcDvolHistory()`
loops from now back to the DVOL index's launch date (2021-03-24, hardcoded as a floor since
earlier requests just return an empty array, not an error) until `continuation` comes back
null. Values are persisted under `btc_dvol`, joined into `findBitcoinChartData`, and exposed
at `GET /api/charts/btc-dvol`. Because DVOL's history (~5 years) is far shorter than BTC's
price history, the live-fallback helper (`getBtcDvolHistory`) uses a size-only threshold
(>30 stored points) rather than the coverage-ratio check every other DB-first chart uses —
that ratio would never pass given the large gap between DVOL's start date and BTC genesis.
The chart's "about" text and subtitle explicitly flag the short history up front, learning
from the Tier 1 #2 (Bitcoin Dominance) mistake below.

## Why Tier 1 #2 (Bitcoin Dominance & Total Market Cap) was removed

This chart was fully built and shipped, then pulled. CoinGecko's `/global`
endpoint only ever returns a current snapshot — the historical version is a
paid-only endpoint — so unlike every other chart in this app, dominance and
total market cap had no way to backfill years of history. The chart ended up
showing the full 2010-to-today BTC price line next to a single data point
for dominance that only grew one real day at a time. In practice this read
as broken ("where's the rest of the data?") rather than as an intentionally
building-up metric, so it was descoped rather than kept as a permanently
sparse chart. All code (client method, daily-refresh ingestion, repository
columns, API route, frontend page, i18n) was removed; nothing in
`bitcoin_metrics_daily` reads or writes `btc_dominance` /
`total_market_cap_usd` anymore. Revisit only if a genuinely free historical
source for global crypto market cap surfaces.
