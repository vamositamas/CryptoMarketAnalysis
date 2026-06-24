import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type PuellMultipleChartDataPoint,
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
  { label: '1 hó', value: '1m' },
  { label: '3 hó', value: '3m' },
  { label: '6 hó', value: '6m' },
  { label: '1 év', value: '1y' },
  { label: '2 év', value: '2y' },
  { label: 'Mind', value: 'all' },
];

const HALVING_EVENTS = [
  { date: '2012-11-28', label: '2012 felezés' },
  { date: '2016-07-09', label: '2016 felezés' },
  { date: '2020-05-11', label: '2020 felezés' },
  { date: '2024-04-20', label: '2024 felezés' },
];

const HALVINGS_SCHEDULE = [
  { date: '2009-01-03', blockReward: 50 },
  { date: '2012-11-28', blockReward: 25 },
  { date: '2016-07-09', blockReward: 12.5 },
  { date: '2020-05-11', blockReward: 6.25 },
  { date: '2024-04-19', blockReward: 3.125 },
];

const PUELL_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'puell_multiple', label: 'Puell Multiple' },
  { value: 'btc_price', label: 'BTC ár USD' },
];

@Component({
  selector: 'app-puell-multiple-chart-page',
  imports: [ChartViewerComponent, ChartAnnotationsComponent, ChartInfoPanelComponent, RouterLink, CreateAlertModalComponent, ChartFavouriteButtonComponent],
  templateUrl: './puell-multiple-chart-page.component.html',
})
export class PuellMultipleChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;
  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = PUELL_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<PuellMultipleChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  private readonly puellValues = computed<(number | null)[]>(() => computePuellMultiple(this.dataPoints()));

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const puell = this.puellValues();
    const lastIndex = points.length - 1;
    const point = points[lastIndex];
    const puellValue = puell[lastIndex] ?? null;

    return [
      { label: 'Aktuális ár', value: point ? formatUsd(point.priceUsd) : 'Adatra vár' },
      { label: 'Aktuális Puell Multiple', value: puellValue !== null ? puellValue.toFixed(3) : 'Adatra vár' },
      { label: 'Jelzés', value: puellValue !== null ? getPuellSignal(puellValue) : 'Adatra vár' },
    ];
  });
  protected readonly infoInterpretation = computed(() => {
    const puell = this.puellValues();
    const puellValue = puell[puell.length - 1] ?? null;

    if (puellValue === null) {
      return 'Waiting for enough price history to compute the Puell Multiple (requires 365 days of data).';
    }

    if (puellValue > 4) {
      return 'The Puell Multiple is in the sell zone (above 4). Miner revenue is extremely elevated relative to the annual average, historically associated with cycle tops and peak profitability.';
    }

    if (puellValue < 0.5) {
      return 'The Puell Multiple is in the buy zone (below 0.5). Miner revenue is depressed relative to the annual average, historically a strong long-term accumulation signal.';
    }

    return 'The Puell Multiple is in the neutral zone (0.5–4). Miner revenue is within normal historical range relative to the 365-day average.';
  });
  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());
  protected readonly infoAbout =
    'The Puell Multiple divides daily miner issuance revenue in USD by its 365-day moving average. It measures whether miners are earning unusually high or low revenue, which historically correlates with cycle tops (high) and cycle bottoms (low).';
  protected readonly infoDataSources = [
    'Bitcoin Price: CoinGecko API',
    'Block reward schedule: Bitcoin halving schedule (hardcoded)',
    'Calculation: (Daily issuance USD) / (365-day SMA of daily issuance USD)',
  ];

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.dataPoints();
    const puell = this.puellValues();
    const futureLabels = buildFutureLabels(points, this.selectedTimeframe());
    const futureNulls = futureLabels.map(() => null as number | null);

    return {
      labels: [...points.map((point) => point.date), ...futureLabels],
      datasets: [
        {
          label: 'Bitcoin ár',
          data: [...points.map((point) => point.priceUsd), ...futureNulls],
          borderColor: '#000000',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.16,
          yAxisID: 'y',
        },
        {
          label: 'Puell Multiple',
          data: [...puell, ...futureNulls],
          borderColor: '#8B5CF6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.16,
          yAxisID: 'y2',
        },
  ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => ({
    animation: { duration: 280 },
    scales: {
      x: {
        ticks: { maxTicksLimit: 10 },
        grid: { color: 'rgba(23, 32, 42, 0.08)' },
      },
      y: {
        type: 'logarithmic',
        position: 'left',
        ticks: {
          callback: (value) => formatUsd(Number(value)),
        },
        grid: { color: 'rgba(23, 32, 42, 0.08)' },
      },
      y2: {
        type: 'logarithmic',
        position: 'right',
        min: 0.05,
        max: 10,
        ticks: {
          callback: (value) => Number(value).toFixed(2),
        },
        grid: { drawOnChartArea: false },
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
              return `Puell Multiple: ${Number(item.parsed.y).toFixed(3)}`;
            }
            return `${item.dataset.label}: ${formatUsd(Number(item.parsed.y))}`;
          },
        },
      },
      annotation: {
        annotations: {
          ...createPuellZoneAnnotations(),
          ...createHalvingAnnotations(),
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('puell-multiple').catch(() => undefined);
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
      chartTitle: 'Puell Multiple',
      fileName: `puell-multiple_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    const puell = this.puellValues();
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints().map((row, i) => ({ ...row, puellMultiple: puell[i] ?? null })),
      fileName: `puell-multiple_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Dátum', value: (row) => row.date },
        { header: 'Ár USD', value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'Puell Multiple', value: (row) => formatCsvNumber(row.puellMultiple) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const timestamp = this.lastUpdated();

    if (!timestamp) {
      return 'Adatra vár';
    }

    return new Date(timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      // Reuse the rainbow endpoint (returns price data) — no dedicated Puell endpoint needed
      const response = await this.api.getBitcoinRainbowChartData(timeframe);
      this.dataPoints.set(response.dataPoints.map((p) => ({ date: p.date, priceUsd: p.priceUsd })));
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Puell Multiple chart load failure@@charts.puellLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getBlockReward(date: string): number {
  let reward = HALVINGS_SCHEDULE[0].blockReward;

  for (const halving of HALVINGS_SCHEDULE) {
    if (date >= halving.date) {
      reward = halving.blockReward;
    } else {
      break;
    }
  }

  return reward;
}

function computePuellMultiple(dataPoints: PuellMultipleChartDataPoint[]): (number | null)[] {
  const dailyIssuance: number[] = dataPoints.map((point) => {
    const reward = getBlockReward(point.date);
    return reward * 144 * point.priceUsd;
  });

  const result: (number | null)[] = [];

  for (let i = 0; i < dailyIssuance.length; i += 1) {
    if (i < 364) {
      result.push(null);
      continue;
    }

    let sum = 0;

    for (let j = i - 364; j <= i; j += 1) {
      sum += dailyIssuance[j];
    }

    const sma365 = sum / 365;

    result.push(sma365 > 0 ? dailyIssuance[i] / sma365 : null);
  }

  return result;
}

function getPuellSignal(value: number): string {
  if (value > 4) return 'Eladási zóna';
  if (value < 0.5) return 'Vételi zóna';
  return 'Semleges';
}

function createPuellZoneAnnotations(): Record<string, AnnotationOptions<'box'>> {
  return {
    zoneSell: {
      type: 'box',
      xScaleID: 'x',
      yScaleID: 'y2',
      yMin: 4,
      yMax: 10,
      backgroundColor: 'rgba(239,68,68,0.15)',
      borderWidth: 0,
      label: {
        display: true,
        content: 'Eladási zóna',
        position: { x: 'end', y: 'start' },
        color: 'rgba(239,68,68,0.7)',
        font: { size: 11 },
      },
    },
    zoneNeutral: {
      type: 'box',
      xScaleID: 'x',
      yScaleID: 'y2',
      yMin: 0.5,
      yMax: 4,
      backgroundColor: 'rgba(234,179,8,0.05)',
      borderWidth: 0,
      label: {
        display: true,
        content: 'Semleges',
        position: { x: 'end', y: 'start' },
        color: 'rgba(234,179,8,0.7)',
        font: { size: 11 },
      },
    },
    zoneBuy: {
      type: 'box',
      xScaleID: 'x',
      yScaleID: 'y2',
      yMin: 0.05,
      yMax: 0.5,
      backgroundColor: 'rgba(34,197,94,0.15)',
      borderWidth: 0,
      label: {
        display: true,
        content: 'Vételi zóna',
        position: { x: 'end', y: 'start' },
        color: 'rgba(34,197,94,0.7)',
        font: { size: 11 },
      },
    },
  };
}

function createHalvingAnnotations(): Record<string, AnnotationOptions<'line'>> {
  return Object.fromEntries(
    HALVING_EVENTS.map((event) => [
      `halving${event.date}`,
      {
        type: 'line',
        xMin: event.date,
        xMax: event.date,
        borderColor: '#6B7280',
        borderDash: [4, 5],
        borderWidth: 1,
        label: {
          display: true,
          content: event.label,
          position: 'start',
          backgroundColor: 'rgba(55, 65, 81, 0.88)',
        },
      },
    ]),
  );
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return 'nincs adat';
  }

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
