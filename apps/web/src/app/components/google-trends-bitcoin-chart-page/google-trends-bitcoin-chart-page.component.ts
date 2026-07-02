import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type GoogleTrendsBitcoinChartDataPoint,
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
  { label: $localize`:Timeframe 1 month@@charts.timeframe.1m:1 month`, value: '1m' },
  { label: $localize`:Timeframe 3 months@@charts.timeframe.3m:3 months`, value: '3m' },
  { label: $localize`:Timeframe 6 months@@charts.timeframe.6m:6 months`, value: '6m' },
  { label: $localize`:Timeframe 1 year@@charts.timeframe.1y:1 year`, value: '1y' },
  { label: $localize`:Timeframe 2 years@@charts.timeframe.2y:2 years`, value: '2y' },
  { label: $localize`:Timeframe All@@charts.timeframe.all:All`, value: 'all' },
];

const GOOGLE_TRENDS_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'google_trends_bitcoin', label: $localize`:Google Trends bitcoin search interest metric@@charts.metric.googleTrendsBitcoin:Bitcoin search interest` },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-google-trends-bitcoin-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './google-trends-bitcoin-chart-page.component.html',
})
export class GoogleTrendsBitcoinChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = GOOGLE_TRENDS_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<GoogleTrendsBitcoinChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  private readonly latestSearchInterest = computed<number | null>(() => {
    const withData = this.dataPoints().filter((p) => p.searchInterest !== null);
    return withData[withData.length - 1]?.searchInterest ?? null;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    const searchInterest = this.latestSearchInterest();
    const noData = $localize`:No data value@@common.noData:No data`;
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: last ? formatUsd(last.priceUsd) : noData },
      { label: $localize`:Google Trends bitcoin search interest metric@@charts.metric.googleTrendsBitcoin:Bitcoin search interest`, value: searchInterest !== null ? searchInterest.toFixed(0) : noData },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: searchInterest !== null ? getSearchInterestSignal(searchInterest) : noData },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const searchInterest = this.latestSearchInterest();
    if (searchInterest === null) {
      return $localize`:Google Trends waiting interpretation@@charts.googleTrendsBitcoin.interpretation.waiting:Waiting for Google Trends search interest data.`;
    }
    if (searchInterest > 75) {
      return $localize`:Google Trends euphoria interpretation@@charts.googleTrendsBitcoin.interpretation.euphoria:Worldwide "bitcoin" search interest is ${searchInterest.toFixed(0)}:INTERPOLATION:, near its all-time relative peak. Historically, spikes this high have coincided with retail-driven euphoria late in a bull cycle.`;
    }
    if (searchInterest > 40) {
      return $localize`:Google Trends elevated interpretation@@charts.googleTrendsBitcoin.interpretation.elevated:Worldwide "bitcoin" search interest is ${searchInterest.toFixed(0)}:INTERPOLATION:, moderately elevated. Retail attention is picking up but not yet at euphoric extremes.`;
    }
    return $localize`:Google Trends quiet interpretation@@charts.googleTrendsBitcoin.interpretation.quiet:Worldwide "bitcoin" search interest is ${searchInterest.toFixed(0)}:INTERPOLATION:, relatively quiet. Low retail search attention has historically been more common during accumulation phases than at cycle tops.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:Google Trends about@@charts.googleTrendsBitcoin.about:Tracks worldwide Google search interest for "bitcoin" over time, scaled 0-100 relative to the peak search volume in the selected date range. It is a classic retail-attention and euphoria proxy that complements the Fear & Greed Index — search interest tends to spike hardest when new, less-experienced participants are entering the market.`;

  protected readonly infoDataSources = [
    $localize`:Google Trends data source price@@charts.googleTrendsBitcoin.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:Google Trends data source search@@charts.googleTrendsBitcoin.dataSource.search:Search interest: Google Trends' unofficial public endpoint for the worldwide "bitcoin" search term. This endpoint is undocumented and can change or rate-limit without notice, so data may occasionally be delayed or unavailable.`,
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'line' as const,
          label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC Price`,
          data: points.map((p) => p.priceUsd),
          borderColor: '#1f2933',
          backgroundColor: '#1f2933',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0,
          yAxisID: 'y',
          order: 1,
        },
        {
          type: 'line' as const,
          label: $localize`:Google Trends bitcoin search interest metric@@charts.metric.googleTrendsBitcoin:Bitcoin Search Interest`,
          data: points.map((p) => p.searchInterest),
          borderColor: '#4285f4',
          backgroundColor: 'rgba(66, 133, 244, 0.12)',
          fill: true,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.15,
          spanGaps: true,
          yAxisID: 'y2',
          order: 2,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions>(() => ({
    animation: { duration: 280 },
    layout: {
      padding: { top: 24, right: 16, bottom: 8, left: 8 },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 10 },
        grid: { color: 'rgba(23, 32, 42, 0.08)' },
      },
      y: {
        type: 'logarithmic',
        position: 'left',
        title: {
          display: true,
          text: $localize`:BTC price USD axis label@@charts.axis.btcPriceUsd:BTC Price (USD)`,
          color: '#1f2933',
          font: { size: 12, weight: 500 },
        },
        ticks: {
          color: '#3f4752',
          callback: (value) => formatCompactUsd(Number(value)),
        },
        grid: { color: 'rgba(23, 32, 42, 0.08)' },
      },
      y2: {
        type: 'linear',
        position: 'right',
        min: 0,
        max: 100,
        title: {
          display: true,
          text: $localize`:Google Trends search interest axis label@@charts.axis.googleTrendsBitcoin:Search Interest (0-100)`,
          color: '#4285f4',
          font: { size: 12, weight: 500 },
        },
        ticks: { color: '#4285f4' },
        grid: { drawOnChartArea: false },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        align: 'start',
        labels: {
          usePointStyle: true,
          pointStyle: 'line',
          boxWidth: 28,
          boxHeight: 3,
          color: '#1f2933',
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (items) => formatDate(String(items[0]?.label ?? '')),
          label: (item) => {
            if (item.dataset.yAxisID === 'y2') {
              return `${$localize`:Google Trends bitcoin search interest metric@@charts.metric.googleTrendsBitcoin:Bitcoin Search Interest`}: ${Number(item.parsed.y).toFixed(0)}`;
            }
            return `${$localize`:BTC price metric@@charts.metric.btcPrice:BTC Price`}: ${formatUsd(Number(item.parsed.y))}`;
          },
        },
      },
      annotation: {
        annotations: {
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('google-trends-bitcoin').catch(() => undefined);
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

  protected toggleFullscreen(): void { this.chartViewer?.toggleFullscreen(); }

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
      chartTitle: 'Google Trends: Bitcoin Search Interest',
      fileName: `google-trends-bitcoin_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `google-trends-bitcoin_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Google Trends bitcoin search interest metric@@charts.metric.googleTrendsBitcoin:Bitcoin search interest`, value: (row) => formatCsvNumber(row.searchInterest) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const ts = this.lastUpdated();
    if (!ts) return $localize`:Waiting for data@@charts.waitingForData:Waiting for data`;
    return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await this.api.getGoogleTrendsBitcoinChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Google Trends chart load failure@@charts.googleTrendsBitcoinLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getSearchInterestSignal(value: number): string {
  if (value > 75) return $localize`:Retail euphoria signal@@charts.signal.googleTrendsBitcoin.euphoria:Retail euphoria`;
  if (value > 40) return $localize`:Elevated attention signal@@charts.signal.googleTrendsBitcoin.elevated:Elevated attention`;
  return $localize`:Quiet attention signal@@charts.signal.googleTrendsBitcoin.quiet:Quiet attention`;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return $localize`:No data value@@common.noData:No data`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
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
