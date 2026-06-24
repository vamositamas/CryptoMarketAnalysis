import { ChartDataRequestError, ChartDataService, parseTimeframe } from './chart-data.service';

const rows = [
  {
    date: '2025-06-10',
    priceUsd: 65000,
    rainbowBand: 5,
    ma111: 64500,
    ma350: 31500,
    stockToFlowRatio: 56.2,
    lastUpdated: '2026-06-09T00:05:23.000Z',
  },
];

describe('ChartDataService', () => {
  it('returns Bitcoin Rainbow chart data', async () => {
    const repository = { findBitcoinChartData: jest.fn().mockResolvedValue(rows), findExcessLiquidityData: jest.fn().mockResolvedValue([]), findSpxLiquidityData: jest.fn().mockResolvedValue([]) };

    await expect(new ChartDataService(repository).getChartData('bitcoin-rainbow', '1y')).resolves.toEqual({
      chartId: 'bitcoin-rainbow',
      title: 'Bitcoin Rainbow Price Chart',
      timeframe: '1y',
      dataPoints: [{ date: '2025-06-10', priceUsd: 65000, rainbowBand: 5 }],
      lastUpdated: '2026-06-09T00:05:23.000Z',
    });
  });

  it('returns Pi Cycle Top chart data with ma350 multiplied by two', async () => {
    const repository = { findBitcoinChartData: jest.fn().mockResolvedValue(rows), findExcessLiquidityData: jest.fn().mockResolvedValue([]), findSpxLiquidityData: jest.fn().mockResolvedValue([]) };

    await expect(new ChartDataService(repository).getChartData('pi-cycle-top', 'all')).resolves.toMatchObject({
      chartId: 'pi-cycle-top',
      title: 'Pi Cycle Top Indicator',
      timeframe: 'all',
      dataPoints: [{ date: '2025-06-10', priceUsd: 65000, ma111: 64500, ma350x2: 63000 }],
    });
  });

  it('returns Stock-to-Flow chart data with simplified model price', async () => {
    const repository = { findBitcoinChartData: jest.fn().mockResolvedValue(rows), findExcessLiquidityData: jest.fn().mockResolvedValue([]), findSpxLiquidityData: jest.fn().mockResolvedValue([]) };

    await expect(new ChartDataService(repository).getChartData('stock-to-flow', 'all')).resolves.toMatchObject({
      chartId: 'stock-to-flow',
      title: 'Stock-to-Flow Model',
      dataPoints: [
        {
          date: '2025-06-10',
          priceUsd: 65000,
          stockToFlowRatio: expect.any(Number),
          modelPrice: expect.any(Number),
        },
      ],
    });
  });
});

describe('parseTimeframe', () => {
  it('defaults to all', () => {
    expect(parseTimeframe(undefined)).toBe('all');
  });

  it('rejects unsupported values', () => {
    expect(() => parseTimeframe('5y')).toThrow(ChartDataRequestError);
  });
});
