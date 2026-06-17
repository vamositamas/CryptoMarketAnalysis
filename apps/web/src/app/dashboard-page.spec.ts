import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';
import { DashboardPage } from './app.routes';

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let auth: { getCurrentUserProfile: jest.Mock; getDashboardWidgets: jest.Mock };

  function setUp(): void {
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [{ provide: AuthApiClient, useValue: auth }],
    });

    fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
  }

  beforeEach(() => {
    auth = {
      getCurrentUserProfile: jest.fn().mockRejectedValue(new Error('not logged in')),
      getDashboardWidgets: jest.fn().mockResolvedValue({ widgets: [] }),
    };
  });

  it('shows a loading state before widgets resolve', () => {
    setUp();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Loading...');
  });

  it('renders widget cards with title, formatted value, trend indicator, and last updated time', async () => {
    auth.getDashboardWidgets.mockResolvedValue({
      widgets: [
        {
          id: 'widget-1',
          type: 'btc_price',
          title: 'Current BTC Price',
          value: 67234.5,
          formattedValue: '$67,234.50',
          trend: 'up',
          trendPercent: 1.87,
          lastUpdated: '2026-06-10T00:00:00.000Z',
        },
      ],
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Current BTC Price');
    expect(compiled.textContent).toContain('$67,234.50');
    expect(compiled.querySelector('.widget-trend.trend-up')?.textContent).toContain('↑');
    expect(compiled.textContent).toContain('2026-06-10 00:00:00 UTC');
  });

  it('renders a waiting-for-data state when a widget has no last-updated timestamp', async () => {
    auth.getDashboardWidgets.mockResolvedValue({
      widgets: [
        {
          id: 'widget-2',
          type: 'mvrv_zscore',
          title: 'MVRV Z-Score',
          value: null,
          formattedValue: 'Waiting for data',
          trend: 'flat',
          trendPercent: null,
          lastUpdated: null,
        },
      ],
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.widget-updated')[0]?.textContent).toContain(
      'Waiting for data',
    );
  });

  it('opens the add-widget modal and appends the newly added widget to the grid', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.widget-modal-overlay')).toBeNull();

    const compiled = fixture.nativeElement as HTMLElement;
    const openButtons = Array.from(compiled.querySelectorAll('button')) as HTMLButtonElement[];
    openButtons.find((button) => button.textContent?.includes('Add Widget'))?.click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.widget-modal-overlay')).not.toBeNull();

    fixture.componentInstance['handleWidgetAdded']({
      id: 'widget-3',
      type: 'hash_rate',
      title: 'Hash Rate',
      value: 931513615.58,
      formattedValue: '931,513,616',
      trend: 'flat',
      trendPercent: null,
      lastUpdated: '2026-06-10T00:00:00.000Z',
    });
    fixture.componentInstance['closeAddWidget']();
    fixture.detectChanges();

    const updated = fixture.nativeElement as HTMLElement;
    expect(updated.querySelector('.widget-modal-overlay')).toBeNull();
    expect(updated.textContent).toContain('Hash Rate');
  });
});
