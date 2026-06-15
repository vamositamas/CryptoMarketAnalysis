import { BaseRepository } from './base.repository';

export type RefreshFrequency = 'daily' | 'hourly' | 'manual';
export type HistoricalDepth = '1_year' | '2_years' | '5_years' | 'all_time';
export type RefreshStatus = 'success' | 'failed' | 'never';

export interface DataRefreshConfiguration {
  refreshFrequency: RefreshFrequency;
  historicalDepth: HistoricalDepth;
  lastRefresh: {
    timestamp: string | null;
    status: RefreshStatus;
  };
}

interface Queryable {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const DEFAULT_CONFIGURATION: DataRefreshConfiguration = {
  refreshFrequency: 'daily',
  historicalDepth: 'all_time',
  lastRefresh: {
    timestamp: null,
    status: 'never',
  },
};

export class SystemConfigurationRepository extends BaseRepository {
  constructor(private readonly database: Queryable) {
    super();
  }

  async getDataRefreshConfiguration(): Promise<DataRefreshConfiguration> {
    const result = await this.database.query(
      `
        SELECT key, value
        FROM system_configuration
        WHERE key IN (
          'refresh_frequency',
          'historical_depth',
          'last_refresh_timestamp',
          'last_refresh_status'
        )
      `,
    );
    const values = Object.fromEntries(
      result.rows.map((row) => [String(row['key']), String(row['value'])]),
    );

    return {
      refreshFrequency: parseRefreshFrequency(values['refresh_frequency']),
      historicalDepth: parseHistoricalDepth(values['historical_depth']),
      lastRefresh: {
        timestamp: values['last_refresh_timestamp'] ?? DEFAULT_CONFIGURATION.lastRefresh.timestamp,
        status: parseRefreshStatus(values['last_refresh_status']),
      },
    };
  }

  async updateDataRefreshConfiguration(input: {
    refreshFrequency?: RefreshFrequency;
    historicalDepth?: HistoricalDepth;
  }): Promise<DataRefreshConfiguration> {
    const entries: [string, RefreshFrequency | HistoricalDepth][] = [];

    if (input.refreshFrequency !== undefined) {
      entries.push(['refresh_frequency', input.refreshFrequency]);
    }

    if (input.historicalDepth !== undefined) {
      entries.push(['historical_depth', input.historicalDepth]);
    }

    for (const [key, value] of entries) {
      await this.database.query(
        `
          INSERT INTO system_configuration (key, value, updated_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT (key)
          DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        `,
        [key, value],
      );
    }

    return this.getDataRefreshConfiguration();
  }
}

function parseRefreshFrequency(value: string | undefined): RefreshFrequency {
  return value === 'hourly' || value === 'manual' ? value : DEFAULT_CONFIGURATION.refreshFrequency;
}

function parseHistoricalDepth(value: string | undefined): HistoricalDepth {
  return value === '1_year' || value === '2_years' || value === '5_years'
    ? value
    : DEFAULT_CONFIGURATION.historicalDepth;
}

function parseRefreshStatus(value: string | undefined): RefreshStatus {
  return value === 'success' || value === 'failed' ? value : DEFAULT_CONFIGURATION.lastRefresh.status;
}
