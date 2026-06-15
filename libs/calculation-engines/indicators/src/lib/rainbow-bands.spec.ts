import { calculateRainbowBands, calculateRainbowFairValue } from './rainbow-bands';

describe('calculateRainbowBands', () => {
  it('returns the lowest blue band for deeply undervalued prices', () => {
    const date = new Date('2026-06-09T00:00:00.000Z');
    const fairValue = calculateRainbowFairValue(date);

    expect(calculateRainbowBands(date, fairValue * 0.1)).toEqual({
      band: 1,
      color: '#1e3a8a',
      label: 'Fire Sale',
    });
  });

  it('returns the middle HODL band for prices above fair value', () => {
    const date = new Date('2026-06-09T00:00:00.000Z');
    const fairValue = calculateRainbowFairValue(date);

    expect(calculateRainbowBands(date, fairValue * 1.2)).toEqual({
      band: 5,
      color: '#84cc16',
      label: 'HODL',
    });
  });

  it('returns the maximum bubble band for extreme prices', () => {
    const date = new Date('2026-06-09T00:00:00.000Z');
    const fairValue = calculateRainbowFairValue(date);

    expect(calculateRainbowBands(date, fairValue * 12)).toEqual({
      band: 9,
      color: '#7f1d1d',
      label: 'Maximum Bubble Territory',
    });
  });
});
