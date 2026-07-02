This chart is part of the Exchange Flow Collection, tailored for those who want to understand how coin movements on and off exchanges shape Bitcoin's available supply.

What Is Exchange Netflow?
Exchange Netflow is the daily difference between coins deposited onto and withdrawn from wallets controlled by known exchanges: netflow = inflow − outflow. Where Exchange Reserve (already shipped) shows the running balance, Netflow shows the movement for a single day — it is the leading edge of the same signal, and the reserve is simply the accumulated result of many days of netflow.

How It Can Be Used
By Value Itself
A positive netflow (more coins moving onto exchanges than off) implies coins are becoming available for sale — historically a bearish signal. A large single-day spike can flag a sudden whale deposit well before it shows up as a shift in the cumulative reserve trend.

A negative netflow (more coins leaving exchanges than arriving) implies coins are moving into private custody — historically a bullish signal, associated with accumulation and increasing scarcity.

By Examining Trend
Because daily netflow is noisy (a single large transfer can swing the reading), this chart derives its buy/sell signal from the trailing 7-day average rather than any one day's value: a positive 7-day average reads "Net Inflow — Selling pressure"; a negative 7-day average reads "Net Outflow — Accumulation"; a value at exactly zero reads "Balanced — Neutral".

Why Is It Important?
Exchange Netflow is the fastest-reacting member of the exchange-flow family. It complements Exchange Reserve by surfacing sudden shifts in exchange balances immediately, rather than waiting for them to accumulate into a visible change in the aggregate reserve level.

Data Source
This chart sources netflow history from the CoinMetrics Community API (`FlowInExNtv` and `FlowOutExNtv` metrics — aggregate BTC flow into and out of known exchange wallets). Both metrics are free and require no API key, with full daily history back to 2011. The Community API does not expose a combined net-flow metric, so netflow is computed client-side as `FlowInExNtv − FlowOutExNtv` for each day. This reuses the same `CoinMetricsClient` already built for Exchange Reserve's `SplyExNtv` metric.

Implementation Notes
- `CoinMetricsClient.fetchExchangeNetflowHistory()` pulls the full paginated history for the chart (a single request for both `FlowInExNtv,FlowOutExNtv`, combined into one netflow value per day); `fetchExchangeNetflowLatest()` is a lightweight lookup used by the daily refresh job to persist each day's reading into `bitcoin_metrics_daily` under the `exchange_netflow` metric name.
- `chart-data.repository.ts` left-joins `exchange_netflow` alongside the other daily metrics in `findBitcoinChartData`.
- `chart-data.service.ts` resolves the `exchange-netflow` chart ID by preferring stored database values and falling back to a live CoinMetrics fetch whenever database coverage is thin — the same pattern used for Exchange Reserve and Funding Rate & Open Interest — so the chart works correctly from day one, before the daily job has had time to backfill history.
- The API exposes this as `GET /api/charts/exchange-netflow?timeframe=...`, matching every other chart endpoint's shape.
- The frontend lives at `apps/web/src/app/components/exchange-netflow-chart-page/`, registered as the `/charts/exchange-netflow` route and listed in the chart library. It plots BTC price as a line and netflow as a bar series (colored red for net inflow, green for net outflow, with a dashed zero-line reference), and derives its signal from the trailing 7-day average of netflow rather than a single day's noisy reading.
- Full UI copy (title, subtitle, interpretation text, signal labels) is localized in both `apps/web/public/assets/i18n/en.json` and `hu.json` under the `charts.exchangeNetflow*` and `charts.library.exchange-netflow.*` key families.
