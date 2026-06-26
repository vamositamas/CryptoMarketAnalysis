import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  Chart,
  type ChartConfiguration,
  type ChartData,
  type LegendItem,
  type ChartOptions,
  type ChartType,
  registerables,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';

export type SupportedChartType = 'line' | 'bar';

export interface ChartPointSelection {
  date: string;
  value: number;
}

Chart.register(...registerables, zoomPlugin, annotationPlugin);

@Component({
  selector: 'app-chart-viewer',
  templateUrl: './chart-viewer.component.html',
  styleUrl: './chart-viewer.component.scss',
})
export class ChartViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) chartData!: ChartData;
  @Input() chartType: SupportedChartType = 'line';
  @Input() chartOptions: ChartOptions = {};
  @Output() chartPointSelected = new EventEmitter<ChartPointSelection>();

  @ViewChild('canvas') private readonly canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private lastTapTime = 0;
  private isResettingZoom = false;
  private originalYBounds: { min: number | undefined; max: number | undefined } = { min: undefined, max: undefined };
  protected isFullscreen = false;

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.chart) {
      return;
    }

    if (changes['chartData']) {
      this.chart.data = this.chartData;
    }

    if (changes['chartType'] || changes['chartOptions']) {
      this.recreateChart();
      return;
    }

    this.chart.update();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  resetZoom(): void {
    if (!this.chart) return;
    // Skip rescaleYAfterZoom during reset — it would compute a wildly wide Y range
    // from the tiny early-dataset values (e.g. 2009 band values ~10⁻¹⁶) that the
    // onZoomComplete callback sees when X is fully zoomed out. We restore the
    // original bounds ourselves afterward instead.
    this.isResettingZoom = true;
    this.chart.resetZoom('none');
    this.isResettingZoom = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configScaleY = (this.chart.config.options as any)?.scales?.['y'];
    if (configScaleY) {
      configScaleY.min = this.originalYBounds.min;
      configScaleY.max = this.originalYBounds.max;
    }
    this.chart.update('none');
  }

  zoomIn(): void {
    this.chart?.zoom(1.5);
  }

  zoomOut(): void {
    this.chart?.zoom(0.67);
  }

  exportImage(): string | null {
    return this.chart?.toBase64Image('image/png', 1) ?? null;
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.scheduleResize();
  }

  protected closeFullscreen(): void {
    if (!this.isFullscreen) {
      return;
    }

    this.isFullscreen = false;
    this.scheduleResize();
  }

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    this.closeFullscreen();
  }

  protected handleTouchEnd(event: TouchEvent): void {
    if (event.touches.length > 0) {
      return;
    }

    const now = Date.now();

    if (now - this.lastTapTime <= 300) {
      this.resetZoom();
      this.lastTapTime = 0;
      return;
    }

    this.lastTapTime = now;
  }

  protected handleClick(event: MouseEvent): void {
    if (!this.chart) {
      return;
    }

    const points = this.chart.getElementsAtEventForMode(
      event,
      'nearest',
      { intersect: false },
      false,
    );
    const point = points[0];

    if (!point) {
      return;
    }

    const label = this.chart.data.labels?.[point.index];
    const value = this.chart.data.datasets[point.datasetIndex]?.data[point.index];

    if (typeof label !== 'string' || typeof value !== 'number') {
      return;
    }

    this.chartPointSelected.emit({ date: label, value });
  }

  private rescaleYAfterZoom(chart: Chart): void {
    if (this.isResettingZoom) return;
    const xScale = chart.scales['x'];
    const yScale = chart.scales['y'];
    if (!xScale || !yScale) return;

    const minIdx = Math.floor(xScale.min);
    const maxIdx = Math.ceil(xScale.max);
    const isLog = yScale.type === 'logarithmic';

    let minY = Infinity;
    let maxY = -Infinity;

    for (const dataset of chart.data.datasets) {
      // Skip datasets assigned to a secondary axis — their values are in a different scale
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axisId = (dataset as any).yAxisID;
      if (axisId && axisId !== 'y') continue;
      const data = dataset.data as number[];
      for (let i = Math.max(0, minIdx); i <= Math.min(data.length - 1, maxIdx); i++) {
        const val = data[i];
        if (typeof val === 'number' && isFinite(val) && (!isLog || val > 0)) {
          if (val < minY) minY = val;
          if (val > maxY) maxY = val;
        }
      }
    }

    if (!isFinite(minY) || !isFinite(maxY) || minY >= maxY) return;

    // chart.options is an ephemeral resolved proxy rebuilt on every chart.update() call —
    // writing to it is a no-op. chart.config.options is the source-of-truth the resolver reads.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configScaleY = (chart.config.options as any)?.scales?.['y'];
    if (!configScaleY) return;

    if (isLog) {
      const logMin = Math.log10(minY);
      const logMax = Math.log10(maxY);
      const pad = (logMax - logMin) * 0.08;
      configScaleY.min = Math.pow(10, logMin - pad);
      configScaleY.max = Math.pow(10, logMax + pad);
    } else {
      const pad = (maxY - minY) * 0.08;
      configScaleY.min = minY - pad;
      configScaleY.max = maxY + pad;
    }

    chart.update('none');
  }

  private recreateChart(): void {
    this.destroyChart();
    this.createChart();
  }

  private createChart(): void {
    const canvas = this.canvas?.nativeElement;

    if (!canvas || !this.chartData) {
      return;
    }

    // Capture Y bounds from chartOptions BEFORE Chart.js merges/replaces scales config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origY = (this.chartOptions.scales as any)?.['y'];
    this.originalYBounds = { min: origY?.min, max: origY?.max };

    this.chart = new Chart(canvas, this.getConfiguration());
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }

  private scheduleResize(): void {
    window.setTimeout(() => this.chart?.resize(), 0);
  }

  private getConfiguration(): ChartConfiguration<ChartType> {
    return {
      type: this.chartType,
      data: this.chartData,
      options: this.getOptions(),
    };
  }

  private getOptions(): ChartOptions {
    const sourceLegend = this.chartOptions.plugins?.legend;
    const sourceLegendLabels = sourceLegend?.labels;
    const sourceGenerateLabels = sourceLegendLabels?.generateLabels;

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
        ...this.chartOptions.interaction,
      },
      plugins: {
        ...this.chartOptions.plugins,
        legend: sourceLegend?.display === false
          ? sourceLegend
          : {
              ...sourceLegend,
              display: true,
              position: 'bottom',
              align: 'center',
              labels: {
                ...sourceLegendLabels,
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 7,
                boxHeight: 7,
                padding: 16,
                generateLabels: (chart) => {
                  const generated = sourceGenerateLabels
                    ? sourceGenerateLabels(chart)
                    : Chart.defaults.plugins.legend.labels.generateLabels(chart);

                  return generated
                    .filter((item) => item.text.trim().length > 0)
                    .map(normalizeLegendItem);
                },
              },
            },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            modifierKey: 'ctrl',
            ...this.chartOptions.plugins?.zoom?.pan,
          },
          zoom: {
            wheel: { enabled: false, ...this.chartOptions.plugins?.zoom?.zoom?.wheel },
            pinch: { enabled: false, ...this.chartOptions.plugins?.zoom?.zoom?.pinch },
            drag: {
              enabled: true,
              backgroundColor: 'rgba(99,147,114,0.15)',
              borderColor: 'rgba(45,107,70,0.6)',
              borderWidth: 1,
              ...this.chartOptions.plugins?.zoom?.zoom?.drag,
            },
            mode: 'x',
            onZoomComplete: ({ chart }) => this.rescaleYAfterZoom(chart),
            ...this.chartOptions.plugins?.zoom?.zoom,
          },
          limits: {
            x: {
              minRange: 7,
              ...this.chartOptions.plugins?.zoom?.limits?.['x'],
            },
            ...this.chartOptions.plugins?.zoom?.limits,
          },
        },
      },
      scales: {
        ...this.chartOptions.scales,
      },
    };
  }
}

function normalizeLegendItem(item: LegendItem): LegendItem {
  const strokeStyle = item.strokeStyle ?? item.fillStyle;

  return {
    ...item,
    pointStyle: 'circle',
    lineWidth: Math.max(Number(item.lineWidth ?? 0), 2),
    strokeStyle,
    fillStyle: strokeStyle,
  };
}
