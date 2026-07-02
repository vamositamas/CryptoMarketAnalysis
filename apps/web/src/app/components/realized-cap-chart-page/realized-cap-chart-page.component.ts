import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type RealizedCapChartDataPoint,
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

const REALIZED_CAP_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-realized-cap-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './realized-cap-chart-page.component.html',
})
export class RealizedCapChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = REALIZED_CAP_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<RealizedCapChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  private readonly capRatio = computed<number | null>(() => {
    const last = [...this.dataPoints()].reverse().find((p) => p.marketCap !== null && p.realizedCap !== null);
    if (!last || last.realizedCap === null || last.realizedCap <= 0 || last.marketCap === null) return null;
    return last.marketCap / last.realizedCap;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const lastRcPoint = [...points].reverse().find((p) => p.realizedCap !== null);
    const marketCap = lastRcPoint?.marketCap ?? null;
    const realizedCap = lastRcPoint?.realizedCap ?? null;
    const ratio = this.capRatio();
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: formatUsd(last.priceUsd) },
      { label: $localize`:Market cap metric@@charts.metric.marketCap:Market cap`, value: marketCap !== null ? formatCompactUsd(marketCap) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:Realized cap metric@@charts.metric.realizedCap:Realized cap`, value: realizedCap !== null ? formatCompactUsd(realizedCap) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: ratio !== null ? getCapRatioSignal(ratio) : $localize`:No data value@@common.noData:No data` },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const ratio = this.capRatio();
    if (ratio === null) {
      return $localize`:Realized Cap waiting interpretation@@charts.realizedCap.interpretation.waiting:Waiting for realized cap data.`;
    }
    if (ratio > 3.5) {
      return $localize`:Realized Cap overheated interpretation@@charts.realizedCap.interpretation.overheated:Market cap trades at ${ratio.toFixed(2)}:INTERPOLATION:x realized cap. Aggregate holders are deeply in profit, a pattern historically seen in late-cycle conditions.`;
    }
    if (ratio > 2.0) {
      return $localize`:Realized Cap elevated interpretation@@charts.realizedCap.interpretation.elevated:Market cap trades at ${ratio.toFixed(2)}:INTERPOLATION:x realized cap. Most market participants are holding sizeable paper profits.`;
    }
    if (ratio >= 1.0) {
      return $localize`:Realized Cap fair interpretation@@charts.realizedCap.interpretation.fair:Market cap trades at ${ratio.toFixed(2)}:INTERPOLATION:x realized cap. The market is in aggregate profit but still close to its on-chain cost basis.`;
    }
    return $localize`:Realized Cap stress interpretation@@charts.realizedCap.interpretation.stress:Market cap trades at ${ratio.toFixed(2)}:INTERPOLATION:x realized cap. Aggregate holders are underwater, a pattern historically clustered near major cycle lows.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:Realized Cap about@@charts.realizedCap.about:Realized Cap values every coin at the price it last moved on-chain, then sums those values across circulating supply — an estimate of aggregate cost basis in dollar terms. Market Cap uses the current price instead. Comparing the two shows how far the market trades above or below the aggregate on-chain cost basis, the same relationship the MVRV Z-Score is built from, presented here as raw dollar values rather than a standardized score.`;

  protected readonly infoDataSources = [
    $localize`:Realized Cap data source BTC price@@charts.realizedCap.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:Realized Cap data source realized price@@charts.realizedCap.dataSource.realized:Realized price: stored DB values plus CoinMetrics community API history derived from PriceUSD / CapMVRVCur`,
    $localize`:Realized Cap data source calc@@charts.realizedCap.dataSource.calculation:Market cap and realized cap: price (or realized price) multiplied by circulating supply, computed by the backend`,
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'line' as const,
          label: $localize`:Market cap metric@@charts.metric.marketCap:Market Cap`,
          data: points.map((p) => p.marketCap),
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
          label: $localize`:Realized cap metric@@charts.metric.realizedCap:Realized Cap`,
          data: points.map((p) => p.realizedCap),
          borderColor: '#ff8a1f',
          backgroundColor: '#ff8a1f',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0,
          yAxisID: 'y',
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
        position: 'right',
        title: {
          display: true,
          text: $localize`:Cap USD axis label@@charts.axis.capUsd:Cap (USD)`,
          color: '#1f2933',
          font: { size: 12, weight: 500 },
        },
        ticks: {
          color: '#3f4752',
          callback: (value) => formatCompactUsd(Number(value)),
        },
        grid: { color: 'rgba(23, 32, 42, 0.08)' },
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
              return `${$localize`:Realized cap metric@@charts.metric.realizedCap:Realized Cap`}: ${formatCompactUsd(Number(item.parsed.y))}`;
            }
            return `${$localize`:Market cap metric@@charts.metric.marketCap:Market Cap`}: ${formatCompactUsd(Number(item.parsed.y))}`;
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
    void this.api.recordRecentChart('realized-cap').catch(() => undefined);
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
      chartTitle: 'Bitcoin Realized Cap',
      fileName: `realized-cap_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `realized-cap_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Market cap metric@@charts.metric.marketCap:Market cap`, value: (row) => formatCsvNumber(row.marketCap) },
        { header: $localize`:Realized cap metric@@charts.metric.realizedCap:Realized cap`, value: (row) => formatCsvNumber(row.realizedCap) },
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
      const response = await this.api.getRealizedCapChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Realized Cap chart load failure@@charts.realizedCapLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getCapRatioSignal(value: number): string {
  if (value > 3.5) return $localize`:Sell zone signal@@charts.signal.sellZone:Sell zone`;
  if (value > 2.0) return $localize`:Overvalued signal@@charts.signal.overvalued:Overvalued`;
  if (value >= 1.0) return $localize`:Fair value range@@charts.signal.fairValueRange:Fair value range`;
  return $localize`:Below realized cap signal@@charts.signal.belowRealizedCap:Below realized cap`;
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
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1000) return `$${Math.round(value / 1000)}k`;
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
