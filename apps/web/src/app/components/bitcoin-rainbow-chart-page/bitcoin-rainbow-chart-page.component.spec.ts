import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';

jest.mock('chart.js', () => ({
  Chart: class {
    static register = jest.fn();
    destroy = jest.fn();
    update = jest.fn();
    resetZoom = jest.fn();
    toBase64Image = jest.fn();
  },
  registerables: [],
}));
jest.mock('chartjs-plugin-zoom', () => ({ id: 'zoom' }));
jest.mock('chartjs-plugin-annotation', () => ({ id: 'annotation' }));

import { BitcoinRainbowChartPageComponent } from './bitcoin-rainbow-chart-page.component';

describe('BitcoinRainbowChartPageComponent', () => {
  let fixture: ComponentFixture<BitcoinRainbowChartPageComponent>;
  let router: { navigate: jest.Mock };
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let api: { getBitcoinRainbowChartData: jest.Mock };

  function setUp(initialTimeframe: string | null): void {
    queryParamMap = new BehaviorSubject(
      convertToParamMap(initialTimeframe === null ? {} : { timeframe: initialTimeframe }),
    );
    router = { navigate: jest.fn().mockResolvedValue(true) };
    api = {
      getBitcoinRainbowChartData: jest.fn().mockResolvedValue({
        dataPoints: [],
        lastUpdated: null,
      }),
      recordRecentChart: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [BitcoinRainbowChartPageComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { queryParamMap, snapshot: {} } },
        { provide: AuthApiClient, useValue: api },
      ],
    });

    fixture = TestBed.createComponent(BitcoinRainbowChartPageComponent);
    fixture.detectChanges();
  }

  it('loads chart data for the timeframe present in the URL on init', () => {
    setUp('1y');

    expect(api.getBitcoinRainbowChartData).toHaveBeenCalledWith('1y');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('corrects an invalid timeframe query param to "all"', () => {
    setUp('invalid');

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: expect.anything(),
      queryParams: { timeframe: 'all' },
      replaceUrl: true,
    });
    expect(api.getBitcoinRainbowChartData).not.toHaveBeenCalled();
  });

  it('navigates with the new timeframe query param when a timeframe button is selected', async () => {
    setUp('all');
    await fixture.whenStable();
    router.navigate.mockClear();

    fixture.componentInstance['selectTimeframe']('1y');

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: expect.anything(),
      queryParams: { timeframe: '1y' },
    });
  });

  it('reloads chart data when the URL query param changes externally (e.g. back button)', () => {
    setUp('all');
    api.getBitcoinRainbowChartData.mockClear();

    queryParamMap.next(convertToParamMap({ timeframe: '3m' }));

    expect(api.getBitcoinRainbowChartData).toHaveBeenCalledWith('3m');
  });
});
