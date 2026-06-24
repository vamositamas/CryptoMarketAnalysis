import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chart, type ChartConfiguration, type Plugin, registerables } from 'chart.js';
import {
  ApiClientError,
  AuthApiClient,
  type BitcoinRainbowChartDataPoint,
} from '@crypto-market-analysis/data-access/api-client';
import {
  ChartInfoPanelComponent,
  type ChartInfoField,
} from '../chart-info-panel/chart-info-panel.component';
import { ChartFavouriteButtonComponent } from '../chart-favourite-button/chart-favourite-button.component';
import {
  exportChartCsv,
  exportChartPng,
  getExportDateStamp,
} from '../chart-export/chart-export.util';

Chart.register(...registerables);

// Halving schedule — last entry is the estimated next halving (for current-cycle fraction)
const HALVINGS_SCHEDULE: { date: string; block: number }[] = [
  { date: '2009-01-03', block: 0 },
  { date: '2012-11-28', block: 210_000 },
  { date: '2016-07-09', block: 420_000 },
  { date: '2020-05-11', block: 630_000 },
  { date: '2024-04-19', block: 840_000 },
  { date: '2028-04-21', block: 1_050_000 }, // estimated
];

// One dataset per halving cycle (index = cycle number starting from 0)
const CYCLE_COLORS = ['#94a3b8', '#60a5fa', '#22d3ee', '#f59e0b', '#f43f5e'];
const CYCLE_LABELS = [
  'Cycle 1 — Genesis to 2012',
  'Cycle 2 — 2012 to 2016',
  'Cycle 3 — 2016 to 2020',
  'Cycle 4 — 2020 to 2024',
  'Current — 2024 onwards',
];

// Radial scale: log10 price mapped to 0..1
// $0.1 → 0 (centre),  $1M → 1 (outer edge)
const LOG_MIN = -1;
const LOG_RANGE = 7;

const HALVINGS_MS = HALVINGS_SCHEDULE.map((h) => Date.parse(h.date + 'T00:00:00Z'));

function toPolar(price: number, dateMs: number): { x: number; y: number; cycle: number } | null {
  if (price <= 0) return null;
  for (let i = 0; i < HALVINGS_SCHEDULE.length - 1; i++) {
    if (dateMs >= HALVINGS_MS[i] && dateMs < HALVINGS_MS[i + 1]) {
      const fraction = (dateMs - HALVINGS_MS[i]) / (HALVINGS_MS[i + 1] - HALVINGS_MS[i]);
      // Clockwise from top: angle = π/2 − fraction·2π
      const angle = Math.PI / 2 - fraction * 2 * Math.PI;
      const r = (Math.log10(price) - LOG_MIN) / LOG_RANGE;
      return { x: r * Math.cos(angle), y: r * Math.sin(angle), cycle: i };
    }
  }
  return null;
}

function formatSpiralPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(0)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  if (price >= 1) return `$${price.toFixed(0)}`;
  return `$${price.toFixed(2)}`;
}

