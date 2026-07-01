import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type ExchangeReserveChartDataPoint,
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

const EXCHANGE_RESERVE_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'exchange_reserve', label: $localize`:Exchange reserve metric@@charts.metric.exchangeReserve:Exchange reserve` },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

const TREND_THRESHOLD_PCT = 2;

@Component({
  selector: 'app-exchange-reserve-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './exchange-reserve-chart-page.component.html',
})
export class ExchangeReserveChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = EXCHANGE_RESERVE_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<ExchangeReserveChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  // Percent change in exchange reserve over the trailing ~30 days — the basis for the
  // trend signal. Per the metric's standard interpretation: rising reserves imply more
  // coins available for sale (bearish); falling reserves imply accumulation/scarcity (bullish).
  private readonly trend30d = computed<number | null>(() => {
    const withData = this.dataPoints().filter(
      (p): p is ExchangeReserveChartDataPoint & { exchangeReserve: number } => p.exchangeReserve !== null,
    );
    if (withData.length < 2) return null;

    const last = withData[withData.length - 1];
    const lastMs = new Date(`${last.date}T00:00:00Z`).getTime();
    const targetMs = lastMs - 30 * 86_400_000;

    let reference = withData[0];
    for (const point of withData) {
      if (new Date(`${point.date}T00:00:00Z`).getTime() <= targetMs) {
        reference = point;
      } else {
        break;
      }
    }

    if (reference === last || reference.exchangeReserve <= 0) return null;
    return ((last.exchangeReserve - reference.exchangeReserve) / reference.exchangeReserve) * 100;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    const lastErPoint = [...points].reverse().find((p) => p.exchangeReserve !== null);
    const exchangeReserve = lastErPoint?.exchangeReserve ?? null;
    const trend = this.trend30d();
    const noData = $localize`:No data value@@common.noData:No data`;

    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: last ? formatUsd(last.priceUsd) : noData },
      { label: $localize`:Exchange reserve metric@@charts.metric.exchangeReserve:Exchange reserve`, value: exchangeReserve !== null ? formatBtc(exchangeReserve) : noData },
      { label: $localize`:Exchange reserve 30 day trend metric@@charts.metric.exchangeReserveTrend30d:30-day trend`, value: trend !== null ? formatPercent(trend) : noData },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: trend !== null ? getExchangeReserveSignal(trend) : noData },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const trend = this.trend30d();
    if (trend === null) {
      return $localize`:Exchange reserve waiting interpretation@@charts.exchangeReserve.interpretation.waiting:Waiting for exchange reserve data.`;
    }
    if (trend > TREND_THRESHOLD_PCT) {
      return $localize`:Exchange reserve rising interpretation@@charts.exchangeReserve.interpretation.rising:Exchange reserves have risen ${trend.toFixed(1)}:INTERPOLATION:% over the past 30 days. A rising reserve means more coins are moving onto exchanges and becoming available for sale, historically associated with increasing selling pressure and decreasing scarcity — a bearish signal.`;
    }
    if (trend < -TREND_THRESHOLD_PCT) {
      return $localize`:Exchange reserve falling interpretation@@charts.exchangeReserve.interpretation.falling:Exchange reserves have fallen ${Math.abs(trend).toFixed(1)}:INTERPOLATION:% over the past 30 days. A falling reserve means coins are being withdrawn from exchanges into private custody, historically associated with accumulation and increasing scarcity — a bullish signal.`;
    }
    return $localize`:Exchange reserve stable interpretation@@charts.exchangeReserve.interpretation.stable:Exchange reserves have been roughly stable over the past 30 days, suggesting no strong shift in aggregate selling or accumulation pressure.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:Exchange reserve about@@charts.exchangeReserve.about:Exchange Reserve tracks the total quantity of BTC held in wallets controlled by exchanges — the accumulated result of exchange in/outflows. A rising reserve signals more coins are available for sale (bearish); a falling reserve signals coins are leaving exchanges for private custody, implying accumulation and increasing scarcity (bullish).`;

  protected readonly infoDataSources = [
    $localize`:Exchange reserve data source BTC price@@charts.exchangeReserve.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:Exchange reserve data source reserve@@charts.exchangeReserve.dataSource.reserve:Exchange reserve: CoinMetrics Community API (SplyExNtv) — aggregate BTC supply held in known exchange wallets, full history since 2011`,
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
          order: 2,
        },
        {
          type: 'line' as const,
          label: $localize`:Exchange reserve metric@@charts.metric.exchangeReserve:Exchange Reserve`,
          data: points.map((p) => p.exchangeReserve),
          borderColor: '#7c3aed',
          backgroundColor: '#7c3aed',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0.1,
          yAxisID: 'y2',
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
          text: $localize`:Exchange reserve axis label@@charts.axis.exchangeReserve:Exchange Reserve (BTC)`,
          color: '#7c3aed',
          font: { size: 12, weight: 500 },
        },
        ticks: {
          color: '#7c3aed',
          callback: (value) => formatBtc(Number(value)),
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
            if (item.datasetIndex === 1) {
              return `${$localize`:Exchange reserve metric@@charts.metric.exchangeReserve:Exchange Reserve`}: ${formatBtc(Number(item.parsed.y))}`;
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
    void this.api.recordRecentChart('exchange-reserve').catch(() => undefined);
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
      chartTitle: 'Bitcoin Exchange Reserve',
      fileName: `exchange-reserve_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `exchange-reserve_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Exchange reserve metric@@charts.metric.exchangeReserve:Exchange reserve`, value: (row) => formatCsvNumber(row.exchangeReserve) },
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
      const response = await this.api.getExchangeReserveChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Exchange reserve chart load failure@@charts.exchangeReserveLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getExchangeReserveSignal(trend: number): string {
  if (trend > TREND_THRESHOLD_PCT) return $localize`:Rising selling pressure signal@@charts.signal.exchangeReserve.rising:Rising — Selling pressure`;
  if (trend < -TREND_THRESHOLD_PCT) return $localize`:Falling accumulation signal@@charts.signal.exchangeReserve.falling:Falling — Accumulation`;
  return $localize`:Stable neutral signal@@charts.signal.exchangeReserve.stable:Stable — Neutral`;
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

function formatBtc(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M BTC`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K BTC`;
  return `${value.toFixed(0)} BTC`;
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
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
