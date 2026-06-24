import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type SpxLiquidityChartResponse,
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

type SpxLiquidityDataPoint = SpxLiquidityChartResponse['dataPoints'][number];

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

@Component({
  selector: 'app-spx-liquidity-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './spx-liquidity-chart-page.component.html',
})
export class SpxLiquidityChartPageComponent implements AfterViewInit {
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
  protected readonly dataPoints = signal<SpxLiquidityDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    if (!points.length) return [];

    const lastSpx = [...points].reverse().find((p) => p.spxYoyChange !== null);
    const lastEL = [...points].reverse().find((p) => p.excessLiquidityLeading !== null);

    const spxVal = lastSpx?.spxYoyChange ?? null;
    const elVal = lastEL?.excessLiquidityLeading ?? null;

    return [
      { label: 'SPX YoY Change', value: spxVal !== null ? spxVal.toFixed(1) + '%' : $localize`:No data value@@common.noData:No data` },
      {
        label: 'SPX Trend',
        value: spxVal === null ? $localize`:No data value@@common.noData:No data` : spxVal > 0 ? 'Positive' : 'Negative',
      },
      { label: 'Excess Liquidity (Leading)', value: elVal !== null ? elVal.toFixed(2) + '%' : $localize`:No data value@@common.noData:No data` },
      {
        label: 'Likviditási jelzés',
        value: elVal === null ? $localize`:No data value@@common.noData:No data` : elVal > 0 ? 'Positive (supportive)' : 'Negative (headwind)',
      },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    if (!points.length) return $localize`:Waiting for data sentence@@charts.waitingForDataSentence:Waiting for data.`;

    const lastEL = [...points].reverse().find((p) => p.excessLiquidityLeading !== null);
    const lastSpx = [...points].reverse().find((p) => p.spxYoyChange !== null);
    const elVal = lastEL?.excessLiquidityLeading ?? null;
    const spxVal = lastSpx?.spxYoyChange ?? null;

    if (elVal === null || spxVal === null) return 'Insufficient data for interpretation.';

    if (elVal > 0 && spxVal > 0) {
      return `Excess liquidity is ${elVal.toFixed(2)}% (positive) and the S&P 500 is up ${spxVal.toFixed(1)}% YoY. Historically, positive excess liquidity leads equity market gains by ~6 months — current conditions remain supportive for risk assets.`;
    }
    if (elVal > 0 && spxVal <= 0) {
      return `Excess liquidity is ${elVal.toFixed(2)}% (positive), suggesting improving conditions ahead, even though the S&P 500 is currently down ${Math.abs(spxVal).toFixed(1)}% YoY. The leading indicator historically precedes a market recovery.`;
    }
    if (elVal <= 0 && spxVal > 0) {
      return `Excess liquidity has turned negative (${elVal.toFixed(2)}%), a potential headwind for equities even as the S&P 500 is up ${spxVal.toFixed(1)}% YoY. Historically this precedes market weakness.`;
    }
    return `Excess liquidity is ${elVal.toFixed(2)}% (negative) and the S&P 500 is down ${Math.abs(spxVal).toFixed(1)}% YoY — both indicators in negative territory, consistent with tightening financial conditions.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  protected readonly infoAbout =
    'This chart overlays the S&P 500 year-over-year % change with the Excess Liquidity Leading Indicator ' +
    '(US M2 money supply growth minus nominal GDP growth, shifted 6 months forward). ' +
    'When excess liquidity is positive, money supply is growing faster than the economy, ' +
    'historically supporting equity prices over the following 6 months. ' +
    'The 6-month forward shift makes the indicator a leading signal for SPX direction.';

  protected readonly infoDataSources = [
    'S&P 500: FRED SP500 series (Federal Reserve, daily from 2016)',
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
          borderColor: '#2563eb',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'y2',
          order: 2,
          spanGaps: true,
        },
        {
          type: 'line' as const,
          label: 'S&P 500 YoY (%)',
          data: points.map((p) => p.spxYoyChange),
          borderColor: '#111827',
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
          callback: (value) => `${Number(value).toFixed(0)}%`,
          color: '#111827',
          maxTicksLimit: 8,
        },
        grid: { color: 'rgba(0,0,0,0.06)' },
        title: { display: true, text: 'S&P 500 YoY (%)', color: '#111827', font: { size: 11 } },
      },
      y2: {
        type: 'linear',
        position: 'right',
        ticks: {
          callback: (value) => `${Number(value).toFixed(1)}%`,
          color: '#1d4ed8',
          maxTicksLimit: 8,
        },
        grid: { display: false },
        title: { display: true, text: $localize`:Excess liquidity percent axis@@charts.axis.excessLiquidityPercent:Excess liquidity (%)`, color: '#1d4ed8', font: { size: 11 } },
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
            return `${item.dataset.label ?? ''}: ${v.toFixed(2)}%`;
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
    void this.api.recordRecentChart('spx-liquidity').catch(() => undefined);
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
      chartTitle: 'S&P 500 vs többletlikviditás',
      fileName: `spx-liquidity_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `spx-liquidity_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: 'S&P 500 YoY (%)', value: (row) => formatCsvNumber(row.spxYoyChange) },
        { header: 'Excess Liquidity Leading (%)', value: (row) => formatCsvNumber(row.excessLiquidityLeading) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const ts = this.lastUpdated();
    if (!ts) return $localize`:Waiting for data@@charts.waitingForData:Waiting for data`;
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
      const response = await this.api.getSpxLiquidityChartData(timeframe);
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
