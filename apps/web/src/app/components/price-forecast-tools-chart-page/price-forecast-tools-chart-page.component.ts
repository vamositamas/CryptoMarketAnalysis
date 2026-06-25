import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type PriceForecastDataPoint,
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

const PRICE_FORECAST_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-price-forecast-tools-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './price-forecast-tools-chart-page.component.html',
})
export class PriceForecastToolsChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = PRICE_FORECAST_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<PriceForecastDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];

    const price = last.priceUsd;
    const topCap = last.topCap;
    const deltaTop = last.deltaTop;
    const cvdd = last.cvdd;
    const balancedPrice = last.balancedPrice;
    const terminalPrice = last.terminalPrice;

    let signalText = $localize`:Neutral signal@@charts.signal.neutral:Neutral`;
    if (cvdd !== null && price < cvdd) {
      signalText = $localize`:Deep undervalue@@charts.signal.deepUndervalue:Deep Undervalue`;
    } else if (balancedPrice !== null && price < balancedPrice) {
      signalText = $localize`:Undervalued signal@@charts.signal.undervalued:Undervalued`;
    } else if (deltaTop !== null && price > deltaTop) {
      signalText = $localize`:Approaching top@@charts.signal.approachingTop:Approaching Top`;
    } else if (topCap !== null && price > topCap) {
      signalText = $localize`:Cycle top zone@@charts.signal.cycleTopZone:Cycle Top Zone`;
    } else if (terminalPrice !== null && price > terminalPrice) {
      signalText = $localize`:Sell signal@@charts.signal.sellSignal:Sell signal`;
    }

    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: formatUsd(price) },
      { label: $localize`:Top Cap@@charts.metric.topCap:Top Cap`, value: topCap !== null ? formatUsd(topCap) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:Delta Top@@charts.metric.deltaCap:Delta Top`, value: deltaTop !== null ? formatUsd(deltaTop) : $localize`:No data value@@common.noData:No data` },
      { label: $localize`:CVDD metric@@charts.metric.cvdd:CVDD`, value: cvdd !== null ? formatUsd(cvdd) : 'Loading...' },
      { label: $localize`:Balanced Price@@charts.metric.balancedPrice:Balanced Price`, value: balancedPrice !== null ? formatUsd(balancedPrice) : 'Loading...' },
      {
        label: $localize`:Terminal Price@@charts.metric.terminalPrice:Terminal Price`,
        value: terminalPrice !== null
          ? (price > terminalPrice ? `${formatUsd(terminalPrice)} — Sell signal` : formatUsd(terminalPrice))
          : 'Loading...',
      },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: signalText },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return $localize`:Waiting for data sentence@@charts.waitingForDataSentence:Waiting for data.`;

    const price = last.priceUsd;
    const cvdd = last.cvdd;
    const balancedPrice = last.balancedPrice;
    const deltaTop = last.deltaTop;
    const topCap = last.topCap;

    if (cvdd !== null && price < cvdd) {
      return `BTC price (${formatUsd(price)}) is below CVDD (${formatUsd(cvdd)}). Historically this is a deep undervaluation zone that coincides with bear market lows.`;
    }
    if (balancedPrice !== null && price < balancedPrice) {
      return `BTC price (${formatUsd(price)}) is below the Balanced Price (${formatUsd(balancedPrice)}), suggesting the market is undervalued relative to on-chain cost basis.`;
    }
    if (topCap !== null && price > topCap) {
      return `BTC price (${formatUsd(price)}) is above Top Cap (${formatUsd(topCap)}). This has historically marked cycle tops.`;
    }
    if (deltaTop !== null && price > deltaTop) {
      return `BTC price (${formatUsd(price)}) is above Delta Top (${formatUsd(deltaTop)}), approaching the upper range of historical cycle peaks.`;
    }
    return `BTC price (${formatUsd(price)}) is in the neutral range between bear market floor models and cycle top targets.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'Price Forecast Tools combines on-chain models to identify historically reliable price targets. ' +
    'Top Cap and Delta Top have tracked Bitcoin\'s cycle highs; CVDD, Balanced Price, and Terminal Price have tracked cycle lows and local tops.';

  protected readonly infoDataSources = [
    'BTC Price & Supply: CoinGecko + halving schedule (stored daily)',
    'Top Cap & Delta Top: Computed from Average Cap and Realized Cap — full history',
    'CVDD, Balanced Price, Terminal Price: Bitcoin-data.com (2022-present)',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        // Top Cap — blue
        {
          type: 'line' as const,
          label: 'Top Cap',
          data: points.map((p) => p.topCap),
          borderColor: '#3b82f6',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          spanGaps: false,
          order: 5,
        },
        // Delta Top — purple
        {
          type: 'line' as const,
          label: 'Delta Top',
          data: points.map((p) => p.deltaTop),
          borderColor: '#a855f7',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          spanGaps: false,
          order: 4,
        },
        // Terminal Price — red
        {
          type: 'line' as const,
          label: 'Terminal Price',
          data: points.map((p) => p.terminalPrice),
          borderColor: '#ef4444',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          spanGaps: false,
          order: 3,
        },
        // Balanced Price — amber/gold
        {
          type: 'line' as const,
          label: 'Balanced Price',
          data: points.map((p) => p.balancedPrice),
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          spanGaps: false,
          order: 3,
        },
        // CVDD — green
        {
          type: 'line' as const,
          label: 'CVDD',
          data: points.map((p) => p.cvdd),
          borderColor: '#22c55e',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          spanGaps: false,
          order: 2,
        },
        // BTC Price — near-black, thin, on top
        {
          type: 'line' as const,
          label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`,
          data: points.map((p) => p.priceUsd),
          borderColor: '#1f2937',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          spanGaps: false,
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
            return `$${v.toFixed(0)}`;
          },
          color: '#6b7280',
        },
        grid: { color: 'rgba(0,0,0,0.06)' },
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
    void this.api.recordRecentChart('price-forecast-tools').catch(() => undefined);
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
      chartTitle: 'Price Forecast Tools',
      fileName: `price-forecast-tools_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `price-forecast-tools_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'Top Cap', value: (row) => formatCsvNumber(row.topCap) },
        { header: 'Delta Top', value: (row) => formatCsvNumber(row.deltaTop) },
        { header: 'CVDD', value: (row) => formatCsvNumber(row.cvdd) },
        { header: 'Balanced Price', value: (row) => formatCsvNumber(row.balancedPrice) },
        { header: 'Terminal Price', value: (row) => formatCsvNumber(row.terminalPrice) },
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
      const response = await this.api.getPriceForecastChartData(timeframe);
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
