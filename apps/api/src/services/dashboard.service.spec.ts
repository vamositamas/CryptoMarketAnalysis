import { DashboardError, DashboardService } from './dashboard.service';
import type { DashboardWidgetRecord } from '../repositories/dashboard-widget.repository';

describe('DashboardService', () => {
  it('creates the 5 default widgets when the user has none yet', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue([
        widgetRecord('1', 'btc_price', { title: 'Current BTC Price', decimals: 2 }, 0),
        widgetRecord('2', '24h_change', { title: '24h Price Change', decimals: 1 }, 1),
        widgetRecord('3', 'mvrv_zscore', { title: 'MVRV Z-Score', decimals: 2 }, 2),
        widgetRecord('4', 'stock_to_flow', { title: 'Stock-to-Flow Ratio', decimals: 2 }, 3),
        widgetRecord('5', 'fear_greed', { title: 'Fear & Greed Index', decimals: 0 }, 4),
      ]),
    };
    const metricsRepository = createMetricsRepositoryStub();
    const service = new DashboardService(widgetRepository, metricsRepository);

    const response = await service.getWidgets('user-1');

    expect(widgetRepository.createMany).toHaveBeenCalledWith(
      'user-1',
      expect.arrayContaining([
        expect.objectContaining({ widgetType: 'btc_price', position: 0 }),
        expect.objectContaining({ widgetType: '24h_change', position: 1 }),
        expect.objectContaining({ widgetType: 'mvrv_zscore', position: 2 }),
        expect.objectContaining({ widgetType: 'stock_to_flow', position: 3 }),
        expect.objectContaining({ widgetType: 'fear_greed', position: 4 }),
      ]),
    );
    expect(response.widgets).toHaveLength(5);
  });

  it('does not recreate widgets when the user already has some', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        widgetRecord('1', 'btc_price', { title: 'Current BTC Price', decimals: 2 }, 0),
      ]),
    };
    const metricsRepository = {
      ...createMetricsRepositoryStub(),
      getLatestPrices: jest.fn().mockResolvedValue([{ date: '2026-06-10', value: 67234.5 }]),
    };
    const service = new DashboardService(widgetRepository, metricsRepository);

    await service.getWidgets('user-1');

    expect(widgetRepository.createMany).not.toHaveBeenCalled();
  });

  it('builds a BTC price widget with an up trend and a formatted dollar value', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        widgetRecord('1', 'btc_price', { title: 'Current BTC Price', decimals: 2 }, 0),
      ]),
    };
    const metricsRepository = {
      ...createMetricsRepositoryStub(),
      getLatestPrices: jest.fn().mockResolvedValue([
        { date: '2026-06-10', value: 67234.5 },
        { date: '2026-06-09', value: 66000 },
      ]),
    };
    const service = new DashboardService(widgetRepository, metricsRepository);

    const response = await service.getWidgets('user-1');

    expect(response.widgets[0]).toEqual({
      id: '1',
      type: 'btc_price',
      title: 'Current BTC Price',
      value: 67234.5,
      formattedValue: '$67,234.50',
      trend: 'up',
      trendPercent: 1.87,
      lastUpdated: '2026-06-10T00:00:00.000Z',
    });
  });

  it('builds a 24h change widget whose value is the percent change itself', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        widgetRecord('2', '24h_change', { title: '24h Price Change', decimals: 1 }, 0),
      ]),
    };
    const metricsRepository = {
      ...createMetricsRepositoryStub(),
      getLatestPrices: jest.fn().mockResolvedValue([
        { date: '2026-06-10', value: 66000 },
        { date: '2026-06-09', value: 67234.5 },
      ]),
    };
    const service = new DashboardService(widgetRepository, metricsRepository);

    const response = await service.getWidgets('user-1');

    expect(response.widgets[0]).toMatchObject({
      type: '24h_change',
      trend: 'down',
      formattedValue: '-1.8%',
    });
  });

  it('maps the stock_to_flow, mvrv_zscore, fear_greed, realized_price, ma_200_day, hash_rate, and mining_difficulty widget types to their stored metric names', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        widgetRecord('3', 'mvrv_zscore', { title: 'MVRV Z-Score', decimals: 2 }, 0),
        widgetRecord('4', 'stock_to_flow', { title: 'Stock-to-Flow Ratio', decimals: 2 }, 1),
        widgetRecord('5', 'fear_greed', { title: 'Fear & Greed Index', decimals: 0 }, 2),
        widgetRecord('6', 'realized_price', { title: 'Realized Price', decimals: 2 }, 3),
        widgetRecord('7', 'ma_200_day', { title: '200-day Moving Average', decimals: 2 }, 4),
        widgetRecord('8', 'hash_rate', { title: 'Hash Rate', decimals: 0 }, 5),
        widgetRecord('9', 'mining_difficulty', { title: 'Mining Difficulty', decimals: 0 }, 6),
      ]),
    };
    const metricsRepository = {
      ...createMetricsRepositoryStub(),
      getLatestMetricValues: jest.fn().mockResolvedValue([{ date: '2026-06-10', value: 1 }]),
    };
    const service = new DashboardService(widgetRepository, metricsRepository);

    await service.getWidgets('user-1');

    expect(metricsRepository.getLatestMetricValues).toHaveBeenCalledWith('mvrv_zscore');
    expect(metricsRepository.getLatestMetricValues).toHaveBeenCalledWith('stock_to_flow_ratio');
    expect(metricsRepository.getLatestMetricValues).toHaveBeenCalledWith('fear_greed_index');
    expect(metricsRepository.getLatestMetricValues).toHaveBeenCalledWith('realized_price');
    expect(metricsRepository.getLatestMetricValues).toHaveBeenCalledWith('ma_200_day');
    expect(metricsRepository.getLatestMetricValues).toHaveBeenCalledWith('hash_rate');
    expect(metricsRepository.getLatestMetricValues).toHaveBeenCalledWith('mining_difficulty');
  });

  it('returns a waiting-for-data placeholder when a metric has no data yet', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        widgetRecord('3', 'mvrv_zscore', { title: 'MVRV Z-Score', decimals: 2 }, 0),
      ]),
    };
    const metricsRepository = {
      ...createMetricsRepositoryStub(),
      getLatestMetricValues: jest.fn().mockResolvedValue([]),
    };
    const service = new DashboardService(widgetRepository, metricsRepository);

    const response = await service.getWidgets('user-1');

    expect(response.widgets[0]).toEqual({
      id: '3',
      type: 'mvrv_zscore',
      title: 'MVRV Z-Score',
      value: null,
      formattedValue: 'Waiting for data',
      trend: 'flat',
      trendPercent: null,
      lastUpdated: null,
    });
  });

  it('builds a total_supply widget as a fixed constant with no external data lookup', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        widgetRecord('10', 'total_supply', { title: 'Total Supply', decimals: 0 }, 0),
      ]),
    };
    const metricsRepository = createMetricsRepositoryStub();
    const service = new DashboardService(widgetRepository, metricsRepository);

    const response = await service.getWidgets('user-1');

    expect(response.widgets[0]).toEqual({
      id: '10',
      type: 'total_supply',
      title: 'Total Supply',
      value: 21_000_000,
      formattedValue: '21,000,000 BTC',
      trend: 'flat',
      trendPercent: null,
      lastUpdated: null,
    });
    expect(metricsRepository.getLatestPrices).not.toHaveBeenCalled();
    expect(metricsRepository.getLatestMetricValues).not.toHaveBeenCalled();
  });

  it('builds circulating_supply and market_cap widgets from the price table', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        widgetRecord('11', 'circulating_supply', { title: 'Circulating Supply', decimals: 0 }, 0),
        widgetRecord('12', 'market_cap', { title: 'Market Cap', decimals: 0 }, 1),
      ]),
    };
    const metricsRepository = {
      ...createMetricsRepositoryStub(),
      getLatestCirculatingSupply: jest
        .fn()
        .mockResolvedValue([{ date: '2026-06-10', value: 19_700_000 }]),
      getLatestMarketCap: jest
        .fn()
        .mockResolvedValue([{ date: '2026-06-10', value: 1_320_000_000_000 }]),
    };
    const service = new DashboardService(widgetRepository, metricsRepository);

    const response = await service.getWidgets('user-1');

    expect(response.widgets[0]).toMatchObject({ type: 'circulating_supply', formattedValue: '19,700,000 BTC' });
    expect(response.widgets[1]).toMatchObject({ type: 'market_cap', formattedValue: '$1,320,000,000,000' });
  });

  it('builds prediction and signal widgets from existing price and indicator data', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        widgetRecord('13', 'realized_price_premium', { title: 'Realized Price Premium', decimals: 1 }, 0),
        widgetRecord('14', 'nupl', { title: 'Bitcoin NUPL', decimals: 1 }, 1),
        widgetRecord('15', 's2f_model_price', { title: 'S2F Model Price', decimals: 0 }, 2),
        widgetRecord('16', 'base_case_target', { title: 'Base Case Target', decimals: 0 }, 3),
        widgetRecord('17', 'bull_case_target', { title: 'Bull Case Target', decimals: 0 }, 4),
        widgetRecord('18', 'market_signal_score', { title: 'Market Signal Score', decimals: 0 }, 5),
      ]),
    };
    const metricsRepository = {
      ...createMetricsRepositoryStub(),
      getLatestPrices: jest.fn().mockResolvedValue([{ date: '2026-06-10', value: 90_000 }]),
      getLatestMetricValues: jest.fn((metricName: string) => {
        const points: Record<string, { date: string; value: number }[]> = {
          realized_price: [{ date: '2026-06-10', value: 60_000 }],
          stock_to_flow_ratio: [{ date: '2026-06-10', value: 60 }],
          ma_200_day: [{ date: '2026-06-10', value: 80_000 }],
          mvrv_zscore: [{ date: '2026-06-10', value: 1.5 }],
          fear_greed_index: [{ date: '2026-06-10', value: 35 }],
        };
        return Promise.resolve(points[metricName] ?? []);
      }),
    };
    const service = new DashboardService(widgetRepository, metricsRepository);

    const response = await service.getWidgets('user-1');

    expect(response.widgets).toEqual([
      expect.objectContaining({
        type: 'realized_price_premium',
        value: 50,
        formattedValue: '+50.0%',
      }),
      expect.objectContaining({
        type: 'nupl',
        value: 33.33333333333333,
        formattedValue: '+33.3%',
      }),
      expect.objectContaining({
        type: 's2f_model_price',
        value: 86_400,
        formattedValue: '$86,400',
      }),
      expect.objectContaining({
        type: 'base_case_target',
        value: 103_200,
        formattedValue: '$103,200',
      }),
      expect.objectContaining({
        type: 'bull_case_target',
        value: 192_000,
        formattedValue: '$192,000',
      }),
      expect.objectContaining({
        type: 'market_signal_score',
        value: 65,
        formattedValue: '65/100',
      }),
    ]);
  });

  it('adds a widget at the next position after the current max', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      countForUser: jest.fn().mockResolvedValue(2),
      getMaxPosition: jest.fn().mockResolvedValue(4),
      create: jest.fn().mockResolvedValue(
        widgetRecord('20', 'ma_200_day', { title: '200-day Moving Average', decimals: 2 }, 5),
      ),
    };
    const metricsRepository = {
      ...createMetricsRepositoryStub(),
      getLatestMetricValues: jest.fn().mockResolvedValue([{ date: '2026-06-10', value: 65000.5 }]),
    };
    const service = new DashboardService(widgetRepository, metricsRepository);

    const response = await service.addWidget('user-1', {
      widgetType: 'ma_200_day',
      widgetConfig: { title: '200-day Moving Average', decimals: 2 },
    });

    expect(widgetRepository.create).toHaveBeenCalledWith('user-1', {
      widgetType: 'ma_200_day',
      widgetConfig: { title: '200-day Moving Average', decimals: 2 },
      position: 5,
    });
    expect(response).toMatchObject({ id: '20', type: 'ma_200_day' });
  });

  it('positions the first widget at 0 when the user has none yet', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      getMaxPosition: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockResolvedValue(widgetRecord('21', 'hash_rate', { title: 'Hash Rate', decimals: 0 }, 0)),
    };
    const service = new DashboardService(widgetRepository, createMetricsRepositoryStub());

    await service.addWidget('user-1', { widgetType: 'hash_rate' });

    expect(widgetRepository.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ position: 0 }),
    );
  });

  it('rejects an unrecognized widget type', async () => {
    const widgetRepository = createWidgetRepositoryStub();
    const service = new DashboardService(widgetRepository, createMetricsRepositoryStub());

    await expect(
      service.addWidget('user-1', { widgetType: 'not_a_real_widget' }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Unsupported widget type' } satisfies Partial<DashboardError>);
    expect(widgetRepository.create).not.toHaveBeenCalled();
  });

  it('rejects adding a widget once the dashboard already has 20 widgets', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      countForUser: jest.fn().mockResolvedValue(20),
    };
    const service = new DashboardService(widgetRepository, createMetricsRepositoryStub());

    await expect(service.addWidget('user-1', { widgetType: 'hash_rate' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Maximum 20 widgets per dashboard',
    } satisfies Partial<DashboardError>);
    expect(widgetRepository.create).not.toHaveBeenCalled();
  });
});

