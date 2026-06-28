import { FredClient, type FredDataPoint } from '@crypto-market-analysis/calculation-engines/data-sources';

export interface DxyBitcoinRecord {
  date: string;
  metricName: 'dxy_yoy_change';
  metricValue: number;
}

interface Queryable {
  query(sql: string, values?: unknown[]): Promise<unknown>;
}

interface DxyBitcoinServiceOptions {
  fredClient?: Pick<FredClient, 'fetchDxy'>;
}

export class DxyBitcoinService {
  private readonly fred: Pick<FredClient, 'fetchDxy'>;

  constructor(options: DxyBitcoinServiceOptions = {}) {
    this.fred = options.fredClient ?? new FredClient();
  }

  async computeAllRecords(): Promise<DxyBitcoinRecord[]> {
    const dxy = await this.fred.fetchDxy();
    return computeDxyYoY(dxy);
  }

  async upsertRecords(database: Queryable, records: DxyBitcoinRecord[]): Promise<void> {
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

function computeDxyYoY(series: FredDataPoint[]): DxyBitcoinRecord[] {
  const sorted = [...series]
    .filter((p) => Number.isFinite(p.value) && p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dateMap = new Map<string, number>(sorted.map((p) => [p.date, p.value]));
  const records: DxyBitcoinRecord[] = [];

  for (const point of sorted) {
    const priorValue = findClosestValue(dateMap, subtractOneYear(point.date), 10);
    if (priorValue === null || priorValue <= 0) continue;

    const yoy = ((point.value - priorValue) / priorValue) * 100;
    if (Number.isFinite(yoy)) {
      records.push({ date: point.date, metricName: 'dxy_yoy_change', metricValue: yoy });
    }
  }

  return records;
}

function subtractOneYear(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function findClosestValue(dateMap: Map<string, number>, targetDate: string, windowDays: number): number | null {
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
