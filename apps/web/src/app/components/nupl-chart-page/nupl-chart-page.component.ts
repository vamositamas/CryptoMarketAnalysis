import { AfterViewInit, Component, LOCALE_ID, ViewChild, computed, inject, signal } from '@angular/core';
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
import { ChartFavouriteButtonComponent } from '../chart-favourite-button/chart-favourite-button.component';
import { parseChartTimeframe } from '../chart-timeframe/chart-timeframe-url.util';

interface TimeframeOption {
  label: string;
  value: ChartTimeframe;
}

interface NuplChartPoint extends RealizePriceChartDataPoint {
  nupl: number | null;
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
  selector: 'app-nupl-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './nupl-chart-page.component.html',
})
export class NuplChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly locale = inject(LOCALE_ID);
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
  protected readonly dataPoints = signal<NuplChartPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly latestNupl = computed(() => {
    const point = [...this.dataPoints()].reverse().find((p) => p.nupl !== null);
    return point?.nupl ?? null;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    const latestPoint = [...points].reverse().find((p) => p.nupl !== null);
    const nupl = latestPoint?.nupl ?? null;

    return [
      {
        label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`,
        value: last ? formatUsd(last.priceUsd) : $localize`:Waiting for data@@charts.waitingForData:Waiting for data`,
      },
      {
        label: $localize`:Realized price metric@@charts.metric.realizedPrice:Realized price`,
        value: latestPoint?.realizedPrice != null ? formatUsd(latestPoint.realizedPrice) : $localize`:No data value@@common.noData:No data`,
      },
      {
        label: $localize`:NUPL metric@@charts.metric.nupl:NUPL`,
        value: nupl !== null ? formatPercent(nupl) : $localize`:No data value@@common.noData:No data`,
      },
      {
        label: $localize`:Cycle phase metric@@charts.metric.cyclePhase:Cycle phase`,
        value: nupl !== null ? getNuplPhase(nupl) : $localize`:No data value@@common.noData:No data`,
      },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const nupl = this.latestNupl();
    if (nupl === null) {
      return $localize`:NUPL waiting interpretation@@charts.nupl.interpretation.waiting:Waiting for realized price data to compute NUPL.`;
    }
    if (nupl >= 0.75) {
      return $localize`:NUPL euphoria interpretation@@charts.nupl.interpretation.euphoria:NUPL is in the Euphoria / Greed zone. Historically, major Bitcoin cycle peaks have occurred after the market entered this band.`;
    }
    if (nupl >= 0.5) {
      return $localize`:NUPL belief interpretation@@charts.nupl.interpretation.belief:NUPL is in the Belief / Denial zone. Aggregate holders are strongly in profit, which often appears in mature bull-market conditions.`;
    }
    if (nupl >= 0.25) {
      return $localize`:NUPL optimism interpretation@@charts.nupl.interpretation.optimism:NUPL is in the Optimism / Anxiety zone. The market is profitable on aggregate but not yet in historical euphoria.`;
    }
    if (nupl >= 0) {
      return $localize`:NUPL hope interpretation@@charts.nupl.interpretation.hope:NUPL is in the Hope / Fear zone. The market is close to its aggregate cost basis, a transition area between stress and recovery.`;
    }
    return $localize`:NUPL capitulation interpretation@@charts.nupl.interpretation.capitulation:NUPL is in the Capitulation zone. Historically, negative readings have clustered near major Bitcoin cycle lows.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    $localize`:NUPL about@@charts.nupl.about:Net Unrealized Profit/Loss (NUPL), also called Relative Unrealized Profit/Loss, compares Bitcoin's market value with realized value. Market value is current price multiplied by circulating supply. Realized value prices each coin where it last moved on-chain, averages those coin prices, then multiplies by circulating supply. Subtracting realized value from market value estimates aggregate paper profit or loss. Dividing that by market value creates NUPL, a sentiment gauge that maps Bitcoin cycle phases from Capitulation through Euphoria / Greed.`;

  protected readonly infoDataSources = [
    $localize`:NUPL data source price@@charts.nupl.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:NUPL data source realized@@charts.nupl.dataSource.realized:Realized price: backend realized price series derived from stored DB values and CoinMetrics community API history`,
    $localize`:NUPL data source formula@@charts.nupl.dataSource.formula:NUPL: (BTC price - realized price) / BTC price`,
  ];

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.dataPoints();
    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          label: $localize`:NUPL metric@@charts.metric.nupl:NUPL`,
          data: points.map((p) => p.nupl),
          borderColor: '#20bde8',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 10,
          tension: 0.16,
          yAxisID: 'y',
          order: 1,
        },
        {
          label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`,
          data: points.map((p) => p.priceUsd),
          borderColor: '#1f2933',
          backgroundColor: 'transparent',
          borderWidth: 1.75,
          pointRadius: 0,
          pointHitRadius: 10,
          tension: 0.1,
          yAxisID: 'y2',
          order: 2,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => {
    const labelXValue = getZoneLabelXValue(this.dataPoints());

    return {
      animation: { duration: 280 },
      layout: {
        padding: { top: 24, right: 12, bottom: 8, left: 8 },
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 10 },
          grid: { color: 'rgba(23, 32, 42, 0.08)' },
        },
        y: {
          type: 'linear',
          position: 'left',
          min: -1.5,
          max: 1,
          title: {
            display: true,
            text: $localize`:NUPL axis label@@charts.axis.nupl:NUPL`,
            color: '#1f2933',
            font: { size: 12, weight: 500 },
          },
          ticks: {
            stepSize: 0.25,
            callback: (value) => `${Math.round(Number(value) * 100)}%`,
          },
          grid: { color: 'rgba(23, 32, 42, 0.08)' },
        },
        y2: {
          type: 'logarithmic',
          position: 'right',
          title: {
            display: true,
            text: $localize`:BTC price USD axis label@@charts.axis.btcPriceUsd:BTC Price (USD)`,
            color: '#1f2933',
            font: { size: 12, weight: 500 },
          },
          ticks: {
            color: '#3f4752',
            callback: (value) => formatCompactUsd(Number(value)),
          },
          grid: { drawOnChartArea: false },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          align: 'start',
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            boxWidth: 28,
            boxHeight: 3,
            color: '#1f2933',
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items) => formatDate(String(items[0]?.label ?? ''), this.locale),
            label: (item) => {
              if (item.dataset.yAxisID === 'y') {
                return `${item.dataset.label}: ${formatPercent(Number(item.parsed.y))}`;
              }
              return `${item.dataset.label}: ${formatUsd(Number(item.parsed.y))}`;
            },
            afterBody: (items) => {
              const nuplItem = items.find((item) => item.dataset.yAxisID === 'y');
              if (!nuplItem) return '';
              return getNuplPhase(Number(nuplItem.parsed.y));
            },
          },
        },
        annotation: {
          annotations: {
            capitulation: zoneBox(-1.5, 0, 'rgba(16, 185, 129, 0.14)'),
            hopeFear: zoneBox(0, 0.25, 'rgba(255, 251, 235, 0.58)'),
            optimism: zoneBox(0.25, 0.5, 'rgba(254, 249, 195, 0.56)'),
            belief: zoneBox(0.5, 0.75, 'rgba(253, 186, 116, 0.38)'),
            euphoria: zoneBox(0.75, 1, 'rgba(244, 114, 182, 0.24)'),
            capitulationLabel: zoneLabel('Capitulation', -0.18, labelXValue),
            hopeFearLabel: zoneLabel('Hope / Fear', 0.17, labelXValue),
            optimismLabel: zoneLabel('Optimism / Anxiety', 0.39, labelXValue),
            beliefLabel: zoneLabel('Belief / Denial', 0.62, labelXValue),
            euphoriaLabel: zoneLabel('Euphoria / Greed', 0.9, labelXValue),
            zeroLine: thresholdLine(0, 'rgba(16, 185, 129, 0.55)'),
            hopeLine: thresholdLine(0.25, 'rgba(202, 138, 4, 0.45)'),
            beliefLine: thresholdLine(0.5, 'rgba(234, 88, 12, 0.45)'),
            euphoriaLine: thresholdLine(0.75, 'rgba(219, 39, 119, 0.52)'),
            ...this.userAnnotations(),
          },
        },
      },
    };
  });

  constructor() {
    void this.api.recordRecentChart('nupl').catch(() => undefined);
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
    const chartImageDataUrl = this.chartViewer?.exportImage();
    if (!chartImageDataUrl) return;
    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl,
      chartTitle: 'Bitcoin NUPL',
      fileName: `nupl_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `nupl_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Realized price metric@@charts.metric.realizedPrice:Realized price`, value: (row) => formatCsvNumber(row.realizedPrice) },
        { header: $localize`:NUPL metric@@charts.metric.nupl:NUPL`, value: (row) => formatCsvNumber(row.nupl) },
        { header: $localize`:Cycle phase metric@@charts.metric.cyclePhase:Cycle phase`, value: (row) => row.nupl !== null ? getNuplPhase(row.nupl) : '' },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const ts = this.lastUpdated();
    if (!ts) return $localize`:Waiting for data@@charts.waitingForData:Waiting for data`;
    return new Date(ts).toLocaleString(this.locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false,
    }) + ' UTC';
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await this.api.getRealizePriceChartData(timeframe);
      this.dataPoints.set(response.dataPoints.map((point) => ({
        ...point,
        nupl: calculateNupl(point.priceUsd, point.realizedPrice),
      })));
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:NUPL chart load failure@@charts.nupl.loadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function calculateNupl(priceUsd: number, realizedPrice: number | null): number | null {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0 || realizedPrice === null || !Number.isFinite(realizedPrice)) {
    return null;
  }
  return (priceUsd - realizedPrice) / priceUsd;
}

function getNuplPhase(value: number): string {
  if (value >= 0.75) return $localize`:NUPL phase euphoria@@charts.nupl.phase.euphoria:Euphoria / Greed`;
  if (value >= 0.5) return $localize`:NUPL phase belief@@charts.nupl.phase.belief:Belief / Denial`;
  if (value >= 0.25) return $localize`:NUPL phase optimism@@charts.nupl.phase.optimism:Optimism / Anxiety`;
  if (value >= 0) return $localize`:NUPL phase hope@@charts.nupl.phase.hope:Hope / Fear`;
  return $localize`:NUPL phase capitulation@@charts.nupl.phase.capitulation:Capitulation`;
}

function zoneBox(yMin: number, yMax: number, color: string): AnnotationOptions {
  return {
    type: 'box',
    xScaleID: 'x',
    yScaleID: 'y',
    yMin,
    yMax,
    backgroundColor: color,
    borderWidth: 0,
  };
}

function thresholdLine(value: number, color: string): AnnotationOptions {
  return {
    type: 'line',
    yScaleID: 'y',
    yMin: value,
    yMax: value,
    borderColor: color,
    borderWidth: 1,
    borderDash: [5, 5],
  };
}

function zoneLabel(content: string, yValue: number, xValue: string): AnnotationOptions {
  return {
    type: 'label',
    xScaleID: 'x',
    yScaleID: 'y',
    xValue,
    yValue,
    content,
    color: 'rgba(55, 65, 81, 0.82)',
    font: { size: 11, weight: 500 },
    backgroundColor: 'rgba(255, 255, 255, 0)',
    borderWidth: 0,
  };
}

function getZoneLabelXValue(points: { date: string }[]): string {
  if (points.length === 0) {
    return '';
  }

  return points[Math.min(points.length - 1, Math.max(0, Math.floor(points.length * 0.08)))].date;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '';
  return `${(value * 100).toFixed(1)}%`;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return $localize`:No data value@@common.noData:No data`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string, locale: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
