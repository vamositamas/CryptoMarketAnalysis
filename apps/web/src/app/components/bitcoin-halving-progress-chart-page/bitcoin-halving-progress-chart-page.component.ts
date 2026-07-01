import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type BitcoinRainbowChartDataPoint,
} from '@crypto-market-analysis/data-access/api-client';
import { ChartViewerComponent } from '../chart-viewer/chart-viewer.component';
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


// Full halving schedule including estimated next
const HALVINGS = [
  '2009-01-03', // Genesis / Cycle 1 start
  '2012-11-28', // 1st halving / Cycle 2 start
  '2016-07-09', // 2nd halving / Cycle 3 start
  '2020-05-11', // 3rd halving / Cycle 4 start
  '2024-04-19', // 4th halving / Cycle 5 start (current)
  '2028-04-21', // 5th halving estimated
];

// Cycle definitions indexed 0-4
const CYCLE_DEFS = HALVINGS.slice(0, -1).map((start, i) => ({
  start,
  end: HALVINGS[i + 1],
  label: i === 0 ? 'Cycle 1 (2009–2012)' : `Cycle ${i + 1}`,
  isCurrent: i === 4,
}));

const CURRENT_CYCLE_START_MS = Date.parse(HALVINGS[4] + 'T00:00:00Z');
const NEXT_HALVING_EST_MS = Date.parse(HALVINGS[5] + 'T00:00:00Z');

@Component({
  selector: 'app-bitcoin-halving-progress-chart-page',
  standalone: true,
  imports: [ChartViewerComponent, ChartInfoPanelComponent, RouterLink, ChartFavouriteButtonComponent],
  templateUrl: './bitcoin-halving-progress-chart-page.component.html',
})
export class BitcoinHalvingProgressChartPageComponent {
  private readonly api = inject(AuthApiClient);
  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly dataPoints = signal<BitcoinRainbowChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly infoAbout =
    'Bitcoin Halving Progress overlays all halving cycles on a continuous logarithmic price chart. ' +
    'The green shaded region in each cycle spans from the halving date to the same relative progress ' +
    'point as we are in the current cycle — so you can directly compare where price was at the ' +
    '"same stage" in each past 4-year cycle. The blue "X%" badges mark the right edge of each ' +
    'green region. Red dots indicate every day a new all-time high was set.';

  protected readonly infoDataSources = ['Bitcoin Price: CoinGecko API (stored daily)'];

  // How far we are through the current cycle (0 → 1)
  protected readonly cycleProgress = computed<number>(() =>
    Math.min(1, Math.max(0, (Date.now() - CURRENT_CYCLE_START_MS) / (NEXT_HALVING_EST_MS - CURRENT_CYCLE_START_MS))),
  );

  // BTC price at the equivalent progress point in each past cycle
  private readonly pastCyclePrices = computed<{ label: string; price: number | null }[]>(() => {
    const points = this.dataPoints();
    const progress = this.cycleProgress();
    const dates = points.map((p) => p.date);

    return CYCLE_DEFS.slice(0, -1).map((cycle) => {
      const startMs = Date.parse(cycle.start + 'T00:00:00Z');
      const endMs = Date.parse(cycle.end + 'T00:00:00Z');
      const progDate = new Date(startMs + progress * (endMs - startMs)).toISOString().slice(0, 10);
      const nearest = nearestInLabels(dates, progDate);
      const pt = nearest ? points.find((p) => p.date === nearest) : undefined;
      return { label: cycle.label, price: pt?.priceUsd ?? null };
    });
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const progress = this.cycleProgress();
    const daysSince = Math.floor((Date.now() - CURRENT_CYCLE_START_MS) / 86_400_000);
    const totalDays = Math.floor((NEXT_HALVING_EST_MS - CURRENT_CYCLE_START_MS) / 86_400_000);
    const fields: ChartInfoField[] = [
      { label: $localize`:BTC price now@@charts.metric.btcPriceNow:BTC price (now)`, value: fmtUsd(last.priceUsd) },
      { label: $localize`:Cycle progress@@charts.metric.cycleProgress:Cycle progress`, value: `${(progress * 100).toFixed(2)}%` },
      { label: $localize`:Days in cycle@@charts.metric.daysInCycle:Days in cycle`, value: `${daysSince} / ~${totalDays} days` },
    ];
    for (const c of this.pastCyclePrices()) {
      fields.push({ label: `${c.label} at same stage`, value: c.price !== null ? fmtUsd(c.price) : '—' });
    }
    return fields;
  });

