import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ActiveAddressesChartDataPoint,
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

const ACTIVE_ADDRESSES_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'active_addresses', label: $localize`:Active addresses metric@@charts.metric.activeAddresses:Active addresses` },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-active-addresses-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './active-addresses-chart-page.component.html',
})
export class ActiveAddressesChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = ACTIVE_ADDRESSES_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<ActiveAddressesChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  private readonly currentActiveAddresses = computed<number | null>(() => {
    const withData = this.dataPoints().filter((p) => p.activeAddresses !== null);
    return withData[withData.length - 1]?.activeAddresses ?? null;
  });

  // 30-day growth rate of active addresses — a fundamentals-based network-usage trend,
  // largely uncorrelated with the valuation-ratio charts (MVRV, NVT, etc.) already in the
  // library. Rising usage historically accompanies healthy cycle expansion; stalling or
  // falling usage even as price rises is a classic late-cycle divergence warning.
  private readonly activeAddresses30dGrowthPct = computed<number | null>(() => {
    const withData = this.dataPoints().filter(
      (p): p is ActiveAddressesChartDataPoint & { activeAddresses: number } => p.activeAddresses !== null,
    );
    if (withData.length === 0) return null;

    const last = withData[withData.length - 1];
    const lastMs = new Date(`${last.date}T00:00:00Z`).getTime();
    const targetMs = lastMs - 30 * 86_400_000;
    const baseline = [...withData]
      .reverse()
      .find((p) => new Date(`${p.date}T00:00:00Z`).getTime() <= targetMs);
    if (!baseline || baseline.activeAddresses <= 0) return null;

    return ((last.activeAddresses - baseline.activeAddresses) / baseline.activeAddresses) * 100;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    const current = this.currentActiveAddresses();
    const growthPct = this.activeAddresses30dGrowthPct();
    const noData = $localize`:No data value@@common.noData:No data`;

    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: last ? formatUsd(last.priceUsd) : noData },
      { label: $localize`:Active addresses metric@@charts.metric.activeAddresses:Active addresses`, value: current !== null ? formatCount(current) : noData },
      { label: $localize`:Active addresses 30 day growth metric@@charts.metric.activeAddresses30dGrowth:30-day growth`, value: growthPct !== null ? formatSignedPercent(growthPct) : noData },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: growthPct !== null ? getActiveAddressesSignal(growthPct) : noData },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const growthPct = this.activeAddresses30dGrowthPct();
    if (growthPct === null) {
      return $localize`:Active addresses waiting interpretation@@charts.activeAddresses.interpretation.waiting:Waiting for active addresses data.`;
    }
    if (growthPct > 5) {
      return $localize`:Active addresses rising interpretation@@charts.activeAddresses.interpretation.rising:Active addresses have risen ${formatSignedPercent(growthPct)}:INTERPOLATION: over the past 30 days. Growing network usage historically accompanies healthy cycle expansion.`;
    }
    if (growthPct < -5) {
      return $localize`:Active addresses falling interpretation@@charts.activeAddresses.interpretation.falling:Active addresses have fallen ${formatSignedPercent(growthPct)}:INTERPOLATION: over the past 30 days. Declining network usage — especially alongside a rising price — is a classic late-cycle divergence warning.`;
    }
    return $localize`:Active addresses stable interpretation@@charts.activeAddresses.interpretation.stable:Active addresses have been roughly stable over the past 30 days, suggesting no major shift in network usage.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:Active addresses about@@charts.activeAddresses.about:Active Addresses counts the number of unique Bitcoin addresses that sent or received a transaction each day. It is a fundamentals-based measure of network usage and adoption, independent of the valuation-ratio charts (MVRV, NVT, etc.) elsewhere in this library. Sustained growth reflects expanding real usage; a stalling or falling count while price keeps rising is a classic divergence warning seen near past cycle tops.`;

  protected readonly infoDataSources = [
    $localize`:Active addresses data source BTC price@@charts.activeAddresses.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:Active addresses data source count@@charts.activeAddresses.dataSource.count:Active addresses: CoinMetrics Community API (AdrActCnt) — full daily history since 2009`,
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
          label: $localize`:Active addresses metric@@charts.metric.activeAddresses:Active Addresses`,
          data: points.map((p) => p.activeAddresses),
          borderColor: '#2f9e44',
          backgroundColor: '#2f9e44',
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
          text: $localize`:Active addresses axis label@@charts.axis.activeAddresses:Active Addresses`,
          color: '#4b5563',
          font: { size: 12, weight: 500 },
        },
        ticks: {
          color: '#4b5563',
          callback: (value) => formatCount(Number(value)),
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
              return `${$localize`:Active addresses metric@@charts.metric.activeAddresses:Active Addresses`}: ${formatCount(Number(item.parsed.y))}`;
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
    void this.api.recordRecentChart('active-addresses').catch(() => undefined);
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
      chartTitle: 'Bitcoin Active Addresses',
      fileName: `active-addresses_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `active-addresses_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Active addresses metric@@charts.metric.activeAddresses:Active addresses`, value: (row) => formatCsvNumber(row.activeAddresses) },
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
      const response = await this.api.getActiveAddressesChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Active addresses chart load failure@@charts.activeAddressesLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getActiveAddressesSignal(growthPct: number): string {
  if (growthPct > 5) return $localize`:Active addresses rising signal@@charts.signal.activeAddresses.rising:Rising — Growing network usage`;
  if (growthPct < -5) return $localize`:Active addresses falling signal@@charts.signal.activeAddresses.falling:Falling — Declining network usage`;
  return $localize`:Active addresses stable signal@@charts.signal.activeAddresses.stable:Stable — Neutral`;
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

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
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
