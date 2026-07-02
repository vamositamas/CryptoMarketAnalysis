import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type BtcDvolChartDataPoint,
  type ChartTimeframe,
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

const BTC_DVOL_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_dvol', label: $localize`:BTC DVOL metric@@charts.metric.btcDvol:BTC implied volatility (DVOL)` },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

// Regime bands mirror the Realized Volatility chart's thresholds — DVOL is forward-looking
// (options-implied) rather than backward-looking (realized), but read the same way: not a
// directional signal, since both tops and bottoms see elevated volatility.
const LOW_VOL_THRESHOLD = 50;
const HIGH_VOL_THRESHOLD = 90;

@Component({
  selector: 'app-btc-dvol-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './btc-dvol-chart-page.component.html',
})
export class BtcDvolChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = BTC_DVOL_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<BtcDvolChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  private readonly currentDvol = computed<number | null>(() => {
    const withData = this.dataPoints().filter((p) => p.dvol !== null);
    return withData[withData.length - 1]?.dvol ?? null;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    const dvol = this.currentDvol();
    const noData = $localize`:No data value@@common.noData:No data`;

    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: last ? formatUsd(last.priceUsd) : noData },
      { label: $localize`:BTC DVOL metric@@charts.metric.btcDvol:DVOL`, value: dvol !== null ? formatPercent(dvol) : noData },
      { label: $localize`:Regime metric@@charts.metric.regime:Regime`, value: dvol !== null ? getDvolRegime(dvol) : noData },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const dvol = this.currentDvol();
    if (dvol === null) {
      return $localize`:BTC DVOL waiting interpretation@@charts.btcDvol.interpretation.waiting:Waiting for DVOL data.`;
    }
    if (dvol < LOW_VOL_THRESHOLD) {
      return $localize`:BTC DVOL low interpretation@@charts.btcDvol.interpretation.low:DVOL is ${formatPercent(dvol)}:INTERPOLATION:, a low reading. Options markets are pricing in a calm near-term outlook — historically a precursor to larger moves once that complacency breaks.`;
    }
    if (dvol > HIGH_VOL_THRESHOLD) {
      return $localize`:BTC DVOL high interpretation@@charts.btcDvol.interpretation.high:DVOL is ${formatPercent(dvol)}:INTERPOLATION:, a high reading. Options markets are pricing in significant near-term turbulence — seen at both panic-driven bottoms and euphoric blow-off tops.`;
    }
    return $localize`:BTC DVOL normal interpretation@@charts.btcDvol.interpretation.normal:DVOL is ${formatPercent(dvol)}:INTERPOLATION:, within its typical range.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:BTC DVOL about@@charts.btcDvol.about:DVOL is Deribit's BTC implied volatility index, derived from the prices of BTC options — it reflects what options markets expect volatility to be over the coming 30 days, forward-looking rather than the backward-looking Realized Volatility chart elsewhere in this library. Like realized volatility, DVOL is not directional: both capitulation bottoms and euphoric tops show elevated readings. Note: DVOL history only goes back to Deribit's index launch on 2021-03-24, far shorter than most other charts in this library.`;

  protected readonly infoDataSources = [
    $localize`:BTC DVOL data source BTC price@@charts.btcDvol.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:BTC DVOL data source dvol@@charts.btcDvol.dataSource.dvol:Implied volatility: Deribit public API (get_volatility_index_data) — daily BTC DVOL index, history since 2021-03-24 only`,
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
          label: $localize`:BTC DVOL metric@@charts.metric.btcDvol:DVOL`,
          data: points.map((p) => p.dvol),
          borderColor: '#9c36b5',
          backgroundColor: '#9c36b5',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0,
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
        title: {
          display: true,
          text: $localize`:BTC DVOL axis label@@charts.axis.btcDvol:Implied Volatility (DVOL, %)`,
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
              return `${$localize`:BTC DVOL metric@@charts.metric.btcDvol:DVOL`}: ${formatPercent(Number(item.parsed.y))}`;
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
    void this.api.recordRecentChart('btc-dvol').catch(() => undefined);
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
      chartTitle: 'Bitcoin Implied Volatility (DVOL)',
      fileName: `btc-dvol_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `btc-dvol_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:BTC DVOL metric@@charts.metric.btcDvol:DVOL`, value: (row) => formatCsvNumber(row.dvol) },
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
      const response = await this.api.getBtcDvolChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:BTC DVOL chart load failure@@charts.btcDvolLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getDvolRegime(dvol: number): string {
  if (dvol < LOW_VOL_THRESHOLD) return $localize`:BTC DVOL low regime@@charts.signal.btcDvol.low:Low — Calm`;
  if (dvol > HIGH_VOL_THRESHOLD) return $localize`:BTC DVOL high regime@@charts.signal.btcDvol.high:High — Turbulent`;
  return $localize`:BTC DVOL normal regime@@charts.signal.btcDvol.normal:Normal — Typical range`;
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
