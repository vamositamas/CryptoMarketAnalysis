import { getDatabasePool } from '../config/database.config';

export interface PriceTarget {
  label: string;
  model: string;
  priceUsd: number;
  description: string;
  timeframe: string;
}

export interface ProjectionScenario {
  scenario: 'bear' | 'base' | 'bull' | 'ultra_bull';
  label: string;
  color: string;
  targets: PriceTarget[];
}

export interface PriceProjectionsResponse {
  btcPriceUsd: number | null;
  scenarios: ProjectionScenario[];
  historicalPoints: { date: string; priceUsd: number }[];
  lastUpdated: string | null;
}

interface Queryable {
  query<Row = unknown>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export class PriceProjectionsService {
  constructor(private readonly database: Queryable | undefined = getDatabasePool()) {}

  async getProjections(): Promise<PriceProjectionsResponse> {
    const db = this.requireDatabase();

    const [priceRow, metricsRow, histRows] = await Promise.all([
      db.query<{ price_usd: string; last_updated: string | Date }>(`
        SELECT price_usd, created_at AS last_updated
        FROM bitcoin_price_daily ORDER BY date DESC LIMIT 1
      `),
      db.query<{
        realized_price: string | null;
        terminal_price: string | null;
        balanced_price: string | null;
        cvdd: string | null;
        ma_200_day: string | null;
        stock_to_flow_model: string | null;
      }>(`
        SELECT
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'realized_price'        ORDER BY date DESC LIMIT 1) AS realized_price,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'terminal_price'        ORDER BY date DESC LIMIT 1) AS terminal_price,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'balanced_price'        ORDER BY date DESC LIMIT 1) AS balanced_price,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'cvdd'                  ORDER BY date DESC LIMIT 1) AS cvdd,
          (SELECT AVG(price_usd) FROM (SELECT price_usd FROM bitcoin_price_daily ORDER BY date DESC LIMIT 200) r) AS ma_200_day,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'stock_to_flow_ratio'   ORDER BY date DESC LIMIT 1) AS stock_to_flow_model
      `),
      db.query<{ date: string; price_usd: string }>(`
        SELECT date::text, price_usd
        FROM bitcoin_price_daily
        ORDER BY date DESC LIMIT 365
      `),
    ]);

    const btc = parseNum(priceRow.rows[0]?.price_usd);
    const lastUpdated = toIso(priceRow.rows[0]?.last_updated ?? null);
    const m = metricsRow.rows[0];

    const realizedPrice = parseNum(m?.realized_price);
    const terminalPrice = parseNum(m?.terminal_price);
    const balancedPrice = parseNum(m?.balanced_price);
    const cvdd = parseNum(m?.cvdd);
    const ma200 = parseNum(m?.ma_200_day);
    const s2fRatio = parseNum(m?.stock_to_flow_model);
    // S2F model price: PlanB calibration — 0.4 * ratio^3
    const s2fModel = s2fRatio !== null ? 0.4 * Math.pow(s2fRatio, 3) : null;

    const historicalPoints = histRows.rows
      .map((r) => ({ date: r.date, priceUsd: parseNum(r.price_usd) ?? 0 }))
      .reverse();

    const scenarios = buildScenarios(btc, { realizedPrice, terminalPrice, balancedPrice, cvdd, ma200, s2fModel });

    return { btcPriceUsd: btc, scenarios, historicalPoints, lastUpdated };
  }

  private requireDatabase(): Queryable {
    if (!this.database) throw new Error('Database is not configured');
    return this.database;
  }
}

interface Models {
  realizedPrice: number | null;
  terminalPrice: number | null;
  balancedPrice: number | null;
  cvdd: number | null;
  ma200: number | null;
  s2fModel: number | null;
}

function buildScenarios(btc: number | null, m: Models): ProjectionScenario[] {
  const scenarios: ProjectionScenario[] = [];

  // Bear: price falls to CVDD or Balanced Price (the stronger floor model)
  const bearFloor = pickBest([m.cvdd, m.balancedPrice]);
  const bearTargets: PriceTarget[] = [];
  if (m.cvdd)           bearTargets.push({ label: 'CVDD floor',     model: 'CVDD',           priceUsd: m.cvdd,           description: 'Cumulative value days destroyed floor', timeframe: '3–12 months' });
  if (m.balancedPrice)  bearTargets.push({ label: 'Balanced Price', model: 'Balanced Price', priceUsd: m.balancedPrice, description: 'Delta Cap / Realized Cap model floor',  timeframe: '3–12 months' });
  if (m.realizedPrice)  bearTargets.push({ label: 'Realized Price', model: 'Realized Price', priceUsd: m.realizedPrice, description: 'Average cost basis of all coins',         timeframe: '3–12 months' });
  if (bearTargets.length > 0) {
    scenarios.push({ scenario: 'bear', label: 'Bear Case', color: '#ef4444', targets: bearTargets });
  }

  // Base: 200-day MA × 1.5 and S2F model
  const baseTargets: PriceTarget[] = [];
  if (m.ma200)    baseTargets.push({ label: '200-day MA ×1.5', model: 'Mayer Multiple', priceUsd: Math.round(m.ma200 * 1.5), description: 'Mayer Multiple 1.5 — historically fair value', timeframe: '6–12 months' });
  if (m.s2fModel) baseTargets.push({ label: 'S2F model price', model: 'Stock-to-Flow', priceUsd: Math.round(m.s2fModel),    description: 'Stock-to-Flow scarcity model fair value',   timeframe: '6–18 months' });
  if (baseTargets.length > 0) {
    scenarios.push({ scenario: 'base', label: 'Base Case', color: '#f59e0b', targets: baseTargets });
  }

  // Bull: S2F × 1.5 and Terminal Price
  const bullTargets: PriceTarget[] = [];
  if (m.s2fModel)      bullTargets.push({ label: 'S2F ×1.5',       model: 'Stock-to-Flow', priceUsd: Math.round(m.s2fModel * 1.5), description: 'S2F model with euphoria premium',      timeframe: '12–24 months' });
  if (m.terminalPrice) bullTargets.push({ label: 'Terminal Price', model: 'Terminal Price', priceUsd: Math.round(m.terminalPrice),   description: 'Upper bound fair value from realized cap', timeframe: '12–24 months' });
  if (m.ma200)         bullTargets.push({ label: '200-day MA ×2.4', model: 'Mayer Multiple', priceUsd: Math.round(m.ma200 * 2.4),   description: 'Mayer Multiple 2.4 — historical bull top',  timeframe: '12–24 months' });
  if (bullTargets.length > 0) {
    scenarios.push({ scenario: 'bull', label: 'Bull Case', color: '#22c55e', targets: bullTargets });
  }

  // Ultra bull: Terminal Price × 1.5 (euphoria extension)
  const ultraTargets: PriceTarget[] = [];
  if (m.terminalPrice) ultraTargets.push({ label: 'Terminal ×1.5', model: 'Terminal Price', priceUsd: Math.round(m.terminalPrice * 1.5), description: 'Parabolic extension beyond terminal price', timeframe: '18–36 months' });
  if (m.s2fModel)      ultraTargets.push({ label: 'S2F ×3',        model: 'Stock-to-Flow', priceUsd: Math.round(m.s2fModel * 3),         description: 'Cycle euphoria peak — historical pattern',   timeframe: '18–36 months' });
  if (ultraTargets.length > 0) {
    scenarios.push({ scenario: 'ultra_bull', label: 'Ultra Bull', color: '#a855f7', targets: ultraTargets });
  }

  return scenarios;
}

function pickBest(values: (number | null)[]): number | null {
  return values.find((v) => v !== null) ?? null;
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function toIso(v: string | Date | null): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}
