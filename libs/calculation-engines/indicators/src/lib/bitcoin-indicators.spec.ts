import {
  calculateBitcoinDailyIndicators,
  selectLatestBitcoinDailyIndicators,
} from './bitcoin-indicators';

describe('Bitcoin daily indicators', () => {
  it('calculates latest daily indicators from historical prices', () => {
    const history = Array.from({ length: 350 }, (_, index) => ({
      date: new Date(Date.UTC(2025, 0, 1 + index)),
      priceUsd: index + 1,
      circulatingSupply: 19_700_000,
    }));

    const latest = selectLatestBitcoinDailyIndicators(history);

    expect(latest).toMatchObject({
      date: history[349].date,
      ma111Day: 295,
      ma200Day: 250.5,
      ma350Day: 175.5,
      stockToFlowRatio: 119.94,
    });
    expect(latest?.rainbowBand).toBeGreaterThanOrEqual(1);
    expect(latest?.rainbowBand).toBeLessThanOrEqual(9);
  });

  it('returns null long-window indicators when there is insufficient history', () => {
    const indicators = calculateBitcoinDailyIndicators([
      {
        date: new Date('2026-06-09T00:00:00.000Z'),
        priceUsd: 67_000,
      },
    ]);

    expect(indicators[0]).toMatchObject({
      ma111Day: null,
      ma200Day: null,
      ma350Day: null,
      stockToFlowRatio: null,
    });
  });
});
