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
  { label: $localize`:Timeframe All@@charts.timeframe.all:All`, value: 'all' },
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
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
  { value: 'power_law_model', label: $localize`:Power Law model metric@@charts.powerLaw.metric.modelPrice:Power Law model price` },
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
  imports: [ChartViewerComponent, ChartAnnotationsComponent, ChartInfoPanelComponent, RouterLink, CreateAlertModalComponent, ChartFavouriteButtonComponent],
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

  protected readonly infoAbout = $localize`:Power Law about@@charts.powerLaw.about:The Bitcoin Power Law Chart models Bitcoin's price as a power function of time since genesis (Jan 3, 2009). Logarithmic regression produces a long-term fair value (Model) line with upper (Ceiling) and lower (Floor) price bounds that have historically contained Bitcoin's price through multiple market cycles.`;

  protected readonly infoDataSources = [
    $localize`:Power Law BTC price data source@@charts.powerLaw.dataSource.price:Bitcoin price: CoinGecko API`,
    $localize`:Power Law model data source@@charts.powerLaw.dataSource.model:Model: power law regression - log10(Price) = 5.845 x log10(days since genesis) - 17.016`,
    $localize`:Power Law bounds data source@@charts.powerLaw.dataSource.bounds:Floor / Ceiling: x0.25 below / x10 above model price`,
  ];

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const point = this.latestPoint();
    if (!point) {
      return [{ label: $localize`:Current price metric@@charts.metric.currentPrice:Current price`, value: $localize`:Waiting for data@@charts.waitingForData:Waiting for data` }];
    }
    const model = powerLawModel(point.date);
    const floor = powerLawFloor(point.date);
    const ceiling = powerLawCeiling(point.date);
    const pct = ((point.priceUsd / model) - 1) * 100;
    return [
      { label: $localize`:Current price metric@@charts.metric.currentPrice:Current price`, value: formatUsd(point.priceUsd) },
      { label: $localize`:Model price metric@@charts.metric.modelPrice:Model price`, value: formatUsd(model) },
      { label: $localize`:Price vs model@@charts.metric.priceVsModel:Price vs. model`, value: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%' },
      { label: $localize`:Lower band price@@charts.metric.lowerBandPrice:Lower band price`, value: formatUsd(floor) },
      { label: $localize`:Upper band price@@charts.metric.upperBandPrice:Upper band price`, value: formatUsd(ceiling) },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const point = this.latestPoint();
    if (!point) return $localize`:Power Law waiting interpretation@@charts.powerLaw.interpretation.waiting:Waiting for the latest price data.`;
    const model = powerLawModel(point.date);
    const floor = powerLawFloor(point.date);
    const ceiling = powerLawCeiling(point.date);
    const price = point.priceUsd;

    if (price < floor) {
      return $localize`:Power Law below floor interpretation@@charts.powerLaw.interpretation.belowFloor:Bitcoin is below the Power Law floor - a historically rare and extremely undervalued condition.`;
    }
    if (price < model) {
      const pct = ((price - floor) / (model - floor)) * 100;
      if (pct < 40) {
        return $localize`:Power Law lower range interpretation@@charts.powerLaw.interpretation.lowerRange:Bitcoin is trading in the lower range between the floor and model, suggesting historically undervalued conditions.`;
      }
      return $localize`:Power Law below model interpretation@@charts.powerLaw.interpretation.belowModel:Bitcoin is trading below the model price, historically associated with accumulation phases.`;
    }
    if (price < ceiling) {
      const pct = ((price - model) / (ceiling - model)) * 100;
      if (pct < 33) {
        return $localize`:Power Law near model interpretation@@charts.powerLaw.interpretation.nearModel:Bitcoin is trading near the model price - close to long-term fair value based on the power law.`;
      }
      if (pct < 66) {
        return $localize`:Power Law elevated interpretation@@charts.powerLaw.interpretation.elevated:Bitcoin is trading above the model price, entering elevated territory relative to the long-term trend.`;
      }
      return $localize`:Power Law near ceiling interpretation@@charts.powerLaw.interpretation.nearCeiling:Bitcoin is approaching the Power Law ceiling, historically associated with cycle-top conditions.`;
    }
    return $localize`:Power Law above ceiling interpretation@@charts.powerLaw.interpretation.aboveCeiling:Bitcoin is above the Power Law ceiling - a historically rare event linked to speculative peak conditions.`;
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
          label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`,
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
          label: $localize`:Model price metric@@charts.metric.modelPrice:Model price`,
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
          label: $localize`:Lower band price@@charts.metric.lowerBandPrice:Lower band price`,
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
          label: $localize`:Upper band price@@charts.metric.upperBandPrice:Upper band price`,
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

  protected toggleFullscreen(): void { this.chartViewer?.toggleFullscreen(); }

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
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Model price metric@@charts.metric.modelPrice:Model price`, value: (row) => formatCsvNumber(powerLawModel(row.date)) },
        { header: $localize`:Lower band price@@charts.metric.lowerBandPrice:Lower band price`, value: (row) => formatCsvNumber(powerLawFloor(row.date)) },
        { header: $localize`:Upper band price@@charts.metric.upperBandPrice:Upper band price`, value: (row) => formatCsvNumber(powerLawCeiling(row.date)) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const timestamp = this.lastUpdated();
    if (!timestamp) return $localize`:Waiting for data@@charts.waitingForData:Waiting for data`;
    return new Date(timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
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
