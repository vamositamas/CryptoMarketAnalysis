import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthApiClient } from '@crypto-market-analysis/data-access/api-client';
import { DashboardPage } from './app.routes';

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let auth: {
    getCurrentUserProfile: jest.Mock;
    getDashboardWidgets: jest.Mock;
    reorderDashboardWidgets: jest.Mock;
    getRecentCharts: jest.Mock;
  };

  function setUp(): void {
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        { provide: AuthApiClient, useValue: auth },
      ],
    });

    fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
  }

  beforeEach(() => {
    auth = {
      getCurrentUserProfile: jest.fn().mockRejectedValue(new Error('not logged in')),
      getDashboardWidgets: jest.fn().mockResolvedValue({ widgets: [] }),
      reorderDashboardWidgets: jest.fn().mockResolvedValue(undefined),
      getRecentCharts: jest.fn().mockResolvedValue({ recentCharts: [] }),
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

  it('renders a drag handle on each widget card', async () => {
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

    const handle = (fixture.nativeElement as HTMLElement).querySelector('.widget-drag-handle');
    expect(handle).not.toBeNull();
    expect(handle?.getAttribute('aria-hidden')).toBe('true');
  });

  it('reorders widgets and calls the API when performReorder is invoked', async () => {
    const widgetA = {
      id: 'widget-a',
      type: 'btc_price',
      title: 'BTC Price',
      value: 67234.5,
      formattedValue: '$67,234.50',
      trend: 'up' as const,
      trendPercent: 1.87,
      lastUpdated: '2026-06-10T00:00:00.000Z',
    };
    const widgetB = {
      id: 'widget-b',
      type: 'market_cap',
      title: 'Market Cap',
      value: 1_320_000_000_000,
      formattedValue: '$1,320,000,000,000',
      trend: 'flat' as const,
      trendPercent: null,
      lastUpdated: '2026-06-10T00:00:00.000Z',
    };
    auth.getDashboardWidgets.mockResolvedValue({ widgets: [widgetA, widgetB] });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance['performReorder']('widget-a', 'widget-b');
    fixture.detectChanges();

    const articles = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-widget-id]');
    expect(articles[0]?.getAttribute('data-widget-id')).toBe('widget-b');
    expect(articles[1]?.getAttribute('data-widget-id')).toBe('widget-a');
    expect(auth.reorderDashboardWidgets).toHaveBeenCalledWith(['widget-b', 'widget-a']);
  });

  it('reloads widgets when the reorder API call fails', async () => {
    const widgetA = {
      id: 'widget-a',
      type: 'btc_price',
      title: 'BTC Price',
      value: 67234.5,
      formattedValue: '$67,234.50',
      trend: 'up' as const,
      trendPercent: 1.87,
      lastUpdated: '2026-06-10T00:00:00.000Z',
    };
    const widgetB = {
      id: 'widget-b',
      type: 'market_cap',
      title: 'Market Cap',
      value: null,
      formattedValue: 'Waiting for data',
      trend: 'flat' as const,
      trendPercent: null,
      lastUpdated: null,
    };
    auth.getDashboardWidgets.mockResolvedValue({ widgets: [widgetA, widgetB] });
    auth.reorderDashboardWidgets.mockRejectedValue(new Error('network error'));
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance['performReorder']('widget-a', 'widget-b');
    await fixture.whenStable();

    expect(auth.getDashboardWidgets).toHaveBeenCalledTimes(2);
  });

  it('marks the dragging widget with is-dragging class and the target with drag-over class', async () => {
    auth.getDashboardWidgets.mockResolvedValue({
      widgets: [
        {
          id: 'widget-a',
          type: 'btc_price',
          title: 'BTC Price',
          value: 67234.5,
          formattedValue: '$67,234.50',
          trend: 'up' as const,
          trendPercent: null,
          lastUpdated: null,
        },
        {
          id: 'widget-b',
          type: 'market_cap',
          title: 'Market Cap',
          value: null,
          formattedValue: 'Waiting for data',
          trend: 'flat' as const,
          trendPercent: null,
          lastUpdated: null,
        },
      ],
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance['draggingId'].set('widget-a');
    fixture.componentInstance['dragOverId'].set('widget-b');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-widget-id="widget-a"]')?.classList).toContain('is-dragging');
    expect(compiled.querySelector('[data-widget-id="widget-b"]')?.classList).toContain('drag-over');
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

  it('shows placeholder message and Explore Charts link when there are no recent charts', async () => {
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No charts viewed yet');
    expect(compiled.querySelector('a[href="/charts"]')).not.toBeNull();
  });

  it('renders a card for each recent chart with title and relative time', async () => {
    auth.getRecentCharts.mockResolvedValue({
      recentCharts: [
        {
          chartId: 'bitcoin-rainbow',
          title: 'Bitcoin Rainbow Price Chart',
          url: '/charts/bitcoin-rainbow',
          thumbnailUrl: '/assets/charts/bitcoin-rainbow-thumb.png',
          viewedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
    setUp();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Bitcoin Rainbow Price Chart');
    expect(compiled.textContent).toContain('2 hours ago');
    expect(compiled.querySelector('.recent-chart-card')).not.toBeNull();
  });

  it('formats relative time correctly', () => {
    setUp();
    const instance = fixture.componentInstance;

    const justNow = new Date(Date.now() - 30_000).toISOString();
    expect(instance['formatRelativeTime'](justNow)).toBe('Just now');

    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    expect(instance['formatRelativeTime'](oneMinAgo)).toBe('1 minute ago');

    const fiveMinsAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(instance['formatRelativeTime'](fiveMinsAgo)).toBe('5 minutes ago');

    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(instance['formatRelativeTime'](oneHourAgo)).toBe('1 hour ago');

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
    expect(instance['formatRelativeTime'](threeDaysAgo)).toBe('3 days ago');
  });
});