function widgetRecord(
  id: string,
  widgetType: string,
  widgetConfig: Record<string, unknown>,
  position: number,
): DashboardWidgetRecord {
  return {
    id,
    userId: 'user-1',
    widgetType,
    widgetConfig,
    position,
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
  };
}

function createWidgetRepositoryStub() {
  return {
    listForUser: jest.fn().mockResolvedValue([]),
    createMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    countForUser: jest.fn().mockResolvedValue(0),
    getMaxPosition: jest.fn().mockResolvedValue(null),
    reorderWidgets: jest.fn().mockResolvedValue(undefined),
    deleteForUser: jest.fn().mockResolvedValue(true),
  };
}

function createMetricsRepositoryStub() {
  return {
    getLatestPrices: jest.fn().mockResolvedValue([]),
    getLatestMetricValues: jest.fn().mockResolvedValue([]),
    getLatestCirculatingSupply: jest.fn().mockResolvedValue([]),
    getLatestMarketCap: jest.fn().mockResolvedValue([]),
    getLastRefreshTimestamp: jest.fn().mockResolvedValue(null),
    getLatestFormulaVariables: jest.fn().mockResolvedValue({
      btc_price: null,
      btc_price_24h_change: null,
      market_cap: null,
      circulating_supply: null,
      stock_to_flow: null,
      mvrv_zscore: null,
      nupl: null,
      fear_greed_index: null,
      global_m2_yoy: null,
    }),
  };
}

