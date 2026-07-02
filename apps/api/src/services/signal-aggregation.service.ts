import { getDatabasePool } from '../config/database.config';
import { MarketSignalPreferencesRepository } from '../repositories/market-signal-preferences.repository';

export interface SignalScore {
  name: string;
  label: string;
  value: number | null;
  formattedValue: string;
  score: number;
  maxScore: number;
  interpretation: string;
  zone: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish' | 'no_data';
}

export interface SignalSummary {
  totalScore: number;
  maxPossibleScore: number;
  normalizedScore: number;
  overallZone: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
  overallLabel: string;
  btcPriceUsd: number | null;
  signals: SignalScore[];
  availableSignals: SignalScore[];
  selectedSignalNames: string[];
  lastUpdated: string | null;
  fearGreedMissing: boolean;
}

interface Queryable {
  query<Row = unknown>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export const DEFAULT_MARKET_SIGNAL_NAMES = [
  'mvrv_zscore',
  'fear_greed',
  'rainbow_band',
  'realized_price',
  'nupl',
  'vdd_multiple',
  'pi_cycle',
  'mayer_multiple',
  'puell_multiple',
  'global_m2_yoy',
] as const;

interface LatestMetricsRow {
  price_usd: string | null;
  mvrv_zscore: string | null;
  fear_greed_index: string | null;
  rainbow_band: string | null;
  realized_price: string | null;
  terminal_price: string | null;
  balanced_price: string | null;
  cvdd: string | null;
  vdd_multiple: string | null;
  stock_to_flow_ratio: string | null;
  ma_365_day: string | null;
  stddev_365_day: string | null;
  ma_111_day: string | null;
  ma_350_day: string | null;
  hash_rate: string | null;
  miners_revenue_usd: string | null;
  miner_fees: string | null;
  exchange_reserve: string | null;
  exchange_netflow: string | null;
  funding_rate_avg: string | null;
  open_interest_usd: string | null;
  lth_sopr: string | null;
  sth_sopr: string | null;
  google_trends_bitcoin: string | null;
  active_addresses: string | null;
  btc_dvol: string | null;
  global_m2_yoy: string | null;
  dxy_yoy_change: string | null;
  excess_liquidity_leading: string | null;
  last_updated: string | Date | null;
}

export class SignalAggregationService {
  private readonly preferences: MarketSignalPreferencesRepository;

  constructor(
    private readonly database: Queryable | undefined = getDatabasePool(),
    preferences?: MarketSignalPreferencesRepository,
  ) {
    this.preferences = preferences ?? new MarketSignalPreferencesRepository(database);
  }

