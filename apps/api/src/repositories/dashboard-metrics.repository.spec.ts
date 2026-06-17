import { DashboardMetricsRepository } from './dashboard-metrics.repository';

describe('DashboardMetricsRepository', () => {
  it('fetches the latest prices ordered most-recent-first', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { date: '2026-06-10', value: '67234.50' },
          { date: '2026-06-09', value: '66000.00' },
        ],
      }),
    };
    const repository = new DashboardMetricsRepository(database);

    await expect(repository.getLatestPrices()).resolves.toEqual([
      { date: '2026-06-10', value: 67234.5 },
      { date: '2026-06-09', value: 66000 },
    ]);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM bitcoin_price_daily'),
      [2],
    );
  });

  it('fetches the latest values for a named metric', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [{ date: '2026-06-10', value: 0.4178 }],
      }),
    };
    const repository = new DashboardMetricsRepository(database);

    await expect(repository.getLatestMetricValues('mvrv_zscore', 1)).resolves.toEqual([
      { date: '2026-06-10', value: 0.4178 },
    ]);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM bitcoin_metrics_daily'),
      ['mvrv_zscore', 1],
    );
  });

  it('fetches the latest non-null circulating supply values', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ date: '2026-06-10', value: 19_700_000 }] }),
    };
    const repository = new DashboardMetricsRepository(database);

    await expect(repository.getLatestCirculatingSupply()).resolves.toEqual([
      { date: '2026-06-10', value: 19_700_000 },
    ]);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('circulating_supply IS NOT NULL'),
      [2],
    );
  });

  it('fetches the latest non-null market cap values', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ date: '2026-06-10', value: 1_320_000_000_000 }] }),
    };
    const repository = new DashboardMetricsRepository(database);

    await expect(repository.getLatestMarketCap()).resolves.toEqual([
      { date: '2026-06-10', value: 1_320_000_000_000 },
    ]);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('market_cap_usd IS NOT NULL'),
      [2],
    );
  });

  it('assembles all formula variable values from two queries', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { date: '2026-06-10', price_usd: '67234.50', market_cap_usd: '1320000000000', circulating_supply: '19700000' },
            { date: '2026-06-09', price_usd: '66000.00', market_cap_usd: '1300000000000', circulating_supply: '19699000' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { metric_name: 'fear_greed_index', metric_value: '42' },
            { metric_name: 'mvrv_zscore', metric_value: '3.4' },
            { metric_name: 'stock_to_flow_ratio', metric_value: '56.2' },
          ],
        }),
    };
    const repository = new DashboardMetricsRepository(database);

    const result = await repository.getLatestFormulaVariables();

    expect(result.btc_price).toBeCloseTo(67234.5);
    expect(result.btc_price_24h_change).toBeCloseTo(1.87, 1);
    expect(result.market_cap).toBeCloseTo(1_320_000_000_000);
    expect(result.circulating_supply).toBeCloseTo(19_700_000);
    expect(result.stock_to_flow).toBeCloseTo(56.2);
    expect(result.mvrv_zscore).toBeCloseTo(3.4);
    expect(result.fear_greed_index).toBeCloseTo(42);
  });

  it('returns null for formula variables when there is no price data', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const repository = new DashboardMetricsRepository(database);

    const result = await repository.getLatestFormulaVariables();

    expect(result.btc_price).toBeNull();
    expect(result.btc_price_24h_change).toBeNull();
    expect(result.market_cap).toBeNull();
    expect(result.circulating_supply).toBeNull();
    expect(result.stock_to_flow).toBeNull();
    expect(result.mvrv_zscore).toBeNull();
    expect(result.fear_greed_index).toBeNull();
  });
});
