import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type RealizePriceChartDataPoint,
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

const REALIZED_PRICE_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'realized_price', label: 'Realized Price (USD)' },
  { value: 'btc_price', label: 'BTC Price USD' },
];

const HALVING_DATES_MS = [
  Date.parse('2009-01-03T00:00:00Z'),
  Date.parse('2012-11-28T00:00:00Z'),
  Date.parse('2016-07-09T00:00:00Z'),
  Date.parse('2020-05-11T00:00:00Z'),
  Date.parse('2024-04-19T00:00:00Z'),
  Date.parse('2028-04-21T00:00:00Z'),
];

function halvingCycleColor(date: string): string {
  if (!date) return '#888';
  const ms = Date.parse(`${date}T00:00:00Z`);
  const nextHalving = HALVING_DATES_MS.find((h) => h > ms) ?? HALVING_DATES_MS[HALVING_DATES_MS.length - 1];
  const daysUntil = (nextHalving - ms) / 86_400_000;
  const hue = Math.max(0, Math.min(240, 240 - (daysUntil / 1400) * 240));
  return `hsl(${hue.toFixed(0)}, 90%, 52%)`;
}

@Component({
  selector: 'app-realized-price-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './realized-price-chart-page.component.html',
})
export class RealizePriceChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = REALIZED_PRICE_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<RealizePriceChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const lastRpPoint = [...points].reverse().find((p) => p.realizedPrice !== null);
    const rp = lastRpPoint?.realizedPrice ?? null;
    const mvrv = lastRpPoint?.mvrvRatio ?? null;
    return [
      { label: 'BTC Price', value: formatUsd(last.priceUsd) },
      { label: 'Realized Price', value: rp !== null ? formatUsd(rp) : 'N/A' },
      { label: 'MVRV Ratio', value: mvrv !== null ? mvrv.toFixed(2) : 'N/A' },
      { label: 'Signal', value: mvrv !== null ? getMvrvSignal(mvrv) : 'N/A' },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const lastRpPoint = [...points].reverse().find((p) => p.mvrvRatio !== null);
    const mvrv = lastRpPoint?.mvrvRatio ?? null;
    if (mvrv === null) return 'Waiting for realized price data to compute the MVRV ratio.';
    if (mvrv > 3.5) {
      return `MVRV Ratio is ${mvrv.toFixed(2)} — above 3.5, historically associated with cycle top sell zones. Market value significantly exceeds the aggregate cost basis of all coins.`;
    }
    if (mvrv > 2.0) {
      return `MVRV Ratio is ${mvrv.toFixed(2)} — in the overvalued range (2.0–3.5). Price is meaningfully above realized price, suggesting elevated profit levels across the network.`;
    }
    if (mvrv >= 1.0) {
      return `MVRV Ratio is ${mvrv.toFixed(2)} — in the fair value range (1.0–2.0). Price is above realized price but within normal historical bounds.`;
    }
    return `MVRV Ratio is ${mvrv.toFixed(2)} — below realized price. The average coin is underwater, historically associated with bear market accumulation zones.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'Bitcoin Realized Price is the average price at which each bitcoin last moved on-chain, ' +
    'weighted by the amount of BTC. It represents the aggregate cost basis of the market. ' +
    'The MVRV Ratio (Market Value / Realized Value) compares current price to realized price — ' +
    'values above 3.5 historically signal cycle tops; values below 1.0 signal deep undervaluation.';

  protected readonly infoDataSources = [
    'Bitcoin Price: CoinGecko API (stored daily)',
    'Realized Price: CoinMetrics community API (CapMVRVCur × PriceUSD) — backfilled via admin',
    'MVRV Ratio: BTC Price ÷ Realized Price — computed on the fly',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'line' as const,
          label: 'BTC Price (USD)',
          data: points.map((p) => p.priceUsd),
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 1,
          segment: {
            borderColor: (ctx: { p0DataIndex: number }) =>
              halvingCycleColor(points[ctx.p0DataIndex]?.date ?? ''),
          },
        },
        {
          type: 'line' as const,
          label: 'Realized Price (USD)',
          data: points.map((p) => p.realizedPrice),
          borderColor: '#000000',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line' as const,
          showLine: false,
          label: 'MVRV Ratio',
          data: points.map((p) => p.mvrvRatio),
          backgroundColor: 'rgba(156, 163, 175, 0.7)',
          pointRadius: 2,
          pointHoverRadius: 4,
          yAxisID: 'y2',
          order: 3,
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
        max: 8,
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
              return `MVRV Ratio: ${v?.toFixed(3) ?? 'N/A'}`;
            }
            if (item.datasetIndex === 1) {
              return `Realized Price: ${formatUsd(Number(item.parsed.y))}`;
            }
            return `BTC Price: ${formatUsd(Number(item.parsed.y))}`;
          },
        },
      },
      annotation: {
        annotations: {
          ...createFairValueAnnotation(),
          ...createHalvingAnnotations(this.dataPoints()[0]?.date ?? '2009-01-03'),
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('realized-price').catch(() => undefined);
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
      chartTitle: 'Bitcoin Realized Price',
      fileName: `realized-price_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `realized-price_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Date', value: (row) => row.date },
        { header: 'Price USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'Realized Price', value: (row) => formatCsvNumber(row.realizedPrice) },
        { header: 'MVRV Ratio', value: (row) => formatCsvNumber(row.mvrvRatio) },
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
      const response = await this.api.getRealizePriceChartData(timeframe);
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

function getMvrvSignal(value: number): string {
  if (value > 3.5) return 'Sell Zone';
  if (value > 2.0) return 'Overvalued';
  if (value >= 1.0) return 'Fair Value Range';
  return 'Below Realized Price';
}

function createFairValueAnnotation(): Record<string, AnnotationOptions> {
  return {
    fairValueLine: {
      type: 'line',
      yMin: 1,
      yMax: 1,
      yScaleID: 'y2',
      borderColor: 'rgba(239, 68, 68, 0.75)',
      borderWidth: 1.5,
      label: {
        display: true,
        content: '1.0 — Fair Value',
        position: 'end',
        backgroundColor: 'rgba(239, 68, 68, 0.82)',
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
