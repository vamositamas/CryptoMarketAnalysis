import { SignalAggregationService } from './signal-aggregation.service';
import type { MarketSignalPreferencesRepository } from '../repositories/market-signal-preferences.repository';

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
            exchange_reserve: '2600000',
            exchange_netflow: '-12000',
            funding_rate_avg: '-0.0004',
            open_interest_usd: '8000000000',
            lth_sopr: '0.99',
            sth_sopr: '0.96',
            google_trends_bitcoin: '18',
            active_addresses: '1050000',
            btc_dvol: '42',
            global_m2_yoy: '6',
            dxy_yoy_change: '-4',
            excess_liquidity_leading: '4.2',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ avg_price: '65000' }] })
        .mockResolvedValueOnce({ rows: [{ puell: '0.8' }] }),
    };
    const service = new SignalAggregationService(database);

    const response = await service.getSummary();

    expect(response.availableSignals).toEqual(
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
        expect.objectContaining({
          name: 'exchange_netflow',
          formattedValue: '-12K BTC',
          zone: 'very_bullish',
        }),
        expect.objectContaining({
          name: 'sopr_split',
          formattedValue: '0.99 / 0.96',
          zone: 'very_bullish',
        }),
        expect.objectContaining({
          name: 'excess_liquidity_leading',
          formattedValue: '4.2%',
          zone: 'very_bullish',
        }),
      ]),
    );
    expect(response.signals.map((signal) => signal.name)).toEqual([
      'mvrv_zscore',
      'fear_greed',
      'rainbow_band',
      'realized_price',
      'nupl',
      'vdd_multiple',
      'pi_cycle',
      'mayer_multiple',
      'puell_multiple',
      'global_m2_yoy',
    ]);
  });

  it('hides optional satellite signals when their source data is missing', async () => {
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
            hash_rate: null,
            miners_revenue_usd: '1',
            miner_fees: null,
            exchange_reserve: null,
            exchange_netflow: null,
            funding_rate_avg: null,
            open_interest_usd: null,
            lth_sopr: null,
            sth_sopr: null,
            google_trends_bitcoin: null,
            active_addresses: null,
            btc_dvol: null,
            global_m2_yoy: '6',
            dxy_yoy_change: '-4',
            excess_liquidity_leading: null,
          }],
        })
        .mockResolvedValueOnce({ rows: [{ avg_price: '65000' }] })
        .mockResolvedValueOnce({ rows: [{ puell: '0.8' }] }),
    };
    const service = new SignalAggregationService(database);

    const response = await service.getSummary();

    expect(response.signals.map((signal) => signal.name)).not.toEqual(
      expect.arrayContaining([
        'exchange_netflow',
        'funding_rate_avg',
        'open_interest_usd',
        'sopr_split',
        'google_trends_bitcoin',
        'active_addresses',
        'btc_dvol',
        'excess_liquidity_leading',
      ]),
    );
    expect(response.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'mvrv_zscore' }),
        expect.objectContaining({ name: 'global_m2_yoy' }),
      ]),
    );
  });

  it('calculates the summary from a user selected signal subset', async () => {
    const database = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{
            price_usd: '60000',
            last_updated: '2026-06-26T00:00:00.000Z',
            mvrv_zscore: '1.5',
            fear_greed_index: '90',
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
            hash_rate: null,
            miners_revenue_usd: '1',
            miner_fees: null,
            exchange_reserve: null,
            exchange_netflow: null,
            funding_rate_avg: null,
            open_interest_usd: null,
            lth_sopr: null,
            sth_sopr: null,
            google_trends_bitcoin: null,
            active_addresses: null,
            btc_dvol: null,
            global_m2_yoy: '6',
            dxy_yoy_change: '-4',
            excess_liquidity_leading: null,
          }],
        })
        .mockResolvedValueOnce({ rows: [{ avg_price: '65000' }] })
        .mockResolvedValueOnce({ rows: [{ puell: '0.8' }] }),
    };
    const preferences = {
      findSelectedSignalNames: jest.fn().mockResolvedValue(['fear_greed']),
      saveSelectedSignalNames: jest.fn(),
    } as unknown as MarketSignalPreferencesRepository;
    const service = new SignalAggregationService(database, preferences);

    const response = await service.getSummary('user-1');

    expect(response.selectedSignalNames).toEqual(['fear_greed']);
    expect(response.signals).toEqual([
      expect.objectContaining({ name: 'fear_greed', score: -15 }),
    ]);
    expect(response.normalizedScore).toBe(-100);
  });
});
