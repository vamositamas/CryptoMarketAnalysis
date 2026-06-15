import { calculateMovingAverage } from './moving-averages';

describe('calculateMovingAverage', () => {
  it('returns null until sufficient history exists and then calculates a simple moving average', () => {
    const prices = [
      { date: new Date('2026-06-01T00:00:00.000Z'), value: 10 },
      { date: new Date('2026-06-02T00:00:00.000Z'), value: 20 },
      { date: new Date('2026-06-03T00:00:00.000Z'), value: 30 },
      { date: new Date('2026-06-04T00:00:00.000Z'), value: 60 },
    ];

    expect(calculateMovingAverage(prices, 3)).toEqual([
      { date: prices[0].date, value: null },
      { date: prices[1].date, value: null },
      { date: prices[2].date, value: 20 },
      { date: prices[3].date, value: 36.67 },
    ]);
  });

  it('sorts input by date before calculating', () => {
    const result = calculateMovingAverage(
      [
        { date: new Date('2026-06-03T00:00:00.000Z'), value: 30 },
        { date: new Date('2026-06-01T00:00:00.000Z'), value: 10 },
        { date: new Date('2026-06-02T00:00:00.000Z'), value: 20 },
      ],
      2,
    );

    expect(result.map((point) => point.value)).toEqual([null, 15, 25]);
  });

  it('rejects invalid periods', () => {
    expect(() => calculateMovingAverage([], 0)).toThrow(
      'Moving average period must be a positive integer',
    );
  });
});