// Plugin draws concentric price circles and radial phase lines before the data
const spiralGridPlugin: Plugin = {
  id: 'spiralGrid',
  beforeDatasetsDraw(chart) {
    const { ctx, scales } = chart;
    const xScale = scales['x'];
    const yScale = scales['y'];
    if (!xScale || !yScale) return;

    const cx = xScale.getPixelForValue(0);
    const cy = yScale.getPixelForValue(0);
    // px per 1 data unit on x-axis (assume square chart area)
    const unitPx = xScale.getPixelForValue(1) - cx;

    ctx.save();

    // --- Concentric price grid circles ---
    const gridPrices = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000];
    for (const price of gridPrices) {
      const r = ((Math.log10(price) - LOG_MIN) / LOG_RANGE) * unitPx;
      if (r <= 0) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Price label in upper-right sector (between Halving and 1-year radial lines)
      const labelAngle = Math.PI / 4; // 45° above horizontal-right
      const lx = cx + r * Math.cos(labelAngle) + 2;
      const ly = cy - r * Math.sin(labelAngle) - 3;
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatSpiralPrice(price), lx, ly);
    }

    // --- Radial phase lines (0°, 90°, 180°, 270° clockwise from top) ---
    const phases = [
      {
        fraction: 0,
        lines: ['Halving'],
        textAlign: 'center' as CanvasTextAlign,
        textBaseline: 'bottom' as CanvasTextBaseline,
        extraPx: -6,
      },
      {
        fraction: 0.25,
        lines: ['52.5K blocks', '~ 1 year'],
        textAlign: 'left' as CanvasTextAlign,
        textBaseline: 'middle' as CanvasTextBaseline,
        extraPx: 6,
      },
      {
        fraction: 0.5,
        lines: ['105K blocks', '~ 2 years'],
        textAlign: 'center' as CanvasTextAlign,
        textBaseline: 'top' as CanvasTextBaseline,
        extraPx: 6,
      },
      {
        fraction: 0.75,
        lines: ['157.5K blocks', '~ 3 years'],
        textAlign: 'right' as CanvasTextAlign,
        textBaseline: 'middle' as CanvasTextBaseline,
        extraPx: -6,
      },
    ];

    for (const phase of phases) {
      const angle = Math.PI / 2 - phase.fraction * 2 * Math.PI;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + unitPx * cosA, cy - unitPx * sinA);
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label slightly past the outer circle
      const outPx = unitPx + 14;
      const lx = cx + outPx * cosA + (phase.fraction === 0.25 ? 2 : phase.fraction === 0.75 ? -2 : 0);
      const ly = cy - outPx * sinA + (phase.fraction === 0 ? phase.extraPx : phase.fraction === 0.5 ? phase.extraPx : 0);

      ctx.fillStyle = '#6b7280';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = phase.textAlign;
      ctx.textBaseline = phase.textBaseline;

      const lineH = 15;
      const offsetY = -(((phase.lines.length - 1) / 2) * lineH);
      for (let j = 0; j < phase.lines.length; j++) {
        ctx.fillText(phase.lines[j], lx, ly + offsetY + j * lineH);
      }
    }

    ctx.restore();
  },
};

