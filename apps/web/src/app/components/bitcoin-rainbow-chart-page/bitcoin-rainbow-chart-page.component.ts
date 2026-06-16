import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type BitcoinRainbowChartDataPoint,
  type ChartTimeframe,
} from '@crypto-market-analysis/data-access/api-client';
import { ChartViewerComponent } from '../chart-viewer/chart-viewer.component';

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

const RAINBOW_BANDS = [
  { label: 'Fire Sale', color: 'rgba(47, 128, 237, 0.14)' },
  { label: 'Buy', color: 'rgba(86, 204, 242, 0.14)' },
  { label: 'Accumulate', color: 'rgba(39, 174, 96, 0.14)' },
  { label: 'Still Cheap', color: 'rgba(111, 207, 151, 0.14)' },
  { label: 'Fair Value', color: 'rgba(242, 201, 76, 0.16)' },
  { label: 'Hold', color: 'rgba(242, 153, 74, 0.14)' },
  { label: 'FOMO', color: 'rgba(235, 87, 87, 0.12)' },
  { label: 'Sell', color: 'rgba(190, 60, 60, 0.12)' },
  { label: 'Maximum Bubble', color: 'rgba(127, 29, 29, 0.12)' },
];

@Component({
  selector: 'app-bitcoin-rainbow-chart-page',
  imports: [ChartViewerComponent, RouterLink],
  templateUrl: './bitcoin-rainbow-chart-page.component.html',
})
export class BitcoinRainbowChartPageComponent {
  private readonly api = inject(AuthApiClient);
  protected readonly timeframes = TIMEFRAMES;
  protected readonly selectedTimeframe = signal<ChartTimeframe>('all');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly dataPoints = signal<BitcoinRainbowChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);
  protected readonly chartData = computed<ChartData<'line'>>(() => ({
    labels: this.dataPoints().map((point) => point.date),
    datasets: [
      {
        label: 'Bitcoin Price',
        data: this.dataPoints().map((point) => point.priceUsd),
        borderColor: '#101820',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 12,
        tension: 0.18,
      },
    ],
  }));
  protected readonly chartOptions = computed<ChartOptions<'line'>>(() => {
    const range = getPriceRange(this.dataPoints());

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
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => formatDate(String(items[0]?.label ?? '')),
            label: (item) => {
              const point = this.dataPoints()[item.dataIndex];
              const band = point?.rainbowBand ?? null;

              return [
                `Price: ${formatUsd(Number(item.parsed.y))}`,
                `Band: ${getBandLabel(band)}${band === null ? '' : ` (Band ${band})`}`,
              ];
            },
          },
        },
        annotation: {
          annotations: createRainbowAnnotations(range.min, range.max),
        },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag: { enabled: true },
            mode: 'x',
          },
        },
      },
    };
  });

  constructor() {
    void this.loadChartData('all');
  }

  protected async selectTimeframe(timeframe: ChartTimeframe): Promise<void> {
    if (this.selectedTimeframe() === timeframe || this.isLoading()) {
      return;
    }

    await this.loadChartData(timeframe);
  }

  protected toggleInfo(): void {
    this.infoOpen.update((isOpen) => !isOpen);
  }

  protected lastUpdatedText(): string {
    const timestamp = this.lastUpdated();

    if (!timestamp) {
      return 'Waiting for data';
    }

    return new Date(timestamp).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
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
          : $localize`:Chart data load failure@@charts.rainbowLoadFailed:Chart data could not be loaded. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}

function getPriceRange(dataPoints: BitcoinRainbowChartDataPoint[]): { min: number; max: number } {
  const prices = dataPoints.map((point) => point.priceUsd).filter((price) => price > 0);

  if (prices.length === 0) {
    return { min: 1, max: 100000 };
  }

  const min = Math.max(0.01, Math.min(...prices) * 0.55);
  const max = Math.max(...prices) * 1.45;

  return { min, max };
}

function createRainbowAnnotations(min: number, max: number): Record<string, AnnotationOptions<'box'>> {
  const ratio = Math.pow(max / min, 1 / RAINBOW_BANDS.length);

  return Object.fromEntries(
    RAINBOW_BANDS.map((band, index) => {
      const yMin = min * Math.pow(ratio, index);
      const yMax = index === RAINBOW_BANDS.length - 1 ? max : min * Math.pow(ratio, index + 1);

      return [
        `rainbowBand${index + 1}`,
        {
          type: 'box',
          yMin,
          yMax,
          backgroundColor: band.color,
          borderWidth: 0,
        },
      ];
    }),
  );
}

function getBandLabel(band: number | null): string {
  if (band === null) {
    return 'Unknown';
  }

  return RAINBOW_BANDS[band - 1]?.label ?? 'Unknown';
}

function formatUsd(value: number): string {
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
