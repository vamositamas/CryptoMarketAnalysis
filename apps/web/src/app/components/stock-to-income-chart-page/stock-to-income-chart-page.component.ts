import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type StockToIncomeDataPoint,
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
  { date: '2028-04-21', label: '2028 Halving' },
  { date: '2032-04-01', label: '2032 Halving' },
  { date: '2036-04-01', label: '2036 Halving' },
];

const S2I_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: 'BTC Price USD' },
];

@Component({
  selector: 'app-stock-to-income-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './stock-to-income-chart-page.component.html',
})
export class StockToIncomeChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = S2I_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<StockToIncomeDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);
  protected readonly regressionA = signal(0);
  protected readonly regressionB = signal(1);
  protected readonly sigma = signal(0);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    // Get last historical point (priceUsd != null)
    const lastHistorical = [...points].reverse().find((p) => p.priceUsd !== null);
    if (!lastHistorical) return [];
    const price = lastHistorical.priceUsd!;
    const model = lastHistorical.modelPrice;
    const s2i = lastHistorical.s2iRatio;
    const pctDiff = model !== null && model > 0 ? ((price - model) / model) * 100 : null;
    return [
      { label: 'BTC Price', value: formatUsd(price) },
      { label: 'S2I Model Price', value: model !== null ? formatUsd(model) : 'N/A' },
      { label: 'S2I Ratio', value: s2i !== null ? s2i.toFixed(1) : 'N/A' },
      { label: 'Signal', value: s2i !== null ? getS2ISignal(s2i) : 'N/A' },
      {
        label: 'Current vs Model',
        value:
          pctDiff !== null
            ? `${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(1)}% ${pctDiff >= 0 ? 'above' : 'below'} model`
            : 'N/A',
      },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const lastHistorical = [...points].reverse().find((p) => p.priceUsd !== null);
    if (!lastHistorical) return 'Waiting for data.';
    const s2i = lastHistorical.s2iRatio;
    if (s2i === null) return 'S2I ratio not yet available.';
    return `Current S2I ratio is ${s2i.toFixed(2)}. ${getS2IInterpretation(s2i)}`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'The Stock to Income model extends Stock-to-Flow by including miner transaction fees in the flow calculation. ' +
    'Stock = active Bitcoin supply; Flow = block subsidy + 365-day average miner fees. ' +
    'The model is re-fit daily against actual price history. ' +
    'Unlike S2F, it projects forward as fees grow relative to subsidy post-halving.';

  protected readonly infoDataSources = [
    'BTC Price: CoinGecko (stored daily)',
    'Miner Fees: Blockchain.info transaction-fees API (stored daily)',
    'Block Subsidy: Computed from halving schedule',
    'S2I Regression: OLS fit of ln(price) ~ ln(s2i) from 2012-present',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        // Upper confidence band — fills to next dataset (lower band); hidden from legend
        {
          type: 'line' as const,
          label: 'Confidence Band',
          data: points.map((p) => p.upperBand),
          borderColor: 'transparent',
          backgroundColor: 'rgba(100,116,139,0.18)',
          fill: '+1',
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 4,
          spanGaps: true,
          hidden: false,
        },
        // Lower confidence band — hidden from legend
        {
          type: 'line' as const,
          label: 'Lower Band',
          data: points.map((p) => p.lowerBand),
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          fill: false,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 4,
          spanGaps: true,
        },
        // S2I model price — visible on both light and dark backgrounds
        {
          type: 'line' as const,
          label: 'S2I Model Price',
          data: points.map((p) => p.modelPrice),
          borderColor: '#f97316',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 2,
          spanGaps: true,
        },
        // BTC actual price — cyan, only historical (null for future and any zero-price rows)
        {
          type: 'line' as const,
          label: 'BTC Price (USD)',
          data: points.map((p) => (p.priceUsd !== null && p.priceUsd > 0 ? p.priceUsd : null)),
          borderColor: '#22d3ee',
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
        ticks: { maxTicksLimit: 12, color: '#9ca3af' },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
      y: {
        type: 'logarithmic',
        position: 'right',
        min: 0.01,
        ticks: {
          callback: (value) => {
            const v = Number(value);
            if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(0)}B`;
            if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
            if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
            if (v >= 1) return `$${v.toFixed(0)}`;
            return `$${v.toFixed(2)}`;
          },
          color: '#9ca3af',
        },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          filter: (item) => item.text !== 'Lower Band',
        },
      },
      tooltip: {
        callbacks: {
          title: (items) => formatDate(String(items[0]?.label ?? '')),
          label: (item) => {
            if (item.datasetIndex === 3) {
              return `BTC Price: ${formatUsd(Number(item.parsed.y))}`;
            }
            if (item.datasetIndex === 2) {
              return `S2I Model: ${formatUsd(Number(item.parsed.y))}`;
            }
            if (item.datasetIndex === 0) {
              return `Upper Band: ${formatUsd(Number(item.parsed.y))}`;
            }
            if (item.datasetIndex === 1) {
              return `Lower Band: ${formatUsd(Number(item.parsed.y))}`;
            }
            return `${item.dataset.label}: ${item.parsed.y}`;
          },
        },
      },
      annotation: {
        annotations: {
          ...createHalvingAnnotations(this.dataPoints()[0]?.date ?? '2012-01-01'),
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('stock-to-income').catch(() => undefined);
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
      chartTitle: 'Stock to Income Model',
      fileName: `stock-to-income_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `stock-to-income_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Date', value: (row) => row.date },
        { header: 'Price USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'Model Price', value: (row) => formatCsvNumber(row.modelPrice) },
        { header: 'Upper Band', value: (row) => formatCsvNumber(row.upperBand) },
        { header: 'Lower Band', value: (row) => formatCsvNumber(row.lowerBand) },
        { header: 'S2I Ratio', value: (row) => formatCsvNumber(row.s2iRatio) },
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
      const response = await this.api.getStockToIncomeChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
      this.regressionA.set(response.regressionA);
      this.regressionB.set(response.regressionB);
      this.sigma.set(response.sigma);
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

function getS2ISignal(s2i: number): string {
  if (s2i > 3.5) return 'Sell Zone';
  if (s2i > 2.0) return 'Overvalued';
  if (s2i >= 1.0) return 'Fair Value';
  if (s2i >= 0.5) return 'Undervalued';
  return 'Deep Undervalue';
}

function getS2IInterpretation(s2i: number): string {
  if (s2i > 3.5) {
    return `Above 3.5 — historically associated with cycle top sell zones.`;
  }
  if (s2i > 2.0) {
    return `In the overvalued range (2.0–3.5). Price is significantly above the S2I model price.`;
  }
  if (s2i >= 1.0) {
    return `In the fair value range (1.0–2.0). Price tracks the model within normal bounds.`;
  }
  if (s2i >= 0.5) {
    return `Undervalued relative to the S2I model (0.5–1.0). Historically an accumulation range.`;
  }
  return `Deep undervalue below 0.5 — extremely rare; historically associated with major cycle lows.`;
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
