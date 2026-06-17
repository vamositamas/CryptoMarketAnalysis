import { RecentChartsRepository } from './recent-charts.repository';

describe('RecentChartsRepository', () => {
  it('upserts a recent chart view with ON CONFLICT update', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new RecentChartsRepository(database);

    await repository.upsert('user-1', 'bitcoin-rainbow');

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      ['user-1', 'bitcoin-rainbow'],
    );
  });

  it('prunes entries beyond the limit using a subquery', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new RecentChartsRepository(database);

    await repository.pruneToLimit('user-1', 5);

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM user_recent_charts'),
      ['user-1', 5],
    );
  });

  it('lists recent charts ordered by viewed_at descending', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { user_id: 'user-1', chart_id: 'bitcoin-rainbow', viewed_at: '2026-06-17T10:00:00.000Z' },
          { user_id: 'user-1', chart_id: 'pi-cycle-top', viewed_at: '2026-06-16T08:00:00.000Z' },
        ],
      }),
    };
    const repository = new RecentChartsRepository(database);

    const result = await repository.listForUser('user-1', 5);

    expect(result).toEqual([
      { userId: 'user-1', chartId: 'bitcoin-rainbow', viewedAt: '2026-06-17T10:00:00.000Z' },
      { userId: 'user-1', chartId: 'pi-cycle-top', viewedAt: '2026-06-16T08:00:00.000Z' },
    ]);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY viewed_at DESC'),
      ['user-1', 5],
    );
  });

  it('returns an empty list when the user has no recent charts', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new RecentChartsRepository(database);

    const result = await repository.listForUser('user-1', 5);

    expect(result).toEqual([]);
  });
});
