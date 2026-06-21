import { Component, EventEmitter, Input, Output, computed, inject, signal, type Signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import {
  ApiClientError,
  AuthApiClient,
  type ChartAnnotation,
  type CreateChartAnnotationRequest,
} from '@crypto-market-analysis/data-access/api-client';
import type { ChartPointSelection } from '../chart-viewer/chart-viewer.component';

@Component({
  selector: 'app-chart-annotations',
  imports: [FormsModule],
  templateUrl: './chart-annotations.component.html',
})
export class ChartAnnotationsComponent {
  private readonly api = inject(AuthApiClient);
  @Input({ required: true }) chartId!: string;
  @Output() annotationsChanged = new EventEmitter<Record<string, AnnotationOptions>>();
  protected readonly mode = signal<'off' | 'note'>('off');
  readonly annotations = signal<ChartAnnotation[]>([]);
  readonly noteAnnotations: Signal<Extract<ChartAnnotation, { type: 'note' }>[]> = computed(() =>
    this.annotations().filter((a): a is Extract<ChartAnnotation, { type: 'note' }> => a.type === 'note'),
  );
  protected readonly message = signal('');
  protected readonly noteDraft = signal<ChartPointSelection | null>(null);
  protected noteText = 'Resistance at $70k';
  protected noteColor = '#FFEB3B';
  protected readonly cursorHint = computed(() => (this.mode() === 'off' ? '' : 'crosshair'));

  async load(): Promise<void> {
    try {
      const annotations = await this.api.getChartAnnotations(this.chartId);
      this.annotations.set(annotations);
      this.emitAnnotations();
    } catch {
      // Silently ignore — annotations are optional on page load.
      // Errors while the user is actively annotating are reported separately.
    }
  }

  startAnnotationMode(): void {
    this.mode.set('note');
    this.message.set('');
  }

  done(): void {
    this.mode.set('off');
    this.noteDraft.set(null);
  }

  handleChartPoint(point: ChartPointSelection): void {
    if (this.mode() === 'note') {
      this.noteDraft.set(point);
    }
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
    } catch (error) {
      this.message.set(getErrorMessage(error));
    }
  }

  private async createAnnotation(request: CreateChartAnnotationRequest): Promise<void> {
    try {
      const annotation = await this.api.createChartAnnotation(request);
      this.annotations.update((annotations) => [...annotations, annotation]);
      this.emitAnnotations();
    } catch (error) {
      this.message.set(getErrorMessage(error));
    }
  }

  private emitAnnotations(): void {
    this.annotationsChanged.emit(toAnnotationOptions(this.annotations(), (annotationId) => {
      void this.deleteAnnotation(annotationId);
    }));
  }
}

function toAnnotationOptions(
  annotations: ChartAnnotation[],
  deleteAnnotation: (annotationId: string) => void,
): Record<string, AnnotationOptions> {
  return Object.fromEntries(
    annotations
      .filter((a): a is Extract<ChartAnnotation, { type: 'note' }> => a.type === 'note')
      .map((annotation) => [
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
      ]),
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : 'Annotation request could not be completed.';
}
