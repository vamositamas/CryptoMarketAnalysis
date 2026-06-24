import { FredClient, type FredDataPoint } from '@crypto-market-analysis/calculation-engines/data-sources';

export interface ExcessLiquidityRecord {
  date: string;
  metricName: string;
  metricValue: number;
}

interface Queryable {
  query(sql: string, values?: unknown[]): Promise<unknown>;
}

interface ExcessLiquidityServiceOptions {
  fredClient?: Pick<FredClient, 'fetchT10Y3M' | 'fetchM2SL' | 'fetchGDP'>;
}

export class ExcessLiquidityService {
  private readonly fred: Pick<FredClient, 'fetchT10Y3M' | 'fetchM2SL' | 'fetchGDP'>;

  constructor(options: ExcessLiquidityServiceOptions = {}) {
    this.fred = options.fredClient ?? new FredClient();
  }

  async computeAllRecords(): Promise<ExcessLiquidityRecord[]> {
    const [t10y3m, m2sl, gdp] = await Promise.all([
      this.fred.fetchT10Y3M(),
      this.fred.fetchM2SL(),
      this.fred.fetchGDP(),
    ]);

    const yieldCurveRecords = computeYieldCurveChange(t10y3m);
    const excessLiquidityRecords = computeExcessLiquidity(m2sl, gdp);

    return [...yieldCurveRecords, ...excessLiquidityRecords];
  }

  async upsertRecords(database: Queryable, records: ExcessLiquidityRecord[]): Promise<void> {
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

function computeYieldCurveChange(series: FredDataPoint[]): ExcessLiquidityRecord[] {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const dateMap = new Map<string, number>(sorted.map((p) => [p.date, p.value]));
  const records: ExcessLiquidityRecord[] = [];

  for (const point of sorted) {
    const priorDate = subtractOneYear(point.date);
    const priorValue = findClosestValue(dateMap, priorDate, sorted);
    if (priorValue === null) continue;

    const changeBps = (point.value - priorValue) * 100;
    records.push({ date: point.date, metricName: 'yield_curve_1y_change', metricValue: changeBps });
  }

  return records;
}

function computeExcessLiquidity(m2sl: FredDataPoint[], gdp: FredDataPoint[]): ExcessLiquidityRecord[] {
  const m2Sorted = [...m2sl].sort((a, b) => a.date.localeCompare(b.date));
  const gdpSorted = [...gdp].sort((a, b) => a.date.localeCompare(b.date));

  // Build month→M2 map and compute YoY growth rate for each month
  const m2ByMonth = new Map<string, number>(m2Sorted.map((p) => [p.date.slice(0, 7), p.value]));
  const m2YoY = new Map<string, number>();

  for (const [monthKey, m2Val] of m2ByMonth) {
    const priorKey = subtractOneYearFromMonth(monthKey);
    const priorM2 = m2ByMonth.get(priorKey);
    if (priorM2 && priorM2 > 0) {
      m2YoY.set(monthKey, ((m2Val - priorM2) / priorM2) * 100);
    }
  }

  // GDP: interpolate quarterly → monthly, then compute YoY growth
  const gdpByQuarter = new Map<string, number>(gdpSorted.map((p) => [p.date.slice(0, 7), p.value]));
  const gdpMonthly = interpolateQuarterlyToMonthly(gdpByQuarter, gdpSorted);

  const gdpYoY = new Map<string, number>();
  for (const [monthKey, gdpVal] of gdpMonthly) {
    const priorKey = subtractOneYearFromMonth(monthKey);
    const priorGdp = gdpMonthly.get(priorKey);
    if (priorGdp && priorGdp > 0) {
      gdpYoY.set(monthKey, ((gdpVal - priorGdp) / priorGdp) * 100);
    }
  }

  // Excess liquidity = M2 YoY% - GDP YoY%, then shift 6 months forward
  const records: ExcessLiquidityRecord[] = [];

  for (const [monthKey, m2Growth] of m2YoY) {
    const gdpGrowth = gdpYoY.get(monthKey);
    if (gdpGrowth === undefined) continue;

    const excessLiq = m2Growth - gdpGrowth;
    const shiftedDate = addSixMonths(`${monthKey}-01`);

    records.push({ date: shiftedDate, metricName: 'excess_liquidity_leading', metricValue: excessLiq });
  }

  return records;
}

function interpolateQuarterlyToMonthly(
  quarterlyMap: Map<string, number>,
  sortedQuarterly: FredDataPoint[],
): Map<string, number> {
  const monthly = new Map<string, number>();

  const quarters = sortedQuarterly.map((p) => ({ month: p.date.slice(0, 7), value: p.value }));

  for (let i = 0; i < quarters.length; i++) {
    const curr = quarters[i]!;
    const next = quarters[i + 1];
    const [currYear, currMo] = curr.month.split('-').map(Number) as [number, number];

    if (!next) {
      monthly.set(curr.month, curr.value);
      const m2 = `${currYear}-${String(currMo + 1).padStart(2, '0')}`;
      const m3 = `${currYear}-${String(currMo + 2).padStart(2, '0')}`;
      monthly.set(m2, curr.value);
      monthly.set(m3, curr.value);
    } else {
      const [nextYear, nextMo] = next.month.split('-').map(Number) as [number, number];
      const totalMonths = (nextYear - currYear) * 12 + (nextMo - currMo);

      for (let m = 0; m < totalMonths; m++) {
        const interpolated = curr.value + ((next.value - curr.value) * m) / totalMonths;
        const targetYear = currYear + Math.floor((currMo - 1 + m) / 12);
        const targetMo = ((currMo - 1 + m) % 12) + 1;
        const key = `${targetYear}-${String(targetMo).padStart(2, '0')}`;
        monthly.set(key, interpolated);
      }
    }
  }

  return monthly;
}

function subtractOneYear(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function subtractOneYearFromMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number) as [number, number];
  return `${y - 1}-${String(m).padStart(2, '0')}`;
}

function addSixMonths(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 6);
  return d.toISOString().slice(0, 10);
}

function findClosestValue(
  dateMap: Map<string, number>,
  targetDate: string,
  sorted: FredDataPoint[],
  windowDays = 7,
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
