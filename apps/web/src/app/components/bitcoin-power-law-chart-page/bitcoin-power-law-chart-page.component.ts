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

const GENESIS_MS = Date.UTC(2009, 0, 3);
const POWER_LAW_EXPONENT = 5.84509376;
const MODEL_INTERCEPT = -17.01593313;

// Ceiling is 10× above model; floor is ~4× below (asymmetric — matches reference)
const FLOOR_MULTIPLIER = 0.25;
const CEILING_MULTIPLIER = 10;


const HALVING_EVENTS = [
  { date: '2012-11-28' },
  { date: '2016-07-09' },
  { date: '2020-05-11' },
  { date: '2024-04-19' },
];

const POWER_LAW_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'btc_price', label: 'BTC Price USD' },
  { value: 'power_law_model', label: 'Power Law Model Price' },
];

function powerLawDays(dateStr: string): number {
  const ms = new Date(`${dateStr}T00:00:00Z`).getTime();
  return Math.floor((ms - GENESIS_MS) / 86_400_000) + 1;
}

function powerLawModel(dateStr: string): number {
  const days = powerLawDays(dateStr);
  return Math.pow(10, MODEL_INTERCEPT + POWER_LAW_EXPONENT * Math.log10(Math.max(1, days)));
}

function powerLawFloor(dateStr: string): number {
  return powerLawModel(dateStr) * FLOOR_MULTIPLIER;
}

function powerLawCeiling(dateStr: string): number {
  return powerLawModel(dateStr) * CEILING_MULTIPLIER;
}

