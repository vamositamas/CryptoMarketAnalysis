import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type HashRibbonsChartResponse,
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

type HashRibbonsDataPoint = HashRibbonsChartResponse['dataPoints'][number];

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

const HASH_RIBBONS_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: 'BTC Price USD' },
];

@Component({
  selector: 'app-hash-ribbons-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
  ],
  templateUrl: './hash-ribbons-chart-page.component.html',
})
export class HashRibbonsChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = HASH_RIBBONS_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<HashRibbonsDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const { priceUsd, ma30, ma60, isBuySignal } = last;
    const status =
      ma30 !== null && ma60 !== null && ma30 > ma60
        ? 'Recovery (30d > 60d)'
        : 'Capitulation (30d < 60d)';
    const recentSignal = isBuySignal ? 'Buy Signal Active' : 'No Active Signal';
    return [
      { label: 'BTC Price', value: formatUsd(priceUsd) },
      { label: '30d Hash Rate MA', value: ma30 !== null ? formatHashRate(ma30) : 'N/A' },
      { label: '60d Hash Rate MA', value: ma60 !== null ? formatHashRate(ma60) : 'N/A' },
      { label: 'Status', value: status },
      { label: 'Recent Signal', value: recentSignal },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return 'Waiting for data.';
    const { ma30, ma60, isBuySignal } = last;
    if (ma30 === null || ma60 === null) {
      return 'Hash rate moving averages are not yet available.';
    }
    const phase =
      ma30 > ma60
        ? 'Miners are in a recovery phase — the 30-day hash rate MA has crossed above the 60-day MA, indicating renewed miner confidence.'
        : 'Miners are in a capitulation phase — the 30-day hash rate MA is below the 60-day MA, indicating miner stress and potential shake-out.';
    const signalNote = isBuySignal
      ? ' A buy signal is currently active on the most recent data point.'
      : ' No active buy signal on the most recent data point.';
    return phase + signalNote;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'Hash Ribbons use the 30-day and 60-day moving averages of Bitcoin\'s hash rate to identify miner capitulation and recovery phases. ' +
    'When the 30d MA crosses back above the 60d MA after a period of miner stress, it has historically produced some of Bitcoin\'s most reliable long-term buy signals.';

  protected readonly infoDataSources = [
    'Hash Rate: Blockchain.info (full history from 2009)',
    'BTC Price: CoinGecko (stored daily)',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        // 30-day Hash Rate MA — blue, left axis
        {
          type: 'line' as const,
          label: '30d Hash Rate MA',
          data: points.map((p) => p.ma30),
          borderColor: '#3b82f6',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          order: 3,
          spanGaps: false,
        },
        // 60-day Hash Rate MA — orange, left axis
        {
          type: 'line' as const,
          label: '60d Hash Rate MA',
          data: points.map((p) => p.ma60),
          borderColor: '#f97316',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          order: 4,
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
          order: 2,
          spanGaps: false,
        },
        // Buy Signals — shown as green dots on the price line
        {
          type: 'line' as const,
          label: 'Buy Signal',
          data: points.map((p) => p.isBuySignal ? p.priceUsd : null),
          pointStyle: 'circle' as const,
          pointRadius: 7,
          pointHoverRadius: 9,
          pointBackgroundColor: '#22c55e',
          pointBorderColor: '#16a34a',
          pointBorderWidth: 2,
          borderWidth: 0,
          showLine: false,
          spanGaps: false,
          yAxisID: 'y',
          order: 1,
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
        ticks: {
          callback: (value) => {
            const v = Number(value);
            if (v >= 1e21) return `${(v / 1e21).toFixed(0)} ZH/s`;
            if (v >= 1e18) return `${(v / 1e18).toFixed(0)} EH/s`;
            if (v >= 1e15) return `${(v / 1e15).toFixed(0)} PH/s`;
            if (v >= 1e12) return `${(v / 1e12).toFixed(0)} TH/s`;
            return `${v.toFixed(0)} H/s`;
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
            if (label === '30d Hash Rate MA' || label === '60d Hash Rate MA') {
              return `${label}: ${formatHashRate(v)}`;
            }
            return `${label}: ${formatUsd(v)}`;
          },
        },
      },
      annotation: {
        annotations: {
          ...createHalvingAnnotations(this.dataPoints()[0]?.date ?? '2010-07-01'),
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('hash-ribbons').catch(() => undefined);
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
      chartTitle: 'Hash Ribbons',
      fileName: `hash-ribbons_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `hash-ribbons_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Date', value: (row) => row.date },
        { header: 'Price USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: '30d Hash Rate MA', value: (row) => formatCsvNumber(row.ma30) },
        { header: '60d Hash Rate MA', value: (row) => formatCsvNumber(row.ma60) },
        { header: 'Buy Signal', value: (row) => (row.isBuySignal ? '1' : '0') },
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
      const response = await this.api.getHashRibbonsChartData(timeframe);
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

function formatHashRate(value: number): string {
  if (!Number.isFinite(value)) return 'n/a';
  if (value >= 1e21) return `${(value / 1e21).toFixed(2)} ZH/s`;
  if (value >= 1e18) return `${(value / 1e18).toFixed(2)} EH/s`;
  if (value >= 1e15) return `${(value / 1e15).toFixed(2)} PH/s`;
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)} TH/s`;
  return `${value.toFixed(0)} H/s`;
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
