# Bitcoin Cycle Analysis — Coverage & Gap Roadmap

This document tracks what the chart library already covers for Bitcoin cycle
buy/sell decision-making, what's missing, and the plan to close the gaps using
only free data sources. It is a living roadmap, not a one-time spec — update
the status column as items ship.

## Current coverage (30 charts, as of 2026-07-01)

- **Valuation vs cost basis:** MVRV Z-Score, Realized Price, Stock-to-Flow,
  Bitcoin Power Law, 200-Week MA Heatmap, Mayer Multiple, 2yr MA Multiplier,
  Thermocap Multiple, NVT Ratio
- **Holder profit/loss & flows:** NUPL, SOPR Ratio (LTH/STH), Exchange Reserve,
  CVDD / VDD Multiple / Balanced Price / Terminal Price (Price Forecast Tools)
- **Cycle pattern models:** Bitcoin Rainbow, Pi Cycle Top, Halving Spiral,
  Halving Progress, Compare Bull Markets
- **Mining/security:** Hash Ribbons, Difficulty Ribbon, Puell Multiple
- **Sentiment:** Fear & Greed Index
- **Derivatives/leverage:** Funding Rate & Open Interest
- **Macro overlays:** Excess Liquidity, SPX Liquidity, Global M2 vs Bitcoin,
  DXY vs Bitcoin, Midterm Cycles

This is a strong on-chain + valuation + macro base, now including a first
derivatives/leverage signal. The remaining gaps are concentrated in
exchange-flow refinements and a few holder/flow splits — categories most
on-chain research platforms treat as essential that this app doesn't fully
touch yet.

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
| 4 | **Realized Cap (standalone)** | Market Cap vs Realized Cap growth is a zero-new-source addition — the backend already computes realized price/MVRV internally; this just exposes a different lens on data already ingested. | Derived from existing DB data — no new provider | Not started |
| 5 | **Google Trends "bitcoin" search interest** | Classic retail-euphoria proxy, complements Fear & Greed. | No official free API anymore — would need an unofficial scraping wrapper (fragile, verify before committing) | Not started |
| 6 | **LTH-SOPR / STH-SOPR split** | Sharper than the combined SOPR ratio already shipped — short-term-holder panic-selling and long-term-holder distribution mean very different things for cycle stage. | Needs verification: unclear whether CoinMetrics' free/community tier exposes the split metrics separately | Not started |

### Tier 3 — nice-to-have, lower priority or harder to source free
    
| # | Chart | Note |
|---|-------|------|
| 7 | HODL Waves / UTXO age bands | Valuable but CoinMetrics' free-tier coverage for age-band supply is unverified |
| 8 | Miner Reserve / Netflow | Reliable free miner-address attribution isn't available; likely needs a paid provider |
| 9 | Options put/call ratio (Deribit) | Free public API exists, but this is more a short-term-timing tool than a cycle-position signal |

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
