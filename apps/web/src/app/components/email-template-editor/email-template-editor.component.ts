import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ApiClientError,
  AuthApiClient,
  type EmailTemplate,
} from '@crypto-market-analysis/data-access/api-client';

const TEMPLATE_VARIABLE_INFO: Record<string, string> = {
  alertName: 'Alert name set by the user',
  chartTitle: 'Chart title (e.g. Bitcoin Rainbow Price Chart)',
  metricLabel: 'Human-readable metric name',
  conditionLabel: 'Condition description (e.g. "crossed above")',
  thresholdValue: 'The threshold value',
  currentValue: 'Current metric value that triggered the alert',
  triggeredAt: 'Formatted timestamp when alert triggered',
  appUrl: 'Application base URL',
};

@Component({
  selector: 'app-email-template-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="content-section">
      <div class="section-heading">
        <p class="eyebrow">Admin</p>
        <h2>Email Template Editor</h2>
      </div>

      @if (isLoading()) {
        <p class="template-editor-loading">Loading templates...</p>
      } @else {
        <div class="template-editor-layout">
          <div class="template-editor-main">
            <div class="template-selector-row">
              <label class="template-selector-label">
                Template
                <select class="template-selector-select" (change)="selectTemplate($event)">
                  @for (t of templates(); track t.key) {
                    <option [value]="t.key" [selected]="t.key === selectedKey()">
                      {{ t.label }}
                    </option>
                  }
                </select>
              </label>
              <span class="template-custom-badge" [class.is-custom]="currentTemplate()?.isCustom">
                {{ currentTemplate()?.isCustom ? 'Custom' : 'Default' }}
              </span>
            </div>

            <form [formGroup]="form" (ngSubmit)="save()">
              <textarea
                class="template-textarea"
                formControlName="value"
                rows="22"
                spellcheck="false"
                [placeholder]="selectedKey() === 'alert_triggered_subject' ? 'Enter subject template...' : 'Enter HTML body template...'"
              ></textarea>

              @if (message()) {
                <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
              }

              <div class="template-actions">
                <button type="submit" [disabled]="isSaving() || form.pristine">
                  {{ isSaving() ? 'Saving...' : 'Save Template' }}
                </button>
                @if (currentTemplate()?.isCustom) {
                  <button
                    type="button"
                    class="secondary-button"
                    [disabled]="isResetting()"
                    (click)="resetToDefault()"
                  >
                    {{ isResetting() ? 'Resetting...' : 'Reset to Default' }}
                  </button>
                }
              </div>
            </form>
          </div>

          <aside class="template-variables-panel">
            <h3>Available Variables</h3>
            <p class="template-variables-hint">
              Use <code>{{ '{' + '{variableName}' + '}' }}</code> in your template.
            </p>
            <table class="template-variables-table">
              <tbody>
                @for (v of currentVariables(); track v.name) {
                  <tr>
                    <td class="variable-name-cell">
                      <code>{{ '{' + '{' + v.name + '}' + '}' }}</code>
                    </td>
                    <td class="variable-desc-cell">{{ v.description }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </aside>
        </div>
      }
    </section>
  `,
})
export class EmailTemplateEditorComponent implements OnInit {
  private readonly api = inject(AuthApiClient);
  private readonly fb = inject(FormBuilder);

  protected readonly templates = signal<EmailTemplate[]>([]);
  protected readonly selectedKey = signal<string>('alert_triggered_html');
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly isResetting = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);

  protected readonly form = this.fb.nonNullable.group({ value: [''] });

  protected readonly currentTemplate = computed(() =>
    this.templates().find((t) => t.key === this.selectedKey()) ?? null,
  );

  protected readonly currentVariables = computed(() => {
    const t = this.currentTemplate();
    if (!t) return [];
    return t.variables.map((name) => ({
      name,
      description: TEMPLATE_VARIABLE_INFO[name] ?? name,
    }));
  });

  ngOnInit(): void {
    void this.loadTemplates();
  }

  protected selectTemplate(event: Event): void {
    const key = (event.target as HTMLSelectElement).value;
    this.selectedKey.set(key);
    this.form.patchValue({ value: this.currentTemplate()?.value ?? '' });
    this.form.markAsPristine();
    this.message.set('');
  }

  protected async save(): Promise<void> {
    if (this.isSaving() || this.form.pristine) return;

    this.isSaving.set(true);
    this.message.set('');
    this.isSuccess.set(false);

    try {
      const updated = await this.api.updateEmailTemplate(this.selectedKey(), this.form.getRawValue().value);
      this.updateTemplateInList(updated);
      this.form.markAsPristine();
      this.isSuccess.set(true);
      this.message.set('Template saved successfully.');
    } catch (error) {
      this.message.set(error instanceof ApiClientError ? error.message : 'Could not save template. Please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async resetToDefault(): Promise<void> {
    if (this.isResetting()) return;

    this.isResetting.set(true);
    this.message.set('');
    this.isSuccess.set(false);

    try {
      const reset = await this.api.resetEmailTemplate(this.selectedKey());
      this.updateTemplateInList(reset);
      this.form.patchValue({ value: reset.value });
      this.form.markAsPristine();
      this.isSuccess.set(true);
      this.message.set('Template reset to default.');
    } catch (error) {
      this.message.set(error instanceof ApiClientError ? error.message : 'Could not reset template. Please try again.');
    } finally {
      this.isResetting.set(false);
    }
  }

  private async loadTemplates(): Promise<void> {
    this.isLoading.set(true);
    try {
      const response = await this.api.getEmailTemplates();
      this.templates.set(response.templates);
      const first = response.templates[0];
      if (first) {
        this.selectedKey.set(first.key);
        this.form.patchValue({ value: first.value });
        this.form.markAsPristine();
      }
    } catch (error) {
      this.message.set(error instanceof ApiClientError ? error.message : 'Could not load templates.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private updateTemplateInList(updated: EmailTemplate): void {
    this.templates.update((list) => list.map((t) => (t.key === updated.key ? updated : t)));
  }
}
