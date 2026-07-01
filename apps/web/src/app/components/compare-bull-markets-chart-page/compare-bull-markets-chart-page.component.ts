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

interface BullMarketEra {
  id: 'era-1' | 'era-2' | 'era-3' | 'era-4' | 'era-5';
  label: string;
  start: string;
  end: string | null;
  subsidy: string;
  color: string;
}

interface BullMarketSeries {
  era: BullMarketEra;
  breakoutDate: string;
  breakoutPrice: number;
  athPrice: number;
  athDay: number;
  scale: number;
  points: { day: number; date: string; priceUsd: number; scaledPriceUsd: number }[];
}

const ERAS: BullMarketEra[] = [
  { id: 'era-1', label: $localize`:Compare bull markets era 1@@charts.compareBullMarkets.era1:Era 1`, start: '2009-01-03', end: '2012-11-28', subsidy: '50 BTC', color: '#64748b' },
  { id: 'era-2', label: $localize`:Compare bull markets era 2@@charts.compareBullMarkets.era2:Era 2`, start: '2012-11-28', end: '2016-07-09', subsidy: '25 BTC', color: '#1d75b9' },
  { id: 'era-3', label: $localize`:Compare bull markets era 3@@charts.compareBullMarkets.era3:Era 3`, start: '2016-07-09', end: '2020-05-11', subsidy: '12.5 BTC', color: '#f97316' },
  { id: 'era-4', label: $localize`:Compare bull markets era 4@@charts.compareBullMarkets.era4:Era 4`, start: '2020-05-11', end: '2024-04-19', subsidy: '6.25 BTC', color: '#16a34a' },
  { id: 'era-5', label: $localize`:Compare bull markets era 5@@charts.compareBullMarkets.era5:Era 5`, start: '2024-04-19', end: null, subsidy: '3.125 BTC', color: '#dc2626' },
];

const DAY_MS = 86_400_000;

