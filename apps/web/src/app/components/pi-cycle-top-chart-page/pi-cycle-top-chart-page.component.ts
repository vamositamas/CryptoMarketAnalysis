import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type PiCycleTopChartDataPoint,
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
  { label: 'Mind', value: 'all' },
];

const SIGNAL_MESSAGE = 'Historically, this signal has preceded major tops within 3-7 days';

const PI_CYCLE_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'ma_111_day', label: '111 napos MA' },
  { value: 'ma_350x2_day', label: '350 napos MA × 2' },
];

@Component({
  selector: 'app-pi-cycle-top-chart-page',
  imports: [ChartViewerComponent, ChartAnnotationsComponent, ChartInfoPanelComponent, RouterLink, CreateAlertModalComponent, ChartFavouriteButtonComponent],
  templateUrl: './pi-cycle-top-chart-page.component.html',
})
export class PiCycleTopChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;
  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = PI_CYCLE_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly signalNotice = signal('');
  protected readonly dataPoints = signal<PiCycleTopChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);
  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const point = this.latestPoint();
    const lastIdx = this.dataPoints().length - 1;
    const ma = lastIdx >= 0 ? this.maAt(lastIdx) : { ma111: null, ma350x2: null };

    return [
      { label: $localize`:Current price metric@@charts.metric.currentPrice:Current price`,   value: point ? formatUsd(point.priceUsd) : $localize`:Waiting for data@@charts.waitingForData:Waiting for data` },
      { label: '111 napos MA',      value: ma.ma111   ? formatUsd(ma.ma111)   : 'Előzményekre vár' },
      { label: '350 napos MA x 2',  value: ma.ma350x2 ? formatUsd(ma.ma350x2) : 'Előzményekre vár' },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`,          value: point ? getStatusText({ ...point, ...ma }) : $localize`:Waiting for data@@charts.waitingForData:Waiting for data` },
    ];
  });
  protected readonly infoInterpretation = computed(() => {
    const point = this.latestPoint();
    if (!point) return 'Waiting for the latest moving-average calculation.';
    const lastIdx = this.dataPoints().length - 1;
    const { ma111, ma350x2 } = lastIdx >= 0 ? this.maAt(lastIdx) : { ma111: null, ma350x2: null };

    return ma111 !== null && ma350x2 !== null && ma111 > ma350x2
      ? 'The 111-day moving average is above the 350-day moving average x 2. Historically, this crossover has appeared near major Bitcoin cycle highs.'
      : 'No Pi Cycle Top crossover is active. The indicator is not currently flagging a historical cycle-top condition.';
  });
  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());
  protected readonly infoAbout =
    'The Pi Cycle Top Indicator compares the 111-day moving average with twice the 350-day moving average. Historically, when the 111-day average crosses above the 350-day average x 2, the signal has appeared near major Bitcoin cycle highs.';
  protected readonly infoDataSources = [
    'Bitcoin Price: CoinGecko API',
    'Moving averages: 111-day daily close and 350-day daily close x 2',
    'Calculation: Moving-average crossover calculated from historical Bitcoin price data',
  ];
  protected readonly signalDates = computed(() => findSignalDates(this.dataPoints()));

  // Compute MAs client-side from price data when the API returns nulls
  private readonly computedMAs = computed(() => {
    const points = this.dataPoints();
    return points.map((_, idx) => {
      const prices = points.map((p) => p.priceUsd);
      const ma111 = sma(prices, idx, 111);
      const ma350 = sma(prices, idx, 350);
      return { ma111, ma350x2: ma350 !== null ? ma350 * 2 : null };
    });
  });

  private maAt(idx: number): { ma111: number | null; ma350x2: number | null } {
    const point = this.dataPoints()[idx];
    const computed = this.computedMAs()[idx];
    return {
      ma111:   point?.ma111   ?? computed?.ma111   ?? null,
      ma350x2: point?.ma350x2 ?? computed?.ma350x2 ?? null,
    };
  }

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.dataPoints();
    const mas = this.computedMAs();
    const futureLabels = buildFutureLabels(points, this.selectedTimeframe());
    const futureNulls = futureLabels.map(() => null as number | null);

    return {
      labels: [...points.map((p) => p.date), ...futureLabels],
      datasets: [
        {
          label: $localize`:Bitcoin price metric@@charts.metric.bitcoinPrice:Bitcoin price`,
          data: [...points.map((p) => p.priceUsd), ...futureNulls],
          borderColor: '#000000',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.16,
        },
        {
          label: '111 napos MA',
          data: [...mas.map((m) => m.ma111), ...futureNulls],
          borderColor: '#3B82F6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.16,
        },
        {
          label: '350 napos MA x 2',
          data: [...mas.map((m) => m.ma350x2), ...futureNulls],
          borderColor: '#EF4444',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.16,
        },
  ],
    };
  });
  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => ({
    animation: { duration: 280 },
    scales: {
      x: {
        ticks: { maxTicksLimit: 10 },
        grid: { color: 'rgba(23, 32, 42, 0.08)' },
      },
      y: {
        type: 'linear',
        beginAtZero: false,
        ticks: {
          callback: (value) => formatUsd(Number(value)),
        },
        grid: { color: 'rgba(23, 32, 42, 0.08)' },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          title: (items) => formatDate(String(items[0]?.label ?? '')),
          label: (item) => `${item.dataset.label}: ${formatUsd(Number(item.parsed.y))}`,
          afterBody: (items) => {
            const point = this.dataPoints()[items[0]?.dataIndex ?? -1];

            return point ? `Status: ${getStatusText(point)}` : '';
          },
        },
      },
      annotation: {
        annotations: {
          ...createSignalAnnotations(this.signalDates(), () => {
            this.signalNotice.set(SIGNAL_MESSAGE);
          }),
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('pi-cycle-top').catch(() => undefined);
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
    if (this.selectedTimeframe() === timeframe || this.isLoading()) {
      return;
    }

    void this.router.navigate([], { relativeTo: this.route, queryParams: { timeframe } });
  }

  protected toggleInfo(): void {
    this.infoOpen.update((isOpen) => !isOpen);
  }

  protected openAlertModal(): void {
    this.showAlertModal.set(true);
  }

  protected closeAlertModal(): void {
    this.showAlertModal.set(false);
  }

  protected toggleExportMenu(): void {
    this.exportMenuOpen.update((isOpen) => !isOpen);
  }

  protected updateUserAnnotations(annotations: Record<string, AnnotationOptions>): void {
    this.userAnnotations.set(annotations);
  }

  protected handleChartPoint(point: Parameters<ChartAnnotationsComponent['handleChartPoint']>[0]): void {
    this.chartAnnotations?.handleChartPoint(point);
  }

  protected async exportPng(): Promise<void> {
    const chartImageDataUrl = this.chartViewer?.exportImage();

    if (!chartImageDataUrl) {
      return;
    }

    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl,
      chartTitle: 'Pi Cycle Top Indicator',
      fileName: `pi-cycle-top_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `pi-cycle-top_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: '111 napos MA', value: (row) => formatCsvNumber(row.ma111) },
        { header: '350 napos MA x2', value: (row) => formatCsvNumber(row.ma350x2) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const timestamp = this.lastUpdated();

    if (!timestamp) {
      return $localize`:Waiting for data@@charts.waitingForData:Waiting for data`;
    }

    return new Date(timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
  }

  private latestPoint(): PiCycleTopChartDataPoint | undefined {
    const dataPoints = this.dataPoints();

    return dataPoints[dataPoints.length - 1];
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.signalNotice.set('');

    try {
      const response = await this.api.getPiCycleTopChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Pi Cycle chart load failure@@charts.piCycleLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function findSignalDates(dataPoints: PiCycleTopChartDataPoint[]): string[] {
  const signalDates: string[] = [];

  for (let index = 1; index < dataPoints.length; index += 1) {
    const previous = dataPoints[index - 1];
    const current = dataPoints[index];

    if (
      previous.ma111 !== null &&
      previous.ma350x2 !== null &&
      current.ma111 !== null &&
      current.ma350x2 !== null &&
      previous.ma111 <= previous.ma350x2 &&
      current.ma111 > current.ma350x2
    ) {
      signalDates.push(current.date);
    }
  }

  return signalDates;
}

function createSignalAnnotations(
  signalDates: string[],
  onClick: () => void,
): Record<string, AnnotationOptions<'line'>> {
  return Object.fromEntries(
    signalDates.map((date, index) => [
      `piCycleSignal${index + 1}`,
      {
        type: 'line',
        xMin: date,
        xMax: date,
        borderColor: '#EF4444',
        borderDash: [6, 6],
        borderWidth: 2,
        label: {
          display: true,
          content: 'Pi Cycle Top Signal',
          position: 'start',
          backgroundColor: 'rgba(239, 68, 68, 0.9)',
        },
        enter({ element }) {
          element.options.borderWidth = 3;
          return true;
        },
        leave({ element }) {
          element.options.borderWidth = 2;
          return true;
        },
        click: () => {
          onClick();
          return true;
        },
      },
    ]),
  );
}

function getStatusText(point: PiCycleTopChartDataPoint): string {
  if (point.ma111 === null || point.ma350x2 === null) {
    return 'Elég mozgóátlag-előzményre vár';
  }

  return point.ma111 > point.ma350x2
    ? 'Pi Cycle Top signal (111-day MA above 350-day MA x 2)'
    : 'No signal (111-day MA below 350-day MA x 2)';
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return 'nincs adat';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

// Simple moving average: returns null until enough data points are available
function sma(prices: number[], idx: number, period: number): number | null {
  if (idx < period - 1) return null;
  let sum = 0;
  for (let i = idx - period + 1; i <= idx; i++) sum += prices[i];
  return sum / period;
}

function buildFutureLabels(points: { date: string }[], timeframe: string): string[] {
  const pad: Record<string, number> = { '1m': 5, '3m': 8, '6m': 14, '1y': 21, '2y': 45, 'all': 90 };
  const days = pad[timeframe] ?? 30;
  if (points.length === 0) return [];
  const last = new Date(`${points[points.length - 1].date}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() + i + 1);
    return d.toISOString().split('T')[0];
  });
}
