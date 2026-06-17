import { RecentChartsService, RecentChartsError } from './recent-charts.service';

function createRepositoryStub() {
  return {
    upsert: jest.fn().mockResolvedValue(undefined),
    pruneToLimit: jest.fn().mockResolvedValue(undefined),
    listForUser: jest.fn().mockResolvedValue([]),
  };
}

describe('RecentChartsService', () => {
  it('upserts and prunes when recording a known chart view', async () => {
    const repository = createRepositoryStub();
    const service = new RecentChartsService(repository);

    await service.recordView('user-1', 'bitcoin-rainbow');

    expect(repository.upsert).toHaveBeenCalledWith('user-1', 'bitcoin-rainbow');
    expect(repository.pruneToLimit).toHaveBeenCalledWith('user-1', 5);
  });

  it('rejects an empty chartId', async () => {
    const service = new RecentChartsService(createRepositoryStub());

    await expect(service.recordView('user-1', '')).rejects.toMatchObject({
      statusCode: 400,
      message: 'chartId is required',
    });
  });

  it('rejects a non-string chartId', async () => {
    const service = new RecentChartsService(createRepositoryStub());

    await expect(service.recordView('user-1', 42)).rejects.toMatchObject({
      statusCode: 400,
      message: 'chartId is required',
    });
  });

  it('rejects an unknown chart ID', async () => {
    const service = new RecentChartsService(createRepositoryStub());

    await expect(service.recordView('user-1', 'not-a-real-chart')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Unknown chart',
    });
  });

  it('returns recent charts enriched with catalog title and URL', async () => {
    const repository = {
      ...createRepositoryStub(),
      listForUser: jest.fn().mockResolvedValue([
        { userId: 'user-1', chartId: 'bitcoin-rainbow', viewedAt: '2026-06-17T10:00:00.000Z' },
        { userId: 'user-1', chartId: 'stock-to-flow', viewedAt: '2026-06-16T08:00:00.000Z' },
      ]),
    };
    const service = new RecentChartsService(repository);

    const response = await service.listRecent('user-1');

    expect(response.recentCharts).toHaveLength(2);
    expect(response.recentCharts[0]).toMatchObject({
      chartId: 'bitcoin-rainbow',
      title: 'Bitcoin Rainbow Price Chart',
      url: '/charts/bitcoin-rainbow',
      viewedAt: '2026-06-17T10:00:00.000Z',
    });
    expect(response.recentCharts[1]).toMatchObject({
      chartId: 'stock-to-flow',
      title: 'Stock-to-Flow Model',
    });
  });

  it('returns an empty list when the user has no recent charts', async () => {
    const service = new RecentChartsService(createRepositoryStub());

    const response = await service.listRecent('user-1');

    expect(response.recentCharts).toEqual([]);
  });

  it('throws a typed RecentChartsError', async () => {
    const service = new RecentChartsService(createRepositoryStub());

    await expect(service.recordView('user-1', 'bad')).rejects.toBeInstanceOf(RecentChartsError);
  });
});
