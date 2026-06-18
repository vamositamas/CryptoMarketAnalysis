import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type StockToFlowChartDataPoint,
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

const HALVING_EVENTS = [
  { date: '2012-11-28', label: '2012 Halving' },
  { date: '2016-07-09', label: '2016 Halving' },
  { date: '2020-05-11', label: '2020 Halving' },
  { date: '2024-04-20', label: '2024 Halving' },
];

const STOCK_TO_FLOW_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'stock_to_flow_ratio', label: 'Stock-to-Flow Ratio' },
  { value: 'btc_price', label: 'BTC Price USD' },
];

@Component({
  selector: 'app-stock-to-flow-chart-page',
  imports: [ChartViewerComponent, ChartAnnotationsComponent, ChartInfoPanelComponent, RouterLink, CreateAlertModalComponent],
  templateUrl: './stock-to-flow-chart-page.component.html',
})
export class StockToFlowChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;
  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = STOCK_TO_FLOW_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<StockToFlowChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);
  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const point = this.latestPoint();

    return [
      { label: 'Current Price', value: point ? formatUsd(point.priceUsd) : 'Waiting for data' },
      { label: 'Model Price', value: point?.modelPrice ? formatUsd(point.modelPrice) : 'Waiting for model' },
      { label: 'Stock-to-Flow Ratio', value: point?.stockToFlowRatio ? point.stockToFlowRatio.toFixed(2) : 'Waiting for model' },
      { label: 'Price vs Model', value: point ? formatPremium(point) : 'Waiting for data' },
    ];
  });
  protected readonly infoInterpretation = computed(() => {
    const point = this.latestPoint();
    const divergenceKind = point ? getDivergenceKind(point) : undefined;

    if (!point || point.modelPrice === null) {
      return 'Waiting for the latest Stock-to-Flow model calculation.';
    }

    if (divergenceKind === 'overvalued') {
      return 'Bitcoin is trading materially above the Stock-to-Flow model price. Treat this as historical context rather than a standalone sell signal.';
    }

    if (divergenceKind === 'undervalued') {
      return 'Bitcoin is trading materially below the Stock-to-Flow model price. Historically, this has marked periods where price lagged scarcity-model expectations.';
    }

    return 'Bitcoin is trading near the Stock-to-Flow model price. The model is best used as long-term scarcity context, not a precise forecast.';
  });
  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());
  protected readonly infoAbout =
    'The Bitcoin Stock-to-Flow model estimates Bitcoin value from scarcity, using the ratio between existing supply and new issuance. It is most useful as long-term historical context around halving cycles.';
  protected readonly infoDataSources = [
    'Bitcoin Price: CoinGecko API',
    'Supply schedule: Bitcoin issuance and halving schedule',
    'Calculation: Stock-to-Flow ratio and model price calculated from Bitcoin supply and issuance flow',
  ];
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
        label: 'S2F Model Price',
        data: this.dataPoints().map((point) => point.modelPrice),
        borderColor: '#F59E0B',
        backgroundColor: 'transparent',
        borderDash: [8, 6],
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 12,
        tension: 0.16,
      },
    ],
  }));
  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => {
    const range = getPriceRange(this.dataPoints());

    return {
      animation: { duration: 280 },
      scales: {
        x: {
          ticks: { maxTicksLimit: 10 },
          grid: { color: 'rgba(23, 32, 42, 0.08)' },
        },
        y: {
          type: 'logarithmic',
          min: range.min,
          max: range.max,
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

              if (!point) {
                return '';
              }

              return [
                `S2F Ratio: ${formatRatio(point.stockToFlowRatio)}`,
                `Premium to Model: ${formatPremium(point)}`,
              ];
            },
          },
        },
        annotation: {
          annotations: {
            ...createHalvingAnnotations(),
            ...createDivergenceAnnotations(this.dataPoints(), range.min, range.max),
            ...this.userAnnotations(),
          },
        },
      },
    };
  });

  constructor() {
    void this.api.recordRecentChart('stock-to-flow').catch(() => undefined);
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
      chartTitle: 'Stock-to-Flow Model',
      fileName: `stock-to-flow_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `stock-to-flow_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Date', value: (row) => row.date },
        { header: 'Price USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'S2F Model Price', value: (row) => formatCsvNumber(row.modelPrice) },
        { header: 'S2F Ratio', value: (row) => row.stockToFlowRatio },
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

  private latestPoint(): StockToFlowChartDataPoint | undefined {
    const dataPoints = this.dataPoints();

    return dataPoints[dataPoints.length - 1];
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const response = await this.api.getStockToFlowChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Stock to Flow chart load failure@@charts.stockToFlowLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function createHalvingAnnotations(): Record<string, AnnotationOptions<'line'>> {
  return Object.fromEntries(
    HALVING_EVENTS.map((event) => [
      `halving${event.date}`,
      {
        type: 'line',
        xMin: event.date,
        xMax: event.date,
        borderColor: '#6B7280',
        borderDash: [4, 5],
        borderWidth: 1,
        label: {
          display: true,
          content: event.label,
          position: 'start',
          backgroundColor: 'rgba(55, 65, 81, 0.88)',
        },
      },
    ]),
  );
}

function createDivergenceAnnotations(
  dataPoints: StockToFlowChartDataPoint[],
  min: number,
  max: number,
): Record<string, AnnotationOptions<'box'>> {
  return Object.fromEntries(
    getDivergenceRanges(dataPoints).map((range, index) => [
      `divergence${index + 1}`,
      {
        type: 'box',
        xMin: range.start,
        xMax: range.end,
        yMin: min,
        yMax: max,
        backgroundColor:
          range.kind === 'overvalued' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
        borderWidth: 0,
        label: {
          display: true,
          content: range.kind === 'overvalued' ? 'Overvalued' : 'Undervalued',
          position: 'center',
          backgroundColor:
            range.kind === 'overvalued' ? 'rgba(239, 68, 68, 0.82)' : 'rgba(34, 197, 94, 0.82)',
        },
      },
    ]),
  );
}

function getDivergenceRanges(
  dataPoints: StockToFlowChartDataPoint[],
): { start: string; end: string; kind: 'overvalued' | 'undervalued' }[] {
  const ranges: { start: string; end: string; kind: 'overvalued' | 'undervalued' }[] = [];
  let currentRange: { start: string; end: string; kind: 'overvalued' | 'undervalued' } | undefined;

  for (const point of dataPoints) {
    const kind = getDivergenceKind(point);

    if (!kind) {
      if (currentRange) {
        ranges.push(currentRange);
        currentRange = undefined;
      }
      continue;
    }

    if (currentRange?.kind === kind) {
      currentRange.end = point.date;
      continue;
    }

    if (currentRange) {
      ranges.push(currentRange);
    }

    currentRange = { start: point.date, end: point.date, kind };
  }

  if (currentRange) {
    ranges.push(currentRange);
  }

  return ranges;
}

function getDivergenceKind(point: StockToFlowChartDataPoint): 'overvalued' | 'undervalued' | undefined {
  if (point.modelPrice === null || point.modelPrice <= 0) {
    return undefined;
  }

  const premium = (point.priceUsd - point.modelPrice) / point.modelPrice;

  if (premium > 0.2) {
    return 'overvalued';
  }

  if (premium < -0.2) {
    return 'undervalued';
  }

  return undefined;
}

function getPriceRange(dataPoints: StockToFlowChartDataPoint[]): { min: number; max: number } {
  const prices = dataPoints
    .flatMap((point) => [point.priceUsd, point.modelPrice])
    .filter((price): price is number => typeof price === 'number' && price > 0);

  if (prices.length === 0) {
    return { min: 1, max: 100000 };
  }

  return {
    min: Math.max(0.01, Math.min(...prices) * 0.55),
    max: Math.max(...prices) * 1.45,
  };
}

function formatPremium(point: StockToFlowChartDataPoint): string {
  if (point.modelPrice === null || point.modelPrice <= 0) {
    return 'n/a';
  }

  const premium = ((point.priceUsd - point.modelPrice) / point.modelPrice) * 100;

  return `${premium >= 0 ? '+' : ''}${premium.toFixed(1)}%`;
}

function formatRatio(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(1);
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
