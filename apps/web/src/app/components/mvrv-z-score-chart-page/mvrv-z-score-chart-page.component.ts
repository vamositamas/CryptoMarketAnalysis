import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartTimeframe,
  type MvrvZScoreChartDataPoint,
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

const MVRV_ALERT_METRICS: AlertMetricOption[] = [
  { value: 'mvrv_zscore', label: 'MVRV Z-Score' },
  { value: 'btc_price', label: 'BTC Price USD' },
];

@Component({
  selector: 'app-mvrv-z-score-chart-page',
  imports: [ChartViewerComponent, ChartAnnotationsComponent, ChartInfoPanelComponent, RouterLink, CreateAlertModalComponent],
  templateUrl: './mvrv-z-score-chart-page.component.html',
})
export class MvrvZScoreChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;
  @ViewChild(ChartAnnotationsComponent) protected readonly chartAnnotations?: ChartAnnotationsComponent;
  protected readonly timeframes = TIMEFRAMES;
  protected readonly alertMetrics = MVRV_ALERT_METRICS;
  protected readonly showAlertModal = signal(false);
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly userAnnotations = signal<Record<string, AnnotationOptions>>({});
  protected readonly dataPoints = signal<MvrvZScoreChartDataPoint[]>([]);
  protected readonly realizedPrices = signal<Map<string, number>>(new Map());
  protected readonly lastUpdated = signal<string | null>(null);

  // 5-year EMA of BTC price — approximates realized price better than short SMAs
  // because it captures long-term coin-accumulation cost basis (old cheap coins drag it down)
  private readonly ema5y = computed<(number | null)[]>(() => {
    const prices = this.dataPoints().map((p) => p.priceUsd);
    const alpha = 2 / 1826; // ~5-year exponential decay
    const out: (number | null)[] = [];
    let ema: number | null = null;
    for (const p of prices) {
      if (p <= 0) { out.push(ema); continue; }
      ema = ema === null ? p : alpha * p + (1 - alpha) * ema;
      out.push(ema);
    }
    return out;
  });

  // Proxy Z-Score: ln(price / ema5y) × 5 ≈ MVRV Z-Score shape.
  // Scale=5 is empirically derived from cycle peaks: at each major top,
  // ln(peak_price / ema5y) ≈ 1.5–2, and actual Z-Score ≈ 7–10, giving scale ≈ 5.
  // No least-squares calibration: calibrating against sparse recent DB data (post-2021,
  // when Z-Scores were 0–2.5) biases the scale to ~1.9, making all historical peaks
  // look flat near 0–2 instead of showing correct 7–10 values.
  private readonly proxyZScore = computed<(number | null)[]>(() => {
    const ema = this.ema5y();
    const scale = 5;
    return this.dataPoints().map((p, i) => {
      const e = ema[i];
      return e !== null && e > 0 && p.priceUsd > 0 ? Math.log(p.priceUsd / e) * scale : null;
    });
  });

  // Z-Score: actual from bitcoin-data.com where available, ema5y proxy otherwise
  private readonly enhancedZScore = computed<(number | null)[]>(() => {
    const points = this.dataPoints();
    const proxy = this.proxyZScore();
    return points.map((p, i) => p.mvrvZScore ?? proxy[i] ?? null);
  });

  // Realized prices: actual from bitcoin-data.com where available, 5yr EMA proxy otherwise
  private readonly enhancedRealizedPrices = computed<Map<string, number>>(() => {
    const points = this.dataPoints();
    const ema = this.ema5y();
    const actualMap = this.realizedPrices();
    const result = new Map<string, number>();
    for (let i = 0; i < points.length; i++) {
      const date = points[i].date;
      const actual = actualMap.get(date);
      if (actual !== undefined) {
        result.set(date, actual);
      } else {
        const e = ema[i];
        if (e !== null) result.set(date, e);
      }
    }
    return result;
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const lastIdx = points.length - 1;
    const point = points[lastIdx];
    const zScore = this.enhancedZScore()[lastIdx] ?? null;
    const realizedPrice = point ? (this.enhancedRealizedPrices().get(point.date) ?? null) : null;

    return [
      { label: 'BTC Price',         value: point ? formatUsd(point.priceUsd) : 'Waiting for data' },
      { label: 'Realized Price',     value: realizedPrice !== null ? formatUsd(realizedPrice) : 'Waiting for data' },
      { label: 'MVRV Z-Score',       value: zScore !== null ? zScore.toFixed(2) : 'Waiting for data' },
      { label: 'Signal',             value: zScore !== null ? getMvrvSignal(zScore) : 'Waiting for data' },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const zScores = this.enhancedZScore();
    const zScore = zScores[zScores.length - 1] ?? null;

    if (zScore === null) return 'Waiting for the latest MVRV Z-Score data.';
    if (zScore > 7)  return 'The MVRV Z-Score is in the overheated zone (above 7). Historically, readings above 7 have coincided with major cycle tops. Exercise caution.';
    if (zScore > 5)  return 'The MVRV Z-Score is elevated (5–7), suggesting the market is overextended relative to realized value. Historically associated with late-cycle conditions.';
    if (zScore > 3)  return 'The MVRV Z-Score is in the caution zone (3–5). The market is pricing in a moderate premium over realized value.';
    if (zScore >= 0) return 'The MVRV Z-Score is in the fair value zone (0–3). Bitcoin is trading near or below historical mean valuations relative to realized cap.';
    return 'The MVRV Z-Score is negative — Bitcoin is trading below its realized value on a statistical basis. Historically this has coincided with strong long-term accumulation opportunities.';
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());
  protected readonly infoAbout =
    'The MVRV Z-Score compares Bitcoin\'s market capitalization to its realized capitalization, then normalizes the difference using standard deviation. Values above 7 historically signal major cycle tops; negative values have marked generational buying opportunities.';
  protected readonly infoDataSources = [
    'Bitcoin Price: CoinGecko via backend DB (full history)',
    'MVRV Z-Score & Realized Price (2022–present): bitcoin-data.com',
    'Pre-2022: 5-year EMA proxy (approximation based on price history)',
  ];

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.dataPoints();
    const timeframe = this.selectedTimeframe();
    const realizedMap = this.enhancedRealizedPrices();
    const zScores = this.enhancedZScore();

    // Future empty space proportional to the visible date range
    const futureDays: Record<string, number> = { '1m': 5, '3m': 8, '6m': 14, '1y': 21, '2y': 45, 'all': 90 };
    const padDays = futureDays[timeframe] ?? 30;
    const futureLabels: string[] = [];
    if (points.length > 0) {
      const last = new Date(`${points[points.length - 1].date}T00:00:00.000Z`);
      for (let i = 1; i <= padDays; i++) {
        const d = new Date(last);
        d.setUTCDate(d.getUTCDate() + i);
        futureLabels.push(d.toISOString().split('T')[0]);
      }
    }
    const futureNulls = futureLabels.map(() => null as number | null);

    return {
      labels: [...points.map((p) => p.date), ...futureLabels],
      datasets: [
        {
          label: 'BTC Price',
          data: [...points.map((p) => p.priceUsd), ...futureNulls],
          borderColor: '#111820',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.1,
          yAxisID: 'y',
          order: 2,
        },
        {
          label: 'Realized Price',
          data: [...points.map((p) => realizedMap.get(p.date) ?? null), ...futureNulls],
          borderColor: '#22a9d0',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.1,
          yAxisID: 'y',
          order: 3,
        },
        {
          label: 'Z-Score',
          data: [...zScores, ...futureNulls],
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 12,
          tension: 0.16,
          yAxisID: 'y2',
          order: 1,
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
        type: 'linear',
        position: 'right',
        suggestedMin: -3,
        suggestedMax: 10,
        ticks: {
          stepSize: 2,
          callback: (value) => Number(value).toFixed(0),
        },
        grid: { drawOnChartArea: false },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 16,
          generateLabels: (chart) =>
            chart.data.datasets.map((ds, i) => ({
              text: ds.label ?? '',
              fillStyle: ds.borderColor as string,
              strokeStyle: ds.borderColor as string,
              pointStyle: ds.label === 'Z-Score' ? 'line' : 'line',
              hidden: !chart.isDatasetVisible(i),
              datasetIndex: i,
            })),
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (items) => formatDate(String(items[0]?.label ?? '')),
          label: (item) => {
            if (item.dataset.yAxisID === 'y2') {
              return `Z-Score: ${Number(item.parsed.y).toFixed(2)}`;
            }
            return `${item.dataset.label}: ${formatUsd(Number(item.parsed.y))}`;
          },
        },
      },
      annotation: {
        annotations: {
          // Red sell zone: Z-Score > 7 (yMax is very large so it always fills to top)
          zoneSell: {
            type: 'box' as const,
            xScaleID: 'x',
            yScaleID: 'y2',
            yMin: 7,
            yMax: 9999,
            backgroundColor: 'rgba(239,68,68,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.3)',
          },
          // Dashed red line at 7
          lineSell: {
            type: 'line' as const,
            yMin: 7,
            yMax: 7,
            yScaleID: 'y2',
            borderColor: 'rgba(239,68,68,0.5)',
            borderWidth: 1,
            borderDash: [4, 4],
          },
          // Green buy zone: Z-Score < 0.2 (yMin is very negative so it always fills to bottom)
          zoneBuy: {
            type: 'box' as const,
            xScaleID: 'x',
            yScaleID: 'y2',
            yMin: -9999,
            yMax: 0.2,
            backgroundColor: 'rgba(34,197,94,0.13)',
            borderWidth: 1,
            borderColor: 'rgba(34,197,94,0.3)',
          },
          // Dashed green line at 0.2
          lineBuy: {
            type: 'line' as const,
            yMin: 0.2,
            yMax: 0.2,
            yScaleID: 'y2',
            borderColor: 'rgba(34,197,94,0.5)',
            borderWidth: 1,
            borderDash: [4, 4],
          },
          ...this.userAnnotations(),
        },
      },
    },
  }));

  constructor() {
    void this.api.recordRecentChart('mvrv-z-score').catch(() => undefined);
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
    const chartImageDataUrl = this.chartViewer?.exportImage();
    if (!chartImageDataUrl) return;
    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl,
      chartTitle: 'MVRV Z-Score',
      fileName: `mvrv-z-score_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    const realizedMap = this.realizedPrices();
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `mvrv-z-score_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Date',            value: (row) => row.date },
        { header: 'Price USD',       value: (row) => formatCsvNumber(row.priceUsd) },
        { header: 'Realized Price',  value: (row) => formatCsvNumber(realizedMap.get(row.date) ?? null) },
        { header: 'MVRV Z-Score',    value: (row) => formatCsvNumber(row.mvrvZScore) },
      ],
    });
  }

  protected lastUpdatedText(): string {
    const timestamp = this.lastUpdated();
    if (!timestamp) return 'Waiting for data';
    return new Date(timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
  }

  private async loadChartData(timeframe: ChartTimeframe): Promise<void> {
    this.selectedTimeframe.set(timeframe);
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      // Fetch backend price data + live bitcoin-data.com data in parallel from the browser
      const [response, mvrvHistory, realizedHistory] = await Promise.all([
        this.api.getMvrvZScoreChartData(timeframe).catch(() =>
          this.api.getBitcoinRainbowChartData(timeframe).then((r) => ({
            chartId: 'mvrv-z-score' as const,
            title: 'MVRV Z-Score' as const,
            timeframe: r.timeframe,
            dataPoints: r.dataPoints.map((p) => ({ date: p.date, priceUsd: p.priceUsd, mvrvZScore: null as number | null })),
            lastUpdated: r.lastUpdated,
          })),
        ),
        fetchWithLocalStorageCache<{ d: string; mvrvZscore: number }[]>(
          this.http, 'https://bitcoin-data.com/v1/mvrv-zscore', 'mvrv_zscore_history',
        ),
        fetchWithLocalStorageCache<{ d: string; realizedPrice: number }[]>(
          this.http, 'https://bitcoin-data.com/v1/realized-price', 'realized_price_history',
        ),
      ]);

      const mvrvMap = new Map(
        mvrvHistory
          .filter((p) => typeof p.d === 'string' && Number.isFinite(p.mvrvZscore))
          .map((p) => [p.d, p.mvrvZscore]),
      );
      this.realizedPrices.set(new Map(
        realizedHistory
          .filter((p) => typeof p.d === 'string' && Number.isFinite(p.realizedPrice))
          .map((p) => [p.d, p.realizedPrice]),
      ));
      this.dataPoints.set(
        response.dataPoints.map((p) => ({
          date: p.date,
          priceUsd: p.priceUsd,
          mvrvZScore: mvrvMap.get(p.date) ?? p.mvrvZScore,
        })),
      );
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:MVRV Z-Score chart load failure@@charts.mvrvLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function fetchWithLocalStorageCache<T>(
  http: { get: (url: string) => { pipe?: unknown } } & import('@angular/common/http').HttpClient,
  url: string,
  cacheKey: string,
): Promise<T> {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, ts } = JSON.parse(cached) as { data: T; ts: number };
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    }
  } catch { /* ignore parse errors */ }

  try {
    const data = await firstValueFrom(http.get<T>(url));
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* ignore storage quota errors */ }
    return data;
  } catch {
    return [] as T;
  }
}

function getMvrvSignal(zScore: number): string {
  if (zScore > 7)  return 'Overheated — Sell zone';
  if (zScore > 5)  return 'Elevated';
  if (zScore > 3)  return 'Caution';
  if (zScore >= 0) return 'Fair Value';
  return 'Undervalued — Buy zone';
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3)  return `$${(value / 1e3).toFixed(0)}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
