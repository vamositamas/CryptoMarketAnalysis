import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type ExchangeNetflowChartDataPoint,
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

const EXCHANGE_NETFLOW_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'exchange_netflow', label: $localize`:Exchange netflow metric@@charts.metric.exchangeNetflow:Exchange netflow` },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-exchange-netflow-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './exchange-netflow-chart-page.component.html',
})
export class ExchangeNetflowChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = EXCHANGE_NETFLOW_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<ExchangeNetflowChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  private readonly currentNetflow = computed<number | null>(() => {
    const withData = this.dataPoints().filter((p) => p.exchangeNetflow !== null);
    return withData[withData.length - 1]?.exchangeNetflow ?? null;
  });

  // Trailing 7-day average of daily netflow — smooths single-day noise (e.g. one large
  // whale deposit) while still reacting far faster than the cumulative Exchange Reserve
  // chart. Sign alone drives the signal: positive means more coins moving onto exchanges
  // net of the period (bearish); negative means net withdrawals (bullish).
  private readonly netflow7dAvg = computed<number | null>(() => {
    const withData = this.dataPoints().filter(
      (p): p is ExchangeNetflowChartDataPoint & { exchangeNetflow: number } => p.exchangeNetflow !== null,
    );
    if (withData.length === 0) return null;

    const last = withData[withData.length - 1];
    const lastMs = new Date(`${last.date}T00:00:00Z`).getTime();
    const windowStartMs = lastMs - 6 * 86_400_000;
    const windowPoints = withData.filter(
      (p) => new Date(`${p.date}T00:00:00Z`).getTime() >= windowStartMs,
    );
    if (windowPoints.length === 0) return null;

    return windowPoints.reduce((sum, p) => sum + p.exchangeNetflow, 0) / windowPoints.length;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    const currentNetflow = this.currentNetflow();
    const avg7d = this.netflow7dAvg();
    const noData = $localize`:No data value@@common.noData:No data`;

    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: last ? formatUsd(last.priceUsd) : noData },
      { label: $localize`:Exchange netflow metric@@charts.metric.exchangeNetflow:Exchange netflow`, value: currentNetflow !== null ? formatNetflowBtc(currentNetflow) : noData },
      { label: $localize`:Exchange netflow 7 day average metric@@charts.metric.exchangeNetflowAvg7d:7-day average`, value: avg7d !== null ? formatNetflowBtc(avg7d) : noData },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: avg7d !== null ? getExchangeNetflowSignal(avg7d) : noData },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const avg7d = this.netflow7dAvg();
    if (avg7d === null) {
      return $localize`:Exchange netflow waiting interpretation@@charts.exchangeNetflow.interpretation.waiting:Waiting for exchange netflow data.`;
    }
    if (avg7d > 0) {
      return $localize`:Exchange netflow inflow interpretation@@charts.exchangeNetflow.interpretation.inflow:Exchange netflow has averaged ${formatNetflowBtc(avg7d)}:INTERPOLATION: per day over the past 7 days. A positive netflow means more coins are moving onto exchanges than off, historically associated with increasing selling pressure and decreasing scarcity — a bearish signal.`;
    }
    if (avg7d < 0) {
      return $localize`:Exchange netflow outflow interpretation@@charts.exchangeNetflow.interpretation.outflow:Exchange netflow has averaged ${formatNetflowBtc(avg7d)}:INTERPOLATION: per day over the past 7 days. A negative netflow means more coins are being withdrawn from exchanges than deposited, historically associated with accumulation and increasing scarcity — a bullish signal.`;
    }
    return $localize`:Exchange netflow neutral interpretation@@charts.exchangeNetflow.interpretation.neutral:Exchange netflow has been roughly balanced over the past 7 days, suggesting no strong shift in aggregate selling or accumulation pressure.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:Exchange netflow about@@charts.exchangeNetflow.about:Exchange Netflow measures the daily difference between coins deposited onto and withdrawn from known exchange wallets. It is the leading edge of the cumulative Exchange Reserve trend — sudden whale deposits or withdrawals show up here immediately, before they move the aggregate reserve level. Positive netflow (net inflow) signals coins becoming available for sale (bearish); negative netflow (net outflow) signals coins leaving exchanges for private custody (bullish).`;

  protected readonly infoDataSources = [
    $localize`:Exchange netflow data source BTC price@@charts.exchangeNetflow.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:Exchange netflow data source netflow@@charts.exchangeNetflow.dataSource.netflow:Exchange netflow: CoinMetrics Community API (FlowInExNtv minus FlowOutExNtv) — daily net BTC flow into known exchange wallets, full history since 2011`,
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'bar' as const,
          label: $localize`:Exchange netflow metric@@charts.metric.exchangeNetflow:Exchange Netflow`,
          data: points.map((p) => p.exchangeNetflow),
          backgroundColor: points.map((p) => getNetflowBarColor(p.exchangeNetflow)),
          borderWidth: 0,
          barPercentage: 0.9,
          categoryPercentage: 1.0,
          yAxisID: 'y2',
          order: 2,
        },
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
        title: {
          display: true,
          text: $localize`:Exchange netflow axis label@@charts.axis.exchangeNetflow:Exchange Netflow (BTC/day)`,
          color: '#4b5563',
          font: { size: 12, weight: 500 },
        },
        ticks: {
          color: '#4b5563',
          callback: (value) => formatNetflowBtc(Number(value)),
        },
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
        callbacks: {
          title: (items) => formatDate(String(items[0]?.label ?? '')),
          label: (item) => {
            if (item.dataset.yAxisID === 'y2') {
              return `${$localize`:Exchange netflow metric@@charts.metric.exchangeNetflow:Exchange Netflow`}: ${formatNetflowBtc(Number(item.parsed.y))}`;
            }
            return `${$localize`:BTC price metric@@charts.metric.btcPrice:BTC Price`}: ${formatUsd(Number(item.parsed.y))}`;
          },
        },
      },
      annotation: {
        annotations: {
          zeroLine: {
            type: 'line' as const,
            yMin: 0,
            yMax: 0,
            yScaleID: 'y2',
            borderColor: 'rgba(75,85,99,0.4)',
            borderWidth: 1,
            borderDash: [4, 4],
          },
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('exchange-netflow').catch(() => undefined);
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
      chartTitle: 'Bitcoin Exchange Netflow',
      fileName: `exchange-netflow_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `exchange-netflow_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Exchange netflow metric@@charts.metric.exchangeNetflow:Exchange netflow`, value: (row) => formatCsvNumber(row.exchangeNetflow) },
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
      const response = await this.api.getExchangeNetflowChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Exchange netflow chart load failure@@charts.exchangeNetflowLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getExchangeNetflowSignal(avg7d: number): string {
  if (avg7d > 0) return $localize`:Net inflow selling pressure signal@@charts.signal.exchangeNetflow.inflow:Net Inflow — Selling pressure`;
  if (avg7d < 0) return $localize`:Net outflow accumulation signal@@charts.signal.exchangeNetflow.outflow:Net Outflow — Accumulation`;
  return $localize`:Balanced neutral signal@@charts.signal.exchangeNetflow.neutral:Balanced — Neutral`;
}

function getNetflowBarColor(value: number | null): string {
  if (value === null || value === 0) return 'rgba(107,114,128,0.7)';
  return value > 0 ? 'rgba(220,38,38,0.75)' : 'rgba(22,163,74,0.75)';
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

function formatNetflowBtc(value: number): string {
  if (!Number.isFinite(value)) return '';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M BTC`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K BTC`;
  return `${sign}${abs.toFixed(0)} BTC`;
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
