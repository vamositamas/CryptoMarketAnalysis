import { DashboardWidgetRepository } from './dashboard-widget.repository';

describe('DashboardWidgetRepository', () => {
  it('lists widgets for a user ordered by position', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'widget-1',
            user_id: 'user-1',
            widget_type: 'btc_price',
            widget_config: { title: 'Current BTC Price', decimals: 2 },
            position: 0,
            created_at: '2026-06-10T00:00:00.000Z',
            updated_at: '2026-06-10T00:00:00.000Z',
          },
        ],
      }),
    };
    const repository = new DashboardWidgetRepository(database);

    await expect(repository.listForUser('user-1')).resolves.toEqual([
      {
        id: 'widget-1',
        userId: 'user-1',
        widgetType: 'btc_price',
        widgetConfig: { title: 'Current BTC Price', decimals: 2 },
        position: 0,
        createdAt: '2026-06-10T00:00:00.000Z',
        updatedAt: '2026-06-10T00:00:00.000Z',
      },
    ]);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY position ASC'),
      ['user-1'],
    );
  });

  it('creates multiple widgets in one insert and returns the created records', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'widget-1',
            user_id: 'user-1',
            widget_type: 'btc_price',
            widget_config: { title: 'Current BTC Price', decimals: 2 },
            position: 0,
            created_at: '2026-06-10T00:00:00.000Z',
            updated_at: '2026-06-10T00:00:00.000Z',
          },
          {
            id: 'widget-2',
            user_id: 'user-1',
            widget_type: '24h_change',
            widget_config: { title: '24h Price Change', decimals: 1 },
            position: 1,
            created_at: '2026-06-10T00:00:00.000Z',
            updated_at: '2026-06-10T00:00:00.000Z',
          },
        ],
      }),
    };
    const repository = new DashboardWidgetRepository(database);

    const result = await repository.createMany('user-1', [
      { widgetType: 'btc_price', widgetConfig: { title: 'Current BTC Price', decimals: 2 }, position: 0 },
      { widgetType: '24h_change', widgetConfig: { title: '24h Price Change', decimals: 1 }, position: 1 },
    ]);

    expect(result).toHaveLength(2);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_dashboard_widgets'),
      [
        'user-1',
        'btc_price',
        JSON.stringify({ title: 'Current BTC Price', decimals: 2 }),
        0,
        'user-1',
        '24h_change',
        JSON.stringify({ title: '24h Price Change', decimals: 1 }),
        1,
      ],
    );
  });

  it('does not query the database when creating an empty widget list', async () => {
    const database = { query: jest.fn() };
    const repository = new DashboardWidgetRepository(database);

    await expect(repository.createMany('user-1', [])).resolves.toEqual([]);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('creates a single widget and returns the created record', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'widget-3',
            user_id: 'user-1',
            widget_type: 'hash_rate',
            widget_config: { title: 'Hash Rate', decimals: 0 },
            position: 5,
            created_at: '2026-06-10T00:00:00.000Z',
            updated_at: '2026-06-10T00:00:00.000Z',
          },
        ],
      }),
    };
    const repository = new DashboardWidgetRepository(database);

    const result = await repository.create('user-1', {
      widgetType: 'hash_rate',
      widgetConfig: { title: 'Hash Rate', decimals: 0 },
      position: 5,
    });

    expect(result).toEqual({
      id: 'widget-3',
      userId: 'user-1',
      widgetType: 'hash_rate',
      widgetConfig: { title: 'Hash Rate', decimals: 0 },
      position: 5,
      createdAt: '2026-06-10T00:00:00.000Z',
      updatedAt: '2026-06-10T00:00:00.000Z',
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_dashboard_widgets'),
      ['user-1', 'hash_rate', JSON.stringify({ title: 'Hash Rate', decimals: 0 }), 5],
    );
  });

  it('counts widgets for a user', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [{ count: 7 }] }) };
    const repository = new DashboardWidgetRepository(database);

    await expect(repository.countForUser('user-1')).resolves.toBe(7);
  });

  it('returns the max position for a user', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [{ max_position: 4 }] }) };
    const repository = new DashboardWidgetRepository(database);

    await expect(repository.getMaxPosition('user-1')).resolves.toBe(4);
  });

  it('returns null max position when the user has no widgets', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [{ max_position: null }] }) };
    const repository = new DashboardWidgetRepository(database);

    await expect(repository.getMaxPosition('user-1')).resolves.toBeNull();
  });
});