  async getSummary(userId?: string): Promise<SignalSummary> {
    const db = this.requireDatabase();

    const result = await db.query<LatestMetricsRow>(`
      SELECT
        p.price_usd,
        p.last_updated,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'mvrv_zscore'    ORDER BY date DESC LIMIT 1) AS mvrv_zscore,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'fear_greed_index' ORDER BY date DESC LIMIT 1) AS fear_greed_index,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'rainbow_band'   ORDER BY date DESC LIMIT 1) AS rainbow_band,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'realized_price' ORDER BY date DESC LIMIT 1) AS realized_price,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'terminal_price' ORDER BY date DESC LIMIT 1) AS terminal_price,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'balanced_price' ORDER BY date DESC LIMIT 1) AS balanced_price,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'cvdd'           ORDER BY date DESC LIMIT 1) AS cvdd,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'vdd_multiple'   ORDER BY date DESC LIMIT 1) AS vdd_multiple,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'stock_to_flow_ratio' ORDER BY date DESC LIMIT 1) AS stock_to_flow_ratio,
        (SELECT AVG(price_usd) FROM (SELECT price_usd FROM bitcoin_price_daily ORDER BY date DESC LIMIT 365) r) AS ma_365_day,
        (SELECT STDDEV_POP(price_usd) FROM (SELECT price_usd FROM bitcoin_price_daily ORDER BY date DESC LIMIT 365) r) AS stddev_365_day,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'ma_111_day'     ORDER BY date DESC LIMIT 1) AS ma_111_day,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'ma_350_day'     ORDER BY date DESC LIMIT 1) AS ma_350_day,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'hash_rate'      ORDER BY date DESC LIMIT 1) AS hash_rate,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'miners_revenue_usd' ORDER BY date DESC LIMIT 1) AS miners_revenue_usd,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'miner_fees'     ORDER BY date DESC LIMIT 1) AS miner_fees,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'exchange_reserve' ORDER BY date DESC LIMIT 1) AS exchange_reserve,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'exchange_netflow' ORDER BY date DESC LIMIT 1) AS exchange_netflow,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'funding_rate_avg' ORDER BY date DESC LIMIT 1) AS funding_rate_avg,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'open_interest_usd' ORDER BY date DESC LIMIT 1) AS open_interest_usd,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'lth_sopr'      ORDER BY date DESC LIMIT 1) AS lth_sopr,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'sth_sopr'      ORDER BY date DESC LIMIT 1) AS sth_sopr,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'google_trends_bitcoin' ORDER BY date DESC LIMIT 1) AS google_trends_bitcoin,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'active_addresses' ORDER BY date DESC LIMIT 1) AS active_addresses,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'btc_dvol'      ORDER BY date DESC LIMIT 1) AS btc_dvol,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'global_m2_yoy'  ORDER BY date DESC LIMIT 1) AS global_m2_yoy,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'dxy_yoy_change' ORDER BY date DESC LIMIT 1) AS dxy_yoy_change,
        (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'excess_liquidity_leading' ORDER BY date DESC LIMIT 1) AS excess_liquidity_leading
      FROM (
        SELECT price_usd, created_at AS last_updated FROM bitcoin_price_daily ORDER BY date DESC LIMIT 1
      ) p
    `);

    const row = result.rows[0];
    const btcPrice = parseNum(row?.price_usd);
    const lastUpdated = toIso(row?.last_updated ?? null);

    const coreSignals: SignalScore[] = [
      scoreMvrv(parseNum(row?.mvrv_zscore)),
      scoreFearGreed(parseNum(row?.fear_greed_index)),
      scoreRainbowBand(parseNum(row?.rainbow_band)),
      scoreRealizedPrice(btcPrice, parseNum(row?.realized_price)),
      scoreNupl(btcPrice, parseNum(row?.realized_price)),
      scoreVddMultiple(parseNum(row?.vdd_multiple)),
      scorePiCycle(btcPrice, parseNum(row?.ma_111_day), parseNum(row?.ma_350_day)),
      scoreMayerMultiple(btcPrice, await this.get200DayMA(db)),
      scorePuellMultiple(await this.getPuellMultiple(db)),
      scoreS2fModelPremium(btcPrice, parseNum(row?.stock_to_flow_ratio)),
      scoreProjectionRange(
        btcPrice,
        parseNum(row?.cvdd),
        parseNum(row?.balanced_price),
        parseNum(row?.terminal_price),
      ),
      scoreVolatilityPosition(
        btcPrice,
        parseNum(row?.ma_365_day),
        parseNum(row?.stddev_365_day),
      ),
      scoreGlobalM2(parseNum(row?.global_m2_yoy)),
      scoreDxy(parseNum(row?.dxy_yoy_change)),
    ];

    const optionalSignals: SignalScore[] = [
      scoreExchangeNetflow(parseNum(row?.exchange_netflow)),
      scoreFundingRate(parseNum(row?.funding_rate_avg)),
      scoreOpenInterest(btcPrice, parseNum(row?.open_interest_usd)),
      scoreSoprSplit(parseNum(row?.lth_sopr), parseNum(row?.sth_sopr)),
      scoreGoogleTrends(parseNum(row?.google_trends_bitcoin)),
      scoreActiveAddresses(parseNum(row?.active_addresses)),
      scoreDvol(parseNum(row?.btc_dvol)),
      scoreExcessLiquidity(parseNum(row?.excess_liquidity_leading)),
    ].filter((signal) => signal.zone !== 'no_data');

    const availableSignals = [...coreSignals, ...optionalSignals];
    const availableNames = new Set(availableSignals.map((signal) => signal.name));
    const savedSelection = userId ? await this.preferences.findSelectedSignalNames(userId) : null;
    const selectedSignalNames = normalizeSelectedSignalNames(savedSelection, availableNames);
    const selectedNames = new Set(selectedSignalNames);
    const signals = availableSignals.filter((signal) => selectedNames.has(signal.name));

    const scoringSignals = signals.filter((s) => s.zone !== 'no_data');
    const totalScore = scoringSignals.reduce((sum, s) => sum + s.score, 0);
    const maxPossibleScore = scoringSignals.reduce((sum, s) => sum + s.maxScore, 0);
    const normalizedScore = maxPossibleScore > 0
      ? Math.round((totalScore / maxPossibleScore) * 100)
      : 0;

    const fearGreedSignal = signals.find((s) => s.name === 'fear_greed');
    return {
      totalScore,
      maxPossibleScore,
      normalizedScore,
      overallZone: overallZone(normalizedScore),
      overallLabel: overallLabel(normalizedScore),
      btcPriceUsd: btcPrice,
      signals,
      availableSignals,
      selectedSignalNames,
      lastUpdated,
      fearGreedMissing: fearGreedSignal?.zone === 'no_data',
    };
  }

