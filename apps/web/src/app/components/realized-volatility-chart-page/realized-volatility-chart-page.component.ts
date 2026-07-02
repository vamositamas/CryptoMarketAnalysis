import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type RealizedVolatilityChartDataPoint,
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

const REALIZED_VOLATILITY_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'realized_volatility_30d', label: $localize`:Realized volatility 30 day metric@@charts.metric.realizedVolatility30d:30-day realized volatility` },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

// Regime bands, not a directional buy/sell signal — both cycle tops and bottoms show high
// realized volatility, so magnitude alone can't say which; low volatility ("compression")
// instead tends to precede a large move in either direction.
const LOW_VOL_THRESHOLD = 40;
const HIGH_VOL_THRESHOLD = 80;

@Component({
  selector: 'app-realized-volatility-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './realized-volatility-chart-page.component.html',
})
export class RealizedVolatilityChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = REALIZED_VOLATILITY_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<RealizedVolatilityChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  private readonly currentVolatility30d = computed<number | null>(() => {
    const withData = this.dataPoints().filter((p) => p.volatility30d !== null);
    return withData[withData.length - 1]?.volatility30d ?? null;
  });

  private readonly currentVolatility90d = computed<number | null>(() => {
    const withData = this.dataPoints().filter((p) => p.volatility90d !== null);
    return withData[withData.length - 1]?.volatility90d ?? null;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    const vol30 = this.currentVolatility30d();
    const vol90 = this.currentVolatility90d();
    const noData = $localize`:No data value@@common.noData:No data`;

    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: last ? formatUsd(last.priceUsd) : noData },
      { label: $localize`:Realized volatility 30 day metric@@charts.metric.realizedVolatility30d:30-day realized volatility`, value: vol30 !== null ? formatPercent(vol30) : noData },
      { label: $localize`:Realized volatility 90 day metric@@charts.metric.realizedVolatility90d:90-day realized volatility`, value: vol90 !== null ? formatPercent(vol90) : noData },
      { label: $localize`:Regime metric@@charts.metric.regime:Regime`, value: vol30 !== null ? getVolatilityRegime(vol30) : noData },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const vol30 = this.currentVolatility30d();
    if (vol30 === null) {
      return $localize`:Realized volatility waiting interpretation@@charts.realizedVolatility.interpretation.waiting:Waiting for realized volatility data.`;
    }
    if (vol30 < LOW_VOL_THRESHOLD) {
      return $localize`:Realized volatility low interpretation@@charts.realizedVolatility.interpretation.low:30-day realized volatility is ${formatPercent(vol30)}:INTERPOLATION:, a low reading for Bitcoin. Volatility compression like this has historically preceded large moves in either direction — it is a "get ready" signal, not a directional one.`;
    }
    if (vol30 > HIGH_VOL_THRESHOLD) {
      return $localize`:Realized volatility high interpretation@@charts.realizedVolatility.interpretation.high:30-day realized volatility is ${formatPercent(vol30)}:INTERPOLATION:, a high reading for Bitcoin. Elevated volatility marks turbulent conditions and shows up at both capitulation bottoms and euphoric tops — check price trend and other charts in this library to tell which.`;
    }
    return $localize`:Realized volatility normal interpretation@@charts.realizedVolatility.interpretation.normal:30-day realized volatility is ${formatPercent(vol30)}:INTERPOLATION:, within Bitcoin's typical historical range.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:Realized volatility about@@charts.realizedVolatility.about:Realized Volatility measures how much BTC's price has actually swung, expressed as an annualized standard deviation of daily log returns over trailing 30-day and 90-day windows. Unlike the valuation-ratio charts elsewhere in this library, volatility is not directional — both cycle tops and capitulation bottoms show elevated readings. Its main use is spotting compression (unusually low volatility), which has historically preceded large moves in either direction.`;

  protected readonly infoDataSources = [
    $localize`:Realized volatility data source@@charts.realizedVolatility.dataSource.price:Bitcoin price: CoinGecko API via backend price history. Volatility is computed entirely from this existing price series — no separate external data source is required.`,
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
          label: $localize`:Realized volatility 30 day metric@@charts.metric.realizedVolatility30d:30-day realized volatility`,
          data: points.map((p) => p.volatility30d),
          borderColor: '#e8590c',
          backgroundColor: '#e8590c',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0,
          yAxisID: 'y2',
          order: 2,
        },
        {
          type: 'line' as const,
          label: $localize`:Realized volatility 90 day metric@@charts.metric.realizedVolatility90d:90-day realized volatility`,
          data: points.map((p) => p.volatility90d),
          borderColor: '#f08c00',
          backgroundColor: '#f08c00',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0,
          borderDash: [4, 3],
          yAxisID: 'y2',
          order: 3,
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
        title: {
          display: true,
          text: $localize`:Realized volatility axis label@@charts.axis.realizedVolatility:Annualized Volatility (%)`,
          color: '#4b5563',
          font: { size: 12, weight: 500 },
        },
        ticks: {
          color: '#4b5563',
          callback: (value) => formatPercent(Number(value)),
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
              return `${item.dataset.label}: ${formatPercent(Number(item.parsed.y))}`;
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
    void this.api.recordRecentChart('realized-volatility').catch(() => undefined);
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
      chartTitle: 'Bitcoin Realized Volatility',
      fileName: `realized-volatility_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `realized-volatility_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Realized volatility 30 day metric@@charts.metric.realizedVolatility30d:30-day realized volatility`, value: (row) => formatCsvNumber(row.volatility30d) },
        { header: $localize`:Realized volatility 90 day metric@@charts.metric.realizedVolatility90d:90-day realized volatility`, value: (row) => formatCsvNumber(row.volatility90d) },
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
      const response = await this.api.getRealizedVolatilityChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Realized volatility chart load failure@@charts.realizedVolatilityLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getVolatilityRegime(vol30: number): string {
  if (vol30 < LOW_VOL_THRESHOLD) return $localize`:Realized volatility low regime@@charts.signal.realizedVolatility.low:Low — Compression`;
  if (vol30 > HIGH_VOL_THRESHOLD) return $localize`:Realized volatility high regime@@charts.signal.realizedVolatility.high:High — Turbulent`;
  return $localize`:Realized volatility normal regime@@charts.signal.realizedVolatility.normal:Normal — Typical range`;
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

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '';
  return `${value.toFixed(1)}%`;
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
