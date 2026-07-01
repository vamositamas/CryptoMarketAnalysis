import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type VddMultipleChartDataPoint,
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

const HALVING_EVENTS = [
  { date: '2012-11-28', label: $localize`:2012 halving label@@charts.halving.2012:2012 halving` },
  { date: '2016-07-09', label: $localize`:2016 halving label@@charts.halving.2016:2016 halving` },
  { date: '2020-05-11', label: $localize`:2020 halving label@@charts.halving.2020:2020 halving` },
  { date: '2024-04-19', label: $localize`:2024 halving label@@charts.halving.2024:2024 halving` },
];

const VDD_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'vdd_multiple', label: 'VDD Multiple' },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

// VDD zone thresholds (defined by TXMC, the creator of VDD Multiple)
const VDD_SELL_THRESHOLD = 2.9;
const VDD_BUY_THRESHOLD = 0.75;

@Component({
  selector: 'app-vdd-multiple-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './vdd-multiple-chart-page.component.html',
})
export class VddMultipleChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = VDD_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<VddMultipleChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);
  protected readonly hasVddData = computed(() => this.dataPoints().some((p) => p.vddMultiple !== null));

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const lastVddPoint = [...points].reverse().find((p) => p.vddMultiple !== null);
    const vdd = lastVddPoint?.vddMultiple ?? null;
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: formatUsd(last.priceUsd) },
      { label: $localize`:VDD Multiple@@charts.metric.vddMultiple:VDD Multiple`, value: vdd !== null ? vdd.toFixed(3) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: vdd !== null ? getVddSignal(vdd) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:History shown@@charts.metric.historyShown:History shown`, value: `${(points.length / 365).toFixed(1)} years` },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const vdd = [...points].reverse().find((p) => p.vddMultiple !== null)?.vddMultiple ?? null;
    if (vdd === null) return 'Waiting for sufficient on-chain data to compute the VDD Multiple.';
    if (vdd > VDD_SELL_THRESHOLD) {
      return `VDD Multiple is ${vdd.toFixed(2)} — above the 2.9 sell threshold. Long-term holders are spending heavily, historically a signal of peak market euphoria and elevated cycle-top risk.`;
    }
    if (vdd < VDD_BUY_THRESHOLD) {
      return `VDD Multiple is ${vdd.toFixed(2)} — below the 0.75 accumulation threshold. Coin movement is subdued, historically associated with bear markets and long-term accumulation zones.`;
    }
    return `VDD Multiple is ${vdd.toFixed(2)} — in the neutral range (0.75–2.9). Spending activity is within normal historical bounds for an active market.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'The VDD (Value Days Destroyed) Multiple compares the 30-day moving average of Value Days Destroyed ' +
    'to its 365-day moving average. VDD = Coin Days Destroyed × BTC Price, adjusting for price fluctuations. ' +
    'A ratio above 2.9 (occurring only ~5% of history) signals long-term holder selling and cycle tops. ' +
    'Below 0.75 signals dormant coins and accumulation phases.';

  protected readonly infoDataSources = [
    'Bitcoin Price: CoinGecko API (stored daily)',
    'Coin Days Destroyed: Blockchain.info API (stored daily)',
    'VDD Multiple: (MA30 of VDD) ÷ (MA365 of VDD) — computed server-side',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();
    const vddValues = points.map((p) => p.vddMultiple);

    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'line' as const,
          label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD`,
          data: points.map((p) => p.priceUsd),
          borderColor: '#000000',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 1,
        },
        {
          type: 'bar' as const,
          label: 'VDD Multiple',
          data: vddValues,
          backgroundColor: vddValues.map((v) =>
            v === null
              ? 'transparent'
              : v > VDD_SELL_THRESHOLD
                ? 'rgba(239, 68, 68, 0.88)'
                : v > VDD_BUY_THRESHOLD
                  ? 'rgba(249, 115, 22, 0.85)'
                  : 'rgba(34, 197, 94, 0.85)',
          ),
          borderWidth: 0,
          // Fill each bar to the full category width so daily bars form a solid area
          barPercentage: 1.0,
          categoryPercentage: 1.0,
          yAxisID: 'y2',
          order: 2,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions>(() => ({
    animation: { duration: 280 },
    scales: {
      x: {
        ticks: { maxTicksLimit: 10 },
        grid: { color: 'rgba(23, 32, 42, 0.08)' },
      },
      y: {
        type: 'logarithmic',
        position: 'right',
        ticks: { callback: (value) => formatUsd(Number(value)) },
        grid: { drawOnChartArea: false },
      },
      y2: {
        type: 'linear',
        position: 'left',
        min: 0,
        max: Math.max(5, ...this.dataPoints().map((p) => p.vddMultiple ?? 0)) * 1.1,
        ticks: { callback: (value) => Number(value).toFixed(1) },
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
          label: (item) => {
            if (item.dataset.yAxisID === 'y2') {
              const v = item.parsed.y;
              return `VDD Multiple: ${v?.toFixed(3) ?? $localize`:No data value@@common.noData:No data`}`;
            }
            return `BTC Price: ${formatUsd(Number(item.parsed.y))}`;
          },
        },
      },
      annotation: {
        annotations: {
          ...createVddThresholdAnnotations(),
          ...createHalvingAnnotations(this.dataPoints()[0]?.date ?? '2009-01-03'),
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('vdd-multiple').catch(() => undefined);
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
      chartTitle: 'VDD Multiple',
      fileName: `vdd-multiple_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `vdd-multiple_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'VDD Multiple', value: (row) => formatCsvNumber(row.vddMultiple) },
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
      const response = await this.api.getVddMultipleChartData(timeframe);
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

function getVddSignal(value: number): string {
  if (value > VDD_SELL_THRESHOLD) return $localize`:Sell zone cycle top risk@@charts.signal.sellZoneCycleTopRisk:Sell zone - cycle top risk`;
  if (value < VDD_BUY_THRESHOLD) return $localize`:Accumulation zone signal@@charts.signal.accumulationZone:Accumulation zone`;
  return $localize`:Neutral signal@@charts.signal.neutral:Neutral`;
}

function createVddThresholdAnnotations(): Record<string, AnnotationOptions> {
  return {
    sellLine: {
      type: 'line',
      yMin: VDD_SELL_THRESHOLD,
      yMax: VDD_SELL_THRESHOLD,
      yScaleID: 'y2',
      borderColor: 'rgba(239, 68, 68, 0.75)',
      borderWidth: 1.5,
      borderDash: [6, 4],
      label: {
        display: true,
        content: `${VDD_SELL_THRESHOLD} — Sell zone`,
        position: 'end',
        backgroundColor: 'rgba(239, 68, 68, 0.82)',
        color: '#fff',
        font: { size: 10, weight: 'bold' as const },
        padding: { x: 5, y: 2 },
      },
    },
    buyLine: {
      type: 'line',
      yMin: VDD_BUY_THRESHOLD,
      yMax: VDD_BUY_THRESHOLD,
      yScaleID: 'y2',
      borderColor: 'rgba(34, 197, 94, 0.75)',
      borderWidth: 1.5,
      borderDash: [6, 4],
      label: {
        display: true,
        content: `${VDD_BUY_THRESHOLD} — Accumulation`,
        position: 'end',
        backgroundColor: 'rgba(34, 197, 94, 0.82)',
        color: '#fff',
        font: { size: 10, weight: 'bold' as const },
        padding: { x: 5, y: 2 },
      },
    },
  };
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
