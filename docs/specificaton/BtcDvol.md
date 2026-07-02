This chart is part of the Volatility Collection, tailored for those who want a forward-looking counterpart to the backward-looking Realized Volatility chart.

What Is DVOL?
DVOL is Deribit's BTC implied volatility index, derived from the live prices of BTC options traded on their exchange. It reflects what options markets currently expect volatility to be over the coming 30 days — a forward-looking, market-implied measure, as opposed to Realized Volatility, which measures what volatility actually was over a past window.

How It Can Be Used
Like Realized Volatility, DVOL is not directional. Both capitulation-driven bottoms and euphoric blow-off tops show elevated readings — the chart tells you how much movement the options market is pricing in, not which direction.

By Value Itself
A low DVOL reading means options markets are pricing in a calm near-term outlook. Historically, this kind of complacency has been a precursor to larger moves once it breaks.

A high DVOL reading means options markets are pricing in significant near-term turbulence — seen at both panic-driven bottoms and euphoric, blow-off tops.

By Comparing to Realized Volatility
Because DVOL is forward-looking and Realized Volatility is backward-looking, comparing the two gives a read on whether the market expects the current volatility regime to continue, cool off, or intensify.

Why Is It Important?
DVOL adds an options-market perspective that nothing else in this library currently provides — every other chart is built from spot price or on-chain data. It's a distinct, independent read on expected volatility.

**Important caveat: DVOL history is short.** Deribit's DVOL index launched on 2021-03-24, so this chart has roughly 5 years of history — far shorter than most other charts in this library, several of which cover BTC's full price history back to 2009 or 2010. This is called out explicitly in the chart's subtitle and info panel so it doesn't read as broken or incomplete.

Data Source
This chart sources DVOL history from Deribit's public API (`GET /public/get_volatility_index_data?currency=BTC&resolution=1D`). This endpoint is genuinely public and keyless, and — unlike Deribit's put/call open-interest endpoint (investigated and ruled out for a different chart idea; see the main roadmap doc) — it does support real historical time-series queries via `start_timestamp`/`end_timestamp` parameters.

Implementation Notes
- A new `DeribitClient` (`libs/calculation-engines/data-sources/src/lib/deribit.client.ts`) implements `fetchBtcDvolHistory()` and `fetchBtcDvolLatest()`.
- Deribit's pagination is the odd one out among this app's data clients: every other client paginates *forward* via a next-page cursor, but this endpoint caps each response at 1000 daily candles and paginates *backward in time* via a `continuation` timestamp in the response — the cutoff to use as the next request's `end_timestamp`. `fetchBtcDvolHistory()` loops from now back to the DVOL index's 2021-03-24 launch date (hardcoded as a floor, since requesting dates before launch just returns an empty array, not an error) until `continuation` comes back null.
- Values are persisted to `bitcoin_metrics_daily` under `btc_dvol`, joined into `findBitcoinChartData` as `btcDvol`, and exposed at `GET /api/charts/btc-dvol?timeframe=...`.
- Because DVOL's real history (~5 years) is far shorter than BTC's price history, the DB-first/live-fallback helper (`getBtcDvolHistory` in `chart-data.service.ts`) uses a size-only threshold (more than 30 stored points) rather than the coverage-ratio check every other DB-first chart in this app uses — that ratio would never pass given the gap between DVOL's start date and BTC genesis.
- The frontend lives at `apps/web/src/app/components/btc-dvol-chart-page/`, registered as the `/charts/btc-dvol` route and listed in the chart library. It plots BTC price and DVOL on a dual-axis chart (DVOL uses `spanGaps: true` since the series starts partway through the price history) and labels the current regime as Low/Normal/High rather than a buy/sell signal.
- Full UI copy (title, subtitle, interpretation text, regime labels, and the short-history caveat) is localized in both `apps/web/public/assets/i18n/en.json` and `hu.json` under the `charts.btcDvol*` and `charts.library.btc-dvol.*` key families.