@Component({
  selector: 'app-compare-bull-markets-chart-page',
  standalone: true,
  imports: [ChartViewerComponent, ChartInfoPanelComponent, RouterLink, ChartFavouriteButtonComponent],
  templateUrl: './compare-bull-markets-chart-page.component.html',
})
export class CompareBullMarketsChartPageComponent {
  private readonly api = inject(AuthApiClient);
  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly dataPoints = signal<BitcoinRainbowChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);
  protected readonly chartTitle = $localize`:Compare Bull Markets title@@charts.compareBullMarkets.title:Compare Bull Markets`;

  protected readonly series = computed(() => buildBullMarketSeries(this.dataPoints()));

  protected readonly currentSeries = computed(() => {
    const all = this.series();
    return all.find((item) => item.era.id === 'era-5') ?? all[all.length - 1] ?? null;
  });

  protected readonly averageDaysToAth = computed(() => {
    const completed = this.series().filter((item) => item.era.id !== 'era-5' && item.athDay > 0);
    if (!completed.length) return null;
    return Math.round(completed.reduce((sum, item) => sum + item.athDay, 0) / completed.length);
  });

  protected readonly chartData = computed<ChartData<'line'>>(() => {
    const series = this.series();
    const maxDay = Math.max(0, ...series.map((item) => item.points[item.points.length - 1]?.day ?? 0));
    const labels = Array.from({ length: maxDay + 1 }, (_, day) => String(day));

    return {
      labels,
      datasets: series.map((item) => {
        const values = Array<number | null>(maxDay + 1).fill(null);
        for (const point of item.points) {
          values[point.day] = point.scaledPriceUsd;
        }
        return {
          label: `${item.era.label} (${item.era.subsidy})`,
          data: values,
          borderColor: item.era.color,
          backgroundColor: 'transparent',
          borderWidth: item.era.id === 'era-5' ? 2 : 1.8,
          pointRadius: 0,
          pointHitRadius: 10,
          spanGaps: true,
          tension: 0.08,
        };
      }),
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => {
    const series = this.series();
    const current = this.currentSeries();
    const avgDays = this.averageDaysToAth();
    const annotations: Record<string, AnnotationOptions> = {};

    if (avgDays !== null) {
      annotations['average_ath'] = {
        type: 'line',
        xMin: String(avgDays),
        xMax: String(avgDays),
        borderColor: 'rgba(22, 163, 74, 0.7)',
        borderWidth: 1.5,
        borderDash: [3, 3],
        label: {
          display: true,
          content: $localize`:Average days to ATH annotation@@charts.compareBullMarkets.averageDaysToAth:Average days to ATH: ${avgDays}:days:`,
          position: 'end',
          backgroundColor: 'rgba(134, 239, 172, 0.95)',
          color: '#14532d',
          font: { size: 10, weight: 'bold' as const },
          padding: { x: 6, y: 3 },
        },
      };
    }

    const maxY = Math.max(1, ...series.flatMap((item) => item.points.map((point) => point.scaledPriceUsd)));

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 220 },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          title: { display: true, text: $localize`:Compare bull markets x axis@@charts.compareBullMarkets.xAxis:Days After Breakout` },
          grid: { color: 'rgba(148, 163, 184, 0.14)' },
          ticks: { maxTicksLimit: 13 },
        },
        y: {
          type: 'logarithmic',
          min: Math.max(1, (current?.breakoutPrice ?? 50_000) * 0.65),
          max: maxY * 1.2,
          title: { display: true, text: $localize`:Compare bull markets y axis@@charts.compareBullMarkets.yAxis:Bitcoin price scaled to current reward era` },
          grid: { color: 'rgba(148, 163, 184, 0.14)' },
          ticks: { callback: (value) => fmtUsd(Number(value)) },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'line', padding: 18 },
        },
        tooltip: {
          callbacks: {
            title: (items) => $localize`:Compare bull markets tooltip title@@charts.compareBullMarkets.tooltipTitle:Day ${items[0]?.label ?? ''}:day: after breakout`,
            label: (item) => {
              const source = series[item.datasetIndex]?.points[item.dataIndex];
              const scaled = fmtUsd(Number(item.parsed.y));
              return source ? `${item.dataset.label}: ${scaled} (${source.date})` : `${item.dataset.label}: ${scaled}`;
            },
          },
        },
        annotation: { annotations },
      },
    };
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const current = this.currentSeries();
    if (!current) return [];
    const latest = current.points[current.points.length - 1];
    return [
      {
        label: $localize`:Current era breakout field@@charts.compareBullMarkets.currentEraBreakout:Current era breakout`,
        value: $localize`:Current era breakout value@@charts.compareBullMarkets.currentEraBreakoutValue:${current.breakoutDate}:date: at ${fmtUsd(current.breakoutPrice)}:price:`,
      },
      {
        label: $localize`:Days since breakout field@@charts.compareBullMarkets.daysSinceBreakout:Days since breakout`,
        value: latest ? String(latest.day) : '-',
      },
      {
        label: $localize`:Current era ATH field@@charts.compareBullMarkets.currentEraAth:Current era ATH`,
        value: $localize`:Current era ATH value@@charts.compareBullMarkets.currentEraAthValue:${fmtUsd(current.athPrice)}:price: on day ${current.athDay}:day:`,
      },
      {
        label: $localize`:Average prior days to ATH field@@charts.compareBullMarkets.averagePriorDaysToAth:Average prior days to ATH`,
        value: this.averageDaysToAth()?.toString() ?? '-',
      },
    ];
  });

  protected readonly infoAbout =
    $localize`:Compare bull markets about@@charts.compareBullMarkets.about:Compare Bull Markets aligns Bitcoin bull-market breakouts by days since each era first breaks above the previous all-time high. Earlier eras are scaled to the current reward era breakout price, which makes historical percentage moves easier to compare against today.`;

  protected readonly infoInterpretation = computed(() =>
    $localize`:Compare bull markets interpretation@@charts.compareBullMarkets.interpretation:A breakout starts when price moves above the previous bull-market high. Each line then continues through the available data for that reward era, so prior cycles remain visible after their main ATH drawdown.`,
  );

  protected readonly infoDataSources = [$localize`:Bitcoin price data source@@charts.compareBullMarkets.dataSource:Bitcoin Price: CoinGecko API (stored daily)`];

  protected readonly infoLastUpdated = computed(() => {
    const ts = this.lastUpdated();
    if (!ts) return $localize`:Waiting for data@@charts.waitingForData:Waiting for data`;
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false,
    }) + ' UTC';
  });

  constructor() {
    void this.api.recordRecentChart('compare-bull-markets').catch(() => undefined);
    void this.loadChartData();
  }

  protected resetZoom(): void {
    this.chartViewer?.resetZoom();
  }

  protected toggleFullscreen(): void { this.chartViewer?.toggleFullscreen(); }

  protected toggleInfo(): void {
    this.infoOpen.update((value) => !value);
  }

  protected toggleExportMenu(): void {
    this.exportMenuOpen.update((value) => !value);
  }

  protected async exportPng(): Promise<void> {
    const dataUrl = this.chartViewer?.exportImage();
    if (!dataUrl) return;
    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl: dataUrl,
      chartTitle: this.chartTitle,
      fileName: `compare-bull-markets_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    const rows = this.series().flatMap((item) =>
      item.points.map((point) => ({
        era: item.era.label,
        subsidy: item.era.subsidy,
        breakoutDate: item.breakoutDate,
        day: point.day,
        date: point.date,
        priceUsd: point.priceUsd,
        scaledPriceUsd: point.scaledPriceUsd,
      })),
    );
    exportChartCsv({
      rows,
      fileName: `compare-bull-markets_${getExportDateStamp()}.csv`,
      columns: [
        { header: $localize`:Era CSV header@@charts.compareBullMarkets.csv.era:Era`, value: (row) => row.era },
        { header: $localize`:Subsidy CSV header@@charts.compareBullMarkets.csv.subsidy:Subsidy`, value: (row) => row.subsidy },
        { header: $localize`:Breakout Date CSV header@@charts.compareBullMarkets.csv.breakoutDate:Breakout Date`, value: (row) => row.breakoutDate },
        { header: $localize`:Day After Breakout CSV header@@charts.compareBullMarkets.csv.dayAfterBreakout:Day After Breakout`, value: (row) => String(row.day) },
        { header: $localize`:Date header@@charts.csv.date:Date`, value: (row) => row.date },
        { header: $localize`:Price USD header@@charts.csv.priceUsd:Price USD`, value: (row) => formatCsvNumber(row.priceUsd) },
        { header: $localize`:Scaled Price USD CSV header@@charts.compareBullMarkets.csv.scaledPriceUsd:Scaled Price USD`, value: (row) => formatCsvNumber(row.scaledPriceUsd) },
      ],
    });
  }

  private async loadChartData(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await this.api.getBitcoinRainbowChartData('all');
      this.dataPoints.set(response.dataPoints.filter((point) => point.priceUsd > 0));
      this.lastUpdated.set(response.lastUpdated);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : $localize`:Chart load failed@@charts.loadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function buildBullMarketSeries(points: BitcoinRainbowChartDataPoint[]): BullMarketSeries[] {
  if (!points.length) return [];
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const candidates = ERAS.slice(1).map((era) => buildEraSeries(era, sorted)).filter((item): item is BullMarketSeries => item !== null);
  const current = candidates.find((item) => item.era.id === 'era-5') ?? candidates[candidates.length - 1];
  if (!current) return candidates;

  return candidates.map((item) => ({
    ...item,
    scale: current.breakoutPrice / item.breakoutPrice,
    points: item.points.map((point) => ({
      ...point,
      scaledPriceUsd: point.priceUsd * (current.breakoutPrice / item.breakoutPrice),
    })),
  }));
}

function buildEraSeries(era: BullMarketEra, points: BitcoinRainbowChartDataPoint[]): BullMarketSeries | null {
  const eraStartIndex = points.findIndex((point) => point.date >= era.start);
  if (eraStartIndex <= 0) return null;

  const previousHigh = Math.max(...points.slice(0, eraStartIndex).map((point) => point.priceUsd));
  const eraEnd = era.end ?? '9999-12-31';
  const breakoutIndex = points.findIndex((point, index) => index >= eraStartIndex && point.date < eraEnd && point.priceUsd > previousHigh);
  if (breakoutIndex < 0) return null;

  const breakout = points[breakoutIndex];
  const eraPoints = points.slice(breakoutIndex).filter((point) => point.date < eraEnd);
  const output: BullMarketSeries['points'] = [];
  let runningAth = breakout.priceUsd;
  let athPrice = breakout.priceUsd;
  let athDay = 0;

  for (const point of eraPoints) {
    const day = daysBetween(breakout.date, point.date);
    if (point.priceUsd > runningAth) {
      runningAth = point.priceUsd;
      athPrice = point.priceUsd;
      athDay = day;
    }
    output.push({ day, date: point.date, priceUsd: point.priceUsd, scaledPriceUsd: point.priceUsd });
  }

  return {
    era,
    breakoutDate: breakout.date,
    breakoutPrice: breakout.priceUsd,
    athPrice,
    athDay,
    scale: 1,
    points: output,
  };
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value).toLocaleString('en-US')}`;
  if (value >= 1) return `$${value.toFixed(0)}`;
  return `$${value.toFixed(2)}`;
}
