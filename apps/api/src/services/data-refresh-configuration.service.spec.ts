import {
  DataRefreshConfigurationError,
  DataRefreshConfigurationService,
} from './data-refresh-configuration.service';

describe('DataRefreshConfigurationService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('updates refresh frequency and applies the scheduler change first', async () => {
    const repository = {
      getDataRefreshConfiguration: jest.fn(),
      updateDataRefreshConfiguration: jest.fn().mockResolvedValue({
        refreshFrequency: 'hourly',
        historicalDepth: 'all_time',
        lastRefresh: { timestamp: null, status: 'never' },
      }),
    };
    const scheduler = { applyRefreshFrequency: jest.fn().mockResolvedValue(undefined) };
    const service = new DataRefreshConfigurationService(repository, scheduler);

    await expect(
      service.updateConfiguration({ refreshFrequency: 'hourly' }),
    ).resolves.toMatchObject({ refreshFrequency: 'hourly' });

    expect(scheduler.applyRefreshFrequency).toHaveBeenCalledWith('hourly');
    expect(repository.updateDataRefreshConfiguration).toHaveBeenCalledWith({
      refreshFrequency: 'hourly',
    });
  });

  it('creates the daily QStash schedule at midnight', async () => {
    process.env.QSTASH_TOKEN = 'qstash-token';
    process.env.QSTASH_DAILY_REFRESH_URL = 'https://example.com/api/jobs/daily-data-refresh';
    delete process.env.QSTASH_DAILY_REFRESH_SCHEDULE_ID;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ scheduleId: 'schedule_123' }), { status: 200 }),
    );
    const repository = {
      getDataRefreshConfiguration: jest.fn(),
      updateDataRefreshConfiguration: jest.fn().mockResolvedValue({
        refreshFrequency: 'daily',
        historicalDepth: 'all_time',
        lastRefresh: { timestamp: null, status: 'never' },
      }),
    };
    const service = new DataRefreshConfigurationService(repository);

    await service.updateConfiguration({ refreshFrequency: 'daily' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://qstash.upstash.io/v2/schedules',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          destination: 'https://example.com/api/jobs/daily-data-refresh',
          cron: '0 0 * * *',
        }),
      }),
    );
  });

  it('fails the update when QStash schedule creation fails', async () => {
    process.env.QSTASH_TOKEN = 'qstash-token';
    process.env.QSTASH_DAILY_REFRESH_URL = 'https://example.com/api/jobs/daily-data-refresh';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('invalid destination', { status: 400 }),
    );
    const repository = {
      getDataRefreshConfiguration: jest.fn(),
      updateDataRefreshConfiguration: jest.fn(),
    };
    const service = new DataRefreshConfigurationService(repository);

    await expect(service.updateConfiguration({ refreshFrequency: 'daily' })).rejects.toThrow(
      'Failed to create data refresh schedule',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(repository.updateDataRefreshConfiguration).not.toHaveBeenCalled();
  });

  it('rejects invalid refresh frequency values', async () => {
    const service = new DataRefreshConfigurationService(
      {
        getDataRefreshConfiguration: jest.fn(),
        updateDataRefreshConfiguration: jest.fn(),
      },
      { applyRefreshFrequency: jest.fn() },
    );

    await expect(
      service.updateConfiguration({ refreshFrequency: 'weekly' as never }),
    ).rejects.toEqual(new DataRefreshConfigurationError(400, 'Invalid refresh frequency'));
  });

  it('rejects empty updates', async () => {
    const service = new DataRefreshConfigurationService(
      {
        getDataRefreshConfiguration: jest.fn(),
        updateDataRefreshConfiguration: jest.fn(),
      },
      { applyRefreshFrequency: jest.fn() },
    );

    await expect(service.updateConfiguration({})).rejects.toEqual(
      new DataRefreshConfigurationError(400, 'At least one configuration field is required'),
    );
  });
});