describe('DashboardService — custom formula widgets', () => {
  it('adds a custom widget after validating its formula', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      countForUser: jest.fn().mockResolvedValue(0),
      getMaxPosition: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(
        widgetRecord('99', 'custom', { title: 'My Ratio', formula: '{{market_cap}} / {{circulating_supply}}' }, 0),
      ),
    };
    const metricsRepository = {
      ...createMetricsRepositoryStub(),
      getLatestFormulaVariables: jest.fn().mockResolvedValue({
        btc_price: 67234.5,
        btc_price_24h_change: 1.87,
        market_cap: 1_320_000_000_000,
        circulating_supply: 19_700_000,
        stock_to_flow: 56.2,
        mvrv_zscore: 3.4,
        nupl: 33.3,
        fear_greed_index: 42,
        global_m2_yoy: 6.4,
      }),
    };
    const service = new DashboardService(widgetRepository, metricsRepository);

    const response = await service.addWidget('user-1', {
      widgetType: 'custom',
      widgetConfig: {
        title: 'My Ratio',
        formula: '{{market_cap}} / {{circulating_supply}}',
      },
    });

    expect(widgetRepository.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ widgetType: 'custom', position: 0 }),
    );
    expect(response.type).toBe('custom');
    expect(response.title).toBe('My Ratio');
    expect(response.value).toBeCloseTo(67005.08, 0);
  });

  it('rejects a custom widget with a missing formula', async () => {
    const service = new DashboardService(createWidgetRepositoryStub(), createMetricsRepositoryStub());

    await expect(
      service.addWidget('user-1', { widgetType: 'custom', widgetConfig: { title: 'No Formula' } }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Custom widget formula is required' });
  });

  it('rejects a custom widget with a missing title', async () => {
    const service = new DashboardService(createWidgetRepositoryStub(), createMetricsRepositoryStub());

    await expect(
      service.addWidget('user-1', {
        widgetType: 'custom',
        widgetConfig: { formula: '{{btc_price}} * 2' },
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Custom widget name is required' });
  });

  it('rejects a custom widget with an unknown variable in its formula', async () => {
    const service = new DashboardService(createWidgetRepositoryStub(), createMetricsRepositoryStub());

    await expect(
      service.addWidget('user-1', {
        widgetType: 'custom',
        widgetConfig: { title: 'Bad', formula: '{{unknown}} * 2' },
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Unknown variable: {{unknown}}' });
  });

  it('builds a custom widget response with a formatted calculated value', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        widgetRecord('99', 'custom', { title: 'S2F x 1000', formula: '{{stock_to_flow}} * 1000' }, 0),
      ]),
    };
    const metricsRepository = {
      ...createMetricsRepositoryStub(),
      getLatestFormulaVariables: jest.fn().mockResolvedValue({
        btc_price: 67234.5,
        btc_price_24h_change: 1.87,
        market_cap: 1_320_000_000_000,
        circulating_supply: 19_700_000,
        stock_to_flow: 56.2,
        mvrv_zscore: 3.4,
        fear_greed_index: 42,
        global_m2_yoy: 6.4,
      }),
    };
    const service = new DashboardService(widgetRepository, metricsRepository);

    const response = await service.getWidgets('user-1');

    expect(response.widgets[0]).toMatchObject({
      type: 'custom',
      title: 'S2F x 1000',
      value: 56200,
      formattedValue: '56,200',
      trend: 'flat',
      trendPercent: null,
      lastUpdated: null,
    });
  });

  it('shows a data-unavailable message when formula variables are null', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        widgetRecord('99', 'custom', { title: 'My Metric', formula: '{{mvrv_zscore}} * 2' }, 0),
      ]),
    };
    const service = new DashboardService(widgetRepository, createMetricsRepositoryStub());

    const response = await service.getWidgets('user-1');

    expect(response.widgets[0]).toMatchObject({
      value: null,
      formattedValue: 'Data unavailable — Check back soon',
    });
  });
});

