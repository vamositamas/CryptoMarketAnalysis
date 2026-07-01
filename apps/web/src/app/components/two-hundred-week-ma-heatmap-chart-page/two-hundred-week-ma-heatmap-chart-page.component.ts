import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type TwoHundredWeekMAHeatmapChartResponse,
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

type DataPoint = TwoHundredWeekMAHeatmapChartResponse['dataPoints'][number];

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

const HALVING_EVENTS = [
  { date: '2012-11-28', label: $localize`:2012 halving label@@charts.halving.2012:2012 halving` },
  { date: '2016-07-09', label: $localize`:2016 halving label@@charts.halving.2016:2016 halving` },
  { date: '2020-05-11', label: $localize`:2020 halving label@@charts.halving.2020:2020 halving` },
  { date: '2024-04-19', label: $localize`:2024 halving label@@charts.halving.2024:2024 halving` },
];

const TWO_HUNDRED_WEEK_MA_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-two-hundred-week-ma-heatmap-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './two-hundred-week-ma-heatmap-chart-page.component.html',
})
export class TwoHundredWeekMAHeatmapChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = TWO_HUNDRED_WEEK_MA_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<DataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const price = last.priceUsd;
    const ma200w = last.ma200w;
    const multiplier = last.multiplier;
    const signalLabel =
      multiplier === null
        ? $localize`:No data value@@common.noData:No data`
        : multiplier > 5
          ? $localize`:Historically overheated@@charts.signal.historicallyOverheated:Historically Overheated`
          : multiplier > 3
            ? $localize`:Elevated signal@@charts.signal.elevated:Elevated`
            : multiplier >= 0.9 && multiplier <= 1.1
              ? $localize`:Near MA@@charts.signal.nearMa:Near MA`
              : multiplier < 1
                ? $localize`:Below MA@@charts.signal.belowMa:Below MA`
                : $localize`:Neutral signal@@charts.signal.neutral:Neutral`;
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: formatUsd(price) },
      { label: $localize`:200 week MA@@charts.metric.ma200wk:200-Week MA`, value: ma200w !== null ? formatUsd(ma200w) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:Multiplier@@charts.metric.multiplier:Multiplier`, value: multiplier !== null ? `${multiplier.toFixed(2)}×` : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: signalLabel },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return $localize`:Waiting for data sentence@@charts.waitingForDataSentence:Waiting for data.`;
    const price = last.priceUsd;
    const ma200w = last.ma200w;
    const multiplier = last.multiplier;
    if (ma200w === null || multiplier === null) {
      return '200-week moving average not yet available (requires 1400 days of data).';
    }
    if (multiplier > 5) {
      return `BTC price ($${price.toLocaleString()}) is ${multiplier.toFixed(2)}× the 200-week MA ($${ma200w.toLocaleString('en-US', { maximumFractionDigits: 0 })}). A multiplier above 5× has historically coincided with cycle peaks and overheated market conditions.`;
    }
    if (multiplier > 3) {
      return `BTC price ($${price.toLocaleString()}) is ${multiplier.toFixed(2)}× the 200-week MA ($${ma200w.toLocaleString('en-US', { maximumFractionDigits: 0 })}). The multiplier is elevated — price is significantly extended above the long-term trend.`;
    }
    if (multiplier < 1) {
      return `BTC price ($${price.toLocaleString()}) is below the 200-week MA ($${ma200w.toLocaleString('en-US', { maximumFractionDigits: 0 })}). Historically, trading below the 200-week MA has represented the ultimate bear-market floor and a strong long-term accumulation zone.`;
    }
    if (multiplier >= 0.9 && multiplier <= 1.1) {
      return `BTC price ($${price.toLocaleString()}) is near the 200-week MA ($${ma200w.toLocaleString('en-US', { maximumFractionDigits: 0 })}), at a multiplier of ${multiplier.toFixed(2)}×. This level has historically acted as critical support.`;
    }
    return `BTC price ($${price.toLocaleString()}) is ${multiplier.toFixed(2)}× the 200-week MA ($${ma200w.toLocaleString('en-US', { maximumFractionDigits: 0 })}). The multiplier is in the neutral zone, with no extreme signal in either direction.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'The 200-Week Moving Average Heatmap shows Bitcoin\'s price relative to its 200-week moving average — a long-term trend indicator that has historically served as the ultimate bear-market floor. ' +
    'The multiplier quantifies how far price has extended above the MA, with values above 5× historically coinciding with cycle peaks.';

  protected readonly infoDataSources = [
    'BTC Price: CoinGecko (stored daily)',
    '200-week MA: 1400-day rolling average computed on-demand',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        // Multiplier — orange line, left y-axis (linear)
        {
          type: 'line' as const,
          label: 'Price / 200w MA Multiplier',
          data: points.map((p) => p.multiplier),
          borderColor: '#f97316',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          order: 2,
          spanGaps: false,
        },
        // BTC Price — dark line, right y-axis (log)
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
        // 200-Week MA — red line, right y-axis (log)
        {
          type: 'line' as const,
          label: '200-Week MA',
          data: points.map((p) => p.ma200w),
          borderColor: '#ef4444',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 3,
          spanGaps: true,
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
        max: 10,
        ticks: {
          callback: (value) => `${Number(value).toFixed(1)}×`,
          color: '#f97316',
        },
        grid: { color: 'rgba(249,115,22,0.08)' },
        title: {
          display: true,
          text: 'Multiplier (Price / 200w MA)',
          color: '#f97316',
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
        grid: { color: 'rgba(0,0,0,0.06)' },
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
            const v = Number(item.parsed.y);
            const label = item.dataset.label ?? '';
            if (item.dataset.yAxisID === 'y2') {
              return `${label}: ${v.toFixed(2)}×`;
            }
            return `${label}: ${formatUsd(v)}`;
          },
        },
      },
      annotation: {
        annotations: {
          refLine1x: {
            type: 'line',
            yMin: 1.0,
            yMax: 1.0,
            yScaleID: 'y2',
            borderColor: '#22c55e',
            borderDash: [5, 5],
            borderWidth: 1.5,
            label: {
              display: true,
              content: $localize`:200w MA line@@charts.annotation.ma200wk.line:200w MA (×1.0)`,
              position: 'end',
              backgroundColor: 'rgba(34,197,94,0.85)',
              color: '#fff',
              font: { size: 9, weight: 'bold' as const },
              padding: { x: 4, y: 2 },
            },
          } as AnnotationOptions,
          refLine3x: {
            type: 'line',
            yMin: 3.0,
            yMax: 3.0,
            yScaleID: 'y2',
            borderColor: '#f97316',
            borderDash: [5, 5],
            borderWidth: 1.5,
            label: {
              display: true,
              content: '×3.0',
              position: 'end',
              backgroundColor: 'rgba(249,115,22,0.85)',
              color: '#fff',
              font: { size: 9, weight: 'bold' as const },
              padding: { x: 4, y: 2 },
            },
          } as AnnotationOptions,
          refLine5x: {
            type: 'line',
            yMin: 5.0,
            yMax: 5.0,
            yScaleID: 'y2',
            borderColor: '#ef4444',
            borderDash: [5, 5],
            borderWidth: 1.5,
            label: {
              display: true,
              content: $localize`:200w MA x5@@charts.annotation.ma200wk.x5:×5.0 — Historic Tops`,
              position: 'end',
              backgroundColor: 'rgba(239,68,68,0.85)',
              color: '#fff',
              font: { size: 9, weight: 'bold' as const },
              padding: { x: 4, y: 2 },
            },
          } as AnnotationOptions,
          ...createHalvingAnnotations(this.dataPoints()[0]?.date ?? '2010-07-01'),
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('200-week-ma-heatmap').catch(() => undefined);
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
      chartTitle: '200-Week MA Heatmap',
      fileName: `200-week-ma-heatmap_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `200-week-ma-heatmap_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: '200-Week MA', value: (row) => formatCsvNumber(row.ma200w) },
        { header: 'Multiplier', value: (row) => formatCsvNumber(row.multiplier) },
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
      const response = await this.api.get200WeekMAHeatmapChartData(timeframe);
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

function createHalvingAnnotations(startDate: string): Record<string, AnnotationOptions> {
  return Object.fromEntries(
    HALVING_EVENTS
      .filter((event) => event.date >= startDate)
      .map((event) => [
        `halving_${event.date}`,
        {
          type: 'line',
          xMin: event.date,
          xMax: event.date,
          borderColor: 'rgba(107, 114, 128, 0.55)',
          borderDash: [4, 5],
          borderWidth: 1.5,
          label: {
            display: true,
            content: event.label,
            position: 'start',
            backgroundColor: 'rgba(55, 65, 81, 0.88)',
            color: '#fff',
            font: { size: 9, weight: 'bold' as const },
            padding: { x: 4, y: 2 },
          },
        } as AnnotationOptions,
      ]),
  );
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return $localize`:No data value@@common.noData:No data`;
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
