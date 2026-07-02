import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type LthSthSoprSplitChartDataPoint,
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

const LTH_STH_SOPR_SPLIT_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'lth_sopr', label: $localize`:LTH SOPR metric@@charts.metric.lthSopr:LTH SOPR` },
  { value: 'sth_sopr', label: $localize`:STH SOPR metric@@charts.metric.sthSopr:STH SOPR` },
  { value: 'btc_price', label: $localize`:BTC price USD metric@@charts.metric.btcPriceUsd:BTC price USD` },
];

@Component({
  selector: 'app-lth-sth-sopr-split-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    CreateAlertModalComponent,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './lth-sth-sopr-split-chart-page.component.html',
})
export class LthSthSoprSplitChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;

  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = LTH_STH_SOPR_SPLIT_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<LthSthSoprSplitChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  private readonly latestSoprPoint = computed(() =>
    [...this.dataPoints()].reverse().find((p) => p.lthSopr !== null || p.sthSopr !== null) ?? null,
  );

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    const latestSopr = this.latestSoprPoint();
    const noData = $localize`:No data value@@common.noData:No data`;
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: last ? formatUsd(last.priceUsd) : noData },
      { label: $localize`:LTH SOPR metric@@charts.metric.lthSopr:LTH SOPR`, value: latestSopr?.lthSopr !== null && latestSopr?.lthSopr !== undefined ? latestSopr.lthSopr.toFixed(3) : noData },
      { label: $localize`:STH SOPR metric@@charts.metric.sthSopr:STH SOPR`, value: latestSopr?.sthSopr !== null && latestSopr?.sthSopr !== undefined ? latestSopr.sthSopr.toFixed(3) : noData },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: getSplitSignal(latestSopr?.lthSopr ?? null, latestSopr?.sthSopr ?? null) },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const latestSopr = this.latestSoprPoint();
    const lth = latestSopr?.lthSopr ?? null;
    const sth = latestSopr?.sthSopr ?? null;
    if (lth === null && sth === null) {
      return $localize`:LTH STH SOPR split waiting interpretation@@charts.lthSthSoprSplit.interpretation.waiting:Waiting for LTH/STH SOPR data.`;
    }
    if (lth !== null && lth < 1) {
      return $localize`:LTH STH SOPR split lth capitulation interpretation@@charts.lthSthSoprSplit.interpretation.lthCapitulation:LTH SOPR is ${lth.toFixed(3)}:INTERPOLATION:, below 1 — long-term holders are on aggregate selling at a loss. This behavior has historically clustered near major cycle bottoms, since it takes a deep, prolonged drawdown to force experienced holders to capitulate.`;
    }
    if (sth !== null && sth < 1) {
      return $localize`:LTH STH SOPR split sth stress interpretation@@charts.lthSthSoprSplit.interpretation.sthStress:STH SOPR is ${sth.toFixed(3)}:INTERPOLATION:, below 1 — short-term holders are on aggregate selling at a loss, a common short-term pullback or capitulation signature that recurs more frequently than LTH capitulation.`;
    }
    return $localize`:LTH STH SOPR split profit interpretation@@charts.lthSthSoprSplit.interpretation.profit:Both LTH and STH SOPR are above 1 — both cohorts are on aggregate realizing profit, typical of stable-to-bullish market conditions.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout = $localize`:LTH STH SOPR split about@@charts.lthSthSoprSplit.about:LTH-SOPR and STH-SOPR measure the realized profit or loss ratio (sale price divided by acquisition price) for coins moved on-chain by long-term holders (held 155+ days) and short-term holders separately. A value above 1 means that cohort is on aggregate selling at a profit; below 1 means it is on aggregate selling at a loss. Viewing the two cohorts separately is sharper than the combined SOPR Ratio, since LTH and STH capitulation carry very different implications for cycle stage.`;

  protected readonly infoDataSources = [
    $localize`:LTH STH SOPR split data source price@@charts.lthSthSoprSplit.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:LTH STH SOPR split data source lth@@charts.lthSthSoprSplit.dataSource.lth:LTH SOPR: bitcoin-data.com free public API, ingested daily and stored server-side (available from 25 June 2022)`,
    $localize`:LTH STH SOPR split data source sth@@charts.lthSthSoprSplit.dataSource.sth:STH SOPR: bitcoin-data.com free public API, ingested daily and stored server-side (available from 25 June 2022)`,
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'line' as const,
          label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC Price`,
          data: points.map((p) => p.priceUsd),
          borderColor: '#111820',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.1,
          yAxisID: 'y',
          order: 1,
        },
        {
          type: 'line' as const,
          label: $localize`:LTH SOPR metric@@charts.metric.lthSopr:LTH SOPR`,
          data: points.map((p) => p.lthSopr),
          borderColor: '#7c3aed',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.1,
          spanGaps: true,
          yAxisID: 'y2',
          order: 2,
        },
        {
          type: 'line' as const,
          label: $localize`:STH SOPR metric@@charts.metric.sthSopr:STH SOPR`,
          data: points.map((p) => p.sthSopr),
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.1,
          spanGaps: true,
          yAxisID: 'y2',
          order: 2,
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
        position: 'left',
        ticks: { callback: (value) => formatUsd(Number(value)) },
        grid: { color: 'rgba(23, 32, 42, 0.08)' },
      },
      y2: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: $localize`:LTH STH SOPR axis label@@charts.axis.lthSthSopr:SOPR`,
          color: '#4b5563',
          font: { size: 12, weight: 500 },
        },
        ticks: { color: '#4b5563' },
        grid: { drawOnChartArea: false },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { usePointStyle: true },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (items) => formatDate(String(items[0]?.label ?? '')),
          label: (item) => {
            if (item.dataset.yAxisID === 'y2') {
              return `${item.dataset.label}: ${Number(item.parsed.y).toFixed(3)}`;
            }
            return `${item.dataset.label}: ${formatUsd(Number(item.parsed.y))}`;
          },
        },
      },
      annotation: {
        annotations: {
          soprOne: {
            type: 'line',
            yMin: 1,
            yMax: 1,
            yScaleID: 'y2',
            borderColor: 'rgba(107,114,128,0.75)',
            borderWidth: 1,
            borderDash: [4, 4],
            label: {
              display: true,
              content: $localize`:SOPR equals one annotation@@charts.lthSthSoprSplit.equalsOne:SOPR = 1`,
              position: 'end',
              backgroundColor: 'rgba(75,85,99,0.85)',
              color: '#fff',
              font: { size: 10, weight: 'bold' as const },
              padding: { x: 5, y: 2 },
            },
          },
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('lth-sth-sopr-split').catch(() => undefined);
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
  protected zoomIn(): void { this.chartViewer?.zoomIn(); }
  protected zoomOut(): void { this.chartViewer?.zoomOut(); }
  protected selectTimeframe(timeframe: ChartTimeframe): void {
    if (this.selectedTimeframe() === timeframe || this.isLoading()) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { timeframe } });
  }
  protected toggleInfo(): void { this.infoOpen.update((v) => !v); }
  protected openAlertModal(): void { this.showAlertModal.set(true); }
  protected closeAlertModal(): void { this.showAlertModal.set(false); }
  protected toggleExportMenu(): void { this.exportMenuOpen.update((v) => !v); }
  protected updateUserAnnotations(annotations: Record<string, AnnotationOptions>): void { this.userAnnotations.set(annotations); }
  protected handleChartPoint(point: Parameters<ChartAnnotationsComponent['handleChartPoint']>[0]): void {
    this.chartAnnotations?.handleChartPoint(point);
  }

  protected async exportPng(): Promise<void> {
    const chartImageDataUrl = this.chartViewer?.exportImage();
    if (!chartImageDataUrl) return;
    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl,
      chartTitle: $localize`:LTH STH SOPR split title@@charts.lthSthSoprSplitTitle:LTH-SOPR / STH-SOPR Split`,
      fileName: `lth-sth-sopr-split_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `lth-sth-sopr-split_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:LTH SOPR metric@@charts.metric.lthSopr:LTH SOPR`, value: (row) => formatCsvNumber(row.lthSopr) },
        { header: $localize`:STH SOPR metric@@charts.metric.sthSopr:STH SOPR`, value: (row) => formatCsvNumber(row.sthSopr) },
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
      const response = await this.api.getLthSthSoprSplitChartData(timeframe);
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:LTH STH SOPR split chart load failure@@charts.lthSthSoprSplitLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getSplitSignal(lth: number | null, sth: number | null): string {
  if (lth === null && sth === null) return $localize`:No data value@@common.noData:No data`;
  if (lth !== null && lth < 1) return $localize`:LTH capitulation signal@@charts.signal.lthSthSoprSplit.lthCapitulation:LTH capitulation`;
  if (sth !== null && sth < 1) return $localize`:STH stress signal@@charts.signal.lthSthSoprSplit.sthStress:STH stress`;
  return $localize`:Both cohorts in profit signal@@charts.signal.lthSthSoprSplit.bothProfit:Both cohorts in profit`;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return $localize`:No data value@@common.noData:No data`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}

function formatDate(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`));
}
