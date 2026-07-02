This chart is part of the Mining & Security Collection, tailored for those who want to see the raw trend behind the network's mining security, without a moving-average crossover or revenue ratio smoothing it out.

What Is Hash Rate?
Hash Rate measures the total computational power miners are dedicating to securing the Bitcoin network. It is the raw series behind two charts already in this library — Hash Ribbons (a 30/60-day moving-average crossover of this same series) and Puell Multiple (mining revenue relative to its own moving average) — exposed here directly rather than only as a derived signal.

How It Can Be Used
By Value Itself
A high or rising hash rate reflects growing miner investment in the network — more computational power means more security and, generally, more confidence that mining remains profitable.

A falling hash rate can reflect miner capitulation: unprofitable miners powering down their equipment and leaving the network, usually following a sharp price decline.

By Examining Trend
Rising Trend — Growing Network Security. A steadily rising hash rate over a 30-day window reflects growing miner investment and long-term confidence in the network.

Falling Trend — Possible Miner Capitulation. A hash rate drop of more than a couple of percent over 30 days can mark a capitulation event — historically, local price bottoms have often coincided with the point where the weakest miners have already exited and hash rate stabilizes.

Why Is It Important?
Hash Rate is a long-run infrastructure-confidence signal, distinct from Hash Ribbons' short-term capitulation/recovery crossover signal even though both are built from the same underlying data. Seeing the raw trend directly — rather than only its moving-average crossover — makes slower shifts in miner sentiment visible sooner.

Data Source
This chart requires no new external data source. Hash rate has already been ingested via `BlockchainInfoClient.fetchHashRate()` — the Blockchain.info charts API — since the Hash Ribbons and Puell Multiple charts shipped, with full daily history back to 2009.

Implementation Notes
- Zero new source, zero new ingestion, zero new repository column — `hash_rate` was already stored in `bitcoin_metrics_daily` and already exposed as `ChartDataRow.hashRate` by `chart-data.repository.ts`.
- The `hash-rate` branch in `chart-data.service.ts` reads that existing field directly, the same "no new source" pattern used by the Realized Cap and Realized Volatility charts.
- The API exposes this as `GET /api/charts/hash-rate?timeframe=...`, matching every other chart endpoint's shape.
- The frontend lives at `apps/web/src/app/components/hash-rate-chart-page/`, registered as the `/charts/hash-rate` route and listed in the chart library. It plots BTC price and hash rate (converted from the stored TH/s to the conventionally-reported EH/s) on a dual-axis log-log line chart, and derives a signal from 30-day growth: rising more than 2% reads "Rising — Growing network security", falling more than 2% reads "Falling — Possible miner capitulation", otherwise "Stable — Neutral".
- Full UI copy (title, subtitle, interpretation text, signal labels) is localized in both `apps/web/public/assets/i18n/en.json` and `hu.json` under the `charts.hashRate*` and `charts.library.hash-rate.*` key families.
