import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
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

  protected resetZoom(): void {
    this.chart?.resetZoom();
  }

  exportImage(): string | null {
    return this.chart?.toBase64Image('image/png', 1) ?? null;
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

  private recreateChart(): void {
    this.destroyChart();
    this.createChart();
  }

  private createChart(): void {
    const canvas = this.canvas?.nativeElement;

    if (!canvas || !this.chartData) {
      return;
    }

    this.chart = new Chart(canvas, this.getConfiguration());
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }

  private getConfiguration(): ChartConfiguration<ChartType> {
    return {
      type: this.chartType,
      data: this.chartData,
      options: this.getOptions(),
    };
  }

  private getOptions(): ChartOptions {
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
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            modifierKey: 'shift',
            ...this.chartOptions.plugins?.zoom?.pan,
          },
          zoom: {
            wheel: {
              enabled: true,
              ...this.chartOptions.plugins?.zoom?.zoom?.wheel,
            },
            pinch: {
              enabled: true,
              ...this.chartOptions.plugins?.zoom?.zoom?.pinch,
            },
            drag: {
              enabled: true,
              ...this.chartOptions.plugins?.zoom?.zoom?.drag,
            },
            mode: 'x',
            ...this.chartOptions.plugins?.zoom?.zoom,
          },
          limits: {
            x: {
              minRange: 24 * 60 * 60 * 1000,
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
