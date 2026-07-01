import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, LOCALE_ID, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type BitcoinRainbowChartDataPoint,
  type ChartTimeframe,
} from '@crypto-market-analysis/data-access/api-client';
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
import { ChartViewerComponent } from '../chart-viewer/chart-viewer.component';
import { parseChartTimeframe } from '../chart-timeframe/chart-timeframe-url.util';

interface TimeframeOption {
  label: string;
  value: ChartTimeframe;
}

interface SoprApiPoint {
  d: string;
  lthSopr?: number;
  sthSopr?: number;
}

interface SoprRatioPoint {
  date: string;
  priceUsd: number;
  lthSopr: number | null;
  sthSopr: number | null;
  soprRatio: number | null;
  ratioBar: [number, number] | null;
  ma7: number | null;
  ma30: number | null;
}

const TIMEFRAMES: TimeframeOption[] = [
  { label: $localize`:Timeframe 1 month@@charts.timeframe.1m:1 month`, value: '1m' },
  { label: $localize`:Timeframe 3 months@@charts.timeframe.3m:3 months`, value: '3m' },
  { label: $localize`:Timeframe 6 months@@charts.timeframe.6m:6 months`, value: '6m' },
  { label: $localize`:Timeframe 1 year@@charts.timeframe.1y:1 year`, value: '1y' },
  { label: $localize`:Timeframe 2 years@@charts.timeframe.2y:2 years`, value: '2y' },
  { label: $localize`:Timeframe All@@charts.timeframe.all:All`, value: 'all' },
];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-sopr-ratio-chart-page',
  imports: [
    ChartViewerComponent,
    ChartAnnotationsComponent,
    ChartInfoPanelComponent,
    RouterLink,
    ChartFavouriteButtonComponent,
  ],
  templateUrl: './sopr-ratio-chart-page.component.html',
})
export class SoprRatioChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly http = inject(HttpClient);
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
  protected readonly dataPoints = signal<SoprRatioPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const last = [...this.dataPoints()].reverse().find((p) => p.soprRatio !== null);
    if (!last) return [];
    return [
      { label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`, value: formatUsd(last.priceUsd) },
      { label: $localize`:SOPR Ratio metric@@charts.metric.soprRatio:SOPR Ratio`, value: formatNumber(last.soprRatio) },
      { label: $localize`:LTH SOPR metric@@charts.metric.lthSopr:LTH SOPR`, value: formatNumber(last.lthSopr) },
      { label: $localize`:STH SOPR metric@@charts.metric.sthSopr:STH SOPR`, value: formatNumber(last.sthSopr) },
      { label: $localize`:Signal metric@@charts.metric.signal:Signal`, value: getSoprSignal(last.soprRatio) },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const ratio = [...this.dataPoints()].reverse().find((p) => p.soprRatio !== null)?.soprRatio ?? null;
    if (ratio === null) return $localize`:SOPR Ratio waiting interpretation@@charts.soprRatio.interpretation.waiting:Waiting for the latest SOPR Ratio data.`;
    if (ratio > 1.1) return $localize`:SOPR Ratio high interpretation@@charts.soprRatio.interpretation.high:The SOPR Ratio is above 1. Long-term holders are realizing relatively more profit than short-term holders, a pattern often seen as experienced holders distribute into strength.`;
    if (ratio < 0.9) return $localize`:SOPR Ratio low interpretation@@charts.soprRatio.interpretation.low:The SOPR Ratio is below 1. Short-term holders are realizing relatively more profit than long-term holders, which is common during early bull phases or short-term momentum bursts.`;
    return $localize`:SOPR Ratio neutral interpretation@@charts.soprRatio.interpretation.neutral:The SOPR Ratio is near 1, meaning long-term and short-term holders are realizing profits or losses at similar relative rates.`;
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());
  protected readonly infoAbout =
    $localize`:SOPR Ratio about@@charts.soprRatio.about:The SOPR Ratio divides Long-Term Holder SOPR by Short-Term Holder SOPR. It compares profit-taking behavior between experienced holders and newer market participants.`;
  protected readonly infoDataSources = [
    $localize`:SOPR Ratio data source price@@charts.soprRatio.dataSource.price:Bitcoin price: CoinGecko API via backend price history`,
    $localize`:SOPR Ratio data source lth@@charts.soprRatio.dataSource.lth:LTH SOPR: bitcoin-data.com free public API (available from 25 June 2022)`,
    $localize`:SOPR Ratio data source sth@@charts.soprRatio.dataSource.sth:STH SOPR: bitcoin-data.com free public API (available from 25 June 2022)`,
    $localize`:SOPR Ratio data source calc@@charts.soprRatio.dataSource.calculation:Calculation: LTH SOPR divided by STH SOPR, with 7-day and 30-day moving averages computed in the browser`,
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const points = this.dataPoints();
    return {
      labels: points.map((p) => p.date),
      datasets: [
        {
          type: 'line' as const,
          label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`,
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
          type: 'bar' as const,
          label: $localize`:SOPR Ratio metric@@charts.metric.soprRatio:SOPR Ratio`,
          data: points.map((p) => p.ratioBar),
          backgroundColor: points.map((p) =>
            p.soprRatio === null
              ? 'transparent'
              : p.soprRatio >= 1
                ? 'rgba(22, 163, 74, 0.86)'
                : 'rgba(239, 68, 68, 0.88)',
          ),
          borderWidth: 0,
          barPercentage: 1,
          categoryPercentage: 1,
          yAxisID: 'y2',
          order: 2,
        },
        {
          type: 'line' as const,
          label: $localize`:SOPR Ratio 7d MA@@charts.soprRatio.ma7:7-day MA`,
          data: points.map((p) => p.ma7),
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.1,
          yAxisID: 'y2',
          order: 0,
        },
        {
          type: 'line' as const,
          label: $localize`:SOPR Ratio 30d MA@@charts.soprRatio.ma30:30-day MA`,
          data: points.map((p) => p.ma30),
          borderColor: '#64748b',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.1,
          yAxisID: 'y2',
          order: 0,
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
        type: 'logarithmic',
        position: 'right',
        min: 0.1,
        max: Math.max(10, ...this.dataPoints().map((p) => p.soprRatio ?? 0)) * 1.15,
        ticks: { callback: (value) => formatRatioAxis(Number(value)) },
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
          title: (items) => formatDate(String(items[0]?.label ?? ''), this.locale),
          label: (item) => {
            if (item.dataset.yAxisID === 'y2') {
              const raw = Array.isArray(item.raw) ? item.raw[1] : item.parsed.y;
              return `${item.dataset.label}: ${Number(raw).toFixed(3)}`;
            }
            return `${item.dataset.label}: ${formatUsd(Number(item.parsed.y))}`;
          },
        },
      },
      annotation: {
        annotations: {
          ratioOne: {
            type: 'line',
            yMin: 1,
            yMax: 1,
            yScaleID: 'y2',
            borderColor: 'rgba(107,114,128,0.75)',
            borderWidth: 1,
            borderDash: [4, 4],
            label: {
              display: true,
              content: $localize`:SOPR Ratio equals one annotation@@charts.soprRatio.equalsOne:SOPR Ratio = 1`,
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
    void this.api.recordRecentChart('sopr-ratio').catch(() => undefined);
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
  protected selectTimeframe(timeframe: ChartTimeframe): void {
    if (this.selectedTimeframe() === timeframe || this.isLoading()) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { timeframe } });
  }
  protected toggleInfo(): void { this.infoOpen.update((v) => !v); }
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
      chartTitle: $localize`:SOPR Ratio title@@charts.soprRatioTitle:SOPR Ratio (LTH/STH)`,
      fileName: `sopr-ratio_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `sopr-ratio_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:LTH SOPR metric@@charts.metric.lthSopr:LTH SOPR`, value: (row) => formatCsvNumber(row.lthSopr) },
        { header: $localize`:STH SOPR metric@@charts.metric.sthSopr:STH SOPR`, value: (row) => formatCsvNumber(row.sthSopr) },
        { header: $localize`:SOPR Ratio metric@@charts.metric.soprRatio:SOPR Ratio`, value: (row) => formatCsvNumber(row.soprRatio) },
        { header: $localize`:SOPR Ratio 7d MA@@charts.soprRatio.ma7:7-day MA`, value: (row) => formatCsvNumber(row.ma7) },
        { header: $localize`:SOPR Ratio 30d MA@@charts.soprRatio.ma30:30-day MA`, value: (row) => formatCsvNumber(row.ma30) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const ts = this.lastUpdated();
    if (!ts) return $localize`:Waiting for data@@charts.waitingForData:Waiting for data`;
    return new Date(ts).toLocaleString(this.locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const [priceResponse, lthSopr, sthSopr] = await Promise.all([
        this.api.getBitcoinRainbowChartData(timeframe),
        fetchWithLocalStorageCache<SoprApiPoint[]>(this.http, 'https://bitcoin-data.com/v1/lth-sopr', 'lth_sopr_history'),
        fetchWithLocalStorageCache<SoprApiPoint[]>(this.http, 'https://bitcoin-data.com/v1/sth-sopr', 'sth_sopr_history'),
      ]);

      this.dataPoints.set(buildSoprRatioPoints(priceResponse.dataPoints, lthSopr, sthSopr));
      this.lastUpdated.set(priceResponse.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:SOPR Ratio chart load failure@@charts.soprRatioLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function buildSoprRatioPoints(
  prices: BitcoinRainbowChartDataPoint[],
  lthRows: SoprApiPoint[],
  sthRows: SoprApiPoint[],
): SoprRatioPoint[] {
  const lthMap = new Map(lthRows.filter((p) => Number.isFinite(p.lthSopr)).map((p) => [p.d, Number(p.lthSopr)]));
  const sthMap = new Map(sthRows.filter((p) => Number.isFinite(p.sthSopr)).map((p) => [p.d, Number(p.sthSopr)]));
  const soprDates = [...new Set([...lthMap.keys(), ...sthMap.keys()])].sort();
  const allSoprPoints = soprDates.map((date) => {
    const lthSopr = lthMap.get(date) ?? null;
    const sthSopr = sthMap.get(date) ?? null;
    const soprRatio = lthSopr !== null && sthSopr !== null && sthSopr > 0 ? lthSopr / sthSopr : null;
    return { date, lthSopr, sthSopr, soprRatio };
  });
  const ratios = allSoprPoints.map((p) => p.soprRatio);
  const ma7 = movingAverage(ratios, 7);
  const ma30 = movingAverage(ratios, 30);
  const soprByDate = new Map(allSoprPoints.map((p, i) => [p.date, { ...p, ma7: ma7[i] ?? null, ma30: ma30[i] ?? null }]));

  const visiblePoints: SoprRatioPoint[] = [];
  for (const price of prices) {
      const sopr = soprByDate.get(price.date);
      if (!sopr || sopr.soprRatio === null) continue;
      visiblePoints.push({
        date: price.date,
        priceUsd: price.priceUsd,
        lthSopr: sopr.lthSopr,
        sthSopr: sopr.sthSopr,
        soprRatio: sopr.soprRatio,
        ratioBar: [Math.min(1, sopr.soprRatio), Math.max(1, sopr.soprRatio)] as [number, number],
        ma7: sopr.ma7,
        ma30: sopr.ma30,
      });
    }
  return visiblePoints;
}

function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null);
    return slice.length >= window ? slice.reduce((sum, value) => sum + value, 0) / slice.length : null;
  });
}

async function fetchWithLocalStorageCache<T>(http: HttpClient, url: string, cacheKey: string): Promise<T> {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, ts } = JSON.parse(cached) as { data: T; ts: number };
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    }
  } catch { /* ignore cache parsing errors */ }

  const data = await firstValueFrom(http.get<T>(url));
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore storage quota errors */ }
  return data;
}

function getSoprSignal(value: number | null): string {
  if (value === null) return $localize`:No data value@@common.noData:No data`;
  if (value > 1.1) return $localize`:SOPR Ratio high signal@@charts.signal.soprRatio.high:LTH profit-taking leads`;
  if (value < 0.9) return $localize`:SOPR Ratio low signal@@charts.signal.soprRatio.low:STH profit-taking leads`;
  return $localize`:SOPR Ratio balanced signal@@charts.signal.soprRatio.balanced:Balanced spending`;
}

function formatNumber(value: number | null): string {
  return value === null ? $localize`:No data value@@common.noData:No data` : value.toFixed(3);
}

function formatRatioAxis(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0.1 || value === 1 || value === 1.5 || value === 5 || value === 10 || value === 100) {
    return value.toString();
  }
  return '';
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return $localize`:No data value@@common.noData:No data`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
}

function formatDate(value: string, locale: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`));
}
