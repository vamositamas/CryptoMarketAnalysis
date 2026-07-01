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
    const repository = { findBitcoinChartData: jest.fn().mockResolvedValue(rows), findExcessLiquidityData: jest.fn().mockResolvedValue([]), findSpxLiquidityData: jest.fn().mockResolvedValue([]), findMidtermCyclesData: jest.fn().mockResolvedValue([]), findGlobalM2BitcoinData: jest.fn().mockResolvedValue([]), findDxyBitcoinData: jest.fn().mockResolvedValue([]) };

    await expect(new ChartDataService(repository).getChartData('bitcoin-rainbow', '1y')).resolves.toEqual({
      chartId: 'bitcoin-rainbow',
      title: 'Bitcoin Rainbow Price Chart',
      timeframe: '1y',
      dataPoints: [{ date: '2025-06-10', priceUsd: 65000, rainbowBand: 5 }],
      lastUpdated: '2026-06-09T00:05:23.000Z',
    });
  });

  it('returns Pi Cycle Top chart data with ma350 multiplied by two', async () => {
    const repository = { findBitcoinChartData: jest.fn().mockResolvedValue(rows), findExcessLiquidityData: jest.fn().mockResolvedValue([]), findSpxLiquidityData: jest.fn().mockResolvedValue([]), findMidtermCyclesData: jest.fn().mockResolvedValue([]), findGlobalM2BitcoinData: jest.fn().mockResolvedValue([]), findDxyBitcoinData: jest.fn().mockResolvedValue([]) };

    await expect(new ChartDataService(repository).getChartData('pi-cycle-top', 'all')).resolves.toMatchObject({
      chartId: 'pi-cycle-top',
      title: 'Pi Cycle Top Indicator',
      timeframe: 'all',
      dataPoints: [{ date: '2025-06-10', priceUsd: 65000, ma111: 64500, ma350x2: 63000 }],
    });
  });

  it('returns Stock-to-Flow chart data with simplified model price', async () => {
    const repository = { findBitcoinChartData: jest.fn().mockResolvedValue(rows), findExcessLiquidityData: jest.fn().mockResolvedValue([]), findSpxLiquidityData: jest.fn().mockResolvedValue([]), findMidtermCyclesData: jest.fn().mockResolvedValue([]), findGlobalM2BitcoinData: jest.fn().mockResolvedValue([]), findDxyBitcoinData: jest.fn().mockResolvedValue([]) };

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

  it('fills sparse realized price history from CoinMetrics-derived history', async () => {
    const repository = {
      findBitcoinChartData: jest.fn().mockResolvedValue([
        { ...rows[0], date: '2025-06-10', priceUsd: 65000, realizedPrice: null },
        { ...rows[0], date: '2025-06-11', priceUsd: 66000, realizedPrice: 52000 },
      ]),
      findExcessLiquidityData: jest.fn().mockResolvedValue([]),
      findSpxLiquidityData: jest.fn().mockResolvedValue([]),
      findMidtermCyclesData: jest.fn().mockResolvedValue([]),
      findGlobalM2BitcoinData: jest.fn().mockResolvedValue([]), findDxyBitcoinData: jest.fn().mockResolvedValue([]),
    };
    const coinMetricsClient = {
      fetchMvrvRatioAndPriceHistory: jest.fn().mockResolvedValue([
        { date: '2025-06-10', realizedPrice: 51000 },
        { date: '2025-06-11', realizedPrice: 51500 },
      ]),
      fetchExchangeReserveHistory: jest.fn().mockResolvedValue([]),
    };

    await expect(
      new ChartDataService(
        repository,
        () => new Date('2025-06-12T00:00:00.000Z'),
        undefined,
        coinMetricsClient,
      ).getChartData('realized-price', 'all'),
    ).resolves.toMatchObject({
      chartId: 'realized-price',
      dataPoints: [
        { date: '2025-06-10', priceUsd: 65000, realizedPrice: 51000, mvrvRatio: 65000 / 51000 },
        { date: '2025-06-11', priceUsd: 66000, realizedPrice: 52000, mvrvRatio: 66000 / 52000 },
      ],
    });
  });

  it('fills sparse exchange reserve history from CoinMetrics-derived history', async () => {
    const repository = {
      findBitcoinChartData: jest.fn().mockResolvedValue([
        { ...rows[0], date: '2025-06-10', priceUsd: 65000, exchangeReserve: null },
        { ...rows[0], date: '2025-06-11', priceUsd: 66000, exchangeReserve: 2_610_000 },
      ]),
      findExcessLiquidityData: jest.fn().mockResolvedValue([]),
      findSpxLiquidityData: jest.fn().mockResolvedValue([]),
      findMidtermCyclesData: jest.fn().mockResolvedValue([]),
      findGlobalM2BitcoinData: jest.fn().mockResolvedValue([]), findDxyBitcoinData: jest.fn().mockResolvedValue([]),
    };
    const coinMetricsClient = {
      fetchMvrvRatioAndPriceHistory: jest.fn(),
      fetchExchangeReserveHistory: jest.fn().mockResolvedValue([
        { date: '2025-06-10', exchangeReserve: 2_600_000 },
        { date: '2025-06-11', exchangeReserve: 2_605_000 },
      ]),
    };

    await expect(
      new ChartDataService(
        repository,
        () => new Date('2025-06-12T00:00:00.000Z'),
        undefined,
        coinMetricsClient,
      ).getChartData('exchange-reserve', 'all'),
    ).resolves.toMatchObject({
      chartId: 'exchange-reserve',
      dataPoints: [
        { date: '2025-06-10', priceUsd: 65000, exchangeReserve: 2_600_000 },
        { date: '2025-06-11', priceUsd: 66000, exchangeReserve: 2_610_000 },
      ],
    });
  });

  it('fills sparse price forecast model history from bitcoin-data history', async () => {
    const repository = {
      findBitcoinChartData: jest.fn().mockResolvedValue([
        {
          ...rows[0],
          date: '2025-06-10',
          priceUsd: 65000,
          circulatingSupply: 19_800_000,
          realizedPrice: 52000,
          cvdd: null,
          balancedPrice: null,
          terminalPrice: null,
        },
        {
          ...rows[0],
          date: '2025-06-11',
          priceUsd: 66000,
          circulatingSupply: 19_800_100,
          realizedPrice: 52100,
          cvdd: 14000,
          balancedPrice: 28000,
          terminalPrice: 130000,
        },
      ]),
      findExcessLiquidityData: jest.fn().mockResolvedValue([]),
      findSpxLiquidityData: jest.fn().mockResolvedValue([]),
      findMidtermCyclesData: jest.fn().mockResolvedValue([]),
      findGlobalM2BitcoinData: jest.fn().mockResolvedValue([]), findDxyBitcoinData: jest.fn().mockResolvedValue([]),
    };
    const bitcoinDataClient = {
      fetchVddMultipleHistory: jest.fn(),
      fetchCvddHistory: jest.fn().mockResolvedValue([
        { date: '2025-06-10', value: 13500 },
        { date: '2025-06-11', value: 13600 },
      ]),
      fetchBalancedPriceHistory: jest.fn().mockResolvedValue([
        { date: '2025-06-10', value: 27000 },
        { date: '2025-06-11', value: 27100 },
      ]),
      fetchTerminalPriceHistory: jest.fn().mockResolvedValue([
        { date: '2025-06-10', value: 128000 },
        { date: '2025-06-11', value: 129000 },
      ]),
    };
    const coinMetricsClient = {
      fetchMvrvRatioAndPriceHistory: jest.fn().mockResolvedValue([
        { date: '2025-06-10', realizedPrice: 51900 },
        { date: '2025-06-11', realizedPrice: 52000 },
      ]),
      fetchExchangeReserveHistory: jest.fn().mockResolvedValue([]),
    };

    await expect(
      new ChartDataService(
        repository,
        () => new Date('2025-06-12T00:00:00.000Z'),
        bitcoinDataClient,
        coinMetricsClient,
      ).getChartData('price-forecast-tools', 'all'),
    ).resolves.toMatchObject({
      chartId: 'price-forecast-tools',
      dataPoints: [
        {
          date: '2025-06-10',
          priceUsd: 65000,
          cvdd: 13500,
          balancedPrice: 27000,
          terminalPrice: 128000,
        },
        {
          date: '2025-06-11',
          priceUsd: 66000,
          cvdd: 14000,
          balancedPrice: 28000,
          terminalPrice: 130000,
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