  async updateSelectedSignals(userId: string, body: unknown): Promise<SignalSummary> {
    const selectedSignalNames = validateSelectedSignalNames(body);
    const current = await this.getSummary(userId);
    const availableNames = new Set(current.availableSignals.map((signal) => signal.name));
    const normalized = selectedSignalNames.filter((name, index) =>
      availableNames.has(name) && selectedSignalNames.indexOf(name) === index,
    );

    if (normalized.length === 0) {
      throw new SignalAggregationError('Select at least one available market signal', 400);
    }

    try {
      await this.preferences.saveSelectedSignalNames(userId, normalized);
    } catch (error) {
      if (error instanceof Error && error.message.includes('preferences table is missing')) {
        throw new SignalAggregationError(error.message, 503);
      }
      throw error;
    }
    return this.getSummary(userId);
  }

  private async get200DayMA(db: Queryable): Promise<number | null> {
    const result = await db.query<{ avg_price: string }>(
      `SELECT AVG(price_usd) AS avg_price FROM (
         SELECT price_usd FROM bitcoin_price_daily ORDER BY date DESC LIMIT 200
       ) recent`,
    );
    return parseNum(result.rows[0]?.avg_price);
  }

  private async getPuellMultiple(db: Queryable): Promise<number | null> {
    const result = await db.query<{ puell: string }>(`
      SELECT
        (daily_rev / NULLIF(avg365_rev, 0)) AS puell
      FROM (
        SELECT
          (SELECT metric_value FROM bitcoin_metrics_daily WHERE metric_name = 'miners_revenue_usd' ORDER BY date DESC LIMIT 1) AS daily_rev,
          AVG(metric_value) AS avg365_rev
        FROM (
          SELECT metric_value FROM bitcoin_metrics_daily
          WHERE metric_name = 'miners_revenue_usd'
          ORDER BY date DESC LIMIT 365
        ) recent
      ) calc
    `);
    return parseNum(result.rows[0]?.puell);
  }

