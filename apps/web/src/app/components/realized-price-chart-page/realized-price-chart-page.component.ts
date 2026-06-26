import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type RealizePriceChartDataPoint,
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

const REALIZED_PRICE_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'realized_price', label: $localize`:Realized price USD metric@@charts.metric.realizedPriceUsd:Realized price USD` },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-realized-price-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './realized-price-chart-page.component.html',
})
export class RealizePriceChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = REALIZED_PRICE_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<RealizePriceChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const lastRpPoint = [...points].reverse().find((p) => p.realizedPrice !== null);
    const rp = lastRpPoint?.realizedPrice ?? null;
    const mvrv = lastRpPoint?.mvrvRatio ?? null;
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: formatUsd(last.priceUsd) },
      { label: $localize`:Realized price metric@@charts.metric.realizedPrice:Realized price`, value: rp !== null ? formatUsd(rp) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:MVRV ratio metric@@charts.metric.mvrvRatio:MVRV ratio`, value: mvrv !== null ? mvrv.toFixed(2) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: mvrv !== null ? getMvrvSignal(mvrv) : $localize`:No data value@@common.noData:No data` },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const lastRpPoint = [...points].reverse().find((p) => p.mvrvRatio !== null);
    const mvrv = lastRpPoint?.mvrvRatio ?? null;
    if (mvrv === null) {
      return $localize`:Realized Price waiting interpretation@@charts.realizedPrice.interpretation.waiting:Waiting for realized price data to compute the MVRV ratio.`;
    }
    if (mvrv > 3.5) {
      return $localize`:Realized Price overheated interpretation@@charts.realizedPrice.interpretation.overheated:MVRV Ratio is ${mvrv.toFixed(2)}:INTERPOLATION:. Market price is far above realized price, so aggregate holders are deeply in profit; historically this has appeared in late-cycle conditions.`;
    }
    if (mvrv > 2.0) {
      return $localize`:Realized Price elevated interpretation@@charts.realizedPrice.interpretation.elevated:MVRV Ratio is ${mvrv.toFixed(2)}:INTERPOLATION:. Price is meaningfully above the aggregate on-chain cost basis, so most market participants are holding paper profits.`;
    }
    if (mvrv >= 1.0) {
      return $localize`:Realized Price fair interpretation@@charts.realizedPrice.interpretation.fair:MVRV Ratio is ${mvrv.toFixed(2)}:INTERPOLATION:. BTC trades above realized price, meaning the market is in aggregate profit but still close to its on-chain cost basis.`;
    }
    return $localize`:Realized Price stress interpretation@@charts.realizedPrice.interpretation.stress:MVRV Ratio is ${mvrv.toFixed(2)}:INTERPOLATION:. BTC trades below realized price, meaning aggregate holders are underwater; historically these periods have clustered near major cycle lows.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:Realized Price about@@charts.realizedPrice.about:Bitcoin Realized Price values each coin at the price when it last moved on-chain, then divides that value by circulating supply. This gives an estimate of the market's aggregate cost basis. When BTC price is above realized price, holders are in profit on aggregate; when BTC price is below realized price, the market is carrying aggregate paper losses.`;

  protected readonly infoDataSources = [
    $localize`:Realized Price data source BTC price@@charts.realizedPrice.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:Realized Price data source realized price@@charts.realizedPrice.dataSource.realized:Realized price: stored DB values plus CoinMetrics community API history derived from PriceUSD / CapMVRVCur`,
    $localize`:Realized Price data source MVRV ratio@@charts.realizedPrice.dataSource.mvrv:MVRV Ratio: BTC price divided by realized price, computed by the backend`,
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
          label: $localize`:Realized price metric@@charts.metric.realizedPrice:Realized Price`,
          data: points.map((p) => p.realizedPrice),
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
              return `Realized Price: ${formatUsd(Number(item.parsed.y))}`;
            }
            return `BTC Price: ${formatUsd(Number(item.parsed.y))}`;
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
    void this.api.recordRecentChart('realized-price').catch(() => undefined);
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
      chartTitle: 'Bitcoin Realized Price',
      fileName: `realized-price_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `realized-price_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Realized price metric@@charts.metric.realizedPrice:Realized price`, value: (row) => formatCsvNumber(row.realizedPrice) },
        { header: $localize`:MVRV ratio metric@@charts.metric.mvrvRatio:MVRV ratio`, value: (row) => formatCsvNumber(row.mvrvRatio) },
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
      const response = await this.api.getRealizePriceChartData(timeframe);
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

function getMvrvSignal(value: number): string {
  if (value > 3.5) return $localize`:Sell zone signal@@charts.signal.sellZone:Sell zone`;
  if (value > 2.0) return $localize`:Overvalued signal@@charts.signal.overvalued:Overvalued`;
  if (value >= 1.0) return $localize`:Fair value range@@charts.signal.fairValueRange:Fair value range`;
  return $localize`:Below realized price@@charts.signal.belowRealizedPrice:Below realized price`;
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
