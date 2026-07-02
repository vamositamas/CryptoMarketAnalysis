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
        ma_365_day: string | null;
        stddev_365_day: string | null;
        ath_price: string | null;
        btc_rsi_12m: string | null;
        rainbow_band: string | null;
        stock_to_flow_model: string | null;
        global_m2_yoy: string | null;
        dxy_yoy_change: string | null;
        excess_liquidity_leading: string | null;
        funding_rate_avg: string | null;
        open_interest_usd: string | null;
        exchange_netflow: string | null;
        active_addresses: string | null;
        google_trends_bitcoin: string | null;
        btc_dvol: string | null;
      }>(`
        SELECT
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'realized_price'        ORDER BY date DESC LIMIT 1) AS realized_price,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'terminal_price'        ORDER BY date DESC LIMIT 1) AS terminal_price,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'balanced_price'        ORDER BY date DESC LIMIT 1) AS balanced_price,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'cvdd'                  ORDER BY date DESC LIMIT 1) AS cvdd,
          (SELECT AVG(price_usd) FROM (SELECT price_usd FROM bitcoin_price_daily ORDER BY date DESC LIMIT 200) r) AS ma_200_day,
          (SELECT AVG(price_usd) FROM (SELECT price_usd FROM bitcoin_price_daily ORDER BY date DESC LIMIT 365) r) AS ma_365_day,
          (SELECT STDDEV_POP(price_usd) FROM (SELECT price_usd FROM bitcoin_price_daily ORDER BY date DESC LIMIT 365) r) AS stddev_365_day,
          (SELECT MAX(price_usd) FROM bitcoin_price_daily) AS ath_price,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'btc_rsi_12m'            ORDER BY date DESC LIMIT 1) AS btc_rsi_12m,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'rainbow_band'           ORDER BY date DESC LIMIT 1) AS rainbow_band,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'stock_to_flow_ratio'   ORDER BY date DESC LIMIT 1) AS stock_to_flow_model,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'global_m2_yoy'          ORDER BY date DESC LIMIT 1) AS global_m2_yoy,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'dxy_yoy_change'        ORDER BY date DESC LIMIT 1) AS dxy_yoy_change,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'excess_liquidity_leading' ORDER BY date DESC LIMIT 1) AS excess_liquidity_leading,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'funding_rate_avg'      ORDER BY date DESC LIMIT 1) AS funding_rate_avg,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'open_interest_usd'      ORDER BY date DESC LIMIT 1) AS open_interest_usd,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'exchange_netflow'       ORDER BY date DESC LIMIT 1) AS exchange_netflow,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'active_addresses'       ORDER BY date DESC LIMIT 1) AS active_addresses,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'google_trends_bitcoin'  ORDER BY date DESC LIMIT 1) AS google_trends_bitcoin,
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'btc_dvol'               ORDER BY date DESC LIMIT 1) AS btc_dvol
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
    const ma365 = parseNum(m?.ma_365_day);
    const stddev365 = parseNum(m?.stddev_365_day);
    const athPrice = parseNum(m?.ath_price);
    const btcRsi12m = parseNum(m?.btc_rsi_12m);
    const rainbowBand = parseNum(m?.rainbow_band);
    const s2fRatio = parseNum(m?.stock_to_flow_model);
    const globalM2YoY = parseNum(m?.global_m2_yoy);
    const dxyYoYChange = parseNum(m?.dxy_yoy_change);
    const excessLiquidityLeading = parseNum(m?.excess_liquidity_leading);
    const fundingRateAvg = parseNum(m?.funding_rate_avg);
    const openInterestUsd = parseNum(m?.open_interest_usd);
    const exchangeNetflow = parseNum(m?.exchange_netflow);
    const activeAddresses = parseNum(m?.active_addresses);
    const googleTrendsBitcoin = parseNum(m?.google_trends_bitcoin);
    const btcDvol = parseNum(m?.btc_dvol);
    // S2F model price: PlanB calibration — 0.4 * ratio^3
    const s2fModel = s2fRatio !== null ? 0.4 * Math.pow(s2fRatio, 3) : null;

    const historicalPoints = histRows.rows
      .map((r) => ({ date: r.date, priceUsd: parseNum(r.price_usd) ?? 0 }))
      .reverse();

    const scenarios = buildScenarios(btc, {
      realizedPrice,
      terminalPrice,
      balancedPrice,
      cvdd,
      ma200,
      ma365,
      stddev365,
      athPrice,
      btcRsi12m,
      rainbowBand,
      s2fModel,
      globalM2YoY,
      dxyYoYChange,
      excessLiquidityLeading,
      fundingRateAvg,
      openInterestUsd,
      exchangeNetflow,
      activeAddresses,
      googleTrendsBitcoin,
      btcDvol,
    });

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
  ma365: number | null;
  stddev365: number | null;
  athPrice: number | null;
  btcRsi12m: number | null;
  rainbowBand: number | null;
  s2fModel: number | null;
  globalM2YoY: number | null;
  dxyYoYChange: number | null;
  excessLiquidityLeading: number | null;
  fundingRateAvg: number | null;
  openInterestUsd: number | null;
  exchangeNetflow: number | null;
  activeAddresses: number | null;
  googleTrendsBitcoin: number | null;
  btcDvol: number | null;
}

function buildScenarios(btc: number | null, m: Models): ProjectionScenario[] {
  const scenarios: ProjectionScenario[] = [];

  // Bear: price falls to CVDD or Balanced Price (the stronger floor model)
  const bearFloor = pickBest([m.cvdd, m.balancedPrice]);
  const bearTargets: PriceTarget[] = [];
  if (m.cvdd)           bearTargets.push({ label: 'CVDD floor',     model: 'CVDD',           priceUsd: m.cvdd,           description: 'Cumulative value days destroyed floor', timeframe: '3–12 months' });
  if (m.balancedPrice)  bearTargets.push({ label: 'Balanced Price', model: 'Balanced Price', priceUsd: m.balancedPrice, description: 'Delta Cap / Realized Cap model floor',  timeframe: '3–12 months' });
  if (m.realizedPrice)  bearTargets.push({ label: 'Realized Price', model: 'Realized Price', priceUsd: m.realizedPrice, description: 'Average cost basis of all coins',         timeframe: '3–12 months' });
  const volatilityFloor = m.ma365 !== null && m.stddev365 !== null ? Math.max(0, m.ma365 - m.stddev365) : null;
  if (volatilityFloor)  bearTargets.push({ label: '365d mean -1σ',  model: 'Volatility Band', priceUsd: Math.round(volatilityFloor), description: 'One standard deviation below the 365-day mean', timeframe: '1–6 months' });
  if (btc && m.fundingRateAvg !== null && m.fundingRateAvg * 100 >= 0.08) bearTargets.push({ label: 'Crowded longs flush', model: 'Funding Rate', priceUsd: Math.round(btc * 0.82), description: 'Very positive funding implies crowded long leverage and liquidation risk', timeframe: '1–3 months' });
  if (btc && m.openInterestUsd !== null && m.openInterestUsd / btc >= 600_000) bearTargets.push({ label: 'Open-interest deleveraging', model: 'Open Interest', priceUsd: Math.round(btc * 0.78), description: 'Very high open interest relative to spot price increases downside flush risk', timeframe: '1–3 months' });
  if (btc && m.exchangeNetflow !== null && m.exchangeNetflow > 10_000) bearTargets.push({ label: 'Exchange inflow stress', model: 'Exchange Netflow', priceUsd: Math.round(btc * 0.88), description: 'Large net exchange inflows may add sell-side supply', timeframe: '1–4 months' });
  if (btc && m.btcDvol !== null && m.btcDvol >= 95) bearTargets.push({ label: 'High-volatility stress', model: 'BTC DVOL', priceUsd: Math.round(btc * 0.75), description: 'Very high implied volatility creates a wider downside stress scenario', timeframe: '1–3 months' });
  if (bearTargets.length > 0) {
    scenarios.push({ scenario: 'bear', label: 'Bear Case', color: '#ef4444', targets: bearTargets });
  }

  // Base: 200-day MA × 1.5 and S2F model
  const baseTargets: PriceTarget[] = [];
  if (m.ma200)    baseTargets.push({ label: '200-day MA ×1.5', model: 'Mayer Multiple', priceUsd: Math.round(m.ma200 * 1.5), description: 'Mayer Multiple 1.5 — historically fair value', timeframe: '6–12 months' });
  if (m.ma365 && m.stddev365) baseTargets.push({ label: '365d mean +1σ', model: 'Volatility Band', priceUsd: Math.round(m.ma365 + m.stddev365), description: 'One standard deviation above the 365-day mean', timeframe: '3–9 months' });
  if (btc && m.globalM2YoY !== null && m.globalM2YoY < 0) baseTargets.push({ label: 'Liquidity-adjusted base', model: 'Global M2', priceUsd: Math.round(btc * 0.85), description: 'Negative Global M2 growth applies a defensive macro-liquidity haircut', timeframe: '3–12 months' });
  if (btc && m.excessLiquidityLeading !== null && m.excessLiquidityLeading < -3) baseTargets.push({ label: 'Excess-liquidity haircut', model: 'Excess Liquidity', priceUsd: Math.round(btc * 0.9), description: 'Negative leading liquidity impulse tempers the base case', timeframe: '3–12 months' });
  if (btc && m.excessLiquidityLeading !== null && m.excessLiquidityLeading >= -3 && m.excessLiquidityLeading < 3) baseTargets.push({ label: 'Neutral liquidity path', model: 'Excess Liquidity', priceUsd: Math.round(btc * 1.05), description: 'Flat leading liquidity keeps the base case close to spot with a modest trend premium', timeframe: '3–9 months' });
  if (btc && m.dxyYoYChange !== null && m.dxyYoYChange >= 5) baseTargets.push({ label: 'Dollar-strength base', model: 'DXY', priceUsd: Math.round(btc * dxyDefensiveMultiplier(m.dxyYoYChange)), description: 'Rising dollar pressure applies a defensive macro haircut to Bitcoin', timeframe: '3–12 months' });
  if (btc && m.dxyYoYChange !== null && m.dxyYoYChange > -3 && m.dxyYoYChange < 3) baseTargets.push({ label: 'Stable dollar path', model: 'DXY', priceUsd: Math.round(btc * 1.06), description: 'Broadly stable dollar conditions support a moderate trend-following base case', timeframe: '3–9 months' });
  if (btc && m.fundingRateAvg !== null && Math.abs(m.fundingRateAvg * 100) <= 0.02) baseTargets.push({ label: 'Neutral funding path', model: 'Funding Rate', priceUsd: Math.round(btc * 1.08), description: 'Near-neutral perpetual funding suggests leverage is not crowded and can support orderly continuation', timeframe: '3–9 months' });
  if (btc && m.googleTrendsBitcoin !== null && m.googleTrendsBitcoin >= 25 && m.googleTrendsBitcoin < 45) baseTargets.push({ label: 'Attention recovery path', model: 'Google Trends', priceUsd: Math.round(btc * 1.1), description: 'Search interest is recovering from quiet levels without reaching euphoric retail demand', timeframe: '3–12 months' });
  if (m.athPrice && (!btc || m.athPrice > btc)) baseTargets.push({ label: 'ATH retest', model: 'Market Structure', priceUsd: Math.round(m.athPrice), description: 'Retest of the highest stored daily close', timeframe: '6–18 months' });
  if (m.s2fModel) baseTargets.push({ label: 'S2F model price', model: 'Stock-to-Flow', priceUsd: Math.round(m.s2fModel),    description: 'Stock-to-Flow scarcity model fair value',   timeframe: '6–18 months' });
  if (baseTargets.length > 0) {
    scenarios.push({ scenario: 'base', label: 'Base Case', color: '#f59e0b', targets: baseTargets });
  }

  // Bull: S2F × 1.5 and Terminal Price
  const bullTargets: PriceTarget[] = [];
  if (m.s2fModel)      bullTargets.push({ label: 'S2F ×1.5',       model: 'Stock-to-Flow', priceUsd: Math.round(m.s2fModel * 1.5), description: 'S2F model with euphoria premium',      timeframe: '12–24 months' });
  if (m.terminalPrice) bullTargets.push({ label: 'Terminal Price', model: 'Terminal Price', priceUsd: Math.round(m.terminalPrice),   description: 'Upper bound fair value from realized cap', timeframe: '12–24 months' });
  if (m.ma200)         bullTargets.push({ label: '200-day MA ×2.4', model: 'Mayer Multiple', priceUsd: Math.round(m.ma200 * 2.4),   description: 'Mayer Multiple 2.4 — historical bull top',  timeframe: '12–24 months' });
  if (m.athPrice)      bullTargets.push({ label: 'ATH ×1.272',     model: 'Fib Extension',  priceUsd: Math.round(m.athPrice * 1.272), description: 'First breakout extension above prior all-time high', timeframe: '9–24 months' });
  if (m.ma365 && m.stddev365) bullTargets.push({ label: '365d mean +2σ', model: 'Volatility Band', priceUsd: Math.round(m.ma365 + (m.stddev365 * 2)), description: 'Two standard deviations above the 365-day mean', timeframe: '9–24 months' });
  if (btc && m.globalM2YoY !== null && m.globalM2YoY >= 5) bullTargets.push({ label: 'Liquidity expansion target', model: 'Global M2', priceUsd: Math.round(btc * liquidityMultiplier(m.globalM2YoY)), description: 'Macro-liquidity expansion premium based on Global M2 YoY growth', timeframe: '6–18 months' });
  if (btc && m.excessLiquidityLeading !== null && m.excessLiquidityLeading >= 3) bullTargets.push({ label: 'Excess liquidity target', model: 'Excess Liquidity', priceUsd: Math.round(btc * excessLiquidityMultiplier(m.excessLiquidityLeading)), description: 'Leading liquidity expansion supports a higher risk-asset target', timeframe: '6–18 months' });
  if (btc && m.dxyYoYChange !== null && m.dxyYoYChange <= -3) bullTargets.push({ label: 'Dollar-weakness target', model: 'DXY', priceUsd: Math.round(btc * dxyTailwindMultiplier(m.dxyYoYChange)), description: 'Dollar weakness adds a macro-liquidity tailwind for Bitcoin', timeframe: '6–18 months' });
  if (btc && m.fundingRateAvg !== null && Math.abs(m.fundingRateAvg * 100) <= 0.02) bullTargets.push({ label: 'Funding reset advance', model: 'Funding Rate', priceUsd: Math.round(btc * 1.16), description: 'Neutral funding leaves room for spot-led upside before derivatives become crowded', timeframe: '3–12 months' });
  if (btc && m.openInterestUsd !== null && m.openInterestUsd / btc < 120_000) bullTargets.push({ label: 'Low-leverage advance', model: 'Open Interest', priceUsd: Math.round(btc * 1.22), description: 'Low open interest relative to spot price suggests leverage is light and upside can be less fragile', timeframe: '3–12 months' });
  if (btc && m.exchangeNetflow !== null && m.exchangeNetflow < -2_000) bullTargets.push({ label: 'Exchange outflow target', model: 'Exchange Netflow', priceUsd: Math.round(btc * 1.14), description: 'Net BTC outflows from exchanges reduce liquid supply and support an upside supply-squeeze scenario', timeframe: '3–12 months' });
  if (btc && m.activeAddresses !== null && m.activeAddresses >= 750_000 && m.activeAddresses < 1_000_000) bullTargets.push({ label: 'Network growth target', model: 'Active Addresses', priceUsd: Math.round(btc * 1.18), description: 'Healthy active-address growth confirms improving network demand before the strongest usage regime', timeframe: '6–18 months' });
  if (btc && m.activeAddresses !== null && m.activeAddresses >= 1_000_000) bullTargets.push({ label: 'Network activity target', model: 'Active Addresses', priceUsd: Math.round(btc * 1.3), description: 'Strong active-address demand adds a network-usage expansion scenario', timeframe: '6–18 months' });
  if (btc && m.googleTrendsBitcoin !== null && m.googleTrendsBitcoin >= 45 && m.googleTrendsBitcoin < 70) bullTargets.push({ label: 'Attention expansion target', model: 'Google Trends', priceUsd: Math.round(btc * 1.18), description: 'Retail attention is rising without reaching euphoric conditions', timeframe: '3–12 months' });
  if (bullTargets.length > 0) {
    scenarios.push({ scenario: 'bull', label: 'Bull Case', color: '#22c55e', targets: bullTargets });
  }

  // Ultra bull: Terminal Price × 1.5 (euphoria extension)
  const ultraTargets: PriceTarget[] = [];
  if (m.terminalPrice) ultraTargets.push({ label: 'Terminal ×1.5', model: 'Terminal Price', priceUsd: Math.round(m.terminalPrice * 1.5), description: 'Parabolic extension beyond terminal price', timeframe: '18–36 months' });
  if (m.s2fModel)      ultraTargets.push({ label: 'S2F ×3',        model: 'Stock-to-Flow', priceUsd: Math.round(m.s2fModel * 3),         description: 'Cycle euphoria peak — historical pattern',   timeframe: '18–36 months' });
  if (m.athPrice)      ultraTargets.push({ label: 'ATH ×1.618',    model: 'Fib Extension', priceUsd: Math.round(m.athPrice * 1.618),     description: 'Golden-ratio extension above prior all-time high', timeframe: '18–36 months' });
  if (m.athPrice)      ultraTargets.push({ label: 'ATH ×2',        model: 'Cycle Extension', priceUsd: Math.round(m.athPrice * 2),       description: 'Prior high doubling scenario for euphoric cycles', timeframe: '24–48 months' });
  if (btc && m.btcRsi12m !== null && m.rainbowBand !== null) {
    const heatMultiplier = m.btcRsi12m >= 80 || m.rainbowBand >= 8 ? 1.25 : 1.5;
    ultraTargets.push({
      label: 'Cycle heat extension',
      model: 'RSI + Rainbow',
      priceUsd: Math.round(btc * heatMultiplier),
      description: 'Current price extended by cycle heat from 12m RSI and Rainbow band',
      timeframe: '12–30 months',
    });
  }
  if (btc && m.googleTrendsBitcoin !== null && m.googleTrendsBitcoin >= 90) {
    ultraTargets.push({
      label: 'Retail euphoria extension',
      model: 'Google Trends',
      priceUsd: Math.round(btc * 1.35),
      description: 'Extreme search interest can accompany blow-off extensions, but also raises reversal risk',
      timeframe: '3–12 months',
    });
  }
  if (ultraTargets.length > 0) {
    scenarios.push({ scenario: 'ultra_bull', label: 'Ultra Bull', color: '#a855f7', targets: ultraTargets });
  }

  return scenarios;
}

function liquidityMultiplier(globalM2YoY: number): number {
  if (globalM2YoY >= 10) return 1.5;
  if (globalM2YoY >= 7) return 1.35;
  return 1.2;
}

function dxyDefensiveMultiplier(dxyYoY: number): number {
  if (dxyYoY >= 10) return 0.75;
  if (dxyYoY >= 7) return 0.82;
  return 0.9;
}

function excessLiquidityMultiplier(excessLiquidity: number): number {
  if (excessLiquidity >= 8) return 1.35;
  if (excessLiquidity >= 5) return 1.25;
  return 1.15;
}

function dxyTailwindMultiplier(dxyYoY: number): number {
  if (dxyYoY <= -8) return 1.35;
  if (dxyYoY <= -5) return 1.25;
  return 1.15;
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
