import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type DifficultyRibbonChartResponse,
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

type DifficultyRibbonDataPoint = DifficultyRibbonChartResponse['dataPoints'][number];

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

const DIFFICULTY_RIBBON_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-difficulty-ribbon-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './difficulty-ribbon-chart-page.component.html',
})
export class DifficultyRibbonChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = DIFFICULTY_RIBBON_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<DifficultyRibbonDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const priceLast = points[points.length - 1];
    if (!priceLast) return [];
    const last = [...points].reverse().find((p) => p.ma9 !== null) ?? priceLast;
    const price = priceLast.priceUsd;
    const ma9 = last.ma9;
    const ma200 = last.ma200;
    const ribbonStatus =
      ma9 !== null && ma200 !== null && ma9 < ma200
        ? $localize`:Ribbon compressed@@charts.signal.ribbonCompressed:Compressed (Miner Stress)`
        : $localize`:Ribbon expanded@@charts.signal.ribbonExpanded:Expanded (Healthy)`;
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: formatUsd(price) },
      { label: $localize`:9d MA@@charts.metric.ma9d:9d MA`, value: ma9 !== null ? formatDifficulty(ma9) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:200d MA@@charts.metric.ma200d:200d MA`, value: ma200 !== null ? formatDifficulty(ma200) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:Ribbon status@@charts.metric.ribbonStatus:Ribbon status`, value: ribbonStatus },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    if (!points.length) return $localize`:Waiting for data sentence@@charts.waitingForDataSentence:Waiting for data.`;
    const last = [...points].reverse().find((p) => p.ma9 !== null) ?? points[points.length - 1];
    const ma9 = last.ma9;
    const ma200 = last.ma200;
    if (ma9 === null || ma200 === null) {
      return 'Difficulty ribbon moving averages are not yet fully available.';
    }
    if (ma9 < ma200) {
      return `The ribbon is compressed — the 9d MA (${formatDifficulty(ma9)}) is below the 200d MA (${formatDifficulty(ma200)}). This signals miner capitulation and has historically coincided with long-term buying opportunities.`;
    }
    return `The ribbon is expanding — the 9d MA (${formatDifficulty(ma9)}) is above the 200d MA (${formatDifficulty(ma200)}). Mining difficulty is growing healthily, indicating a stable or growing miner base.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'The Difficulty Ribbon displays 8 moving averages (9 to 200 days) of Bitcoin\'s mining difficulty. ' +
    'When short-term MAs drop below long-term MAs, the ribbon compresses — signalling that miners are capitulating and selling Bitcoin to cover costs. ' +
    'Historically, ribbon compression has coincided with long-term buying opportunities.';

  protected readonly infoDataSources = [
    'Mining Difficulty: Blockchain.info (full history from 2009)',
    'BTC Price: CoinGecko (stored daily)',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'line' as const,
          label: '9d MA',
          data: points.map((p) => p.ma9),
          borderColor: '#ef4444',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          spanGaps: false,
        },
        {
          type: 'line' as const,
          label: '14d MA',
          data: points.map((p) => p.ma14),
          borderColor: '#f97316',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          spanGaps: false,
        },
        {
          type: 'line' as const,
          label: '25d MA',
          data: points.map((p) => p.ma25),
          borderColor: '#eab308',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          spanGaps: false,
        },
        {
          type: 'line' as const,
          label: '40d MA',
          data: points.map((p) => p.ma40),
          borderColor: '#84cc16',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          spanGaps: false,
        },
        {
          type: 'line' as const,
          label: '60d MA',
          data: points.map((p) => p.ma60),
          borderColor: '#22c55e',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          spanGaps: false,
        },
        {
          type: 'line' as const,
          label: '90d MA',
          data: points.map((p) => p.ma90),
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          spanGaps: false,
        },
        {
          type: 'line' as const,
          label: '128d MA',
          data: points.map((p) => p.ma128),
          borderColor: '#6366f1',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          spanGaps: false,
        },
        {
          type: 'line' as const,
          label: '200d MA',
          data: points.map((p) => p.ma200),
          borderColor: '#a855f7',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          spanGaps: false,
        },
        {
          type: 'line' as const,
          label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`,
          data: points.map((p) => p.priceUsd),
          borderColor: '#1f2937',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
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
            if (v >= 1e15) return `${(v / 1e15).toFixed(0)}P`;
            if (v >= 1e12) return `${(v / 1e12).toFixed(0)}T`;
            if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
            return `${v.toFixed(0)}`;
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
            if (item.dataset.yAxisID === 'y') {
              return `${label}: ${formatUsd(v)}`;
            }
            return `${label}: ${formatDifficulty(v)}`;
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
    void this.api.recordRecentChart('difficulty-ribbon').catch(() => undefined);
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
      chartTitle: 'Difficulty Ribbon',
      fileName: `difficulty-ribbon_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `difficulty-ribbon_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: '9d MA', value: (row) => formatCsvNumber(row.ma9) },
        { header: '14d MA', value: (row) => formatCsvNumber(row.ma14) },
        { header: '25d MA', value: (row) => formatCsvNumber(row.ma25) },
        { header: '40d MA', value: (row) => formatCsvNumber(row.ma40) },
        { header: '60d MA', value: (row) => formatCsvNumber(row.ma60) },
        { header: '90d MA', value: (row) => formatCsvNumber(row.ma90) },
        { header: '128d MA', value: (row) => formatCsvNumber(row.ma128) },
        { header: '200d MA', value: (row) => formatCsvNumber(row.ma200) },
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
      const response = await this.api.getDifficultyRibbonChartData(timeframe);
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

function formatDifficulty(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return $localize`:No data value@@common.noData:No data`;
  if (value >= 1e15) return `${(value / 1e15).toFixed(2)}P`;
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
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
