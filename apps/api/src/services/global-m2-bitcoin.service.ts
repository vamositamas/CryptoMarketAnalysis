import { FredClient, type FredDataPoint } from '@crypto-market-analysis/calculation-engines/data-sources';

export interface GlobalM2BitcoinRecord {
  date: string;
  metricName: 'global_m2_yoy' | 'btc_yoy_return';
  metricValue: number;
}

interface Queryable {
  query(sql: string, values?: unknown[]): Promise<{ rows?: unknown[] } | unknown>;
}

interface BitcoinPriceRow {
  date: string | Date;
  price_usd: string | number;
}

interface GlobalM2BitcoinServiceOptions {
  fredClient?: Pick<FredClient, 'fetchGlobalM2ComponentSeries' | 'fetchM2SL'>;
}

export class GlobalM2BitcoinService {
  private readonly fred: Pick<FredClient, 'fetchGlobalM2ComponentSeries' | 'fetchM2SL'>;

  constructor(options: GlobalM2BitcoinServiceOptions = {}) {
    this.fred = options.fredClient ?? new FredClient();
  }

  async computeAllRecords(database: Queryable): Promise<GlobalM2BitcoinRecord[]> {
    const [m2Records, btcRecords] = await Promise.all([
      this.computeGlobalM2Records(),
      this.computeBitcoinYoYRecords(database),
    ]);

    return [...m2Records, ...btcRecords];
  }

  async upsertRecords(database: Queryable, records: GlobalM2BitcoinRecord[]): Promise<void> {
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

  private async computeGlobalM2Records(): Promise<GlobalM2BitcoinRecord[]> {
    let components: Array<{ seriesId: string; points: FredDataPoint[] }> = [];

    try {
      components = await this.fred.fetchGlobalM2ComponentSeries();
    } catch {
      components = [];
    }

    if (components.length === 0) {
      components = [{ seriesId: 'M2SL', points: await this.fred.fetchM2SL() }];
    }

    const yoyByMonth = components
      .map((component) => computeMonthlyYoY(component.points))
      .filter((series) => series.size > 0);
    const allMonths = [...new Set(yoyByMonth.flatMap((series) => [...series.keys()]))].sort();

    return allMonths.flatMap((month) => {
      const values = yoyByMonth
        .map((series) => series.get(month))
        .filter((value): value is number => value !== undefined && Number.isFinite(value));

      if (values.length === 0) return [];

      return [{
        date: `${month}-01`,
        metricName: 'global_m2_yoy' as const,
        metricValue: values.reduce((sum, value) => sum + value, 0) / values.length,
      }];
    });
  }

  private async computeBitcoinYoYRecords(database: Queryable): Promise<GlobalM2BitcoinRecord[]> {
    const result = await database.query(
      `SELECT date::text, price_usd
       FROM bitcoin_price_daily
       WHERE price_usd > 0
       ORDER BY date ASC`,
    ) as { rows: BitcoinPriceRow[] };

    const rows = result.rows.map((row) => ({
      date: formatDate(row.date),
      priceUsd: Number(row.price_usd),
    }));
    const priceByDate = new Map(rows.map((row) => [row.date, row.priceUsd]));

    return rows.flatMap((row) => {
      const priorDate = subtractOneYear(row.date);
      const priorPrice = findClosestValue(priceByDate, priorDate, 10);
      if (priorPrice === null || priorPrice <= 0) return [];

      const yoy = ((row.priceUsd - priorPrice) / priorPrice) * 100;
      return Number.isFinite(yoy)
        ? [{ date: row.date, metricName: 'btc_yoy_return' as const, metricValue: yoy }]
        : [];
    });
  }
}

function computeMonthlyYoY(points: FredDataPoint[]): Map<string, number> {
  const monthly = new Map<string, number>();
  for (const point of points) {
    if (Number.isFinite(point.value) && point.value > 0) monthly.set(point.date.slice(0, 7), point.value);
  }

  const yoy = new Map<string, number>();
  for (const [month, value] of monthly) {
    const prior = monthly.get(subtractOneYearFromMonth(month));
    if (prior && prior > 0) yoy.set(month, ((value - prior) / prior) * 100);
  }

  return yoy;
}

function subtractOneYear(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function subtractOneYearFromMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number) as [number, number];
  return `${year - 1}-${String(month).padStart(2, '0')}`;
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

function formatDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}
