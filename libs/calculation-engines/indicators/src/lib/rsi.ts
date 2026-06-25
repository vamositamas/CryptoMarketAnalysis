export interface RsiPoint {
  date: string;
  rsi: number;
}

export function computeMonthlyRsi(
  dailyPrices: Array<{ date: string; value: number }>,
  period = 12,
): RsiPoint[] {
  const monthly = resampleToMonthly(dailyPrices);
  return computeWildersRsi(monthly, period);
}

function resampleToMonthly(
  prices: Array<{ date: string; value: number }>,
): Array<{ date: string; value: number }> {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const monthMap = new Map<string, { date: string; value: number }>();
  for (const p of sorted) {
    monthMap.set(p.date.slice(0, 7), p); // last entry per month wins
  }
  return [...monthMap.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function computeWildersRsi(
  prices: Array<{ date: string; value: number }>,
  period: number,
): RsiPoint[] {
  if (prices.length <= period) return [];

  const result: RsiPoint[] = [];
  const changes = prices.slice(1).map((p, i) => p.value - prices[i].value);

  // Seed: simple average of first <period> gains/losses
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  const toRsi = (ag: number, al: number) =>
    al === 0 ? 100 : 100 - 100 / (1 + ag / al);

  result.push({ date: prices[period].date, rsi: toRsi(avgGain, avgLoss) });

  // Wilder's smoothing for all subsequent months
  for (let i = period; i < changes.length; i++) {
    const gain = Math.max(0, changes[i]);
    const loss = Math.abs(Math.min(0, changes[i]));
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push({ date: prices[i + 1].date, rsi: toRsi(avgGain, avgLoss) });
  }

  return result;
}
