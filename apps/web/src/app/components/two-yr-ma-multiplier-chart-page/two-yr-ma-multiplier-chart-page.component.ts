import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type TwoYrMaMultiplierDataPoint,
} from '@crypto-market-analysis/data-access/api-client';
import { ChartViewerComponent } from '../chart-viewer/chart-viewer.component';
import { ChartAnnotationsComponent } from '../chart-annotations/chart-annotations.component';
import {
  exportChartCsv,
  exportChartPng,
  formatCsvNumber,
  getExportDateStamp,
} from '../chart-export/chart-export.util';
import {
  ChartInfoPanelComponent,
  type ChartInfoField,
} from '../chart-info-panel/chart-info-panel.component';
import { parseChartTimeframe } from '../chart-timeframe/chart-timeframe-url.util';
import { ChartFavouriteButtonComponent } from '../chart-favourite-button/chart-favourite-button.component';
import {
  CreateAlertModalComponent,
  type AlertMetricOption,
} from '../create-alert-modal/create-alert-modal.component';

interface TimeframeOption {
  label: string;
  value: ChartTimeframe;
}

const TIMEFRAMES: TimeframeOption[] = [
  { label: '1 hó', value: '1m' },
  { label: '3 hó', value: '3m' },
  { label: '6 hó', value: '6m' },
  { label: '1 év', value: '1y' },
  { label: '2 év', value: '2y' },
  { label: 'Mind', value: 'all' },
];

const HALVING_EVENTS = [
  { date: '2012-11-28', label: '2012 felezés' },
  { date: '2016-07-09', label: '2016 felezés' },
  { date: '2020-05-11', label: '2020 felezés' },
  { date: '2024-04-19', label: '2024 felezés' },
];

const TWO_YR_MA_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: 'BTC ár USD' },
];

