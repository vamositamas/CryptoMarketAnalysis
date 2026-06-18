import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ApiClientError,
  AuthApiClient,
  type AlertCondition,
} from '@crypto-market-analysis/data-access/api-client';

export interface AlertMetricOption {
  value: string;
  label: string;
}

const ALERT_CONDITIONS: { value: AlertCondition; label: string }[] = [
  { value: 'crosses_above', label: 'Crosses above' },
  { value: 'crosses_below', label: 'Crosses below' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'equals', label: 'Equals' },
];

@Component({
  selector: 'app-create-alert-modal',
  imports: [ReactiveFormsModule],
  template: `
    <div class="widget-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="alert-modal-title">
      <div class="widget-modal">
        <div class="widget-modal-header">
          <h3 id="alert-modal-title">Create Alert</h3>
          <button type="button" class="modal-close-button" aria-label="Close" (click)="close()">✕</button>
        </div>

        <form class="alert-form" [formGroup]="form" (ngSubmit)="submit()">
          <label class="alert-form-label">
            Alert Name
            <input
              type="text"
              formControlName="alertName"
              class="alert-form-input"
              placeholder="e.g., Rainbow hits Fire Sale zone"
              autocomplete="off"
            />
          </label>

          <label class="alert-form-label">
            Metric
            <select formControlName="metricName" class="alert-form-select">
              @for (metric of metrics; track metric.value) {
                <option [value]="metric.value">{{ metric.label }}</option>
              }
            </select>
          </label>

          <label class="alert-form-label">
            Condition
            <select formControlName="condition" class="alert-form-select">
              @for (cond of conditions; track cond.value) {
                <option [value]="cond.value">{{ cond.label }}</option>
              }
            </select>
          </label>

          <label class="alert-form-label">
            Threshold Value
            <input
              type="number"
              formControlName="thresholdValue"
              class="alert-form-input"
              step="any"
            />
          </label>

          <label class="alert-form-label alert-form-checkbox-label">
            <input type="checkbox" checked disabled />
            Email notification
          </label>

          @if (errorMessage()) {
            <p class="form-message">{{ errorMessage() }}</p>
          }

          <div class="alert-form-actions">
            <button type="button" class="secondary-button" (click)="close()" [disabled]="isSubmitting()">
              Cancel
            </button>
            <button type="submit" [disabled]="form.invalid || isSubmitting()">
              @if (isSubmitting()) {
                Creating...
              } @else {
                Create Alert
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class CreateAlertModalComponent implements OnInit {
  @Input({ required: true }) chartId!: string;
  @Input({ required: true }) metrics!: AlertMetricOption[];
  @Output() readonly closed = new EventEmitter<void>();

  protected readonly conditions = ALERT_CONDITIONS;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');

  private readonly api = inject(AuthApiClient);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    alertName: ['', [Validators.required, Validators.maxLength(255)]],
    metricName: ['', Validators.required],
    condition: ['crosses_above' as AlertCondition, Validators.required],
    thresholdValue: [0 as number | null, Validators.required],
  });

  ngOnInit(): void {
    if (this.metrics.length > 0) {
      this.form.controls.metricName.setValue(this.metrics[0].value);
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const { alertName, metricName, condition, thresholdValue } = this.form.getRawValue();

      await this.api.createAlert({
        chartId: this.chartId,
        metricName,
        condition,
        thresholdValue: thresholdValue ?? 0,
        alertName,
      });

      await this.router.navigate(['/alerts'], {
        state: { successMessage: "Alert created successfully. You'll be notified by email when this condition is met." },
      });
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError
          ? error.message
          : 'The request could not be completed. Please try again.',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
