import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation'; // still used for userAnnotations
import {
  ApiClientError,
  AuthApiClient,
  type BitcoinRainbowChartDataPoint,
  type ChartTimeframe,
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

// Mirrors rainbow-bands.ts with the corrected Math.pow10 formula
const GENESIS_MS = Date.UTC(2009, 0, 3);
const BAND_EXPONENT = 5.84509376;
const BAND_INTERCEPT = -17.01593313;
const BAND_DAYS_OFFSET = 1;

// 10 boundary multipliers create 9 filled bands between them
const BAND_BOUNDARIES = [0.10, 0.25, 0.40, 0.65, 1.00, 1.60, 2.50, 4.00, 6.50, 12.00];

const RAINBOW_BANDS = [
  { label: 'Fire sale!',                color: 'rgba(30,  58, 138, 0.65)' },
  { label: 'BUY!',                      color: 'rgba(37,  99, 235, 0.65)' },
  { label: 'Accumulate',                color: 'rgba(6,  182, 212, 0.65)' },
  { label: 'Still cheap',               color: 'rgba(34, 197,  94, 0.65)' },
  { label: 'HODL',                      color: 'rgba(132,204,  22, 0.65)' },
  { label: 'Is this a bubble?',         color: 'rgba(234,179,   8, 0.65)' },
  { label: 'FOMO intensifies',          color: 'rgba(249,115,  22, 0.65)' },
  { label: 'Sell. Seriously, sell!',    color: 'rgba(239, 68,  68, 0.65)' },
  { label: 'Maximum bubble territory',  color: 'rgba(127, 29,  29, 0.65)' },
];

const HALVING_EVENTS = [
  { date: '2012-11-28', label: '2012 Halving' },
  { date: '2016-07-09', label: '2016 Halving' },
  { date: '2020-05-11', label: '2020 Halving' },
  { date: '2024-04-19', label: '2024 Halving' },
];

function rainbowFairValue(dateStr: string): number {
  const ms = new Date(`${dateStr}T00:00:00Z`).getTime();
  const days = Math.floor((ms - GENESIS_MS) / 86_400_000) + BAND_DAYS_OFFSET;
  return Math.pow(10, BAND_INTERCEPT + BAND_EXPONENT * Math.log10(Math.max(1, days)));
}

function rainbowBandFromPrice(priceUsd: number, fv: number): number {
  const ratio = priceUsd / fv;
  for (let i = 1; i < BAND_BOUNDARIES.length; i++) {
    if (ratio <= BAND_BOUNDARIES[i]) return i;
  }
  return 9;
}

const RAINBOW_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'rainbow_band', label: 'Rainbow Band' },
  { value: 'btc_price', label: 'BTC Price USD' },
];

