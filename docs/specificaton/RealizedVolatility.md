This chart is part of the Volatility Collection, tailored for those who want to gauge how much BTC's price is actually swinging, independent of direction.

What Is Realized Volatility?
Realized Volatility measures how much BTC's price has actually moved, expressed as an annualized standard deviation of daily log returns over trailing 30-day and 90-day windows. It is a backward-looking measure — it describes what already happened, as opposed to Implied Volatility (DVOL), which reflects what options markets expect to happen next.

How It Can Be Used
Unlike most other charts in this library, Realized Volatility is not directional. Both cycle tops (euphoric blow-offs) and capitulation bottoms (panic selling) show elevated volatility — the chart cannot tell you which one you're looking at on its own. Its real value is spotting compression: unusually low volatility, which has historically preceded large moves in either direction. A tightening range on this chart is a "get ready" signal, not a "buy" or "sell" one.

By Value Itself
A high reading (above roughly 80% annualized) marks turbulent conditions. Cross-reference with price trend and other charts in this library (Fear & Greed, NUPL, MVRV Z-Score) to judge whether that turbulence looks like capitulation or euphoria.

A low reading (below roughly 40% annualized) marks a compressed, quiet market — historically a precursor to a larger move once the calm breaks.

By Examining Trend
The 30-day series reacts faster and is noisier; the 90-day series smooths that out and shows the broader regime. Watching the two converge or diverge gives an early read on whether a volatility regime shift is just getting started or already underway.

Why Is It Important?
Realized Volatility complements the valuation-ratio charts elsewhere in this library (MVRV Z-Score, NVT Ratio, Thermocap Multiple) by measuring price behavior directly rather than a derived ratio. It's a magnitude gauge, not a direction gauge — pairing it with a directional chart is what makes it useful for cycle timing.

Data Source
This chart requires no new external data source at all. It is computed entirely from `bitcoin_price_daily`, the BTC price history already ingested for every other chart in this app — the same "zero new source" pattern used by the Realized Cap chart.

Implementation Notes
- No new client, no new daily-refresh ingestion, and no new `bitcoin_metrics_daily` column — this is a `chart-data.service.ts`-only addition.
- The `realized-volatility` branch fetches full-history rows via `findBitcoinChartData('all', ...)` (the same pattern Hash Ribbons and the 200-Week MA Heatmap use for their own rolling-window computations, since a timeframe-filtered fetch wouldn't have enough lookback at the start of the requested window).
- For each day, the daily log return is `ln(price[i] / price[i-1])`. The rolling annualized volatility over a window of `N` days is `stdev(log returns in window) × √365 × 100`, expressed as a percentage.
- The API exposes this as `GET /api/charts/realized-volatility?timeframe=...`, matching every other chart endpoint's shape.
- The frontend lives at `apps/web/src/app/components/realized-volatility-chart-page/`, registered as the `/charts/realized-volatility` route and listed in the chart library. It plots BTC price as a line on the left log axis, with 30-day (solid) and 90-day (dashed) volatility lines on a right linear axis. The info panel labels the current regime as Low/Normal/High rather than a buy/sell signal, and explicitly states that volatility is not directional.
- Full UI copy (title, subtitle, interpretation text, regime labels) is localized in both `apps/web/public/assets/i18n/en.json` and `hu.json` under the `charts.realizedVolatility*` and `charts.library.realized-volatility.*` key families.
