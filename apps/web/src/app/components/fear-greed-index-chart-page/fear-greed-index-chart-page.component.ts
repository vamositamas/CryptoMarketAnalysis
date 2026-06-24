import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type FearGreedIndexChartResponse,
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

type FearGreedDataPoint = FearGreedIndexChartResponse['dataPoints'][number];

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
  { label: 'Mind', value: 'all' },
];

const FEAR_GREED_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-fear-greed-index-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './fear-greed-index-chart-page.component.html',
})
export class FearGreedIndexChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = FEAR_GREED_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<FearGreedDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const priceLast = points[points.length - 1];
    if (!priceLast) return [];
    const last = [...points].reverse().find((p) => p.fearGreedValue !== null) ?? priceLast;
    const score = last.fearGreedValue;
    const sentiment = score !== null ? getFearGreedSentiment(score) : $localize`:No data value@@common.noData:No data`;
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: formatUsd(last.priceUsd) },
      { label: 'Fear & Greed Score', value: score !== null ? String(score) : $localize`:No data value@@common.noData:No data` },
      { label: 'Sentiment', value: sentiment },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    if (!points.length) return $localize`:Waiting for data sentence@@charts.waitingForDataSentence:Waiting for data.`;
    const last = [...points].reverse().find((p) => p.fearGreedValue !== null) ?? points[points.length - 1];
    const score = last.fearGreedValue;
    if (score === null) return 'Fear & Greed score not available for the latest data point.';
    const sentiment = getFearGreedSentiment(score);
    return `Current Fear & Greed score is ${score} (${sentiment}). Historically, extreme fear readings below 20 have coincided with long-term accumulation opportunities.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'The Fear & Greed Index is a composite sentiment indicator (0–100) sourced from Alternative.me. ' +
    'It combines price volatility, market momentum, social media activity, surveys, and dominance. ' +
    'Extreme Fear (0–24) has historically been a reliable long-term buy signal for Bitcoin.';

  protected readonly infoDataSources = [
    'Fear & Greed Index: Alternative.me (historical data from 2018-02-01)',
    'BTC Price: CoinGecko (stored daily)',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        // Fear & Greed bars — left y2 axis, linear 0–100
        {
          type: 'bar' as const,
          label: 'Félelem és kapzsiság index',
          data: points.map((p) => p.fearGreedValue),
          backgroundColor: points.map((p) => getFearGreedColor(p.fearGreedValue)),
          borderWidth: 0,
          barPercentage: 0.9,
          categoryPercentage: 1.0,
          yAxisID: 'y2',
          order: 2,
        },
        // BTC Price — dark line, right y axis, logarithmic
        {
          type: 'line' as const,
          label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`,
          data: points.map((p) => p.priceUsd),
          borderColor: '#1f2937',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 1,
          spanGaps: false,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions>(() => ({
    animation: { duration: 280 },
    scales: {
      x: {
        ticks: { maxTicksLimit: 12, color: '#6b7280' },
        grid: { color: 'rgba(0,0,0,0.06)' },
      },
      y2: {
        type: 'linear',
        position: 'left',
        min: 0,
        max: 100,
        ticks: {
          color: '#6b7280',
          stepSize: 25,
        },
        grid: { color: 'rgba(0,0,0,0.04)' },
        title: {
          display: true,
          text: 'Fear & Greed (0–100)',
          color: '#6b7280',
          font: { size: 11 },
        },
      },
      y: {
        type: 'logarithmic',
        position: 'right',
        ticks: {
          callback: (value) => {
            const v = Number(value);
            if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
            if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
            if (v >= 1) return `$${v.toFixed(0)}`;
            return `$${v.toFixed(2)}`;
          },
          color: '#6b7280',
        },
        grid: { drawOnChartArea: false },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          title: (items) => formatDate(String(items[0]?.label ?? '')),
          label: (item) => {
            const label = item.dataset.label ?? '';
            if (item.dataset.yAxisID === 'y2') {
              const v = item.parsed.y;
              return `${label}: ${v !== null ? String(v) : $localize`:No data value@@common.noData:No data`}`;
            }
            return `${label}: ${formatUsd(Number(item.parsed.y))}`;
          },
        },
      },
      annotation: {
        annotations: {
          fearLine: {
            type: 'line',
            yMin: 25,
            yMax: 25,
            yScaleID: 'y2',
            borderColor: 'rgba(220, 38, 38, 0.7)',
            borderDash: [5, 4],
            borderWidth: 1.5,
            label: {
              display: true,
              content: 'Fear',
              position: 'start',
              backgroundColor: 'rgba(220, 38, 38, 0.75)',
              color: '#fff',
              font: { size: 9, weight: 'bold' as const },
              padding: { x: 4, y: 2 },
            },
          } as AnnotationOptions,
          greedLine: {
            type: 'line',
            yMin: 75,
            yMax: 75,
            yScaleID: 'y2',
            borderColor: 'rgba(34, 197, 94, 0.7)',
            borderDash: [5, 4],
            borderWidth: 1.5,
            label: {
              display: true,
              content: 'Greed',
              position: 'start',
              backgroundColor: 'rgba(34, 197, 94, 0.75)',
              color: '#fff',
              font: { size: 9, weight: 'bold' as const },
              padding: { x: 4, y: 2 },
            },
          } as AnnotationOptions,
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('fear-greed-index').catch(() => undefined);
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
      chartTitle: 'Félelem és kapzsiság index',
      fileName: `fear-greed-index_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `fear-greed-index_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'Fear & Greed Value', value: (row) => formatCsvNumber(row.fearGreedValue) },
        {
          header: 'Sentiment',
          value: (row) =>
            row.fearGreedValue !== null ? getFearGreedSentiment(row.fearGreedValue) : '',
        },
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
      const response = await this.api.getFearGreedIndexChartData(timeframe);
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

function getFearGreedColor(value: number | null): string {
  if (value === null) return 'transparent';
  if (value < 25) return 'rgba(127, 29, 29, 0.75)';   // Extreme Fear
  if (value < 45) return 'rgba(220, 38, 38, 0.75)';   // Fear
  if (value < 56) return 'rgba(234, 179, 8, 0.75)';   // Neutral
  if (value < 75) return 'rgba(34, 197, 94, 0.75)';   // Greed
  return 'rgba(21, 128, 75, 0.75)';                    // Extreme Greed
}

function getFearGreedSentiment(value: number): string {
  if (value < 25) return 'Extreme Fear';
  if (value < 45) return 'Fear';
  if (value < 56) return 'Semleges';
  if (value < 75) return 'Greed';
  return 'Extreme Greed';
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return 'nincs adat';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
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
