This chart is part of the Network Fundamentals Collection, tailored for those who want to gauge real usage and adoption of the Bitcoin network, independent of price or on-chain valuation ratios.

What Is Active Addresses?
Active Addresses counts the number of unique Bitcoin addresses that sent or received a transaction on a given day. It is a fundamentals-based measure of network usage and adoption — a proxy for how many distinct participants are actually using the network, as opposed to how the market is pricing it.

How It Can Be Used
By Value Itself
A high or rising address count reflects broad, growing participation — people and services are actively transacting on-chain.

A low or falling count reflects shrinking on-chain activity, which can mean users are transacting off-chain (exchanges, layer 2) or genuinely losing interest.

By Examining Trend
Rising Trend — Growing Adoption. Sustained growth in active addresses historically accompanies healthy cycle expansion, as more participants enter the network.

Falling Trend — Divergence Warning. A stalling or falling address count while price keeps rising is a classic divergence seen near past cycle tops: the market is being driven by a shrinking, more concentrated set of participants rather than broad-based adoption.

Why Is It Important?
Active Addresses is independent of the valuation-ratio charts elsewhere in this library (MVRV Z-Score, NVT Ratio, Thermocap Multiple, etc.), all of which combine price with some on-chain cost-basis or supply figure. This chart instead measures raw usage directly, giving a fundamentals check that doesn't move in lockstep with price-derived ratios.

Data Source
This chart sources active address history from the CoinMetrics Community API (`AdrActCnt` metric — count of unique addresses active as sender or receiver each day). This endpoint is free and requires no API key, with full daily history back to 2009-01-03.

Implementation Notes
- `CoinMetricsClient.fetchActiveAddressesHistory()` pulls the full paginated history for the chart; `fetchActiveAddressesLatest()` is a lightweight lookup used by the daily refresh job to persist each day's reading into `bitcoin_metrics_daily` under the `active_addresses` metric name.
- `chart-data.repository.ts` left-joins `active_addresses` alongside the other daily metrics in `findBitcoinChartData`.
- `chart-data.service.ts` resolves the `active-addresses` chart ID by preferring stored database values and falling back to a live CoinMetrics fetch whenever database coverage is thin — the same DB-first/live-fallback pattern used for Exchange Reserve and Exchange Netflow.
- The API exposes this as `GET /api/charts/active-addresses?timeframe=...`, matching every other chart endpoint's shape.
- The frontend lives at `apps/web/src/app/components/active-addresses-chart-page/`, registered as the `/charts/active-addresses` route and listed in the chart library. It plots BTC price and active addresses on a dual-axis line chart, and derives a signal from 30-day growth: rising more than 5% reads "Rising — Growing network usage", falling more than 5% reads "Falling — Declining network usage", otherwise "Stable — Neutral".
- Full UI copy (title, subtitle, interpretation text, signal labels) is localized in both `apps/web/public/assets/i18n/en.json` and `hu.json` under the `charts.activeAddresses*` and `charts.library.active-addresses.*` key families.
