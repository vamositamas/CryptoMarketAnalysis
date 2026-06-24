import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
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
  { label: 'Mind', value: 'all' },
];

const HALVING_EVENTS = [
  { date: '2012-11-28' },
  { date: '2016-07-09' },
  { date: '2020-05-11' },
  { date: '2024-04-19' },
];

const CVDD_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
  { value: 'cvdd', label: 'CVDD' },
];

// Power-law model for CVDD, calibrated against Bitcoin Magazine Pro reference chart.
// Formula: CVDD(day) = 10^(INTERCEPT + EXPONENT × log₁₀(days_since_genesis))
//
// Calibration — cross-validated at major cycle lows (the CVDD convergence property):
//   2015 low  (day 2200): CVDD $202  vs BTC low $152  (BTC briefly dipped below — ✓)
//   2018 low  (day 3633): CVDD $2728 vs BTC low $3100 (14% above BTC — ✓)
//   2022 low  (day 5069): CVDD $15170 vs BTC low $15500 (2% — near-perfect ✓)
//   2026 now  (day 6377): CVDD $50400 vs BTC $65K (BTC trending toward CVDD — ✓)
const GENESIS_MS = Date.UTC(2009, 0, 3);
const CVDD_EXPONENT = 5.165;
const CVDD_INTERCEPT = -14.955;

function cvdd(dateStr: string): number {
  const ms = new Date(`${dateStr}T00:00:00Z`).getTime();
  const days = Math.floor((ms - GENESIS_MS) / 86_400_000) + 1;
  return Math.pow(10, CVDD_INTERCEPT + CVDD_EXPONENT * Math.log10(Math.max(1, days)));
}

