import { AfterViewInit, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  AuthApiClient,
  type MidtermCyclesChartResponse,
} from '@crypto-market-analysis/data-access/api-client';
import { ChartViewerComponent } from '../chart-viewer/chart-viewer.component';
import { ChartInfoPanelComponent, type ChartInfoField } from '../chart-info-panel/chart-info-panel.component';
import { ChartFavouriteButtonComponent } from '../chart-favourite-button/chart-favourite-button.component';
import { exportChartCsv, exportChartPng, formatCsvNumber, getExportDateStamp } from '../chart-export/chart-export.util';

type DataPoint = MidtermCyclesChartResponse['dataPoints'][number];

interface MidtermElection {
  date: string;
  president: string;
  party: 'R' | 'D';
  houseChange: number | null;
  senateChange: number | null;
}

const MIDTERM_ELECTIONS: MidtermElection[] = [
  { date: '1990-11-06', president: 'G.H.W. Bush', party: 'R', houseChange: -8,  senateChange: -1 },
  { date: '1994-11-08', president: 'Clinton',      party: 'D', houseChange: -54, senateChange: -8 },
  { date: '1998-11-03', president: 'Clinton',      party: 'D', houseChange: +5,  senateChange: 0  },
  { date: '2002-11-05', president: 'G.W. Bush',    party: 'R', houseChange: +8,  senateChange: +2 },
  { date: '2006-11-07', president: 'G.W. Bush',    party: 'R', houseChange: -30, senateChange: -6 },
  { date: '2010-11-02', president: 'Obama',         party: 'D', houseChange: -63, senateChange: -6 },
  { date: '2014-11-04', president: 'Obama',         party: 'D', houseChange: -13, senateChange: -9 },
  { date: '2018-11-06', president: 'Trump',         party: 'R', houseChange: -40, senateChange: +2 },
  { date: '2022-11-08', president: 'Biden',         party: 'D', houseChange: -9,  senateChange: +1 },
  { date: '2026-11-03', president: 'Trump',         party: 'R', houseChange: null, senateChange: null },
];

function midtermLabel(e: MidtermElection): string {
  const sign = (n: number) => (n >= 0 ? '+' : '') + n;
  const seats =
    e.houseChange !== null && e.senateChange !== null
      ? `${e.party} ${sign(e.houseChange)} House, ${sign(e.senateChange)} Senate`
      : 'TBD';
  return `${e.president} (${e.party})\n${seats}`;
}

function buildMidtermAnnotations(): Record<string, AnnotationOptions> {
  const annotations: Record<string, AnnotationOptions> = {};
  for (const e of MIDTERM_ELECTIONS) {
    annotations[`midterm_${e.date}`] = {
      type: 'line',
      scaleID: 'x',
      value: e.date,
      borderColor: 'rgba(100, 100, 120, 0.55)',
      borderWidth: 1,
      borderDash: [4, 4],
      label: {
        content: midtermLabel(e),
        display: false,
      },
    };
  }
  return annotations;
}

@Component({
  selector: 'app-midterm-cycles-chart-page',
  imports: [ChartViewerComponent, ChartInfoPanelComponent, RouterLink, ChartFavouriteButtonComponent],
  templateUrl: './midterm-cycles-chart-page.component.html',
})
export class MidtermCyclesChartPageComponent implements AfterViewInit {
  private readonly api = inject(AuthApiClient);

  @ViewChild(ChartViewerComponent) private readonly chartViewer?: ChartViewerComponent;

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoOpen = signal(true);
  protected readonly exportMenuOpen = signal(false);
  protected readonly dataPoints = signal<DataPoint[]>([]);
  protected readonly lastUpdated = signal<string | null>(null);

  protected readonly lastUpdatedText = computed(() => {
    const d = this.lastUpdated();
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  });

  protected readonly infoCurrentFields = computed<ChartInfoField[]>(() => {
    const pts = this.dataPoints();
    const last = [...pts].reverse().find((p) => p.btcRsi12m !== null);
    const lastSpx = [...pts].reverse().find((p) => p.spxRsi12m !== null);
    const lastCfnai = [...pts].reverse().find((p) => p.cfnai !== null);
    return [
      { label: 'BTC RSI (12m)', value: last?.btcRsi12m != null ? last.btcRsi12m.toFixed(2) : '—' },
      { label: 'SPX RSI (12m)', value: lastSpx?.spxRsi12m != null ? lastSpx.spxRsi12m.toFixed(2) : '—' },
      { label: 'CFNAI', value: lastCfnai?.cfnai != null ? lastCfnai.cfnai.toFixed(2) : '—' },
    ];
  });

  private static readonly CFNAI_MIN = -3;
  private static readonly CFNAI_MAX = 2;

