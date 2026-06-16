import { DEFAULT_CHART_TIMEFRAME, isChartTimeframe, parseChartTimeframe } from './chart-timeframe-url.util';

describe('chart-timeframe-url.util', () => {
  describe('isChartTimeframe', () => {
    it('accepts every valid timeframe value', () => {
      for (const value of ['1m', '3m', '6m', '1y', '2y', 'all']) {
        expect(isChartTimeframe(value)).toBe(true);
      }
    });

    it('rejects invalid or missing values', () => {
      expect(isChartTimeframe('invalid')).toBe(false);
      expect(isChartTimeframe(null)).toBe(false);
      expect(isChartTimeframe('')).toBe(false);
    });
  });

  describe('parseChartTimeframe', () => {
    it('returns the value when it is a valid timeframe', () => {
      expect(parseChartTimeframe('1y')).toBe('1y');
    });

    it('falls back to the default timeframe for invalid input', () => {
      expect(parseChartTimeframe('invalid')).toBe(DEFAULT_CHART_TIMEFRAME);
      expect(parseChartTimeframe(null)).toBe(DEFAULT_CHART_TIMEFRAME);
    });
  });
});
