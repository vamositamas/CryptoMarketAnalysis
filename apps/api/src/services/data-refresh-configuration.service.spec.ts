import {
  DataRefreshConfigurationError,
  DataRefreshConfigurationService,
} from './data-refresh-configuration.service';

describe('DataRefreshConfigurationService', () => {
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
