import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type HashRateChartDataPoint,
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

const HASH_RATE_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'hash_rate', label: $localize`:Hash rate metric@@charts.metric.hashRate:Hash rate` },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-hash-rate-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './hash-rate-chart-page.component.html',
})
export class HashRateChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = HASH_RATE_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<HashRateChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  private readonly currentHashRate = computed<number | null>(() => {
    const withData = this.dataPoints().filter((p) => p.hashRate !== null);
    return withData[withData.length - 1]?.hashRate ?? null;
  });

  // 30-day growth rate of hash rate — a rising trend reflects growing miner investment and
  // network security (a long-run infrastructure-confidence signal, distinct from Hash
  // Ribbons' short-term miner-capitulation/recovery crossover signal built on the same data).
  private readonly hashRate30dGrowthPct = computed<number | null>(() => {
    const withData = this.dataPoints().filter(
      (p): p is HashRateChartDataPoint & { hashRate: number } => p.hashRate !== null,
    );
    if (withData.length === 0) return null;

    const last = withData[withData.length - 1];
    const lastMs = new Date(`${last.date}T00:00:00Z`).getTime();
    const targetMs = lastMs - 30 * 86_400_000;
    const baseline = [...withData]
      .reverse()
      .find((p) => new Date(`${p.date}T00:00:00Z`).getTime() <= targetMs);
    if (!baseline || baseline.hashRate <= 0) return null;

    return ((last.hashRate - baseline.hashRate) / baseline.hashRate) * 100;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    const currentHashRate = this.currentHashRate();
    const growthPct = this.hashRate30dGrowthPct();
    const noData = $localize`:No data value@@common.noData:No data`;

    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: last ? formatUsd(last.priceUsd) : noData },
      { label: $localize`:Hash rate metric@@charts.metric.hashRate:Hash rate`, value: currentHashRate !== null ? formatHashRate(currentHashRate) : noData },
      { label: $localize`:Hash rate 30 day growth metric@@charts.metric.hashRate30dGrowth:30-day growth`, value: growthPct !== null ? formatSignedPercent(growthPct) : noData },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: growthPct !== null ? getHashRateSignal(growthPct) : noData },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const growthPct = this.hashRate30dGrowthPct();
    if (growthPct === null) {
      return $localize`:Hash rate waiting interpretation@@charts.hashRate.interpretation.waiting:Waiting for hash rate data.`;
    }
    if (growthPct > 2) {
      return $localize`:Hash rate rising interpretation@@charts.hashRate.interpretation.rising:Hash rate has risen ${formatSignedPercent(growthPct)}:INTERPOLATION: over the past 30 days. A rising hash rate reflects growing miner investment and network security, historically associated with long-term confidence in the network.`;
    }
    if (growthPct < -2) {
      return $localize`:Hash rate falling interpretation@@charts.hashRate.interpretation.falling:Hash rate has fallen ${formatSignedPercent(growthPct)}:INTERPOLATION: over the past 30 days. A falling hash rate can reflect miner capitulation — unprofitable miners powering down — often coinciding with local price bottoms once the weakest miners have exited.`;
    }
    return $localize`:Hash rate stable interpretation@@charts.hashRate.interpretation.stable:Hash rate has been roughly stable over the past 30 days, suggesting no major shift in miner participation.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:Hash rate about@@charts.hashRate.about:Hash Rate measures the total computational power securing the Bitcoin network. It complements the existing Hash Ribbons and Puell Multiple charts (both derived from this same series) by showing the raw underlying trend rather than a moving-average crossover or a revenue ratio. A steadily rising hash rate reflects growing miner investment and network security; sharp drops typically mark miner capitulation events.`;

  protected readonly infoDataSources = [
    $localize`:Hash rate data source BTC price@@charts.hashRate.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:Hash rate data source hash rate@@charts.hashRate.dataSource.hashRate:Hash rate: Blockchain.info charts API — full daily history since 2009`,
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
          label: $localize`:Hash rate metric@@charts.metric.hashRate:Hash Rate`,
          data: points.map((p) => p.hashRate),
          borderColor: '#ff8a1f',
          backgroundColor: '#ff8a1f',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0,
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
        type: 'logarithmic',
        position: 'right',
        title: {
          display: true,
          text: $localize`:Hash rate axis label@@charts.axis.hashRate:Hash Rate (EH/s)`,
          color: '#4b5563',
          font: { size: 12, weight: 500 },
        },
        ticks: {
          color: '#4b5563',
          callback: (value) => formatHashRate(Number(value)),
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
              return `${$localize`:Hash rate metric@@charts.metric.hashRate:Hash Rate`}: ${formatHashRate(Number(item.parsed.y))}`;
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
    void this.api.recordRecentChart('hash-rate').catch(() => undefined);
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
      chartTitle: 'Bitcoin Hash Rate',
      fileName: `hash-rate_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `hash-rate_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Hash rate metric@@charts.metric.hashRate:Hash rate`, value: (row) => formatCsvNumber(row.hashRate) },
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
      const response = await this.api.getHashRateChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Hash rate chart load failure@@charts.hashRateLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getHashRateSignal(growthPct: number): string {
  if (growthPct > 2) return $localize`:Hash rate rising signal@@charts.signal.hashRate.rising:Rising — Growing network security`;
  if (growthPct < -2) return $localize`:Hash rate falling signal@@charts.signal.hashRate.falling:Falling — Possible miner capitulation`;
  return $localize`:Hash rate stable signal@@charts.signal.hashRate.stable:Stable — Neutral`;
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

// Hash rate is stored in TH/s (the unit Blockchain.info's API returns); displayed in EH/s
// (1 EH/s = 1,000,000 TH/s), the unit BTC network hash rate is conventionally reported in.
function formatHashRate(value: number): string {
  if (!Number.isFinite(value)) return '';
  const eh = value / 1_000_000;
  return `${eh.toLocaleString('en-US', { maximumFractionDigits: eh >= 100 ? 0 : 1 })} EH/s`;
}

function formatSignedPercent(value: number): string {
  if (!Number.isFinite(value)) return '';
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