@Component({
  selector: 'app-halving-spiral-chart-page',
  standalone: true,
  imports: [RouterLink, ChartInfoPanelComponent, ChartFavouriteButtonComponent],
  templateUrl: './halving-spiral-chart-page.component.html',
})
export class HavingSpiralChartPageComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(AuthApiClient);

  @ViewChild('spiralCanvas') private readonly canvasRef?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly exportMenuOpen = signal(false);
  protected readonly infoOpen = signal(true);
  protected readonly dataPoints = signal<BitcoinRainbowChartDataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly cycleLegend = CYCLE_LABELS.map((label, i) => ({
    label,
    color: CYCLE_COLORS[i],
  }));

  protected readonly lastUpdatedText = computed(() => {
    const d = this.lastUpdated();
    if (!d) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(d));
  });

  protected readonly infoAbout =
    'The Halving Spiral maps Bitcoin price history onto a polar chart where each full revolution ' +
    'represents one halving cycle (≈ 4 years / 210,000 blocks). The radial axis is logarithmic, ' +
    'so each concentric ring is 10× the previous one. Each cycle is shown as a colour-coded arc ' +
    'starting at the top (halving event) and spiralling clockwise. Historically, BTC reaches new ' +
    'all-time highs in the upper-right quadrant and bottoms in the lower-left quadrant of each cycle.';

  protected readonly infoDataSources = ['Bitcoin Price: CoinGecko API (stored daily)'];

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return [];
    const dateMs = Date.parse(last.date + 'T00:00:00Z');
    const cycleStart = HALVINGS_MS[4]; // current cycle: 2024-04-19
    const cycleEnd = HALVINGS_MS[5];
    const fraction = Math.max(0, Math.min(1, (dateMs - cycleStart) / (cycleEnd - cycleStart)));
    const approxBlocks = Math.round(fraction * 210_000);
    const approxYears = (fraction * 4).toFixed(1);
    return [
      { label: 'Current Cycle', value: 'Cycle 5 (2024 onwards)' },
      { label: 'Progress', value: `${(fraction * 100).toFixed(1)}% complete` },
      { label: 'Est. blocks into cycle', value: `${approxBlocks.toLocaleString()} / 210,000` },
      { label: 'Est. years into cycle', value: `${approxYears} / 4 years` },
      { label: 'BTC Price', value: formatUsdPrice(last.priceUsd) },
    ];
  });

  protected readonly infoInterpretation = computed(() => {
    const points = this.dataPoints();
    const last = points[points.length - 1];
    if (!last) return '';
    const dateMs = Date.parse(last.date + 'T00:00:00Z');
    const fraction = (dateMs - HALVINGS_MS[4]) / (HALVINGS_MS[5] - HALVINGS_MS[4]);
    if (fraction < 0.15) return 'Early cycle: historically a consolidation phase after the halving euphoria.';
    if (fraction < 0.4) return 'Mid-cycle expansion: BTC has typically accelerated strongly in this phase.';
    if (fraction < 0.6) return 'Peak zone: historically where cycle tops have formed (upper-right quadrant).';
    if (fraction < 0.8) return 'Post-peak: typically a prolonged correction phase leading toward the next bottom.';
    return 'Late cycle: approaching the next halving — historically a period of quiet accumulation.';
  });

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  ngAfterViewInit(): void {
    // Defer one animation frame so CSS layout (padding-top square trick) is computed
    // before Chart.js reads canvas.offsetWidth / offsetHeight
    requestAnimationFrame(() => {
      this.initChart();
      void this.loadData();
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  protected toggleExportMenu(): void {
    this.exportMenuOpen.update((v) => !v);
  }

  protected toggleInfo(): void {
    this.infoOpen.update((v) => !v);
  }

  protected async exportPng(): Promise<void> {
    this.exportMenuOpen.set(false);
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    await exportChartPng({
      chartImageDataUrl: canvas.toDataURL('image/png'),
      chartTitle: 'Bitcoin Halving Spiral',
      fileName: `halving-spiral-${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      columns: [
        { header: 'Date', value: (p) => p.date },
        { header: 'Price USD', value: (p) => p.priceUsd },
        { header: 'Cycle', value: (p) => getCycleNumber(Date.parse(p.date + 'T00:00:00Z')) },
        {
          header: 'Cycle Fraction',
          value: (p) => {
            const ms = Date.parse(p.date + 'T00:00:00Z');
            for (let i = 0; i < HALVINGS_SCHEDULE.length - 1; i++) {
              if (ms >= HALVINGS_MS[i] && ms < HALVINGS_MS[i + 1]) {
                return ((ms - HALVINGS_MS[i]) / (HALVINGS_MS[i + 1] - HALVINGS_MS[i])).toFixed(6);
              }
            }
            return '';
          },
        },
  ],
      fileName: `halving-spiral-${getExportDateStamp()}.csv`,
    });
  }

  private initChart(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const config: ChartConfiguration = {
      type: 'scatter',
      data: { datasets: [] },
      options: {
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { display: false, min: -1.22, max: 1.22 },
          y: { display: false, min: -1.22, max: 1.22 },
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
      },
      plugins: [spiralGridPlugin],
    };

    this.chart = new Chart(canvas, config);
  }

  private async loadData(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await this.api.getBitcoinRainbowChartData('all');
      this.dataPoints.set(response.dataPoints);
      this.lastUpdated.set(response.lastUpdated);
      this.updateChart(response.dataPoints);
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

  private updateChart(points: BitcoinRainbowChartDataPoint[]): void {
    if (!this.chart) return;

    // Build per-cycle arrays of {x, y} polar points
    const cycleData: { x: number; y: number }[][] = CYCLE_COLORS.map(() => []);

    for (const p of points) {
      const ms = Date.parse(p.date + 'T00:00:00Z');
      const polar = toPolar(p.priceUsd, ms);
      if (polar) cycleData[polar.cycle].push({ x: polar.x, y: polar.y });
    }

    this.chart.data.datasets = cycleData.map((data, i) => ({
      data,
      label: CYCLE_LABELS[i],
      borderColor: CYCLE_COLORS[i],
      borderWidth: i === CYCLE_COLORS.length - 1 ? 2 : 1.5,
      pointRadius: 0,
      showLine: true,
    }));

    // Resize first so the canvas has correct pixel dimensions after becoming visible
    this.chart.resize();
    this.chart.update('none');
  }
}

function getCycleNumber(dateMs: number): number | null {
  for (let i = 0; i < HALVINGS_SCHEDULE.length - 1; i++) {
    if (dateMs >= HALVINGS_MS[i] && dateMs < HALVINGS_MS[i + 1]) return i + 1;
  }
  return null;
}

function formatUsdPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(1)}K`;
  return `$${price.toFixed(2)}`;
}