@Component({
  selector: 'app-bitcoin-power-law-chart-page',
  imports: [ChartViewerComponent, ChartAnnotationsComponent, ChartInfoPanelComponent, RouterLink, CreateAlertModalComponent],
  templateUrl: './bitcoin-power-law-chart-page.component.html',
})
export class BitcoinPowerLawChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = POWER_LAW_ALERT_METRICS;
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
    'The Bitcoin Power Law Chart models Bitcoin\'s price as a power function of time since genesis (Jan 3, 2009). ' +
    'Logarithmic regression produces a long-term fair value (Model) line with upper (Ceiling) and lower (Floor) price bounds ' +
    'that have historically contained Bitcoin\'s price through multiple market cycles.';

  protected readonly infoDataSources = [
    'Bitcoin Price: CoinGecko API',
    'Model: Power law regression — log₁₀(Price) = 5.845 × log₁₀(days since genesis) − 17.016',
    'Floor / Ceiling: ×0.25 below / ×10 above Model Price',
  ];

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const point = this.latestPoint();
    if (!point) {
      return [{ label: 'Current Price', value: 'Waiting for data' }];
    }
    const model = powerLawModel(point.date);
    const floor = powerLawFloor(point.date);
    const ceiling = powerLawCeiling(point.date);
    const pct = ((point.priceUsd / model) - 1) * 100;
    return [
      { label: 'Current Price', value: formatUsd(point.priceUsd) },
      { label: 'Model Price', value: formatUsd(model) },
      { label: 'Price vs Model', value: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%' },
      { label: 'Floor Price', value: formatUsd(floor) },
      { label: 'Ceiling Price', value: formatUsd(ceiling) },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const point = this.latestPoint();
    if (!point) return 'Waiting for the latest price data.';
    const model = powerLawModel(point.date);
    const floor = powerLawFloor(point.date);
    const ceiling = powerLawCeiling(point.date);
    const price = point.priceUsd;

    if (price < floor) {
      return 'Bitcoin is below the Power Law floor — a historically rare and extremely undervalued condition.';
    }
    if (price < model) {
      const pct = ((price - floor) / (model - floor)) * 100;
      if (pct < 40) {
        return 'Bitcoin is trading in the lower range between the floor and model, suggesting historically undervalued conditions.';
      }
      return 'Bitcoin is trading below the model price, historically associated with accumulation phases.';
    }
    if (price < ceiling) {
      const pct = ((price - model) / (ceiling - model)) * 100;
      if (pct < 33) {
        return 'Bitcoin is trading near the model price — close to long-term fair value based on the power law.';
      }
      if (pct < 66) {
        return 'Bitcoin is trading above the model price, entering elevated territory relative to the long-term trend.';
      }
      return 'Bitcoin is approaching the Power Law ceiling, historically associated with cycle-top conditions.';
    }
    return 'Bitcoin is above the Power Law ceiling — a historically rare event linked to speculative peak conditions.';
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.dataPoints();
    const futureLabels = buildFutureLabels(points, this.selectedTimeframe());
    const allDates = [...points.map((p) => p.date), ...futureLabels];
    const futureNulls = futureLabels.map(() => null as number | null);

    return {
      labels: allDates,
      datasets: [
        {
          label: 'BTC Price',
          data: [...points.map((p) => p.priceUsd), ...futureNulls],
          borderColor: '#000000',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.1,
          order: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fill: false as any,
        },
        {
          label: 'Model Price',
          data: allDates.map((d) => powerLawModel(d)),
          borderColor: '#F97316',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 0,
          tension: 0,
          order: 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fill: false as any,
        },
        {
          label: 'Floor Price',
          data: allDates.map((d) => powerLawFloor(d)),
          borderColor: '#60A5FA',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 0,
          tension: 0,
          order: 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fill: false as any,
        },
        {
          label: 'Ceiling Price',
          data: allDates.map((d) => powerLawCeiling(d)),
          borderColor: '#EF4444',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 0,
          tension: 0,
          order: 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fill: false as any,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => {
    const points = this.dataPoints();
    const futureLabels = buildFutureLabels(points, this.selectedTimeframe());
    const allDates = [...points.map((p) => p.date), ...futureLabels];
    const range = computeYRange(allDates);
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
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            padding: 16,
          },
        },
        tooltip: {
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            title: (items) => formatDate(String(items[0]?.label ?? '')),
            label: (item) => {
              const dateStr = String(item.label ?? '');
              const price = Number(item.parsed.y);
              const model = powerLawModel(dateStr);
              const pct = ((price / model) - 1) * 100;
              const rel = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
              return [
                `Price: ${formatUsd(price)}`,
                `Model: ${formatUsd(model)}`,
                `vs Model: ${rel}`,
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
    void this.api.recordRecentChart('bitcoin-power-law').catch(() => undefined);
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

  protected handleChartPoint(point: Parameters<ChartAnnotationsComponent['handleChartPoint']>[0]): void {
    this.chartAnnotations?.handleChartPoint(point);
  }

  protected async exportPng(): Promise<void> {
    const dataUrl = this.chartViewer?.exportImage();
    if (!dataUrl) return;
    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl: dataUrl,
      chartTitle: 'Bitcoin Power Law Chart',
      fileName: `bitcoin-power-law-chart_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `bitcoin-power-law-chart_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Date', value: (row) => row.date },
        { header: 'Price USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'Model Price', value: (row) => formatCsvNumber(powerLawModel(row.date)) },
        { header: 'Floor Price', value: (row) => formatCsvNumber(powerLawFloor(row.date)) },
        { header: 'Ceiling Price', value: (row) => formatCsvNumber(powerLawCeiling(row.date)) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const timestamp = this.lastUpdated();
    if (!timestamp) return 'Waiting for data';
    return new Date(timestamp).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  }

  private latestPoint(): BitcoinRainbowChartDataPoint | undefined {
    const points = this.dataPoints();
    return points[points.length - 1];
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

function computeYRange(allDates: string[]): { min: number; max: number } {
  if (allDates.length === 0) return { min: 0.001, max: 10_000_000 };
  const floors = allDates.map((d) => powerLawFloor(d));
  const ceilings = allDates.map((d) => powerLawCeiling(d));
  return {
    min: Math.max(0.0001, Math.min(...floors) * 0.5),
    max: Math.max(...ceilings) * 2,
  };
}

function buildFutureLabels(points: { date: string }[], timeframe: string): string[] {
  const pad: Record<string, number> = { '1m': 7, '3m': 14, '6m': 30, '1y': 60, '2y': 180, 'all': 1095 };
  const days = pad[timeframe] ?? 60;
  if (points.length === 0) return [];
  const last = new Date(`${points[points.length - 1].date}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() + i + 1);
    return d.toISOString().split('T')[0];
  });
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 2 : 4,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