  protected readonly infoInterpretation = computed(() => {
    const progress = this.cycleProgress();
    if (progress < 0.25) return 'Early cycle: typically sees post-halving excitement then consolidation.';
    if (progress < 0.45) return 'Mid-cycle expansion: BTC has historically entered its main bull run in this phase.';
    if (progress < 0.65) return 'Peak zone: cycles 3 and 4 both topped in this range.';
    if (progress < 0.82) return 'Post-peak: cycle 4 found its bottom near 80% through the cycle.';
    return 'Late cycle: approaching the next halving — historically a quiet accumulation period.';
  });

  protected readonly infoLastUpdated = computed(() => {
    const ts = this.lastUpdated();
    if (!ts) return $localize`:Waiting for data@@charts.waitingForData:Waiting for data`;
    return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }) + ' UTC';
  });

  private readonly allDates = computed<string[]>(() => {
    const points = this.dataPoints();
    const future = buildFutureLabels(points);
    return [...points.map((p) => p.date), ...future];
  });

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const points = this.dataPoints();
    const allDates = this.allDates();
    const futureCount = allDates.length - points.length;
    const futureNulls = Array<number | null>(futureCount).fill(null);

    // ATH markers: red dot every day a new all-time high is reached
    let maxPrice = 0;
    const athValues = points.map((p) => {
      if (p.priceUsd > maxPrice) {
        maxPrice = p.priceUsd;
        return p.priceUsd;
      }
      return null as number | null;
    });
    const athData = [...athValues, ...futureNulls];

    return {
      labels: allDates,
      datasets: [
        {
          label: $localize`:BTC price metric@@charts.metric.btcPrice:BTC price`,
          data: [...points.map((p) => p.priceUsd), ...futureNulls],
          borderColor: '#000000',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 10,
          tension: 0.1,
          order: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fill: false as any,
        },
        {
          label: $localize`:All-time high@@charts.metric.allTimeHigh:All-time high`,
          data: athData,
          showLine: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pointRadius: athData.map((v) => (v !== null ? 3 : 0)) as any,
          pointBackgroundColor: '#dc2626',
          pointBorderColor: '#dc2626',
          pointBorderWidth: 0,
          pointHoverRadius: 5,
          order: 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fill: false as any,
        },
  ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => {
    const points = this.dataPoints();
    if (!points.length) return {};

    const allDates = this.allDates();
    const progress = this.cycleProgress();
    const today = new Date().toISOString().slice(0, 10);
    const annotations: Record<string, AnnotationOptions> = {};
    const progressPct = `${(progress * 100).toFixed(2)}%`;

    // ── Green elapsed band + progress line per cycle ──
    for (const [i, cycle] of CYCLE_DEFS.entries()) {
      const cycleStartMs = Date.parse(cycle.start + 'T00:00:00Z');
      const cycleEndMs = Date.parse(cycle.end + 'T00:00:00Z');
      const progDateRaw = new Date(cycleStartMs + progress * (cycleEndMs - cycleStartMs))
        .toISOString()
        .slice(0, 10);

      const progDate = cycle.isCurrent ? today : progDateRaw;

      const xMin = nearestInLabels(allDates, cycle.start);
      const xMax = nearestInLabels(allDates, progDate);

      if (!xMin || !xMax || xMin === xMax) continue;

      // Green elapsed band: halving date → equivalent-progress date
      annotations[`green_${i}`] = {
        type: 'box',
        xMin,
        xMax,
        backgroundColor: 'rgba(34, 197, 94, 0.22)',
        borderWidth: 0,
      };

      // Vertical progress line at right edge
      const isCurrent = cycle.isCurrent;
      annotations[`prog_line_${i}`] = {
        type: 'line',
        xMin: xMax,
        xMax: xMax,
        borderColor: isCurrent ? '#f59e0b' : 'rgba(59, 130, 246, 0.75)',
        borderWidth: isCurrent ? 2 : 1.5,
        borderDash: isCurrent ? [] : [4, 4],
        label: {
          display: true,
          content: progressPct,
          position: 'start',
          backgroundColor: isCurrent ? '#f59e0b' : '#3b82f6',
          color: '#fff',
          font: { size: 10, weight: 'bold' as const },
          padding: { x: 5, y: 2 },
        },
      };
    }

    // ── Remaining current cycle (today → 2028): neutral gray so it reads as
    //    "this part of the cycle hasn't happened yet" ──
    const xRemStart = nearestInLabels(allDates, today);
    const xRemEnd = nearestInLabels(allDates, HALVINGS[5]);
    if (xRemStart && xRemEnd && xRemStart !== xRemEnd) {
      annotations['remaining_current'] = {
        type: 'box',
        xMin: xRemStart,
        xMax: xRemEnd,
        backgroundColor: 'rgba(156, 163, 175, 0.12)',
        borderWidth: 0,
      };
    }

    // ── All halving vertical lines (including 2028 estimate) ──
    for (let h = 1; h < HALVINGS.length; h++) {
      const d = nearestInLabels(allDates, HALVINGS[h]);
      if (!d) continue;
      const isEstimated = h === HALVINGS.length - 1;
      annotations[`halving_${h}`] = {
        type: 'line',
        xMin: d,
        xMax: d,
        borderColor: 'rgba(107, 114, 128, 0.55)',
        borderWidth: 1.5,
        borderDash: [6, 4],
        label: {
          display: true,
          content: isEstimated ? 'Halving (est.)' : 'Halving',
          position: 'start',
          backgroundColor: 'rgba(239, 68, 68, 0.85)',
          color: '#fff',
          font: { size: 9, weight: 'bold' as const },
          padding: { x: 4, y: 2 },
        },
      };
    }

    const maxPrice = Math.max(...points.map((p) => p.priceUsd));

    return {
      animation: { duration: 280 },
      scales: {
        x: {
          ticks: { maxTicksLimit: 12 },
          grid: { color: 'rgba(23, 32, 42, 0.08)' },
        },
        y: {
          type: 'logarithmic',
          min: 0.01,
          max: maxPrice * 5,
          ticks: { callback: (value) => fmtUsd(Number(value)) },
          grid: { color: 'rgba(23, 32, 42, 0.08)' },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            filter: (item) => !item.text.startsWith('All-Time'),
          },
        },
        tooltip: {
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            title: (items) => fmtDate(String(items[0]?.label ?? '')),
            label: (item) => `Price: ${fmtUsd(Number(item.parsed.y))}`,
          },
        },
        annotation: { annotations },
      },
    };
  });

  constructor() {
    void this.api.recordRecentChart('halving-progress').catch(() => undefined);
    void this.loadChartData();
  }

  protected resetZoom(): void {
    this.chartViewer?.resetZoom();
  }

  protected toggleFullscreen(): void { this.chartViewer?.toggleFullscreen(); }

  protected toggleInfo(): void {
    this.infoOpen.update((v) => !v);
  }

  protected toggleExportMenu(): void {
    this.exportMenuOpen.update((v) => !v);
  }

  protected async exportPng(): Promise<void> {
    const dataUrl = this.chartViewer?.exportImage();
    if (!dataUrl) return;
    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl: dataUrl,
      chartTitle: 'Bitcoin Halving Progress',
      fileName: `bitcoin-halving-progress_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `bitcoin-halving-progress_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
      ],
    });
  }

  private async loadChartData(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await this.api.getBitcoinRainbowChartData('all');
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

// ─────────────────────────── Helpers ───────────────────────────

function nearestInLabels(labels: string[], targetDate: string): string | null {
  if (!labels.length) return null;
  if (targetDate <= labels[0]) return labels[0];
  if (targetDate >= labels[labels.length - 1]) return labels[labels.length - 1];

  let lo = 0;
  let hi = labels.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (labels[mid] <= targetDate) lo = mid;
    else hi = mid;
  }
  const diffLo = Date.parse(targetDate + 'T00:00:00Z') - Date.parse(labels[lo] + 'T00:00:00Z');
  const diffHi = Date.parse(labels[hi] + 'T00:00:00Z') - Date.parse(targetDate + 'T00:00:00Z');
  return diffLo <= diffHi ? labels[lo] : labels[hi];
}

function buildFutureLabels(points: { date: string }[]): string[] {
  if (!points.length) return [];
  const last = new Date(points[points.length - 1].date + 'T00:00:00Z');

  // Always extend monthly to the next estimated halving so the remaining
  // current cycle period is visible at the correct proportional width
  const labels: string[] = [];
  const cursor = new Date(last);
  const maxDate = new Date('2028-05-01T00:00:00Z');
  cursor.setDate(cursor.getDate() + 30);
  while (cursor <= maxDate) {
    labels.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 30);
  }
  if (!labels.includes(HALVINGS[5])) labels.push(HALVINGS[5]);
  labels.sort();
  return labels;
}

function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (value >= 1) return `$${value.toFixed(0)}`;
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