describe('DashboardService — reorderWidgets', () => {
  it('delegates reordering to the widget repository with the validated ID array', async () => {
    const widgetRepository = {
      ...createWidgetRepositoryStub(),
      reorderWidgets: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DashboardService(widgetRepository, createMetricsRepositoryStub());

    await service.reorderWidgets('user-1', ['id-b', 'id-a', 'id-c']);

    expect(widgetRepository.reorderWidgets).toHaveBeenCalledWith('user-1', ['id-b', 'id-a', 'id-c']);
  });

  it('rejects a non-array input', async () => {
    const service = new DashboardService(createWidgetRepositoryStub(), createMetricsRepositoryStub());

    await expect(service.reorderWidgets('user-1', 'not-an-array')).rejects.toMatchObject({
      statusCode: 400,
      message: 'orderedIds must be a non-empty array',
    });
  });

  it('rejects an empty array', async () => {
    const service = new DashboardService(createWidgetRepositoryStub(), createMetricsRepositoryStub());

    await expect(service.reorderWidgets('user-1', [])).rejects.toMatchObject({
      statusCode: 400,
      message: 'orderedIds must be a non-empty array',
    });
  });

  it('rejects duplicate widget IDs', async () => {
    const service = new DashboardService(createWidgetRepositoryStub(), createMetricsRepositoryStub());

    await expect(service.reorderWidgets('user-1', ['id-a', 'id-a', 'id-b'])).rejects.toMatchObject({
      statusCode: 400,
      message: 'Widget IDs must be unique',
    });
  });

  it('rejects a list that exceeds the 20-widget cap', async () => {
    const service = new DashboardService(createWidgetRepositoryStub(), createMetricsRepositoryStub());
    const ids = Array.from({ length: 21 }, (_, i) => `id-${i}`);

    await expect(service.reorderWidgets('user-1', ids)).rejects.toMatchObject({ statusCode: 400 });
  });
});
