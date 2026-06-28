import { PriceProjectionsService } from './price-projections.service';

describe('PriceProjectionsService', () => {
  it('adds volatility, ATH, and cycle-heat projection possibilities from existing data', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ price_usd: '59690', last_updated: '2026-06-26T00:00:00.000Z' }],
        })
        .mockResolvedValueOnce({
          rows: [{
            realized_price: '52864',
            terminal_price: '95250',
            balanced_price: '28700',
            cvdd: '13524',
            ma_200_day: '76148',
            ma_365_day: '70000',
            stddev_365_day: '15000',
            ath_price: '108000',
            btc_rsi_12m: '72',
            rainbow_band: '6',
            stock_to_flow_model: '122',
            global_m2_yoy: '6.4',
            dxy_yoy_change: '-4.5',
          }],
        })
        .mockResolvedValueOnce({
          rows: [
            { date: '2026-06-25', price_usd: '59000' },
            { date: '2026-06-26', price_usd: '59690' },
          ],
        }),
    };
    const service = new PriceProjectionsService(database);

    const response = await service.getProjections();

    expect(response.scenarios.find((s) => s.scenario === 'bear')?.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '365d mean -1σ', priceUsd: 55_000 }),
      ]),
    );
    expect(response.scenarios.find((s) => s.scenario === 'base')?.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '365d mean +1σ', priceUsd: 85_000 }),
        expect.objectContaining({ label: 'ATH retest', priceUsd: 108_000 }),
      ]),
    );
    expect(response.scenarios.find((s) => s.scenario === 'bull')?.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'ATH ×1.272', priceUsd: 137_376 }),
        expect.objectContaining({ label: '365d mean +2σ', priceUsd: 100_000 }),
        expect.objectContaining({ label: 'Liquidity expansion target', priceUsd: 71_628 }),
        expect.objectContaining({ label: 'Dollar-weakness target', priceUsd: 68_644 }),
      ]),
    );
    expect(response.scenarios.find((s) => s.scenario === 'ultra_bull')?.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'ATH ×1.618', priceUsd: 174_744 }),
        expect.objectContaining({ label: 'ATH ×2', priceUsd: 216_000 }),
        expect.objectContaining({ label: 'Cycle heat extension', priceUsd: 89_535 }),
      ]),
    );
  });
});