  private requireDatabase(): Queryable {
    if (!this.database) {
      throw new Error('Database is not configured');
    }
    return this.database;
  }
}

export class SignalAggregationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

// --- Scoring functions ---

function scoreMvrv(z: number | null): SignalScore {
  const name = 'mvrv_zscore';
  const label = 'MVRV Z-Score';
  const maxScore = 20;

  if (z === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (z < 0)      { score = 20; interpretation = 'Deep buy zone — historically rare undervaluation'; }
  else if (z < 2) { score = 12; interpretation = 'Undervalued — accumulation zone'; }
  else if (z < 4) { score = 4;  interpretation = 'Fair value range'; }
  else if (z < 7) { score = -8; interpretation = 'Elevated — market heating up'; }
  else             { score = -20; interpretation = 'Extreme overvaluation — historical sell zone'; }

  return { name, label, value: z, formattedValue: z.toFixed(2), score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreFearGreed(fg: number | null): SignalScore {
  const name = 'fear_greed';
  const label = 'Fear & Greed Index';
  const maxScore = 15;

  if (fg === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (fg <= 20)      { score = 15; interpretation = 'Extreme fear — historically strong buy signal'; }
  else if (fg <= 40) { score = 8;  interpretation = 'Fear — accumulation favoured'; }
  else if (fg <= 60) { score = 0;  interpretation = 'Neutral sentiment'; }
  else if (fg <= 80) { score = -8; interpretation = 'Greed — caution advised'; }
  else               { score = -15; interpretation = 'Extreme greed — distribution zone'; }

  return { name, label, value: fg, formattedValue: `${Math.round(fg)}/100`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreRainbowBand(band: number | null): SignalScore {
  const name = 'rainbow_band';
  const label = 'Rainbow Band';
  const maxScore = 20;

  if (band === null) return noData(name, label, maxScore);

  // Band 1 = Fire Sale (cheapest/most bullish), Band 9 = Maximum Bubble Territory (most bearish)
  const b = Math.round(band);
  const bandLabels = ['', 'Fire Sale', 'Buy', 'Accumulate', 'Still Cheap', 'HODL', 'Is This A Bubble?', 'FOMO Intensifies', 'Sell Seriously', 'Maximum Bubble Territory'];
  const scores =     [0,  20,          15,    8,             3,             0,      -5,                    -10,                 -15,              -20];
  const score = scores[Math.min(Math.max(b, 1), 9)] ?? 0;
  const label2 = bandLabels[Math.min(Math.max(b, 1), 9)] ?? '';
  const interpretation = `Band ${b}: ${label2}`;

  return { name, label, value: b, formattedValue: `Band ${b}`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreRealizedPrice(btc: number | null, realized: number | null): SignalScore {
  const name = 'realized_price';
  const label = 'Realized Price Premium';
  const maxScore = 15;

  if (btc === null || realized === null || realized === 0) return noData(name, label, maxScore);

  const premium = ((btc - realized) / realized) * 100;
  let score: number;
  let interpretation: string;

  if (premium < 0)    { score = 15; interpretation = 'Below realized price — market at loss, strong accumulation signal'; }
  else if (premium < 30)  { score = 8;  interpretation = 'Near realized price — healthy premium'; }
  else if (premium < 100) { score = 0;  interpretation = 'Moderate premium above realized price'; }
  else if (premium < 250) { score = -8; interpretation = 'High premium — market overextended'; }
  else                    { score = -15; interpretation = 'Extreme premium — historical sell zone'; }

  return { name, label, value: premium, formattedValue: `+${premium.toFixed(1)}%`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreNupl(btc: number | null, realized: number | null): SignalScore {
  const name = 'nupl';
  const label = 'Bitcoin NUPL';
  const maxScore = 15;

  if (btc === null || realized === null || btc === 0) return noData(name, label, maxScore);

  const nupl = ((btc - realized) / btc) * 100;
  let score: number;
  let interpretation: string;

  if (nupl < 0)       { score = 15;  interpretation = 'Capitulation — market in aggregate loss, historically strong accumulation zone'; }
  else if (nupl < 25) { score = 8;   interpretation = 'Hope / Fear — near aggregate cost basis, early recovery conditions'; }
  else if (nupl < 50) { score = 3;   interpretation = 'Optimism / Anxiety — profitable but not euphoric'; }
  else if (nupl < 75) { score = -6;  interpretation = 'Belief / Denial — mature bull-market profit zone'; }
  else                { score = -15; interpretation = 'Euphoria / Greed — overheated profit zone, cycle-top risk'; }

  return { name, label, value: nupl, formattedValue: `${nupl.toFixed(1)}%`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreVddMultiple(vdd: number | null): SignalScore {
  const name = 'vdd_multiple';
  const label = 'VDD Multiple';
  const maxScore = 10;

  if (vdd === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (vdd < 0.5)      { score = 10; interpretation = 'Very low — accumulation zone'; }
  else if (vdd < 1)   { score = 5;  interpretation = 'Below average — mild bullish'; }
  else if (vdd < 3)   { score = 0;  interpretation = 'Average range'; }
  else if (vdd < 6)   { score = -5; interpretation = 'Elevated — caution'; }
  else                { score = -10; interpretation = 'Extreme — distribution zone'; }

  return { name, label, value: vdd, formattedValue: vdd.toFixed(2), score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scorePiCycle(btc: number | null, ma111: number | null, ma350: number | null): SignalScore {
  const name = 'pi_cycle';
  const label = 'Pi Cycle Top';
  const maxScore = 15;

  if (btc === null || ma111 === null || ma350 === null) return noData(name, label, maxScore);

  const ma350x2 = ma350 * 2;
  const gap = ((ma350x2 - ma111) / ma350x2) * 100;

  let score: number;
  let interpretation: string;

  if (gap > 30)     { score = 15; interpretation = 'Far from crossover — early/mid cycle'; }
  else if (gap > 15) { score = 8;  interpretation = 'Moving toward crossover — watch for top'; }
  else if (gap > 5)  { score = -5; interpretation = 'Approaching crossover — caution'; }
  else if (gap > 0)  { score = -12; interpretation = 'Very close to crossover — high risk'; }
  else               { score = -15; interpretation = 'Crossover occurred — historical cycle top signal'; }

  return { name, label, value: gap, formattedValue: `${gap.toFixed(1)}% gap`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreMayerMultiple(btc: number | null, ma200: number | null): SignalScore {
  const name = 'mayer_multiple';
  const label = 'Mayer Multiple';
  const maxScore = 10;

  if (btc === null || ma200 === null || ma200 === 0) return noData(name, label, maxScore);

  const mayer = btc / ma200;
  let score: number;
  let interpretation: string;

  if (mayer < 0.8)    { score = 10; interpretation = 'Well below 200-day MA — deep accumulation zone'; }
  else if (mayer < 1) { score = 6;  interpretation = 'Below 200-day MA — accumulation zone'; }
  else if (mayer < 1.5){ score = 2;  interpretation = 'Slightly above 200-day MA — healthy'; }
  else if (mayer < 2.4){ score = -4; interpretation = 'Extended above 200-day MA'; }
  else                 { score = -10; interpretation = 'Extreme extension — historical sell signal'; }

  return { name, label, value: mayer, formattedValue: `×${mayer.toFixed(2)}`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scorePuellMultiple(puell: number | null): SignalScore {
  const name = 'puell_multiple';
  const label = 'Puell Multiple';
  const maxScore = 15;

  if (puell === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (puell < 0.5)      { score = 15; interpretation = 'Miners stressed — historically rare buy zone'; }
  else if (puell < 1)   { score = 8;  interpretation = 'Below average miner revenue — accumulation zone'; }
  else if (puell < 4)   { score = 0;  interpretation = 'Average miner revenue — neutral'; }
  else if (puell < 8)   { score = -8; interpretation = 'Elevated miner revenue — late cycle signal'; }
  else                  { score = -15; interpretation = 'Extreme miner revenue — distribution zone'; }

  return { name, label, value: puell, formattedValue: puell.toFixed(2), score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreS2fModelPremium(btc: number | null, s2fRatio: number | null): SignalScore {
  const name = 's2f_model_premium';
  const label = 'S2F Model Premium';
  const maxScore = 10;

  if (btc === null || s2fRatio === null || btc === 0) return noData(name, label, maxScore);

  const modelPrice = 0.4 * Math.pow(s2fRatio, 3);
  if (!isFinite(modelPrice) || modelPrice <= 0) return noData(name, label, maxScore);

  const discount = ((modelPrice - btc) / modelPrice) * 100;
  let score: number;
  let interpretation: string;

  if (discount >= 50)      { score = 10; interpretation = 'Deep discount to Stock-to-Flow model price'; }
  else if (discount >= 20) { score = 6;  interpretation = 'Meaningful discount to Stock-to-Flow model price'; }
  else if (discount >= -20){ score = 0;  interpretation = 'Near Stock-to-Flow model fair value'; }
  else if (discount >= -50){ score = -6; interpretation = 'Premium to Stock-to-Flow model price'; }
  else                     { score = -10; interpretation = 'Large premium to Stock-to-Flow model price'; }

  return { name, label, value: discount, formattedValue: `${discount.toFixed(1)}%`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreProjectionRange(
  btc: number | null,
  cvdd: number | null,
  balancedPrice: number | null,
  terminalPrice: number | null,
): SignalScore {
  const name = 'projection_range';
  const label = 'Projection Range';
  const maxScore = 10;

  if (btc === null) return noData(name, label, maxScore);

  const floorValues = [cvdd, balancedPrice].filter((v): v is number => v !== null && v > 0);
  const floor = floorValues.length > 0 ? Math.max(...floorValues) : null;
  const ceiling = terminalPrice !== null && terminalPrice > 0 ? terminalPrice : null;

  if (floor === null || ceiling === null || ceiling <= floor) return noData(name, label, maxScore);

  const position = ((btc - floor) / (ceiling - floor)) * 100;
  let score: number;
  let interpretation: string;

  if (position < 0)       { score = 10; interpretation = 'Below modeled floor range — historically stressed valuation'; }
  else if (position < 25) { score = 6;  interpretation = 'Near projection floor range'; }
  else if (position < 60) { score = 2;  interpretation = 'Mid-range between modeled floor and terminal price'; }
  else if (position < 90) { score = -4; interpretation = 'Upper projection range — reward/risk cooling'; }
  else                    { score = -10; interpretation = 'Near or above terminal price range'; }

  return { name, label, value: position, formattedValue: `${position.toFixed(1)}% range`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreVolatilityPosition(btc: number | null, ma365: number | null, stddev365: number | null): SignalScore {
  const name = 'volatility_position';
  const label = '365d Volatility Position';
  const maxScore = 10;

  if (btc === null || ma365 === null || stddev365 === null || stddev365 === 0) return noData(name, label, maxScore);

  const z = (btc - ma365) / stddev365;
  let score: number;
  let interpretation: string;

  if (z <= -1.5)     { score = 10; interpretation = 'Deeply below 365-day trend band — capitulation-style discount'; }
  else if (z <= -0.5){ score = 6;  interpretation = 'Below 365-day trend band — accumulation conditions'; }
  else if (z < 0.75) { score = 1;  interpretation = 'Inside normal 365-day volatility range'; }
  else if (z < 1.5)  { score = -4; interpretation = 'Above 365-day trend band — extended conditions'; }
  else               { score = -10; interpretation = 'Far above 365-day trend band — overheated volatility extension'; }

  return { name, label, value: z, formattedValue: `${z.toFixed(2)}σ`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreGlobalM2(m2YoY: number | null): SignalScore {
  const name = 'global_m2_yoy';
  const label = 'Global M2 YoY';
  const maxScore = 10;

  if (m2YoY === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (m2YoY >= 10)      { score = 10; interpretation = 'Strong liquidity expansion — supportive macro backdrop for Bitcoin'; }
  else if (m2YoY >= 5)  { score = 6;  interpretation = 'Positive liquidity growth — risk-on conditions improving'; }
  else if (m2YoY >= 0)  { score = 2;  interpretation = 'Mild liquidity expansion — modest macro support'; }
  else if (m2YoY >= -3) { score = -4; interpretation = 'Liquidity contraction — macro headwind'; }
  else                  { score = -10; interpretation = 'Severe liquidity contraction — strong macro headwind'; }

  return { name, label, value: m2YoY, formattedValue: `${m2YoY.toFixed(1)}%`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreExchangeNetflow(netflow: number | null): SignalScore {
  const name = 'exchange_netflow';
  const label = 'Exchange Netflow';
  const maxScore = 10;

  if (netflow === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (netflow <= -10_000)    { score = 10; interpretation = 'Large net outflows — coins leaving exchanges, supply pressure easing'; }
  else if (netflow < -2_000) { score = 6;  interpretation = 'Net outflows — mild accumulation signal'; }
  else if (netflow <= 2_000) { score = 0;  interpretation = 'Flows balanced — neutral exchange impulse'; }
  else if (netflow <= 10_000){ score = -6; interpretation = 'Net inflows — potential sell-side supply building'; }
  else                       { score = -10; interpretation = 'Large exchange inflows — distribution risk elevated'; }

  return { name, label, value: netflow, formattedValue: `${formatCompact(netflow)} BTC`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreFundingRate(fundingRate: number | null): SignalScore {
  const name = 'funding_rate_avg';
  const label = 'Funding Rate';
  const maxScore = 10;

  if (fundingRate === null) return noData(name, label, maxScore);

  const percent = fundingRate * 100;
  let score: number;
  let interpretation: string;

  if (percent <= -0.03)      { score = 10; interpretation = 'Shorts paying longs — contrarian bullish derivatives setup'; }
  else if (percent < 0)      { score = 5;  interpretation = 'Negative funding — leverage skew is not overheated'; }
  else if (percent <= 0.03)  { score = 0;  interpretation = 'Funding near neutral'; }
  else if (percent <= 0.08)  { score = -5; interpretation = 'Positive funding — long leverage building'; }
  else                       { score = -10; interpretation = 'Very positive funding — crowded long risk'; }

  return { name, label, value: percent, formattedValue: `${percent.toFixed(3)}%`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreOpenInterest(btc: number | null, openInterestUsd: number | null): SignalScore {
  const name = 'open_interest_usd';
  const label = 'Open Interest';
  const maxScore = 10;

  if (btc === null || btc <= 0 || openInterestUsd === null) return noData(name, label, maxScore);

  const oiToPrice = openInterestUsd / btc;
  let score: number;
  let interpretation: string;

  if (oiToPrice < 150_000)       { score = 6;  interpretation = 'Leverage load is light relative to BTC price'; }
  else if (oiToPrice < 350_000)  { score = 2;  interpretation = 'Open interest is moderate'; }
  else if (oiToPrice < 600_000)  { score = -4; interpretation = 'Open interest elevated — liquidation sensitivity rising'; }
  else                           { score = -10; interpretation = 'Open interest very high — leverage flush risk elevated'; }

  return { name, label, value: openInterestUsd, formattedValue: `$${formatCompact(openInterestUsd)}`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreSoprSplit(lthSopr: number | null, sthSopr: number | null): SignalScore {
  const name = 'sopr_split';
  const label = 'LTH/STH SOPR';
  const maxScore = 10;

  if (lthSopr === null || sthSopr === null) return noData(name, label, maxScore);

  const avg = (lthSopr + sthSopr) / 2;
  let score: number;
  let interpretation: string;

  if (avg < 0.98)      { score = 10; interpretation = 'Coins selling at losses — capitulation-style reset'; }
  else if (avg < 1.02) { score = 5;  interpretation = 'Profit/loss near breakeven — reset conditions'; }
  else if (avg < 1.08) { score = 0;  interpretation = 'Moderate realized profits'; }
  else if (avg < 1.2)  { score = -5; interpretation = 'Profit taking elevated'; }
  else                 { score = -10; interpretation = 'Heavy profit taking — late-cycle distribution risk'; }

  return { name, label, value: avg, formattedValue: `${lthSopr.toFixed(2)} / ${sthSopr.toFixed(2)}`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreGoogleTrends(searchInterest: number | null): SignalScore {
  const name = 'google_trends_bitcoin';
  const label = 'Google Trends';
  const maxScore = 10;

  if (searchInterest === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (searchInterest < 20)       { score = 8;  interpretation = 'Low retail attention — accumulation backdrop'; }
  else if (searchInterest < 45)  { score = 4;  interpretation = 'Search interest rising from a quiet base'; }
  else if (searchInterest < 70)  { score = 0;  interpretation = 'Retail attention is normal'; }
  else if (searchInterest < 90)  { score = -6; interpretation = 'High retail attention — crowding risk rising'; }
  else                           { score = -10; interpretation = 'Extreme search interest — euphoric attention risk'; }

  return { name, label, value: searchInterest, formattedValue: `${Math.round(searchInterest)}/100`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreActiveAddresses(activeAddresses: number | null): SignalScore {
  const name = 'active_addresses';
  const label = 'Active Addresses';
  const maxScore = 10;

  if (activeAddresses === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (activeAddresses >= 1_000_000)      { score = 8;  interpretation = 'Strong network usage — demand fundamentals healthy'; }
  else if (activeAddresses >= 750_000)   { score = 4;  interpretation = 'Network usage is constructive'; }
  else if (activeAddresses >= 500_000)   { score = 0;  interpretation = 'Network usage is moderate'; }
  else if (activeAddresses >= 350_000)   { score = -4; interpretation = 'Network usage is soft'; }
  else                                   { score = -8; interpretation = 'Weak network usage — demand confirmation missing'; }

  return { name, label, value: activeAddresses, formattedValue: formatCompact(activeAddresses), score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreDvol(dvol: number | null): SignalScore {
  const name = 'btc_dvol';
  const label = 'BTC DVOL';
  const maxScore = 10;

  if (dvol === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (dvol < 45)      { score = 5;  interpretation = 'Low implied volatility — calm conditions'; }
  else if (dvol < 70) { score = 1;  interpretation = 'Normal implied volatility'; }
  else if (dvol < 95) { score = -4; interpretation = 'Elevated implied volatility — risk premium rising'; }
  else                { score = -8; interpretation = 'Very high implied volatility — stress conditions'; }

  return { name, label, value: dvol, formattedValue: `${dvol.toFixed(1)}%`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreExcessLiquidity(excessLiquidity: number | null): SignalScore {
  const name = 'excess_liquidity_leading';
  const label = 'Excess Liquidity';
  const maxScore = 10;

  if (excessLiquidity === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (excessLiquidity >= 8)       { score = 10; interpretation = 'Strong leading liquidity impulse'; }
  else if (excessLiquidity >= 3)  { score = 6;  interpretation = 'Positive leading liquidity impulse'; }
  else if (excessLiquidity > -3)  { score = 0;  interpretation = 'Liquidity impulse is neutral'; }
  else if (excessLiquidity > -8)  { score = -6; interpretation = 'Negative leading liquidity impulse'; }
  else                            { score = -10; interpretation = 'Severe liquidity drag'; }

  return { name, label, value: excessLiquidity, formattedValue: `${excessLiquidity.toFixed(1)}%`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

function scoreDxy(dxyYoY: number | null): SignalScore {
  const name = 'dxy_yoy_change';
  const label = 'DXY YoY';
  const maxScore = 10;

  if (dxyYoY === null) return noData(name, label, maxScore);

  let score: number;
  let interpretation: string;

  if (dxyYoY <= -8)      { score = 10; interpretation = 'Dollar weakening sharply - strong macro tailwind for Bitcoin'; }
  else if (dxyYoY <= -3) { score = 6;  interpretation = 'Dollar weakening - supportive liquidity backdrop'; }
  else if (dxyYoY <= 3)  { score = 0;  interpretation = 'Dollar broadly stable - neutral macro impulse'; }
  else if (dxyYoY <= 8)  { score = -6; interpretation = 'Dollar strengthening - macro headwind for Bitcoin'; }
  else                   { score = -10; interpretation = 'Dollar strengthening sharply - strong risk-asset headwind'; }

  return { name, label, value: dxyYoY, formattedValue: `${dxyYoY.toFixed(1)}%`, score, maxScore, interpretation, zone: toZone(score, maxScore) };
}

// --- Helpers ---

function noData(name: string, label: string, maxScore: number): SignalScore {
  return { name, label, value: null, formattedValue: 'N/A', score: 0, maxScore, interpretation: 'No data available', zone: 'no_data' };
}

function normalizeSelectedSignalNames(
  savedSelection: string[] | null,
  availableNames: Set<string>,
): string[] {
  const source = savedSelection && savedSelection.length > 0
    ? savedSelection
    : [...DEFAULT_MARKET_SIGNAL_NAMES];
  const selected = source.filter((name, index) => availableNames.has(name) && source.indexOf(name) === index);

  if (selected.length > 0) {
    return selected;
  }

  const firstAvailable = availableNames.values().next().value;
  return firstAvailable ? [firstAvailable] : [];
}

function validateSelectedSignalNames(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) {
    throw new SignalAggregationError('Invalid request body', 400);
  }

  const value = (body as Record<string, unknown>)['selectedSignalNames'];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new SignalAggregationError('selectedSignalNames must be an array of signal names', 400);
  }

  return value;
}

function toZone(score: number, max: number): SignalScore['zone'] {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.6)       return 'very_bullish';
  if (pct >= 0.2)       return 'bullish';
  if (pct >= -0.2)      return 'neutral';
  if (pct >= -0.6)      return 'bearish';
  return 'very_bearish';
}

function overallZone(normalized: number): SignalSummary['overallZone'] {
  if (normalized >= 60) return 'very_bullish';
  if (normalized >= 20) return 'bullish';
  if (normalized >= -20) return 'neutral';
  if (normalized >= -60) return 'bearish';
  return 'very_bearish';
}

function overallLabel(normalized: number): string {
  if (normalized >= 60) return 'Strong Buy';
  if (normalized >= 20) return 'Bullish';
  if (normalized >= -20) return 'Neutral';
  if (normalized >= -60) return 'Bearish';
  return 'Strong Sell';
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

function formatCompact(value: number): string {
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
