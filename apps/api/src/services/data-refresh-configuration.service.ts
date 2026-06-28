import {
  type DataRefreshConfiguration,
  type HistoricalDepth,
  type RefreshFrequency,
  SystemConfigurationRepository,
} from '../repositories/system-configuration.repository';

export class DataRefreshConfigurationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export interface DataRefreshConfigurationScheduler {
  applyRefreshFrequency(frequency: RefreshFrequency): Promise<void>;
}

const QSTASH_DAILY_CRON = '0 0 * * *';
const QSTASH_HOURLY_CRON = '0 * * * *';

export interface DataRefreshConfigurationUpdate {
  refreshFrequency?: RefreshFrequency;
  historicalDepth?: HistoricalDepth;
}

export class DataRefreshConfigurationService {
  constructor(
    private readonly repository: Pick<
      SystemConfigurationRepository,
      'getDataRefreshConfiguration' | 'updateDataRefreshConfiguration'
    >,
    private readonly scheduler: DataRefreshConfigurationScheduler = new QStashScheduleService(),
  ) {}

  getConfiguration(): Promise<DataRefreshConfiguration> {
    return this.repository.getDataRefreshConfiguration();
  }

  async updateConfiguration(
    input: DataRefreshConfigurationUpdate,
  ): Promise<DataRefreshConfiguration> {
    const update = validateUpdate(input);

    if (Object.keys(update).length === 0) {
      throw new DataRefreshConfigurationError(400, 'At least one configuration field is required');
    }

    if (update.refreshFrequency) {
      await this.scheduler.applyRefreshFrequency(update.refreshFrequency);
    }

    return this.repository.updateDataRefreshConfiguration(update);
  }
}

class QStashScheduleService implements DataRefreshConfigurationScheduler {
  async applyRefreshFrequency(frequency: RefreshFrequency): Promise<void> {
    if (!process.env.QSTASH_TOKEN || !process.env.QSTASH_DAILY_REFRESH_URL) {
      return;
    }

    const scheduleId = process.env.QSTASH_DAILY_REFRESH_SCHEDULE_ID;

    if (scheduleId) {
      const response = await fetch(`https://qstash.upstash.io/v2/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.QSTASH_TOKEN}` },
      });
      await assertQStashResponse(response, 'delete existing data refresh schedule');
    }

    if (frequency === 'manual') {
      return;
    }

    const response = await fetch('https://qstash.upstash.io/v2/schedules', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        destination: process.env.QSTASH_DAILY_REFRESH_URL,
        cron: frequency === 'hourly' ? QSTASH_HOURLY_CRON : QSTASH_DAILY_CRON,
      }),
    });
    await assertQStashResponse(response, 'create data refresh schedule');
  }
}

async function assertQStashResponse(response: Response, action: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = await response.text().catch(() => '');
  throw new Error(`Failed to ${action}: QStash returned ${response.status} ${body}`.trim());
}

function validateUpdate(input: DataRefreshConfigurationUpdate): DataRefreshConfigurationUpdate {
  const update: DataRefreshConfigurationUpdate = {};

  if (input.refreshFrequency !== undefined) {
    if (!['daily', 'hourly', 'manual'].includes(input.refreshFrequency)) {
      throw new DataRefreshConfigurationError(400, 'Invalid refresh frequency');
    }
    update.refreshFrequency = input.refreshFrequency;
  }

  if (input.historicalDepth !== undefined) {
    if (!['1_year', '2_years', '5_years', 'all_time'].includes(input.historicalDepth)) {
      throw new DataRefreshConfigurationError(400, 'Invalid historical depth');
    }
    update.historicalDepth = input.historicalDepth;
  }

  return update;
}