  protected readonly chartData = computed<ChartData>(() => {
    const pts = this.dataPoints();
    const labels = pts.map((p) => p.date);
    return {
      labels,
      datasets: [
        {
          label: 'Bitcoin RSI (12m)',
          data: pts.map((p) => p.btcRsi12m),
          borderColor: '#e07b39',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: 'y',
          spanGaps: true,
        },
        {
          label: 'SPX RSI (12m)',
          data: pts.map((p) => p.spxRsi12m),
          borderColor: '#7ab3d4',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: 'y',
          spanGaps: true,
        },
        {
          label: 'CFNAI',
          data: pts.map((p) => p.cfnai == null ? null : Math.max(MidtermCyclesChartPageComponent.CFNAI_MIN, Math.min(MidtermCyclesChartPageComponent.CFNAI_MAX, p.cfnai))),
          borderColor: '#1a2e5e',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          yAxisID: 'y2',
          spanGaps: true,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid: { color: 'rgba(200,200,210,0.15)' },
        ticks: {
          color: '#888',
          maxRotation: 0,
          maxTicksLimit: 12,
          callback: (_, index) => {
            const pts = this.dataPoints();
            return pts[index]?.date?.slice(0, 7) ?? '';
          },
        },
      },
      y: {
        position: 'left',
        min: 0,
        max: 100,
        title: { display: true, text: 'RSI (12m)', color: '#888', font: { size: 11 } },
        grid: { color: 'rgba(200,200,210,0.15)' },
        ticks: { color: '#888' },
      },
      y2: {
        position: 'right',
        min: MidtermCyclesChartPageComponent.CFNAI_MIN,
        max: MidtermCyclesChartPageComponent.CFNAI_MAX,
        title: { display: true, text: 'CFNAI', color: '#1a2e5e', font: { size: 11 } },
        grid: { drawOnChartArea: false },
        ticks: { color: '#1a2e5e' },
      },
    },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: '#888', usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.dataset.label === 'CFNAI') {
              const raw = this.dataPoints()[ctx.dataIndex]?.cfnai;
              if (raw == null) return '';
              return `CFNAI: ${raw.toFixed(2)}`;
            }
            const v = ctx.parsed.y;
            if (v == null) return '';
            return `${ctx.dataset.label}: ${v.toFixed(1)}`;
          },
        },
      },
      annotation: { annotations: {} },
    },
  }));

  protected readonly infoAbout = $localize`:@@charts.midtermCycles.about:Overlays Bitcoin and S&P 500 12-month RSI (Relative Strength Index) against the Chicago Fed National Activity Index (CFNAI), aligned to US midterm election cycles. CFNAI is a composite of 85 monthly indicators that measures overall US economic activity — positive values indicate above-trend growth, negative values indicate below-trend growth. Data: FRED (free, no API key required) + on-chain BTC prices.`;

  protected readonly infoInterpretation = computed<string>(() => {
    const pts = this.dataPoints();
    const last = [...pts].reverse().find((p) => p.btcRsi12m !== null);
    if (!last?.btcRsi12m) return '';
    const rsi = last.btcRsi12m;
    if (rsi > 70) return $localize`:@@charts.midtermCycles.overbought:BTC RSI above 70 — historically elevated, potential cycle top territory.`;
    if (rsi < 40) return $localize`:@@charts.midtermCycles.oversold:BTC RSI below 40 — historically oversold, potential accumulation zone.`;
    return $localize`:@@charts.midtermCycles.neutral:BTC RSI in neutral range (40–70).`;
  });

  protected readonly infoDataSources = [
    'Bitcoin on-chain prices (blockchain.info)',
    'S&P 500 (FRED: SP500)',
    'Chicago Fed National Activity Index (FRED: CFNAI)',
  ];

  protected readonly infoLastUpdated = computed(() => this.lastUpdatedText());

  ngAfterViewInit(): void {
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const res = await this.api.getMidtermCyclesChartData();
      this.dataPoints.set(res.dataPoints);
      this.lastUpdated.set(res.lastUpdated);
    } catch {
      this.errorMessage.set($localize`:@@charts.loadError:Failed to load chart data. Please try again.`);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected resetZoom(): void {
    this.chartViewer?.resetZoom();
  }

  protected toggleExportMenu(): void {
    this.exportMenuOpen.update((v) => !v);
  }

  protected async exportPng(): Promise<void> {
    const chartImageDataUrl = this.chartViewer?.exportImage();
    if (!chartImageDataUrl) return;
    this.exportMenuOpen.set(false);
    await exportChartPng({
      chartImageDataUrl,
      chartTitle: 'Midterm Cycles',
      fileName: `midterm-cycles_${getExportDateStamp()}.png`,
    });
  }

  protected exportCsv(): void {
    this.exportMenuOpen.set(false);
    exportChartCsv({
      rows: this.dataPoints(),
      fileName: `midterm-cycles_${getExportDateStamp()}.csv`,
      columns: [
        { header: 'Date', value: (p) => p.date },
        { header: 'BTC RSI 12m', value: (p) => formatCsvNumber(p.btcRsi12m) },
        { header: 'SPX RSI 12m', value: (p) => formatCsvNumber(p.spxRsi12m) },
        { header: 'CFNAI', value: (p) => formatCsvNumber(p.cfnai) },
      ],
    });
  }

  protected toggleInfo(): void {
    this.infoOpen.update((v) => !v);
  }
}
