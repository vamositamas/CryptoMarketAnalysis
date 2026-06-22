import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type ThermocapMultipleChartResponse,
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

type ThermocapMultipleDataPoint = ThermocapMultipleChartResponse['dataPoints'][number];

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

const THERMOCAP_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: 'BTC Price USD' },
];

@Component({
  selector: 'app-thermocap-multiple-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
  ],
  templateUrl: './thermocap-multiple-chart-page.component.html',
})
export class ThermocapMultipleChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = THERMOCAP_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<ThermocapMultipleDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const price = last.priceUsd;
    const multiple = last.thermocapMultiple;
    const signal =
      multiple !== null && multiple > 33
        ? 'Historically Overvalued'
        : multiple !== null && multiple > 10
          ? 'Elevated'
          : multiple !== null && multiple < 4
            ? 'Accumulation Zone'
            : 'Neutral';
    return [
      { label: 'BTC Price', value: formatUsd(price) },
      { label: 'Thermocap Multiple', value: multiple !== null ? `${multiple.toFixed(1)}×` : 'N/A' },
      { label: 'Signal', value: signal },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return 'Waiting for data.';
    const multiple = last.thermocapMultiple;
    if (multiple === null) return 'Thermocap Multiple not yet available.';
    if (multiple > 33) {
      return `The Thermocap Multiple is ${multiple.toFixed(1)}×, above the historical overvaluation threshold of 33×. This level has historically coincided with cycle tops and suggests elevated risk.`;
    }
    if (multiple > 10) {
      return `The Thermocap Multiple is ${multiple.toFixed(1)}×, in the elevated range (above 10×). The market is heating up but has not yet reached historically extreme levels.`;
    }
    if (multiple < 4) {
      return `The Thermocap Multiple is ${multiple.toFixed(1)}×, below the accumulation threshold of 4×. Historically this has been a deep value zone offering strong long-term entry opportunities.`;
    }
    return `The Thermocap Multiple is ${multiple.toFixed(1)}×, in the neutral range between 4× and 10×. The market is within historically normal bounds without signalling either extreme.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'The Thermocap Multiple measures Bitcoin\'s market capitalisation relative to its Thermocap — the cumulative total of all miner revenues in USD, representing the total capital invested to secure the network. Historically, multiples above 33× have marked cycle tops while values below 4× have indicated deep value accumulation zones.';

  protected readonly infoDataSources = [
    'Miners Revenue: Blockchain.info (full history from 2009)',
    'BTC Price & Supply: CoinGecko (stored daily)',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        // Thermocap Multiple — teal line, left log axis
        {
          type: 'line' as const,
          label: 'Thermocap Multiple',
          data: points.map((p) => p.thermocapMultiple),
          borderColor: '#0d9488',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          order: 2,
          spanGaps: false,
        },
        // BTC Price — dark line, right log axis
        {
          type: 'line' as const,
          label: 'BTC Price',
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
        type: 'logarithmic',
        position: 'left',
        ticks: {
          callback: (value) => {
            const v = Number(value);
            if (!Number.isFinite(v) || v <= 0) return '';
            return `${v.toFixed(0)}×`;
          },
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
              return `${label}: ${Number.isFinite(v) ? `${v.toFixed(1)}×` : 'N/A'}`;
            }
            return `${label}: ${formatUsd(v)}`;
          },
        },
      },
      annotation: {
        annotations: {
          thermocapOvervalued: {
            type: 'line',
            yMin: 33,
            yMax: 33,
            yScaleID: 'y2',
            borderColor: 'rgba(239, 68, 68, 0.75)',
            borderDash: [6, 4],
            borderWidth: 1.5,
            label: {
              display: true,
              content: 'Historically Overvalued (33×)',
              position: 'start',
              backgroundColor: 'rgba(239, 68, 68, 0.85)',
              color: '#fff',
              font: { size: 9, weight: 'bold' as const },
              padding: { x: 4, y: 2 },
            },
          } as AnnotationOptions,
          thermocapElevated: {
            type: 'line',
            yMin: 10,
            yMax: 10,
            yScaleID: 'y2',
            borderColor: 'rgba(249, 115, 22, 0.75)',
            borderDash: [6, 4],
            borderWidth: 1.5,
            label: {
              display: true,
              content: 'Elevated (10×)',
              position: 'start',
              backgroundColor: 'rgba(249, 115, 22, 0.85)',
              color: '#fff',
              font: { size: 9, weight: 'bold' as const },
              padding: { x: 4, y: 2 },
            },
          } as AnnotationOptions,
          thermocapAccumulation: {
            type: 'line',
            yMin: 4,
            yMax: 4,
            yScaleID: 'y2',
            borderColor: 'rgba(34, 197, 94, 0.75)',
            borderDash: [6, 4],
            borderWidth: 1.5,
            label: {
              display: true,
              content: 'Accumulation Zone (4×)',
              position: 'start',
              backgroundColor: 'rgba(34, 197, 94, 0.85)',
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
    void this.api.recordRecentChart('thermocap-multiple').catch(() => undefined);
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
      chartTitle: 'Thermocap Multiple',
      fileName: `thermocap-multiple_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `thermocap-multiple_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Date', value: (row) => row.date },
        { header: 'Price USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'Thermocap Multiple', value: (row) => formatCsvNumber(row.thermocapMultiple) },
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
      const response = await this.api.getThermocapMultipleChartData(timeframe);
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
