import { FredClient, type FredDataPoint } from '@crypto-market-analysis/calculation-engines/data-sources';

export interface SpxRecord {
  date: string;
  metricName: 'spx_yoy_change';
  metricValue: number;
}

interface Queryable {
  query(sql: string, values?: unknown[]): Promise<unknown>;
}

interface SpxLiquidityServiceOptions {
  fredClient?: Pick<FredClient, 'fetchSP500'>;
}

export class SpxLiquidityService {
  private readonly fred: Pick<FredClient, 'fetchSP500'>;

  constructor(options: SpxLiquidityServiceOptions = {}) {
    this.fred = options.fredClient ?? new FredClient();
  }

  async computeAllRecords(): Promise<SpxRecord[]> {
    const sp500 = await this.fred.fetchSP500();
    return computeSpxYoY(sp500);
  }

  async upsertRecords(database: Queryable, records: SpxRecord[]): Promise<void> {
    if (records.length === 0) return;

    const chunkSize = 500;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];

      chunk.forEach((rec, idx) => {
        const base = idx * 3;
        placeholders.push(`($${base + 1}::date, $${base + 2}, $${base + 3}::numeric)`);
        values.push(rec.date, rec.metricName, rec.metricValue);
      });

      await database.query(
        `INSERT INTO bitcoin_metrics_daily (id, date, metric_name, metric_value, created_at)
         SELECT gen_random_uuid(), t.date, t.metric_name, t.metric_value, NOW()
         FROM (VALUES ${placeholders.join(', ')}) AS t(date, metric_name, metric_value)
         ON CONFLICT (date, metric_name)
         DO UPDATE SET metric_value = EXCLUDED.metric_value, created_at = NOW()`,
        values,
      );
    }
  }
}

function computeSpxYoY(series: FredDataPoint[]): SpxRecord[] {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const dateMap = new Map<string, number>(sorted.map((p) => [p.date, p.value]));
  const records: SpxRecord[] = [];

  for (const point of sorted) {
    const priorDate = subtractOneYear(point.date);
    const priorValue = findClosestValue(dateMap, priorDate, 10);
    if (priorValue === null || priorValue <= 0) continue;

    const yoy = ((point.value - priorValue) / priorValue) * 100;
    if (!Number.isFinite(yoy)) continue;

    records.push({ date: point.date, metricName: 'spx_yoy_change', metricValue: yoy });
  }

  return records;
}

function subtractOneYear(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function findClosestValue(
  dateMap: Map<string, number>,
  targetDate: string,
  windowDays = 10,
): number | null {
  if (dateMap.has(targetDate)) return dateMap.get(targetDate)!;

  const target = new Date(`${targetDate}T00:00:00Z`).getTime();
  for (let offset = 1; offset <= windowDays; offset++) {
    for (const sign of [1, -1]) {
      const candidate = new Date(target + sign * offset * 86_400_000).toISOString().slice(0, 10);
      if (dateMap.has(candidate)) return dateMap.get(candidate)!;
    }
  }
  return null;
}
