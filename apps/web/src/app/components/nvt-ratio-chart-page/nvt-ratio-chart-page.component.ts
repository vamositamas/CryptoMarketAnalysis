import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type NvtRatioChartResponse,
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

type NvtRatioDataPoint = NvtRatioChartResponse['dataPoints'][number];

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

const NVT_RATIO_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-nvt-ratio-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './nvt-ratio-chart-page.component.html',
})
export class NvtRatioChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = NVT_RATIO_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<NvtRatioDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const priceLast = points[points.length - 1];
    if (!priceLast) return [];
    const last = [...points].reverse().find((p) => p.nvtRatio !== null) ?? priceLast;
    const price = priceLast.priceUsd;
    const nvtRatio = last.nvtRatio;
    const nvtSignal = last.nvtSignal;
    const signalValue =
      nvtSignal !== null && nvtSignal > 150
        ? $localize`:Overvalued signal@@charts.signal.overvalued:Overvalued`
        : nvtSignal !== null && nvtSignal < 45
          ? $localize`:Undervalued signal@@charts.signal.undervalued:Undervalued`
          : $localize`:Neutral signal@@charts.signal.neutral:Neutral`;
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: formatUsd(price) },
      { label: $localize`:NVT ratio@@charts.metric.nvtRatio:NVT Ratio`, value: nvtRatio !== null ? nvtRatio.toFixed(0) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:NVT signal@@charts.metric.nvtSignal:NVT Signal / 90d MA`, value: nvtSignal !== null ? nvtSignal.toFixed(0) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: signalValue },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    if (!points.length) return $localize`:Waiting for data sentence@@charts.waitingForDataSentence:Waiting for data.`;
    const last = [...points].reverse().find((p) => p.nvtRatio !== null) ?? points[points.length - 1];
    const nvtSignal = last.nvtSignal;
    if (nvtSignal === null) return 'NVT Signal not yet available (requires sufficient transaction volume history).';
    if (nvtSignal > 150) {
      return `NVT Signal is ${nvtSignal.toFixed(0)}, above the overvaluation threshold of 150. This suggests that Bitcoin's network value is high relative to on-chain transaction volume, historically a signal of overvaluation.`;
    }
    if (nvtSignal < 45) {
      return `NVT Signal is ${nvtSignal.toFixed(0)}, below the undervaluation threshold of 45. This suggests Bitcoin's network is being heavily utilised relative to its market cap, historically a signal of undervaluation.`;
    }
    return `NVT Signal is ${nvtSignal.toFixed(0)}, within the neutral range (45–150). Network usage appears proportionate to Bitcoin's current market cap.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'The NVT Ratio (Network Value to Transactions) is Bitcoin\'s equivalent of a P/E ratio: market cap divided by daily on-chain transaction volume. ' +
    'The NVT Signal uses a 90-day moving average of NVT to reduce noise. ' +
    'Values above 150 historically signal overvaluation relative to network usage; values below 45 signal undervaluation.';

  protected readonly infoDataSources = [
    'Transaction Volume: Blockchain.info estimated-transaction-volume-usd (full history)',
    'BTC Price & Supply: CoinGecko (stored daily)',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        // NVT Ratio — orange, thin, semi-transparent, left y2 axis
        {
          type: 'line' as const,
          label: 'NVT Ratio',
          data: points.map((p) => p.nvtRatio),
          borderColor: 'rgba(249, 115, 22, 0.6)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          order: 3,
          spanGaps: false,
        },
        // NVT Signal (90d MA) — red, solid, thicker, left y2 axis
        {
          type: 'line' as const,
          label: 'NVT Signal (90d MA)',
          data: points.map((p) => p.nvtSignal),
          borderColor: '#ef4444',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          order: 2,
          spanGaps: true,
        },
        // BTC Price — dark line, thin, right y axis (log)
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
        ticks: {
          callback: (value) => String(value),
          color: '#6b7280',
        },
        grid: { color: 'rgba(0,0,0,0.06)' },
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
        grid: { display: false },
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
            if (item.dataset.yAxisID === 'y') {
              return `${label}: ${formatUsd(v)}`;
            }
            return `${label}: ${v.toFixed(1)}`;
          },
        },
      },
      annotation: {
        annotations: {
          nvtOvervalued: {
            type: 'line',
            yScaleID: 'y2',
            yMin: 150,
            yMax: 150,
            borderColor: 'rgba(239, 68, 68, 0.7)',
            borderDash: [6, 4],
            borderWidth: 1.5,
            label: {
              display: true,
              content: $localize`:NVT overvalued@@charts.annotation.nvt.overvalued:Overvalued (150)`,
              position: 'end',
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              color: '#fff',
              font: { size: 9, weight: 'bold' as const },
              padding: { x: 4, y: 2 },
            },
          } as AnnotationOptions,
          nvtUndervalued: {
            type: 'line',
            yScaleID: 'y2',
            yMin: 45,
            yMax: 45,
            borderColor: 'rgba(34, 197, 94, 0.7)',
            borderDash: [6, 4],
            borderWidth: 1.5,
            label: {
              display: true,
              content: $localize`:NVT undervalued@@charts.annotation.nvt.undervalued:Undervalued (45)`,
              position: 'end',
              backgroundColor: 'rgba(34, 197, 94, 0.8)',
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
    void this.api.recordRecentChart('nvt-ratio').catch(() => undefined);
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
      chartTitle: 'NVT Ratio',
      fileName: `nvt-ratio_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `nvt-ratio_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'NVT Ratio', value: (row) => formatCsvNumber(row.nvtRatio) },
        { header: 'NVT Signal', value: (row) => formatCsvNumber(row.nvtSignal) },
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
      const response = await this.api.getNvtRatioChartData(timeframe);
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
