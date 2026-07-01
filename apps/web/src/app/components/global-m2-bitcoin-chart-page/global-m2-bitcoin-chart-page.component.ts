import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type GlobalM2BitcoinChartResponse,
} from '@crypto-market-analysis/data-access/api-client';
import { ChartAnnotationsComponent } from '../chart-annotations/chart-annotations.component';
import {
  exportChartCsv,
  exportChartPng,
  formatCsvNumber,
  getExportDateStamp,
} from '../chart-export/chart-export.util';
import { ChartFavouriteButtonComponent } from '../chart-favourite-button/chart-favourite-button.component';
import { ChartInfoPanelComponent, type ChartInfoField } from '../chart-info-panel/chart-info-panel.component';
import { parseChartTimeframe } from '../chart-timeframe/chart-timeframe-url.util';
import { ChartViewerComponent } from '../chart-viewer/chart-viewer.component';

type GlobalM2BitcoinDataPoint = GlobalM2BitcoinChartResponse['dataPoints'][number];

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

@Component({
  selector: 'app-global-m2-bitcoin-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './global-m2-bitcoin-chart-page.component.html',
})
export class GlobalM2BitcoinChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<GlobalM2BitcoinDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    if (!points.length) return [];

    const lastM2 = [...points].reverse().find((p) => p.globalM2YoY !== null)?.globalM2YoY ?? null;
    const lastBtc = [...points].reverse().find((p) => p.btcYoYReturn !== null)?.btcYoYReturn ?? null;

    return [
      { label: 'Global M2 YoY', value: lastM2 !== null ? `${lastM2.toFixed(2)}%` : $localize`:No data value@@common.noData:No data` },
      { label: 'Liquidity impulse', value: lastM2 === null ? $localize`:No data value@@common.noData:No data` : lastM2 > 0 ? 'Expanding' : 'Contracting' },
      { label: 'BTC YoY return', value: lastBtc !== null ? `${lastBtc.toFixed(1)}%` : $localize`:No data value@@common.noData:No data` },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const lastM2 = [...this.dataPoints()].reverse().find((p) => p.globalM2YoY !== null)?.globalM2YoY ?? null;
    const lastBtc = [...this.dataPoints()].reverse().find((p) => p.btcYoYReturn !== null)?.btcYoYReturn ?? null;

    if (lastM2 === null) return 'Global M2 data is not yet available.';
    const btcText = lastBtc === null ? 'BTC YoY return is not yet available' : `BTC YoY return is ${lastBtc.toFixed(1)}%`;
    if (lastM2 > 5) return `Global M2 growth is ${lastM2.toFixed(2)}%, a strong liquidity expansion. ${btcText}. Historically, rising liquidity has coincided with stronger Bitcoin cycle conditions.`;
    if (lastM2 > 0) return `Global M2 growth is ${lastM2.toFixed(2)}%, modestly positive. ${btcText}. Liquidity is supportive, though not forceful.`;
    return `Global M2 growth is ${lastM2.toFixed(2)}%, negative. ${btcText}. Liquidity contraction has historically aligned with tougher Bitcoin cycle conditions.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());
  protected readonly infoAbout =
    'This chart compares Global M2 money supply growth with Bitcoin year-over-year returns. ' +
    'The blue line is a free-data broad-money growth proxy built from available FRED money-supply series. ' +
    'The black line shows Bitcoin year-over-year return on the right axis.';
  protected readonly infoDataSources = [
    'Global M2 YoY proxy: FRED broad-money and M2 component series, averaged by YoY growth where available',
    'BTC YoY return: local Bitcoin daily price history',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();
    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'line' as const,
          label: 'Global M2 YoY',
          data: points.map((p) => p.globalM2YoY),
          borderColor: '#20b8ee',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          yAxisID: 'y',
          order: 1,
          spanGaps: true,
        },
        {
          type: 'line' as const,
          label: 'BTC YoY',
          data: points.map((p) => p.btcYoYReturn),
          borderColor: '#111827',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y2',
          order: 2,
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
      y: {
        type: 'linear',
        position: 'left',
        min: -5,
        max: 20,
        ticks: { callback: (value) => `${Number(value).toFixed(0)}%`, color: '#0284c7', maxTicksLimit: 8 },
        grid: { color: 'rgba(0,0,0,0.06)' },
        title: { display: true, text: 'Global M2 YoY', color: '#0284c7', font: { size: 11 } },
      },
      y2: {
        type: 'linear',
        position: 'right',
        min: -500,
        max: 2500,
        ticks: { callback: (value) => `${Number(value).toFixed(0)}%`, color: '#111827', maxTicksLimit: 8 },
        grid: { display: false },
        title: { display: true, text: 'BTC YoY', color: '#111827', font: { size: 11 } },
      },
    },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { usePointStyle: true } },
      tooltip: {
        callbacks: {
          title: (items) => formatDate(String(items[0]?.label ?? '')),
          label: (item) => `${item.dataset.label ?? ''}: ${Number(item.parsed.y).toFixed(2)}%`,
        },
      },
      annotation: {
        annotations: {
          zeroLine: {
            type: 'line',
            yScaleID: 'y',
            yMin: 0,
            yMax: 0,
            borderColor: 'rgba(107, 114, 128, 0.5)',
            borderDash: [6, 4],
            borderWidth: 1,
          } as AnnotationOptions,
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('global-m2-bitcoin').catch(() => undefined);
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const requested = params.get('timeframe');
      const timeframe = parseChartTimeframe(requested);
      if (requested !== timeframe) {
        void this.router.navigate([], { relativeTo: this.route, queryParams: { timeframe }, replaceUrl: true });
        return;
      }
      void this.loadChartData(timeframe);
    });
  }

  ngAfterViewInit(): void {
    void this.chartAnnotations?.load();
  }

  protected resetZoom(): void { this.chartViewer?.resetZoom(); }

  protected toggleFullscreen(): void { this.chartViewer?.toggleFullscreen(); }
  protected toggleInfo(): void { this.infoOpen.update((v) => !v); }
  protected toggleExportMenu(): void { this.exportMenuOpen.update((v) => !v); }

  protected selectTimeframe(timeframe: ChartTimeframe): void {
    if (this.selectedTimeframe() === timeframe || this.isLoading()) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { timeframe } });
  }

  protected updateUserAnnotations(annotations: Record<string, AnnotationOptions>): void {
    this.userAnnotations.set(annotations);
  }

  protected handleChartPoint(point: Parameters<ChartAnnotationsComponent['handleChartPoint']>[0]): void {
    this.chartAnnotations?.handleChartPoint(point);
  }

  protected async exportPng(): Promise<void> {
    const chartImageDataUrl = this.chartViewer?.exportImage();
    if (!chartImageDataUrl) return;
    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl,
      chartTitle: 'Global M2 vs BTC YoY',
      fileName: `global-m2-bitcoin_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `global-m2-bitcoin_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: 'Global M2 YoY (%)', value: (row) => formatCsvNumber(row.globalM2YoY) },
        { header: 'BTC YoY (%)', value: (row) => formatCsvNumber(row.btcYoYReturn) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const ts = this.lastUpdated();
    if (!ts) return $localize`:Waiting for data@@charts.waitingForData:Waiting for data`;
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
    }) + ' UTC';
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await this.api.getGlobalM2BitcoinChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(error instanceof ApiClientError ? error.message : 'Chart data could not be loaded. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}

function formatDate(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
