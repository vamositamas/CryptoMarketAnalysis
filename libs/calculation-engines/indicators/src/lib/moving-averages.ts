export interface IndicatorPoint {
  date: Date;
  value: number;
}

export interface MovingAveragePoint {
  date: Date;
  value: number | null;
}

export function calculateMovingAverage(
  prices: IndicatorPoint[],
  periodDays: number,
): MovingAveragePoint[] {
  if (!Number.isInteger(periodDays) || periodDays < 1) {
    throw new Error('Moving average period must be a positive integer');
  }

  const sortedPrices = [...prices].sort((left, right) => left.date.getTime() - right.date.getTime());
  const movingAverages: MovingAveragePoint[] = [];
  let rollingSum = 0;

  for (let index = 0; index < sortedPrices.length; index += 1) {
    rollingSum += sortedPrices[index].value;

    if (index >= periodDays) {
      rollingSum -= sortedPrices[index - periodDays].value;
    }

    movingAverages.push({
      date: sortedPrices[index].date,
      value: index >= periodDays - 1 ? roundToDecimals(rollingSum / periodDays, 2) : null,
    });
  }

  return movingAverages;
}

function roundToDecimals(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;

  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}
