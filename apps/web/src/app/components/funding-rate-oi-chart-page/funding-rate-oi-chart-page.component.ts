import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type FundingRateOpenInterestChartDataPoint,
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

const FUNDING_RATE_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'funding_rate_avg', label: $localize`:Funding rate metric@@charts.metric.fundingRate:Funding rate` },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

const OVERHEATED_THRESHOLD = 0.0005;
const NEGATIVE_THRESHOLD = -0.0002;

@Component({
  selector: 'app-funding-rate-oi-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './funding-rate-oi-chart-page.component.html',
})
export class FundingRateOpenInterestChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = FUNDING_RATE_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<FundingRateOpenInterestChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  private readonly currentFundingRate = computed<number | null>(() => {
    const withData = this.dataPoints().filter((p) => p.fundingRate !== null);
    return withData[withData.length - 1]?.fundingRate ?? null;
  });

  private readonly currentOpenInterest = computed<number | null>(() => {
    const withData = this.dataPoints().filter((p) => p.openInterestUsd !== null);
    return withData[withData.length - 1]?.openInterestUsd ?? null;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    const fundingRate = this.currentFundingRate();
    const openInterest = this.currentOpenInterest();
    const noData = $localize`:No data value@@common.noData:No data`;

    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: last ? formatUsd(last.priceUsd) : noData },
      { label: $localize`:Funding rate metric@@charts.metric.fundingRate:Funding rate`, value: fundingRate !== null ? formatFundingRate(fundingRate) : noData },
      { label: $localize`:Open interest metric@@charts.metric.openInterest:Open interest`, value: openInterest !== null ? formatCompactUsd(openInterest) : noData },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: fundingRate !== null ? getFundingRateSignal(fundingRate) : noData },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const fundingRate = this.currentFundingRate();
    if (fundingRate === null) {
      return $localize`:Funding rate waiting interpretation@@charts.fundingRate.interpretation.waiting:Waiting for funding rate data.`;
    }
    if (fundingRate > OVERHEATED_THRESHOLD) {
      return $localize`:Funding rate overheated interpretation@@charts.fundingRate.interpretation.overheated:Funding is strongly positive, meaning long positions are paying shorts to stay open. This reflects euphoric, leveraged long demand — historically associated with overheated conditions and a higher risk of long-squeeze cascades.`;
    }
    if (fundingRate < NEGATIVE_THRESHOLD) {
      return $localize`:Funding rate negative interpretation@@charts.fundingRate.interpretation.negative:Funding is negative, meaning short positions are paying longs to stay open. This reflects a short-heavy, fearful market — historically these setups have preceded short-squeeze rallies.`;
    }
    return $localize`:Funding rate neutral interpretation@@charts.fundingRate.interpretation.neutral:Funding is close to neutral, indicating no strong leveraged bias in either direction.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:Funding rate about@@charts.fundingRate.about:Perpetual futures funding rate and open interest measure leverage in the derivatives market. Positive funding means longs pay shorts (bullish/leveraged demand); negative funding means shorts pay longs (bearish/leveraged demand). Extremes in either direction, especially combined with rising open interest, have historically marked overheated conditions prone to sharp reversals.`;

  protected readonly infoDataSources = [
    $localize`:Funding rate data source BTC price@@charts.fundingRate.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:Funding rate data source funding@@charts.fundingRate.dataSource.funding:Funding rate: Binance Futures public API (BTCUSDT perpetual), daily average of 8-hour funding events, full history since 2019`,
    $localize`:Funding rate data source OI@@charts.fundingRate.dataSource.oi:Open interest: Bybit public API (BTCUSDT linear perpetual), converted to USD using each day's BTC price. Full history available since 2020-08-05.`,
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
          order: 3,
        },
        {
          type: 'line' as const,
          label: $localize`:Funding rate metric@@charts.metric.fundingRate:Funding Rate`,
          data: points.map((p) => p.fundingRate),
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0,
          yAxisID: 'y2',
          order: 1,
        },
        {
          type: 'line' as const,
          label: $localize`:Open interest metric@@charts.metric.openInterest:Open Interest`,
          data: points.map((p) => p.openInterestUsd),
          borderColor: '#7c3aed',
          backgroundColor: '#7c3aed',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0,
          yAxisID: 'y3',
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
        title: {
          display: true,
          text: $localize`:Funding rate axis label@@charts.axis.fundingRate:Funding Rate`,
          color: '#b45309',
          font: { size: 12, weight: 500 },
        },
        ticks: {
          color: '#b45309',
          callback: (value) => formatFundingRate(Number(value)),
        },
        grid: { drawOnChartArea: false },
      },
      y3: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: $localize`:Open interest axis label@@charts.axis.openInterest:Open Interest (USD)`,
          color: '#7c3aed',
          font: { size: 12, weight: 500 },
        },
        ticks: {
          color: '#7c3aed',
          callback: (value) => formatCompactUsd(Number(value)),
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
              return `${$localize`:Funding rate metric@@charts.metric.fundingRate:Funding Rate`}: ${formatFundingRate(Number(item.parsed.y))}`;
            }
            if (item.dataset.yAxisID === 'y3') {
              return `${$localize`:Open interest metric@@charts.metric.openInterest:Open Interest`}: ${formatCompactUsd(Number(item.parsed.y))}`;
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
            borderColor: 'rgba(180,83,9,0.4)',
            borderWidth: 1,
            borderDash: [4, 4],
          },
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('funding-rate-oi').catch(() => undefined);
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

  protected toggleFullscreen(): void { this.chartViewer?.toggleFullscreen(); }

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
      chartTitle: 'Bitcoin Funding Rate & Open Interest',
      fileName: `funding-rate-oi_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `funding-rate-oi_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Funding rate metric@@charts.metric.fundingRate:Funding rate`, value: (row) => formatCsvNumber(row.fundingRate) },
        { header: $localize`:Open interest metric@@charts.metric.openInterest:Open interest`, value: (row) => formatCsvNumber(row.openInterestUsd) },
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
      const response = await this.api.getFundingRateOpenInterestChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Funding rate chart load failure@@charts.fundingRateLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getFundingRateSignal(rate: number): string {
  if (rate > OVERHEATED_THRESHOLD) return $localize`:Overheated leverage signal@@charts.signal.fundingRate.overheated:Overheated — Euphoric long leverage`;
  if (rate < NEGATIVE_THRESHOLD) return $localize`:Negative funding signal@@charts.signal.fundingRate.negative:Negative — Short-heavy (squeeze risk)`;
  return $localize`:Neutral leverage signal@@charts.signal.fundingRate.neutral:Neutral leverage`;
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
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatFundingRate(value: number): string {
  if (!Number.isFinite(value)) return '';
  return `${(value * 100).toFixed(3)}%`;
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
