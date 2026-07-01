This chart is part of the Exchange Flow Collection, tailored for those who want to understand how coin movements on and off exchanges shape Bitcoin's available supply.

What Is Exchange Reserve?
Exchange Reserve refers to the overall quantity of coins held in wallets or addresses controlled by a particular exchange (or, on this chart, aggregated across all known exchanges). It represents the total holdings an exchange has available for facilitating trades, withdrawals, and managing user balances.

Exchange Reserve is the accumulated result of Exchange In/Outflow and Netflow. Where Netflow shows the movement at a single moment or period, Reserve makes it easy to track the cumulative result of the entire period's movements — it is the running balance that in/outflow feeds into.

How It Can Be Used
An increasing trend in exchange reserves indicates selling pressure, and a decreasing trend indicates buying pressure — the same read as Exchange Netflow, just expressed as an accumulated level rather than a per-period delta.

By Value Itself
A high reserve signals elevated selling pressure: a large number of coins are sitting in exchange wallets, awaiting potential trades, meaning a significant volume of coins is available to hit the market. For example, a spike from 10,000 to 50,000 BTC over a short period implies a wave of deposits and heightened selling sentiment.

A low reserve signals diminished selling pressure: fewer coins sit on exchanges awaiting sale, and market participants are more inclined to withdraw coins for purposes other than immediate selling. For example, a decline from 30,000 to 5,000 BTC implies fewer users keeping coins on the exchange, suggesting a shift toward long-term holding or external transfers.

By Examining Trend
Increasing Trend — Decreasing Scarcity — Bearish. Rising exchange reserves suggest coins are being deposited back onto exchanges, often in response to a perceived decrease in risk or an intent to sell, lowering overall market scarcity.

Decreasing Trend — Increasing Scarcity — Bullish. Falling exchange reserves suggest coins are being withdrawn into private custody, reflecting a preference for accumulation and long-term holding, and increasing market scarcity.

Why Is It Important?
Exchange Reserve acts as a compass for gauging accumulated selling pressure and the changing scarcity of coins available for trading. It complements Exchange Netflow by making the cumulative effect of many days of in/outflow easy to read at a glance, without having to mentally sum a noisy daily series.

Data Source
This chart sources exchange reserve history from the CoinMetrics Community API (`SplyExNtv` metric — aggregate BTC supply held in known exchange wallets). This endpoint is free and requires no API key, with full daily history back to 2011-04-24. It was chosen over bitcoin-data.com (the provider used for several other charts in this app, such as MVRV Z-Score and Realized Price) because bitcoin-data.com only exposes exchange reserve behind a paid subscription tier.

Implementation Notes
- `CoinMetricsClient.fetchExchangeReserveHistory()` pulls the full paginated history for the chart; `fetchExchangeReserveLatest()` is a lightweight lookup used by the daily refresh job to persist each day's reading into `bitcoin_metrics_daily` under the `exchange_reserve` metric name.
- `chart-data.repository.ts` left-joins `exchange_reserve` alongside the other daily metrics in `findBitcoinChartData`.
- `chart-data.service.ts` resolves the `exchange-reserve` chart ID by preferring stored database values and falling back to a live CoinMetrics fetch whenever database coverage is thin — the same pattern used for Realized Price — so the chart works correctly from day one, before the daily job has had time to backfill history.
- The API exposes this as `GET /api/charts/exchange-reserve?timeframe=...`, matching every other chart endpoint's shape.
- The frontend lives at `apps/web/src/app/components/exchange-reserve-chart-page/`, registered as the `/charts/exchange-reserve` route and listed in the chart library. It plots BTC price and exchange reserve on a dual-axis line chart, and derives a signal from the 30-day trend in reserve: rising more than 2% is flagged as bearish ("Rising — Selling pressure"), falling more than 2% is flagged as bullish ("Falling — Accumulation"), otherwise it reads "Stable — Neutral".
- Full UI copy (title, subtitle, interpretation text, signal labels) is localized in both `apps/web/public/assets/i18n/en.json` and `hu.json` under the `charts.exchangeReserve*` and `charts.library.exchange-reserve.*` key families.

Chart example: not yet captured — see the CryptoQuant reference chart shared when this feature was requested for expected shape (BTC price vs. Exchange Reserve, All Exchanges).
