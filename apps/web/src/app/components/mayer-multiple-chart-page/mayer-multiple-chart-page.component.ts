import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type MayerMultipleChartResponse,
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

type MayerMultipleDataPoint = MayerMultipleChartResponse['dataPoints'][number];

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
  { date: '2024-04-19', label: '2024 Halving' },
];

const MAYER_MULTIPLE_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: 'BTC Price USD' },
];

@Component({
  selector: 'app-mayer-multiple-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
  ],
  templateUrl: './mayer-multiple-chart-page.component.html',
})
export class MayerMultipleChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = MAYER_MULTIPLE_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<MayerMultipleDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const price = last.priceUsd;
    const ma200 = last.ma200;
    const multiple = last.mayerMultiple;
    const signalValue =
      multiple !== null && multiple > 2.4
        ? 'Overheated'
        : multiple !== null && multiple < 0.8
          ? 'Accumulation'
          : 'Neutral';
    return [
      { label: 'BTC Price', value: formatUsd(price) },
      { label: '200d MA', value: ma200 !== null ? formatUsd(ma200) : 'N/A' },
      { label: 'Mayer Multiple', value: multiple !== null ? multiple.toFixed(3) : 'N/A' },
      { label: 'Signal', value: signalValue },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return 'Waiting for data.';
    const multiple = last.mayerMultiple;
    if (multiple === null) return '200-day moving average not yet available (requires 200 days of data).';
    if (multiple > 2.4) {
      return `Mayer Multiple is ${multiple.toFixed(2)}. Values above 2.4 historically signal overheating; the market may be overextended relative to the 200-day MA.`;
    }
    if (multiple < 0.8) {
      return `Mayer Multiple is ${multiple.toFixed(2)}. Values below 0.8 historically signal undervaluation; the market is trading well below the 200-day MA.`;
    }
    return `Mayer Multiple is ${multiple.toFixed(2)}. Values above 2.4 historically signal overheating; below 0.8 signals undervaluation.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'The Mayer Multiple is the ratio of Bitcoin\'s price to its 200-day moving average. ' +
    'Created by Trace Mayer, it identifies historically overvalued (above 2.4) and undervalued (below 0.8) periods. ' +
    'The 200-day MA acts as a long-term trend line and the multiple quantifies price deviation from it.';

  protected readonly infoDataSources = [
    'BTC Price: CoinGecko (stored daily)',
    '200-day MA: 200-day rolling average computed on-demand',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        // Mayer Multiple — teal, solid, thick, left axis (y2)
        {
          type: 'line' as const,
          label: 'Mayer Multiple',
          data: points.map((p) => p.mayerMultiple),
          borderColor: '#0d9488',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          order: 1,
          spanGaps: false,
        },
        // BTC Price — dark line, thin, right axis (y)
        {
          type: 'line' as const,
          label: 'BTC Price',
          data: points.map((p) => p.priceUsd),
          borderColor: '#1f2937',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 2,
          spanGaps: false,
        },
        // 200-day MA — blue, solid, right axis (y)
        {
          type: 'line' as const,
          label: '200-day MA',
          data: points.map((p) => p.ma200),
          borderColor: '#3b82f6',
          borderWidth: 2,
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
        max: 4,
        ticks: {
          callback: (value) => `${Number(value).toFixed(1)}`,
          color: '#6b7280',
        },
        grid: { color: 'rgba(0,0,0,0.06)' },
        title: {
          display: false,
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
            const v = Number(item.parsed.y);
            const label = item.dataset.label ?? '';
            if (item.dataset.yAxisID === 'y2') {
              return `${label}: ${v.toFixed(3)}`;
            }
            return `${label}: ${formatUsd(v)}`;
          },
        },
      },
      annotation: {
        annotations: {
          mayerRef24: {
            type: 'line',
            yMin: 2.4,
            yMax: 2.4,
            yScaleID: 'y2',
            borderColor: 'rgba(239, 68, 68, 0.75)',
            borderDash: [6, 4],
            borderWidth: 1.5,
            label: {
              display: true,
              content: 'Overheated (2.4)',
              position: 'start',
              backgroundColor: 'rgba(239, 68, 68, 0.85)',
              color: '#fff',
              font: { size: 9, weight: 'bold' as const },
              padding: { x: 4, y: 2 },
            },
          } as AnnotationOptions,
          mayerRef10: {
            type: 'line',
            yMin: 1.0,
            yMax: 1.0,
            yScaleID: 'y2',
            borderColor: 'rgba(234, 179, 8, 0.75)',
            borderDash: [6, 4],
            borderWidth: 1.5,
            label: {
              display: true,
              content: 'Fair Value (1.0)',
              position: 'start',
              backgroundColor: 'rgba(161, 123, 5, 0.85)',
              color: '#fff',
              font: { size: 9, weight: 'bold' as const },
              padding: { x: 4, y: 2 },
            },
          } as AnnotationOptions,
          mayerRef08: {
            type: 'line',
            yMin: 0.8,
            yMax: 0.8,
            yScaleID: 'y2',
            borderColor: 'rgba(34, 197, 94, 0.75)',
            borderDash: [6, 4],
            borderWidth: 1.5,
            label: {
              display: true,
              content: 'Accumulation (0.8)',
              position: 'start',
              backgroundColor: 'rgba(21, 128, 61, 0.85)',
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
    void this.api.recordRecentChart('mayer-multiple').catch(() => undefined);
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
      chartTitle: 'Mayer Multiple',
      fileName: `mayer-multiple_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `mayer-multiple_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Date', value: (row) => row.date },
        { header: 'Price USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: '200d MA', value: (row) => formatCsvNumber(row.ma200) },
        { header: 'Mayer Multiple', value: (row) => formatCsvNumber(row.mayerMultiple) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const ts = this.lastUpdated();
    if (!ts) return 'Waiting for data';
    return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await this.api.getMayerMultipleChartData(timeframe);
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
  if (!Number.isFinite(value)) return 'n/a';
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
