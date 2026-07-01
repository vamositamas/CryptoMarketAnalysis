import { ChartDataRepository } from './chart-data.repository';

describe('ChartDataRepository', () => {
  it('queries joined chart data from the last 365 days for 1y timeframe', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            date: '2025-06-15',
            price_usd: '65000.50',
            rainbow_band: '5',
            ma_111_day: '64500.125',
            ma_350_day: '31500',
            stock_to_flow_ratio: '56.2',
            last_updated: '2026-06-15T00:05:23.000Z',
          },
        ],
      }),
    };

    const rows = await new ChartDataRepository(database).findBitcoinChartData(
      '1y',
      new Date('2026-06-15T12:00:00.000Z'),
    );

    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('FROM bitcoin_price_daily price'), [
      '2025-06-15',
    ]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("rainbow.metric_name = 'rainbow_band'"), [
      '2025-06-15',
    ]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("ma111.metric_name = 'ma_111_day'"), [
      '2025-06-15',
    ]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("stock_to_flow.metric_name = 'stock_to_flow_ratio'"), [
      '2025-06-15',
    ]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("exres_m.metric_name = 'exchange_reserve'"), [
      '2025-06-15',
    ]);
    expect(rows).toMatchObject([
      {
        date: '2025-06-15',
        priceUsd: 65000.5,
        rainbowBand: 5,
        ma111: 64500.125,
        ma350: 31500,
        stockToFlowRatio: 56.2,
        lastUpdated: '2026-06-15T00:05:23.000Z',
      },
    ]);
  });

  it('uses Bitcoin genesis date for all timeframe', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    await new ChartDataRepository(database).findBitcoinChartData('all');

    expect(database.query).toHaveBeenCalledWith(expect.any(String), ['2009-01-03']);
  });
});