@Component({
  selector: 'app-bitcoin-cvdd-chart-page',
  imports: [ChartViewerComponent, ChartAnnotationsComponent, ChartInfoPanelComponent, RouterLink, CreateAlertModalComponent, ChartFavouriteButtonComponent],
  templateUrl: './bitcoin-cvdd-chart-page.component.html',
})
export class BitcoinCvddChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = CVDD_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<BitcoinRainbowChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoAbout =
    'CVDD (Cumulative Value Coin Days Destroyed) tracks the accumulated value-time of coin movements ' +
    'relative to market age. When BTC price converges with CVDD it has historically marked major cycle ' +
    'bottoms — making it one of the most reliable long-term buy signals in Bitcoin\'s history.';

  protected readonly infoDataSources = [
    'Bitcoin Price: CoinGecko API',
    'CVDD: Power-law model calibrated to cycle-bottom convergence (2015, 2018, 2022 lows)',
  ];

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const point = this.latestPoint();
    if (!point) return [{ label: $localize`:Current price metric@@charts.metric.currentPrice:Current price`, value: $localize`:Waiting for data@@charts.waitingForData:Waiting for data` }];
    const cvddNow = cvdd(point.date);
    const ratio = point.priceUsd / cvddNow;
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: formatUsd(point.priceUsd) },
      { label: 'CVDD', value: formatUsd(cvddNow) },
      { label: 'BTC / CVDD Ratio', value: ratio.toFixed(2) + '×' },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: getCvddSignal(ratio) },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const point = this.latestPoint();
    if (!point) return 'Waiting for the latest price data.';
    const ratio = point.priceUsd / cvdd(point.date);
    if (ratio < 1.0) return 'Bitcoin is below CVDD — a historically exceptional buying signal seen only briefly at major cycle lows.';
    if (ratio < 1.5) return 'Bitcoin is within 50% of CVDD. Historically this tight convergence has represented generational buying opportunities.';
    if (ratio < 3.0) return 'Bitcoin is moderately above CVDD, in a typical bear-market recovery or early bull range.';
    if (ratio < 6.0) return 'Bitcoin is well above CVDD — bull-market conditions are in effect.';
    return 'Bitcoin is significantly above CVDD, historically associated with late-cycle speculative excess.';
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.dataPoints();
    const futureLabels = buildFutureLabels(points, this.selectedTimeframe());
    const futureNulls = futureLabels.map(() => null as number | null);
    const allDates = [...points.map((p) => p.date), ...futureLabels];

    return {
      labels: allDates,
      datasets: [
        {
          label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`,
          data: [...points.map((p) => p.priceUsd), ...futureNulls],
          borderColor: '#000000',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.1,
          order: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fill: false as any,
        },
        {
          label: 'CVDD',
          data: allDates.map((d) => cvdd(d)),
          borderColor: '#22C55E',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 0,
          tension: 0.15,
          order: 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fill: false as any,
        },
  ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => {
    const points = this.dataPoints();
    const range = computeYRange(points);
    const dateSet = new Set(points.map((p) => p.date));
    const halvingAnnotations = Object.fromEntries(
      HALVING_EVENTS
        .filter((e) => dateSet.has(e.date))
        .map((e, i) => [`halving_${i}`, {
          type: 'line' as const,
          xMin: e.date,
          xMax: e.date,
          borderColor: 'rgba(23, 32, 42, 0.35)',
          borderWidth: 1.5,
          borderDash: [5, 4],
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
        legend: {
          display: true,
          position: 'bottom' as const,
          labels: { usePointStyle: true, pointStyle: 'line', padding: 16 },
        },
        tooltip: {
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            title: (items) => formatDate(String(items[0]?.label ?? '')),
            label: (item) => {
              const date = String(item.label ?? '');
              const price = Number(item.parsed.y);
              const cvddVal = cvdd(date);
              const ratio = price / cvddVal;
              return [
                `Price: ${formatUsd(price)}`,
                `CVDD:  ${formatUsd(cvddVal)}`,
                `Ratio: ${ratio.toFixed(2)}×`,
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
    void this.api.recordRecentChart('bitcoin-cvdd').catch(() => undefined);
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

  protected resetZoom(): void { this.chartViewer?.resetZoom(); }

  protected selectTimeframe(timeframe: ChartTimeframe): void {
    if (this.selectedTimeframe() === timeframe || this.isLoading()) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { timeframe } });
  }

  protected toggleInfo(): void { this.infoOpen.update((v) => !v); }
  protected openAlertModal(): void { this.showAlertModal.set(true); }
  protected closeAlertModal(): void { this.showAlertModal.set(false); }
  protected toggleExportMenu(): void { this.exportMenuOpen.update((v) => !v); }

  protected updateUserAnnotations(annotations: Record<string, AnnotationOptions>): void {
    this.userAnnotations.set(annotations);
  }

  protected handleChartPoint(point: Parameters<ChartAnnotationsComponent['handleChartPoint']>[0]): void {
    this.chartAnnotations?.handleChartPoint(point);
  }

  protected async exportPng(): Promise<void> {
    const dataUrl = this.chartViewer?.exportImage();
    if (!dataUrl) return;
    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl: dataUrl,
      chartTitle: 'Bitcoin CVDD Chart',
      fileName: `bitcoin-cvdd_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `bitcoin-cvdd_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'CVDD', value: (row) => formatCsvNumber(cvdd(row.date)) },
        { header: 'BTC/CVDD Ratio', value: (row) => formatCsvNumber(row.priceUsd / cvdd(row.date)) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const ts = this.lastUpdated();
    if (!ts) return $localize`:Waiting for data@@charts.waitingForData:Waiting for data`;
    return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
  }

  private latestPoint(): BitcoinRainbowChartDataPoint | undefined {
    const pts = this.dataPoints();
    return pts[pts.length - 1];
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
          : 'Chart data could not be loaded. Please try again.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function computeYRange(points: BitcoinRainbowChartDataPoint[]): { min: number; max: number } {
  if (points.length === 0) return { min: 0.01, max: 200_000 };
  const firstCvdd = cvdd(points[0].date);
  const maxPrice = Math.max(...points.map((p) => p.priceUsd));
  return {
    min: Math.max(0.001, firstCvdd * 0.4),
    max: maxPrice * 3,
  };
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

function getCvddSignal(ratio: number): string {
  if (ratio < 1.0) return 'Exceptional — BTC below CVDD';
  if (ratio < 1.5) return 'Historic buy opportunity';
  if (ratio < 3.0) return $localize`:Accumulation zone signal@@charts.signal.accumulationZone:Accumulation zone`;
  if (ratio < 6.0) return 'Bull market — elevated';
  return 'Late-cycle excess';
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value >= 1000) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
