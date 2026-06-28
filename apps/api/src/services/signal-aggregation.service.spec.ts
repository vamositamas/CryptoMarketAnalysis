import { SignalAggregationService } from './signal-aggregation.service';

describe('SignalAggregationService', () => {
  it('adds projection-derived market signals from existing chart data', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{
            price_usd: '60000',
            last_updated: '2026-06-26T00:00:00.000Z',
            mvrv_zscore: '1.5',
            fear_greed_index: '35',
            rainbow_band: '4',
            realized_price: '52000',
            terminal_price: '120000',
            balanced_price: '30000',
            cvdd: '18000',
            vdd_multiple: '0.8',
            stock_to_flow_ratio: '60',
            ma_365_day: '70000',
            stddev_365_day: '10000',
            ma_111_day: '65000',
            ma_350_day: '42000',
            hash_rate: '1',
            miners_revenue_usd: '1',
            miner_fees: '1',
            global_m2_yoy: '6',
            dxy_yoy_change: '-4',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ avg_price: '65000' }] })
        .mockResolvedValueOnce({ rows: [{ puell: '0.8' }] }),
    };
    const service = new SignalAggregationService(database);

    const response = await service.getSummary();

    expect(response.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 's2f_model_premium',
          formattedValue: '30.6%',
          zone: 'very_bullish',
        }),
        expect.objectContaining({
          name: 'projection_range',
          formattedValue: '33.3% range',
          zone: 'bullish',
        }),
        expect.objectContaining({
          name: 'volatility_position',
          formattedValue: '-1.00σ',
          zone: 'very_bullish',
        }),
      ]),
    );
  });
});
