import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type ExcessLiquidityChartResponse,
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

type ExcessLiquidityDataPoint = ExcessLiquidityChartResponse['dataPoints'][number];

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

@Component({
  selector: 'app-excess-liquidity-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './excess-liquidity-chart-page.component.html',
})
export class ExcessLiquidityChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
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
  protected readonly dataPoints = signal<ExcessLiquidityDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    if (!points.length) return [];

    const lastYC = [...points].reverse().find((p) => p.yieldCurve1yChange !== null);
    const lastEL = [...points].reverse().find((p) => p.excessLiquidityLeading !== null);

    const ycVal = lastYC?.yieldCurve1yChange ?? null;
    const elVal = lastEL?.excessLiquidityLeading ?? null;

    const ycSignal =
      ycVal === null ? 'Nincs adat'
      : ycVal > 0 ? 'Steepening'
      : 'Flattening / Inverted';

    const elSignal =
      elVal === null ? 'Nincs adat'
      : elVal > 0 ? 'Positive'
      : 'Negative';

    return [
      { label: '3m10y Change (1yr, bps)', value: ycVal !== null ? ycVal.toFixed(1) : 'Nincs adat' },
      { label: 'Hozamgörbe', value: ycSignal },
      { label: 'Excess Liquidity (Leading)', value: elVal !== null ? elVal.toFixed(2) + '%' : 'Nincs adat' },
      { label: 'Likviditási jelzés', value: elSignal },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    if (!points.length) return 'Adatra vár.';

    const lastEL = [...points].reverse().find((p) => p.excessLiquidityLeading !== null);
    const elVal = lastEL?.excessLiquidityLeading ?? null;

    if (elVal === null) return 'Excess liquidity data not yet available.';

    if (elVal > 1) {
      return `Excess liquidity is ${elVal.toFixed(2)}%, clearly positive. Historically this environment — money supply growing faster than the economy — has supported risk assets including Bitcoin over the following 6 months.`;
    }
    if (elVal > 0) {
      return `Excess liquidity is ${elVal.toFixed(2)}%, slightly positive. Liquidity conditions are broadly supportive but not strongly so.`;
    }
    return `Excess liquidity is ${elVal.toFixed(2)}%, negative. This indicates money supply is growing slower than the economy, which has historically created headwinds for risk assets over the following 6 months.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'This chart overlays two macro indicators to gauge financial conditions and their leading relationship with risk assets. ' +
    'The black line shows the 1-year change in the 3-month/10-year Treasury yield spread in basis points — a proxy for credit conditions. ' +
    'The orange line shows Excess Liquidity (M2 money supply growth minus nominal GDP growth) shifted 6 months forward, ' +
    'revealing how today\'s liquidity environment tends to lead market conditions.';

  protected readonly infoDataSources = [
    '3m/10y Spread: FRED T10Y3M (Federal Reserve, daily)',
    'Excess Liquidity: FRED M2SL (monthly) minus FRED GDP YoY growth (quarterly, interpolated)',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();

    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'line' as const,
          label: 'Többletlikviditási előrejelző indikátor (6 hónappal előre, %)',
          data: points.map((p) => p.excessLiquidityLeading),
          borderColor: 'rgba(234, 179, 8, 0.85)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'y2',
          order: 2,
          spanGaps: true,
        },
        {
          type: 'line' as const,
          label: '3m10y 1yr Change (bps)',
          data: points.map((p) => p.yieldCurve1yChange),
          borderColor: '#1f2937',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          yAxisID: 'y',
          order: 1,
          spanGaps: true,
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
        type: 'linear',
        position: 'left',
        ticks: {
          callback: (value) => `${Number(value).toFixed(0)} bps`,
          color: '#1f2937',
          maxTicksLimit: 8,
        },
        grid: { color: 'rgba(0,0,0,0.06)' },
        title: { display: true, text: '3m10y 1yr Change (bps)', color: '#1f2937', font: { size: 11 } },
      },
      y2: {
        type: 'linear',
        position: 'right',
        ticks: {
          callback: (value) => `${Number(value).toFixed(1)}%`,
          color: 'rgba(161, 120, 5, 1)',
          maxTicksLimit: 8,
        },
        grid: { display: false },
        title: { display: true, text: 'Többletlikviditás (%)', color: 'rgba(161, 120, 5, 1)', font: { size: 11 } },
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
            if (item.dataset.yAxisID === 'y') return `${label}: ${v.toFixed(1)} bps`;
            return `${label}: ${v.toFixed(2)}%`;
          },
        },
      },
      annotation: {
        annotations: {
          zeroLine: {
            type: 'line',
            yScaleID: 'y',
            yMin: 0,
            yMax: 0,
            borderColor: 'rgba(107, 114, 128, 0.5)',
            borderDash: [6, 4],
            borderWidth: 1,
          } as AnnotationOptions,
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('excess-liquidity').catch(() => undefined);
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
  protected zoomIn(): void { this.chartViewer?.zoomIn(); }
  protected zoomOut(): void { this.chartViewer?.zoomOut(); }

  protected selectTimeframe(timeframe: ChartTimeframe): void {
    if (this.selectedTimeframe() === timeframe || this.isLoading()) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { timeframe } });
  }

  protected toggleInfo(): void { this.infoOpen.update((v) => !v); }
  protected toggleExportMenu(): void { this.exportMenuOpen.update((v) => !v); }

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
      chartTitle: 'Többletlikviditási előrejelző indikátor',
      fileName: `excess-liquidity_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `excess-liquidity_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Dátum', value: (row) => row.date },
        { header: '3m10y 1yr Change (bps)', value: (row) => formatCsvNumber(row.yieldCurve1yChange) },
        { header: 'Excess Liquidity Leading (%)', value: (row) => formatCsvNumber(row.excessLiquidityLeading) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const ts = this.lastUpdated();
    if (!ts) return 'Adatra vár';
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
    }) + ' UTC';
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await this.api.getExcessLiquidityChartData(timeframe);
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

function formatDate(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
