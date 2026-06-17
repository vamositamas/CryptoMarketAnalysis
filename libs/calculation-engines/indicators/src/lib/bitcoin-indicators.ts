import { calculateMovingAverage, type IndicatorPoint } from './moving-averages';
import { calculateRainbowBands } from './rainbow-bands';
import { calculateStockToFlow } from './stock-to-flow';

export interface BitcoinDailyIndicatorInput {
  date: Date;
  priceUsd: number;
  circulatingSupply?: number;
}

export interface BitcoinDailyIndicators {
  date: Date;
  ma111Day: number | null;
  ma200Day: number | null;
  ma350Day: number | null;
  stockToFlowRatio: number | null;
  rainbowBand: number;
}

export function calculateBitcoinDailyIndicators(
  priceHistory: BitcoinDailyIndicatorInput[],
): BitcoinDailyIndicators[] {
  const sortedHistory = [...priceHistory].sort((left, right) => left.date.getTime() - right.date.getTime());
  const pricePoints: IndicatorPoint[] = sortedHistory.map((point) => ({
    date: point.date,
    value: point.priceUsd,
  }));
  const ma111Day = calculateMovingAverage(pricePoints, 111);
  const ma200Day = calculateMovingAverage(pricePoints, 200);
  const ma350Day = calculateMovingAverage(pricePoints, 350);

  return sortedHistory.map((point, index) => ({
    date: point.date,
    ma111Day: ma111Day[index].value,
    ma200Day: ma200Day[index].value,
    ma350Day: ma350Day[index].value,
    stockToFlowRatio:
      point.circulatingSupply === undefined
        ? null
        : calculateStockToFlow(point.date, point.circulatingSupply),
    rainbowBand: calculateRainbowBands(point.date, point.priceUsd).band,
  }));
}

export function selectLatestBitcoinDailyIndicators(
  priceHistory: BitcoinDailyIndicatorInput[],
): BitcoinDailyIndicators | undefined {
  return calculateBitcoinDailyIndicators(priceHistory).at(-1);
}
