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
            excess_liquidity_leading: '6',
            funding_rate_avg: '0.001',
            open_interest_usd: '42000000000',
            exchange_netflow: '12500',
            active_addresses: '1100000',
            google_trends_bitcoin: '52',
            btc_dvol: '102',
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
        expect.objectContaining({ label: 'Crowded longs flush', priceUsd: 48_946 }),
        expect.objectContaining({ label: 'Open-interest deleveraging', priceUsd: 46_558 }),
        expect.objectContaining({ label: 'Exchange inflow stress', priceUsd: 52_527 }),
        expect.objectContaining({ label: 'High-volatility stress', priceUsd: 44_768 }),
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
        expect.objectContaining({ label: 'Excess liquidity target', priceUsd: 74_613 }),
        expect.objectContaining({ label: 'Dollar-weakness target', priceUsd: 68_644 }),
        expect.objectContaining({ label: 'Network activity target', priceUsd: 77_597 }),
        expect.objectContaining({ label: 'Attention expansion target', priceUsd: 70_434 }),
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

  it('adds projection targets when new market data is neutral or constructively light', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ price_usd: '60160', last_updated: '2026-07-01T00:00:00.000Z' }],
        })
        .mockResolvedValueOnce({
          rows: [{
            realized_price: '52677',
            terminal_price: '95382',
            balanced_price: '28609',
            cvdd: '13530',
            ma_200_day: '75363',
            ma_365_day: '81000',
            stddev_365_day: '10169',
            ath_price: '124777',
            btc_rsi_12m: '58',
            rainbow_band: '2',
            stock_to_flow_model: '122',
            global_m2_yoy: '5.6',
            dxy_yoy_change: '1',
            excess_liquidity_leading: '-0.5',
            funding_rate_avg: '0.00005',
            open_interest_usd: '3800000000',
            exchange_netflow: '-3500',
            active_addresses: '850000',
            google_trends_bitcoin: '35',
            btc_dvol: '55',
          }],
        })
        .mockResolvedValueOnce({
          rows: [
            { date: '2026-06-30', price_usd: '59800' },
            { date: '2026-07-01', price_usd: '60160' },
          ],
        }),
    };
    const service = new PriceProjectionsService(database);

    const response = await service.getProjections();

    expect(response.scenarios.find((s) => s.scenario === 'base')?.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Neutral liquidity path', priceUsd: 63_168 }),
        expect.objectContaining({ label: 'Stable dollar path', priceUsd: 63_770 }),
        expect.objectContaining({ label: 'Neutral funding path', priceUsd: 64_973 }),
        expect.objectContaining({ label: 'Attention recovery path', priceUsd: 66_176 }),
      ]),
    );
    expect(response.scenarios.find((s) => s.scenario === 'bull')?.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Funding reset advance', priceUsd: 69_786 }),
        expect.objectContaining({ label: 'Low-leverage advance', priceUsd: 73_395 }),
        expect.objectContaining({ label: 'Exchange outflow target', priceUsd: 68_582 }),
        expect.objectContaining({ label: 'Network growth target', priceUsd: 70_989 }),
      ]),
    );
  });
});