@Component({
  selector: 'app-two-yr-ma-multiplier-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './two-yr-ma-multiplier-chart-page.component.html',
})
export class TwoYrMaMultiplierChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = TWO_YR_MA_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<TwoYrMaMultiplierDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const price = last.priceUsd;
    const ma = last.ma730;
    const ma5 = last.ma730x5;
    const signal =
      ma !== null && price < ma
        ? 'Buy Zone (Below 2yr MA)'
        : ma5 !== null && price > ma5
          ? 'Sell Zone (Above 2yr MA×5)'
          : 'Semleges';
    const distancePct =
      ma !== null && ma > 0
        ? ((price / ma) - 1) * 100
        : null;
    return [
      { label: 'BTC ár', value: formatUsd(price) },
      { label: '2yr MA', value: ma !== null ? formatUsd(ma) : 'Nincs adat' },
      { label: '2yr MA × 5', value: ma5 !== null ? formatUsd(ma5) : 'Nincs adat' },
      { label: 'Jelzés', value: signal },
      {
        label: 'Távolság az MA-tól',
        value:
          distancePct !== null
            ? `${distancePct > 0 ? '+' : ''}${distancePct.toFixed(1)}% ${distancePct >= 0 ? 'above' : 'below'} 2yr MA`
            : 'Nincs adat',
      },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return 'Adatra vár.';
    const price = last.priceUsd;
    const ma = last.ma730;
    const ma5 = last.ma730x5;
    if (ma === null) return '2-year moving average not yet available (requires 730 days of data).';
    if (price < ma) {
      return `BTC price ($${price.toLocaleString()}) is below the 2yr MA ($${ma.toLocaleString('en-US', { maximumFractionDigits: 0 })}). Historically this is a strong accumulation zone.`;
    }
    if (ma5 !== null && price > ma5) {
      return `BTC price ($${price.toLocaleString()}) is above the 2yr MA × 5 ($${ma5.toLocaleString('en-US', { maximumFractionDigits: 0 })}). Historically this signals overheated market conditions.`;
    }
    const ratio = price / ma;
    return `BTC price is ${ratio.toFixed(2)}× the 2yr MA. The market is in the neutral zone between accumulation (below MA) and overheating (above MA×5).`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'The 2-Year MA Multiplier highlights periods where buying or selling Bitcoin has historically produced outsized returns. ' +
    'When price drops below the 2-year moving average (green), it signals an attractive accumulation zone. ' +
    'When price rises above the 2yr MA × 5 (red), it has historically signalled overheated market conditions.';

  protected readonly infoDataSources = [
    'BTC Price: CoinGecko (stored daily)',
    '2yr MA: 730-day rolling average computed on-demand',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        // 2yr MA x5 — red, solid, thick
        {
          type: 'line' as const,
          label: '2yr MA × 5',
          data: points.map((p) => p.ma730x5),
          borderColor: '#ef4444',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 5,
          spanGaps: false,
        },
        // 2yr MA x4 — lighter red
        {
          type: 'line' as const,
          label: '2yr MA × 4',
          data: points.map((p) => p.ma730x4),
          borderColor: 'rgba(239, 68, 68, 0.55)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 5,
          spanGaps: false,
        },
        // 2yr MA x3 — lighter red
        {
          type: 'line' as const,
          label: '2yr MA × 3',
          data: points.map((p) => p.ma730x3),
          borderColor: 'rgba(239, 68, 68, 0.35)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 5,
          spanGaps: false,
        },
        // 2yr MA x2 — lightest red
        {
          type: 'line' as const,
          label: '2yr MA × 2',
          data: points.map((p) => p.ma730x2),
          borderColor: 'rgba(239, 68, 68, 0.2)',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 5,
          spanGaps: false,
        },
        // 2yr MA — green, solid, thick
        {
          type: 'line' as const,
          label: '2 Year Moving Average',
          data: points.map((p) => p.ma730),
          borderColor: '#22c55e',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 3,
          spanGaps: false,
        },
        // BTC Price — black line, thin, on top
        {
          type: 'line' as const,
          label: 'BTC ár',
          data: points.map((p) => p.priceUsd),
          borderColor: '#1f2937',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 1,
          spanGaps: false,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions>(() => ({
    animation: { duration: 280 },
    scales: {
      x: {
        ticks: { maxTicksLimit: 12, color: '#6b7280' },
        grid: { color: 'rgba(0,0,0,0.06)' },
      },
      y: {
        type: 'logarithmic',
        position: 'right',
        ticks: {
          callback: (value) => {
            const v = Number(value);
            if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
            if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
            if (v >= 1) return `$${v.toFixed(0)}`;
            return `$${v.toFixed(2)}`;
          },
          color: '#6b7280',
        },
        grid: { color: 'rgba(0,0,0,0.06)' },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          title: (items) => formatDate(String(items[0]?.label ?? '')),
          label: (item) => {
            const v = Number(item.parsed.y);
            const label = item.dataset.label ?? '';
            return `${label}: ${formatUsd(v)}`;
          },
        },
      },
      annotation: {
        annotations: {
          ...createHalvingAnnotations(this.dataPoints()[0]?.date ?? '2010-07-01'),
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('2yr-ma-multiplier').catch(() => undefined);
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const requested = params.get('timeframe');
      const timeframe = parseChartTimeframe(requested);
      if (requested !== timeframe) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { timeframe },
          replaceUrl: true,
        });
        return;
      }
      void this.loadChartData(timeframe);
    });
  }

  ngAfterViewInit(): void {
    void this.chartAnnotations?.load();
  }

  protected resetZoom(): void {
    this.chartViewer?.resetZoom();
  }

  protected zoomIn(): void {
    this.chartViewer?.zoomIn();
  }

  protected zoomOut(): void {
    this.chartViewer?.zoomOut();
  }

  protected selectTimeframe(timeframe: ChartTimeframe): void {
    if (this.selectedTimeframe() === timeframe || this.isLoading()) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { timeframe } });
  }

  protected toggleInfo(): void {
    this.infoOpen.update((v) => !v);
  }

  protected openAlertModal(): void {
    this.showAlertModal.set(true);
  }

  protected closeAlertModal(): void {
    this.showAlertModal.set(false);
  }

  protected toggleExportMenu(): void {
    this.exportMenuOpen.update((v) => !v);
  }

  protected updateUserAnnotations(annotations: Record<string, AnnotationOptions>): void {
    this.userAnnotations.set(annotations);
  }

  protected handleChartPoint(
    point: Parameters<ChartAnnotationsComponent['handleChartPoint']>[0],
  ): void {
    this.chartAnnotations?.handleChartPoint(point);
  }

  protected async exportPng(): Promise<void> {
    const chartImageDataUrl = this.chartViewer?.exportImage();
    if (!chartImageDataUrl) return;
    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl,
      chartTitle: '2 éves MA szorzó',
      fileName: `2yr-ma-multiplier_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `2yr-ma-multiplier_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Dátum', value: (row) => row.date },
        { header: 'Ár USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: '2yr MA', value: (row) => formatCsvNumber(row.ma730) },
        { header: '2yr MA × 2', value: (row) => formatCsvNumber(row.ma730x2) },
        { header: '2yr MA × 3', value: (row) => formatCsvNumber(row.ma730x3) },
        { header: '2yr MA × 4', value: (row) => formatCsvNumber(row.ma730x4) },
        { header: '2yr MA × 5', value: (row) => formatCsvNumber(row.ma730x5) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const ts = this.lastUpdated();
    if (!ts) return 'Adatra vár';
    return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await this.api.getTwoYrMaMultiplierChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : 'Chart data could not be loaded. Please try again.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function createHalvingAnnotations(startDate: string): Record<string, AnnotationOptions> {
  return Object.fromEntries(
    HALVING_EVENTS
      .filter((event) => event.date >= startDate)
      .map((event) => [
        `halving_${event.date}`,
        {
          type: 'line',
          xMin: event.date,
          xMax: event.date,
          borderColor: 'rgba(107, 114, 128, 0.55)',
          borderDash: [4, 5],
          borderWidth: 1.5,
          label: {
            display: true,
            content: event.label,
            position: 'start',
            backgroundColor: 'rgba(55, 65, 81, 0.88)',
            color: '#fff',
            font: { size: 9, weight: 'bold' as const },
            padding: { x: 4, y: 2 },
          },
        } as AnnotationOptions,
      ]),
  );
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return 'nincs adat';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
