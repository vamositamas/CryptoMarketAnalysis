import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type DxyBitcoinChartResponse,
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

type DxyBitcoinDataPoint = DxyBitcoinChartResponse['dataPoints'][number];

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
  selector: 'app-dxy-bitcoin-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './dxy-bitcoin-chart-page.component.html',
})
export class DxyBitcoinChartPageComponent implements AfterViewInit {
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
  protected readonly dataPoints = signal<DxyBitcoinDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    if (!points.length) return [];

    const lastDxy = [...points].reverse().find((p) => p.dxyYoYChange !== null)?.dxyYoYChange ?? null;
    const lastPrice = [...points].reverse().find((p) => p.priceUsd !== null)?.priceUsd ?? null;

    return [
      { label: 'DXY YoY', value: lastDxy !== null ? `${lastDxy.toFixed(2)}%` : $localize`:No data value@@common.noData:No data` },
      { label: 'Dollar impulse', value: lastDxy === null ? $localize`:No data value@@common.noData:No data` : lastDxy > 0 ? 'Strengthening' : 'Weakening' },
      { label: 'BTC price', value: lastPrice !== null ? formatUsd(lastPrice) : $localize`:No data value@@common.noData:No data` },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const lastDxy = [...this.dataPoints()].reverse().find((p) => p.dxyYoYChange !== null)?.dxyYoYChange ?? null;
    const lastPrice = [...this.dataPoints()].reverse().find((p) => p.priceUsd !== null)?.priceUsd ?? null;

    if (lastDxy === null) return 'DXY year-over-year data is not yet available.';
    const priceText = lastPrice === null ? 'BTC price is not yet available' : `BTC price is ${formatUsd(lastPrice)}`;
    if (lastDxy > 5) return `DXY YoY is ${lastDxy.toFixed(2)}%, showing strong dollar pressure. ${priceText}. Historically, a strengthening dollar has been a macro headwind for Bitcoin.`;
    if (lastDxy > 0) return `DXY YoY is ${lastDxy.toFixed(2)}%, showing mild dollar strength. ${priceText}. This can keep liquidity conditions tighter for dollar-denominated risk assets.`;
    return `DXY YoY is ${lastDxy.toFixed(2)}%, showing a weaker dollar backdrop. ${priceText}. Historically, dollar weakness has aligned with more supportive Bitcoin cycle conditions.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());
  protected readonly infoAbout =
    'This chart compares the year-over-year change in the US dollar index with Bitcoin price. ' +
    'The purple line shows dollar strength on the left axis. The black line shows BTC price on a logarithmic right axis. ' +
    'The relationship is usually inverse: rising dollar pressure tends to coincide with weaker Bitcoin conditions, while dollar weakness tends to support risk assets.';
  protected readonly infoDataSources = [
    'DXY YoY proxy: FRED DTWEXBGS broad US dollar index, year-over-year change',
    'BTC price: local Bitcoin daily price history',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();
    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'line' as const,
          label: 'DXY YoY',
          data: points.map((p) => p.dxyYoYChange),
          borderColor: '#a855f7',
          borderWidth: 1.6,
          pointRadius: 0,
          tension: 0.15,
          yAxisID: 'y',
          order: 1,
          spanGaps: true,
        },
        {
          type: 'line' as const,
          label: 'BTC',
          data: points.map((p) => p.priceUsd),
          borderColor: '#111827',
          borderWidth: 1.4,
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
        min: -15,
        max: 30,
        ticks: { callback: (value) => `${Number(value).toFixed(0)}%`, color: '#7e22ce', maxTicksLimit: 9 },
        grid: { color: 'rgba(0,0,0,0.06)' },
        title: { display: true, text: 'US Dollar Index YoY Change', color: '#7e22ce', font: { size: 11 } },
      },
      y2: {
        type: 'logarithmic',
        position: 'right',
        min: 1,
        ticks: { callback: (value) => formatUsdTick(Number(value)), color: '#111827', maxTicksLimit: 8 },
        grid: { display: false },
        title: { display: true, text: 'BTC Price (USD)', color: '#111827', font: { size: 11 } },
      },
    },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { usePointStyle: true } },
      tooltip: {
        callbacks: {
          title: (items) => formatDate(String(items[0]?.label ?? '')),
          label: (item) => item.dataset.yAxisID === 'y2'
            ? `${item.dataset.label ?? ''}: ${formatUsd(Number(item.parsed.y))}`
            : `${item.dataset.label ?? ''}: ${Number(item.parsed.y).toFixed(2)}%`,
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
    void this.api.recordRecentChart('dxy-bitcoin').catch(() => undefined);
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
      chartTitle: 'DXY vs Bitcoin',
      fileName: `dxy-bitcoin_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `dxy-bitcoin_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: 'DXY YoY (%)', value: (row) => formatCsvNumber(row.dxyYoYChange) },
        { header: 'BTC Price (USD)', value: (row) => formatCsvNumber(row.priceUsd) },
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
      const response = await this.api.getDxyBitcoinChartData(timeframe);
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

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatUsdTick(value: number): string {
  if (value >= 1_000_000) return `$${Math.round(value / 1_000_000)}m`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}
