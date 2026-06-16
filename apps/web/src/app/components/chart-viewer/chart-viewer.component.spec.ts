import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ChartData, ChartOptions } from 'chart.js';
import { ChartViewerComponent } from './chart-viewer.component';

const chartInstances: MockChart[] = [];

jest.mock('chart.js', () => {
  class MockChart {
    static register = jest.fn();
    data: unknown;
    options: unknown;
    type: unknown;
    destroy = jest.fn();
    resetZoom = jest.fn();
    toBase64Image = jest.fn().mockReturnValue('data:image/png;base64,chart');
    getElementsAtEventForMode = jest.fn().mockReturnValue([
      { datasetIndex: 0, index: 0 },
    ]);
    update = jest.fn();

    constructor(_canvas: HTMLCanvasElement, configuration: { data: unknown; options: unknown; type: unknown }) {
      this.data = configuration.data;
      this.options = configuration.options;
      this.type = configuration.type;
      chartInstances.push(this);
    }
  }

  return {
    Chart: MockChart,
    registerables: [],
  };
});

jest.mock('chartjs-plugin-zoom', () => ({ id: 'zoom' }));
jest.mock('chartjs-plugin-annotation', () => ({ id: 'annotation' }));

interface MockChart {
  data: unknown;
  options: unknown;
  type: unknown;
  destroy: jest.Mock;
  resetZoom: jest.Mock;
  toBase64Image: jest.Mock;
  getElementsAtEventForMode: jest.Mock;
  update: jest.Mock;
}

describe('ChartViewerComponent', () => {
  const chartData: ChartData = {
    labels: ['2026-06-10'],
    datasets: [{ label: 'BTC', data: [65000] }],
  };

  beforeEach(async () => {
    chartInstances.length = 0;

    await TestBed.configureTestingModule({
      imports: [ChartViewerComponent],
    }).compileComponents();
  });

  it('creates a responsive Chart.js instance with zoom defaults', () => {
    const fixture = createComponent(chartData);

    expect(chartInstances).toHaveLength(1);
    expect(chartInstances[0].data).toBe(chartData);
    expect(chartInstances[0].type).toBe('line');
    expect(chartInstances[0].options).toMatchObject({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        zoom: {
          pan: { enabled: true, mode: 'x', modifierKey: 'shift' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag: { enabled: true },
            mode: 'x',
          },
          limits: { x: { minRange: 86400000 } },
        },
      },
    });
    expect(fixture.nativeElement.querySelector('canvas')).not.toBeNull();
  });

  it('updates chart data when input data changes', () => {
    const fixture = createComponent(chartData);
    const nextData: ChartData = {
      labels: ['2026-06-11'],
      datasets: [{ label: 'BTC', data: [66000] }],
    };

    fixture.componentRef.setInput('chartData', nextData);
    fixture.detectChanges();

    expect(chartInstances[0].data).toBe(nextData);
    expect(chartInstances[0].update).toHaveBeenCalledTimes(1);
  });

  it('recreates the chart when chart type changes', () => {
    const fixture = createComponent(chartData);

    fixture.componentRef.setInput('chartType', 'bar');
    fixture.detectChanges();

    expect(chartInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(chartInstances[1].type).toBe('bar');
  });

  it('merges custom chart options and resets zoom on double click', () => {
    const chartOptions: ChartOptions = {
      plugins: {
        zoom: {
          pan: { enabled: false },
          limits: { x: { minRange: 172800000 } },
        },
      },
    };
    const fixture = createComponent(chartData, chartOptions);
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    canvas.dispatchEvent(new MouseEvent('dblclick'));

    expect(chartInstances[0].options).toMatchObject({
      plugins: {
        zoom: {
          pan: { enabled: false },
          limits: { x: { minRange: 172800000 } },
        },
      },
    });
    expect(chartInstances[0].resetZoom).toHaveBeenCalledTimes(1);
  });

  it('exports the current chart as a PNG data URL', () => {
    const fixture = createComponent(chartData);

    expect(fixture.componentInstance.exportImage()).toBe('data:image/png;base64,chart');
    expect(chartInstances[0].toBase64Image).toHaveBeenCalledWith('image/png', 1);
  });

  it('emits selected chart coordinates on click', () => {
    const fixture = createComponent(chartData);
    const selected: unknown[] = [];
    fixture.componentInstance.chartPointSelected.subscribe((point) => selected.push(point));

    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new MouseEvent('click'));

    expect(selected).toEqual([{ date: '2026-06-10', value: 65000 }]);
  });
});

function createComponent(
  chartData: ChartData,
  chartOptions: ChartOptions = {},
): ComponentFixture<ChartViewerComponent> {
  const fixture = TestBed.createComponent(ChartViewerComponent);
  fixture.componentRef.setInput('chartData', chartData);
  fixture.componentRef.setInput('chartOptions', chartOptions);
  fixture.detectChanges();

  return fixture;
}
