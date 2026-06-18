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
import {
  CreateAlertModalComponent,
  type AlertMetricOption,
} from '../create-alert-modal/create-alert-modal.component';

interface TimeframeOption {
  label: string;
  value: ChartTimeframe;
}

const TIMEFRAMES: TimeframeOption[] = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '2Y', value: '2y' },
  { label: 'All', value: 'all' },
];

const SIGNAL_MESSAGE = 'Historically, this signal has preceded major tops within 3-7 days';

const PI_CYCLE_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'ma_111_day', label: '111-Day MA' },
  { value: 'ma_350x2_day', label: '350-Day MA × 2' },
];

@Component({
  selector: 'app-pi-cycle-top-chart-page',
  imports: [ChartViewerComponent, ChartAnnotationsComponent, ChartInfoPanelComponent, RouterLink, CreateAlertModalComponent],
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

    return [
      { label: 'Current Price', value: point ? formatUsd(point.priceUsd) : 'Waiting for data' },
      { label: '111-day MA', value: point?.ma111 ? formatUsd(point.ma111) : 'Waiting for history' },
      { label: '350-day MA x 2', value: point?.ma350x2 ? formatUsd(point.ma350x2) : 'Waiting for history' },
      { label: 'Signal', value: point ? getStatusText(point) : 'Waiting for data' },
    ];
  });
  protected readonly infoInterpretation = computed(() => {
    const point = this.latestPoint();

    if (!point) {
      return 'Waiting for the latest moving-average calculation.';
    }

    return point.ma111 !== null && point.ma350x2 !== null && point.ma111 > point.ma350x2
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
  protected readonly chartData = computed<ChartData<'line'>>(() => ({
    labels: this.dataPoints().map((point) => point.date),
    datasets: [
      {
        label: 'Bitcoin Price',
        data: this.dataPoints().map((point) => point.priceUsd),
        borderColor: '#000000',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 12,
        tension: 0.16,
      },
      {
        label: '111-day MA',
        data: this.dataPoints().map((point) => point.ma111),
        borderColor: '#3B82F6',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 12,
        tension: 0.16,
      },
      {
        label: '350-day MA x 2',
        data: this.dataPoints().map((point) => point.ma350x2),
        borderColor: '#EF4444',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 12,
        tension: 0.16,
      },
    ],
  }));
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
        { header: 'Date', value: (row) => row.date },
        { header: 'Price USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: '111-day MA', value: (row) => formatCsvNumber(row.ma111) },
        { header: '350-day MA x2', value: (row) => formatCsvNumber(row.ma350x2) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const timestamp = this.lastUpdated();

    if (!timestamp) {
      return 'Waiting for data';
    }

    return new Date(timestamp).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
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
    return 'Waiting for enough moving-average history';
  }

  return point.ma111 > point.ma350x2
    ? 'Pi Cycle Top signal (111-day MA above 350-day MA x 2)'
    : 'No signal (111-day MA below 350-day MA x 2)';
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return 'n/a';
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