@Component({
  selector: 'app-bitcoin-rainbow-chart-page',
  imports: [ChartViewerComponent, ChartAnnotationsComponent, ChartInfoPanelComponent, RouterLink, CreateAlertModalComponent],
  templateUrl: './bitcoin-rainbow-chart-page.component.html',
})
export class BitcoinRainbowChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;
  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = RAINBOW_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly reversedBands = [...RAINBOW_BANDS].reverse();
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<BitcoinRainbowChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);
  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const point = this.latestPoint();
    const band = point ? rainbowBandFromPrice(point.priceUsd, rainbowFairValue(point.date)) : null;

    return [
      { label: 'Current Position', value: getBandLabel(band) },
      { label: 'Current Price', value: point ? formatUsd(point.priceUsd) : 'Waiting for data' },
    ];
  });
  protected readonly infoInterpretation = computed(() => {
    const point = this.latestPoint();
    const band = point ? rainbowBandFromPrice(point.priceUsd, rainbowFairValue(point.date)) : null;
    return getRainbowInterpretation(band);
  });
  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());
  protected readonly infoAbout =
    'The Bitcoin Rainbow Chart uses logarithmic growth curves to identify market cycle positions. Nine color-coded bands represent valuation levels from "Fire Sale" (deep undervaluation) to "Maximum Bubble Territory" (extreme overvaluation).';
  protected readonly infoDataSources = [
    'Bitcoin Price: CoinGecko API',
    'On-chain Metrics: Blockchain.info',
    'Calculation: Rainbow bands calculated from logarithmic regression model fit to historical price data since 2009-01-03',
  ];
  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.dataPoints();
    const futureLabels = buildFutureLabels(points, this.selectedTimeframe());
    // Bands are deterministic (log formula), so we let them project into the future
    const allDates = [...points.map((p) => p.date), ...futureLabels];
    const fairValues = allDates.map((d) => rainbowFairValue(d));

    // One dataset per boundary (floor + 9 band tops), filled between adjacent datasets
    const bandDatasets = BAND_BOUNDARIES.map((mult, idx) => ({
      label: '',
      data: fairValues.map((fv) => fv * mult),
      borderWidth: 0,
      pointRadius: 0,
      pointHitRadius: 0,
      order: 1, // drawn first (behind price line)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fill: idx === 0 ? false : ('-1' as any),
      backgroundColor: idx === 0 ? 'transparent' : RAINBOW_BANDS[idx - 1].color,
      tension: 0,
    }));

    const futureNulls = futureLabels.map(() => null as number | null);

    return {
      labels: allDates,
      datasets: [
        ...bandDatasets,
        {
          label: 'Bitcoin Price',
          data: [...points.map((p) => p.priceUsd), ...futureNulls],
          borderColor: '#000000',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.15,
          order: 0, // lower order = drawn last = on top of fills
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fill: false as any,
        },
      ],
    };
  });
  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => {
    const range = getPriceRange(this.dataPoints());
    const priceDatasetIndex = BAND_BOUNDARIES.length; // band datasets come first
    const dateSet = new Set(this.dataPoints().map((p) => p.date));
    const halvingAnnotations = Object.fromEntries(
      HALVING_EVENTS
        .filter((e) => dateSet.has(e.date))
        .map((e, i) => [`halving_${i}`, {
          type: 'line' as const,
          xMin: e.date,
          xMax: e.date,
          borderColor: 'rgba(23, 32, 42, 0.45)',
          borderWidth: 1.5,
          borderDash: [5, 4],
          label: {
            display: true,
            content: e.label,
            position: 'start' as const,
            backgroundColor: 'rgba(23, 32, 42, 0.75)',
            color: '#ffffff',
            font: { size: 11 },
            padding: { x: 6, y: 3 },
            borderRadius: 4,
          },
        }]),
    );

    return {
      animation: { duration: 280 },
      scales: {
        x: {
          ticks: { maxTicksLimit: 10 },
          grid: { color: 'rgba(23, 32, 42, 0.08)' },
        },
        y: {
          type: 'logarithmic',
          min: range.min,
          max: range.max,
          ticks: {
            callback: (value) => formatUsd(Number(value)),
          },
          grid: { color: 'rgba(23, 32, 42, 0.08)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.datasetIndex === priceDatasetIndex,
          callbacks: {
            title: (items) => formatDate(String(items[0]?.label ?? '')),
            label: (item) => {
              const dateStr = String(item.label ?? '');
              const price = Number(item.parsed.y);
              const fv = rainbowFairValue(dateStr);
              const band = rainbowBandFromPrice(price, fv);

              return [
                `Price: ${formatUsd(price)}`,
                `Band: ${getBandLabel(band)} (Band ${band})`,
              ];
            },
          },
        },
        annotation: {
          annotations: { ...halvingAnnotations, ...this.userAnnotations() },
        },
      },
    };
  });

  constructor() {
    void this.api.recordRecentChart('bitcoin-rainbow').catch(() => undefined);
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
    if (this.selectedTimeframe() === timeframe || this.isLoading()) {
      return;
    }

    void this.router.navigate([], { relativeTo: this.route, queryParams: { timeframe } });
  }

  protected toggleInfo(): void {
    this.infoOpen.update((isOpen) => !isOpen);
  }

  protected openAlertModal(): void {
    this.showAlertModal.set(true);
  }

  protected closeAlertModal(): void {
    this.showAlertModal.set(false);
  }

  protected toggleExportMenu(): void {
    this.exportMenuOpen.update((isOpen) => !isOpen);
  }

  protected updateUserAnnotations(annotations: Record<string, AnnotationOptions>): void {
    this.userAnnotations.set(annotations);
  }

  protected handleChartPoint(point: Parameters<ChartAnnotationsComponent['handleChartPoint']>[0]): void {
    this.chartAnnotations?.handleChartPoint(point);
  }

  protected async exportPng(): Promise<void> {
    const chartImageDataUrl = this.chartViewer?.exportImage();

    if (!chartImageDataUrl) {
      return;
    }

    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl,
      chartTitle: 'Bitcoin Rainbow Price Chart',
      fileName: `bitcoin-rainbow-chart_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `bitcoin-rainbow-chart_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Date', value: (row) => row.date },
        { header: 'Price USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'Rainbow Band', value: (row) => row.rainbowBand },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const timestamp = this.lastUpdated();

    if (!timestamp) {
      return 'Waiting for data';
    }

    return new Date(timestamp).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  }

  private latestPoint(): BitcoinRainbowChartDataPoint | undefined {
    const dataPoints = this.dataPoints();

    return dataPoints[dataPoints.length - 1];
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const response = await this.api.getBitcoinRainbowChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Chart data load failure@@charts.rainbowLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getPriceRange(dataPoints: BitcoinRainbowChartDataPoint[]): { min: number; max: number } {
  if (dataPoints.length === 0) {
    return { min: 0.01, max: 200_000 };
  }

  const fairValues = dataPoints.map((p) => rainbowFairValue(p.date));
  const minFv = Math.min(...fairValues);
  const maxFv = Math.max(...fairValues);

  return {
    min: Math.max(0.001, minFv * BAND_BOUNDARIES[0]),
    max: maxFv * BAND_BOUNDARIES[BAND_BOUNDARIES.length - 1] * 1.1,
  };
}

function getRainbowInterpretation(band: number | null): string {
  if (band === null) {
    return 'Waiting for the latest rainbow band calculation.';
  }

  if (band <= 2) {
    return 'Bitcoin is in a historically depressed valuation zone. Cooler bands have often represented long-term accumulation opportunities.';
  }

  if (band <= 5) {
    return 'Bitcoin is near fair-value to accumulation territory. This zone has historically represented constructive long-term positioning.';
  }

  if (band <= 7) {
    return 'Bitcoin is in a warmer valuation zone. Historical cycles suggest risk management becomes more important as price moves higher through the bands.';
  }

  return 'Bitcoin is in an overheated valuation zone. Upper bands have historically appeared near speculative market-cycle extremes.';
}


function getBandLabel(band: number | null): string {
  if (band === null) {
    return 'Unknown';
  }

  return RAINBOW_BANDS[band - 1]?.label ?? 'Unknown';
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function buildFutureLabels(points: { date: string }[], timeframe: string): string[] {
  const pad: Record<string, number> = { '1m': 5, '3m': 8, '6m': 14, '1y': 21, '2y': 45, 'all': 90 };
  const days = pad[timeframe] ?? 30;
  if (points.length === 0) return [];
  const last = new Date(`${points[points.length - 1].date}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() + i + 1);
    return d.toISOString().split('T')[0];
  });
}
