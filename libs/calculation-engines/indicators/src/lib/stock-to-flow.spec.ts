import {
  calculateStockToFlow,
  getAnnualBitcoinProduction,
  getBlockSubsidyBtc,
} from './stock-to-flow';

describe('stock-to-flow indicators', () => {
  it('uses the current Bitcoin halving epoch to determine annual production', () => {
    const date = new Date('2026-06-09T00:00:00.000Z');

    expect(getBlockSubsidyBtc(date)).toBe(3.125);
    expect(getAnnualBitcoinProduction(date)).toBe(164250);
  });

  it('calculates stock-to-flow rounded to 2 decimals', () => {
    expect(calculateStockToFlow(new Date('2026-06-09T00:00:00.000Z'), 19_700_000)).toBe(
      119.94,
    );
  });

  it('allows explicit annual production for testability and alternative supply models', () => {
    expect(calculateStockToFlow(new Date('2026-06-09T00:00:00.000Z'), 19_700_000, 350_000)).toBe(
      56.29,
    );
  });
});
