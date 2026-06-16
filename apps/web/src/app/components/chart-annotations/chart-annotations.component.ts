import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartAnnotation,
  type CreateChartAnnotationRequest,
} from '@crypto-market-analysis/data-access/api-client';
import type { ChartPointSelection } from '../chart-viewer/chart-viewer.component';

type AnnotationMode = 'off' | 'note' | 'trendline';

@Component({
  selector: 'app-chart-annotations',
  imports: [FormsModule],
  templateUrl: './chart-annotations.component.html',
})
export class ChartAnnotationsComponent {
  private readonly api = inject(AuthApiClient);
  @Input({ required: true }) chartId!: string;
  @Output() annotationsChanged = new EventEmitter<Record<string, AnnotationOptions>>();
  protected readonly mode = signal<AnnotationMode>('off');
  protected readonly annotations = signal<ChartAnnotation[]>([]);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly noteDraft = signal<ChartPointSelection | null>(null);
  protected readonly trendlineStart = signal<ChartPointSelection | null>(null);
  protected noteText = 'Resistance at $70k';
  protected noteColor = '#FFEB3B';
  protected trendlineColor = '#3B82F6';
  protected readonly cursorHint = computed(() => (this.mode() === 'off' ? '' : 'crosshair'));

  async load(): Promise<void> {
    try {
      const annotations = await this.api.getChartAnnotations(this.chartId);
      this.annotations.set(annotations);
      this.emitAnnotations();
    } catch {
      this.setMessage('Saved annotations could not be loaded.', false);
    }
  }

  startAnnotationMode(): void {
    this.mode.set('note');
    this.setMessage('', false);
  }

  selectNoteMode(): void {
    this.mode.set('note');
    this.trendlineStart.set(null);
  }

  selectTrendlineMode(): void {
    this.mode.set('trendline');
    this.noteDraft.set(null);
  }

  done(): void {
    this.mode.set('off');
    this.noteDraft.set(null);
    this.trendlineStart.set(null);
  }

  handleChartPoint(point: ChartPointSelection): void {
    if (this.mode() === 'note') {
      this.noteDraft.set(point);
      return;
    }

    if (this.mode() !== 'trendline') {
      return;
    }

    const start = this.trendlineStart();

    if (!start) {
      this.trendlineStart.set(point);
      this.setMessage('Select the trend line end point.', true);
      return;
    }

    void this.createAnnotation({
      chartId: this.chartId,
      type: 'trendline',
      startDate: start.date,
      startPrice: start.value,
      endDate: point.date,
      endPrice: point.value,
      color: this.trendlineColor,
    });
    this.trendlineStart.set(null);
  }

  async saveNote(): Promise<void> {
    const draft = this.noteDraft();

    if (!draft) {
      return;
    }

    await this.createAnnotation({
      chartId: this.chartId,
      type: 'note',
      date: draft.date,
      priceLevel: draft.value,
      text: this.noteText,
      color: this.noteColor,
    });
    this.noteDraft.set(null);
  }

  cancelNote(): void {
    this.noteDraft.set(null);
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    try {
      await this.api.deleteChartAnnotation(annotationId);
      this.annotations.update((annotations) =>
        annotations.filter((annotation) => annotation.id !== annotationId),
      );
      this.emitAnnotations();
      this.setMessage('Annotation deleted.', true);
    } catch (error) {
      this.setMessage(getErrorMessage(error), false);
    }
  }

  private async createAnnotation(request: CreateChartAnnotationRequest): Promise<void> {
    try {
      const annotation = await this.api.createChartAnnotation(request);
      this.annotations.update((annotations) => [...annotations, annotation]);
      this.emitAnnotations();
      this.setMessage('Annotation saved.', true);
    } catch (error) {
      this.setMessage(getErrorMessage(error), false);
    }
  }

  private emitAnnotations(): void {
    this.annotationsChanged.emit(toAnnotationOptions(this.annotations(), (annotationId) => {
      void this.deleteAnnotation(annotationId);
    }));
  }

  private setMessage(message: string, success: boolean): void {
    this.message.set(message);
    this.isSuccess.set(success);
  }
}

function toAnnotationOptions(
  annotations: ChartAnnotation[],
  deleteAnnotation: (annotationId: string) => void,
): Record<string, AnnotationOptions> {
  return Object.fromEntries(
    annotations.map((annotation) => {
      if (annotation.type === 'note') {
        return [
          annotation.id,
          {
            type: 'label',
            xValue: annotation.date,
            yValue: annotation.priceLevel,
            content: annotation.text,
            backgroundColor: annotation.color,
            color: '#17202a',
            borderRadius: 6,
            padding: 6,
            callout: { display: true },
            contextmenu: () => {
              deleteAnnotation(annotation.id);
              return true;
            },
          },
        ];
      }

      return [
        annotation.id,
        {
          type: 'line',
          xMin: annotation.startDate,
          yMin: annotation.startPrice,
          xMax: annotation.endDate,
          yMax: annotation.endPrice,
          borderColor: annotation.color,
          borderWidth: 2,
          contextmenu: () => {
            deleteAnnotation(annotation.id);
            return true;
          },
        },
      ];
    }),
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : 'Annotation request could not be completed.';
}
