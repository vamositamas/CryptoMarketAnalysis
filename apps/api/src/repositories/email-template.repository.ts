interface Queryable {
  query<Row = unknown>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export interface EmailTemplateRecord {
  key: string;
  value: string;
  updatedAt: string;
}

interface ConfigRow {
  key: string;
  value: string;
  updated_at: string | Date;
}

const KEY_PREFIX = 'email_template_';

export class EmailTemplateRepository {
  constructor(private readonly database: Queryable) {}

  async getTemplate(key: string): Promise<string | null> {
    const result = await this.database.query<{ value: string }>(
      `SELECT value FROM system_configuration WHERE key = $1`,
      [`${KEY_PREFIX}${key}`],
    );
    return result.rows[0]?.value ?? null;
  }

  async setTemplate(key: string, value: string): Promise<EmailTemplateRecord> {
    const result = await this.database.query<ConfigRow>(
      `INSERT INTO system_configuration (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
       RETURNING key, value, updated_at`,
      [`${KEY_PREFIX}${key}`, value],
    );
    const row = result.rows[0];
    return { key, value: row.value, updatedAt: toIsoString(row.updated_at) };
  }

  async deleteTemplate(key: string): Promise<boolean> {
    const result = await this.database.query<{ key: string }>(
      `DELETE FROM system_configuration WHERE key = $1 RETURNING key`,
      [`${KEY_PREFIX}${key}`],
    );
    return result.rows.length > 0;
  }

  async listTemplates(keys: string[]): Promise<Map<string, EmailTemplateRecord>> {
    const dbKeys = keys.map((k) => `${KEY_PREFIX}${k}`);
    const result = await this.database.query<ConfigRow>(
      `SELECT key, value, updated_at FROM system_configuration WHERE key = ANY($1)`,
      [dbKeys],
    );

    const map = new Map<string, EmailTemplateRecord>();
    for (const row of result.rows) {
      const shortKey = row.key.replace(KEY_PREFIX, '');
      map.set(shortKey, { key: shortKey, value: row.value, updatedAt: toIsoString(row.updated_at) });
    }
    return map;
  }
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
