interface Queryable {
  query<Row = unknown>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

interface MarketSignalPreferenceRow {
  selected_signal_names: unknown;
}

export class MarketSignalPreferencesRepository {
  constructor(private readonly database: Queryable | undefined) {}

  async findSelectedSignalNames(userId: string): Promise<string[] | null> {
    let result: { rows: MarketSignalPreferenceRow[] };
    try {
      result = await this.requireDatabase().query<MarketSignalPreferenceRow>(
        `SELECT selected_signal_names
         FROM user_market_signal_preferences
         WHERE user_id = $1::uuid`,
        [userId],
      );
    } catch (error) {
      if (isUndefinedTableError(error)) return null;
      throw error;
    }

    if (result.rows.length === 0) return null;

    const value = result.rows[0].selected_signal_names;
    if (!Array.isArray(value)) return null;

    return value.filter((item): item is string => typeof item === 'string');
  }

  async saveSelectedSignalNames(userId: string, selectedSignalNames: string[]): Promise<string[]> {
    let result: { rows: MarketSignalPreferenceRow[] };
    try {
      result = await this.requireDatabase().query<MarketSignalPreferenceRow>(
        `INSERT INTO user_market_signal_preferences (user_id, selected_signal_names, created_at, updated_at)
         VALUES ($1::uuid, $2::jsonb, NOW(), NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET selected_signal_names = EXCLUDED.selected_signal_names, updated_at = NOW()
         RETURNING selected_signal_names`,
        [userId, JSON.stringify(selectedSignalNames)],
      );
    } catch (error) {
      if (isUndefinedTableError(error)) {
        throw new Error('Market signal preferences table is missing. Apply migration 017_create_user_market_signal_preferences.sql.');
      }
      throw error;
    }

    const value = result.rows[0]?.selected_signal_names;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private requireDatabase(): Queryable {
    if (!this.database) {
      throw new Error('Database is not configured');
    }
    return this.database;
  }
}

function isUndefinedTableError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === '42P01';
}
