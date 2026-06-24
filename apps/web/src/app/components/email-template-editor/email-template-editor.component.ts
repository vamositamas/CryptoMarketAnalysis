import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import {
  ApiClientError,
  AuthApiClient,
  type EmailTemplate,
} from '@crypto-market-analysis/data-access/api-client';

interface EmailType {
  id: string;
  name: string;
  description: string;
  subjectKey: string;
  htmlKey: string;
  variables: VariableInfo[];
}

interface VariableInfo {
  name: string;
  description: string;
}

interface EmailConfig {
  provider: string;
  apiKeyConfigured: boolean;
  fromEmail: string | null;
  appUrl: string;
}

const EMAIL_TYPES: EmailType[] = [
  {
    id: 'alert_triggered',
    name: 'Alert Triggered',
    description: 'Sent to users when one of their price alerts fires.',
    subjectKey: 'alert_triggered_subject',
    htmlKey: 'alert_triggered_html',
    variables: [
      { name: 'alertName',       description: 'Alert name set by the user' },
      { name: 'chartTitle',      description: 'Chart title (e.g. Bitcoin Rainbow Price Chart)' },
      { name: 'metricLabel',     description: 'Human-readable metric name' },
      { name: 'conditionLabel',  description: 'Condition (e.g. "crossed above")' },
      { name: 'thresholdValue',  description: 'The threshold value' },
      { name: 'currentValue',    description: 'Current metric value when alert fired' },
      { name: 'triggeredAt',     description: 'Formatted timestamp' },
      { name: 'appUrl',          description: 'Application base URL' },
    ],
  },
];

@Component({
  selector: 'app-email-template-editor',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    /* Settings card */
    .es-card {
      background: #fff; border: 1.5px solid #e5ebe7; border-radius: 12px;
      padding: 20px 24px; margin-bottom: 24px;
    }
    .es-card-title { font-size: 1rem; font-weight: 700; color: #17202a; margin: 0 0 4px; }
    .es-card-sub { font-size: 0.8rem; color: #6b7280; margin: 0 0 18px; }
    .es-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; }
    .es-field { display: flex; flex-direction: column; gap: 4px; }
    .es-field-label { font-size: 0.72rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .es-field-value { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; color: #17202a; }
    .es-status { display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; font-weight: 600; padding: 3px 10px; border-radius: 10px; }
    .es-status.ok  { background: #dcfce7; color: #15803d; }
    .es-status.err { background: #fee2e2; color: #dc2626; }
    .es-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

    /* Template selector */
    .et-selector-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .et-selector-label { font-size: 0.72rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .et-type-btn {
      padding: 7px 16px; border: 1.5px solid #e5ebe7; border-radius: 8px;
      background: #fff; font-size: 0.875rem; font-weight: 500; color: #4a5568;
      cursor: pointer; transition: border-color 0.12s, background 0.12s;
    }
    .et-type-btn:hover { border-color: #c8d8cc; background: #f8fbf8; }
    .et-type-btn.active { border-color: #1a4731; background: #f0faf4; color: #1a4731; font-weight: 700; }
    .et-custom-badge { font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: #dbeafe; color: #1e40af; }

    /* Editor layout */
    .et-layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
    .et-editor { background: #fff; border: 1.5px solid #e5ebe7; border-radius: 12px; overflow: hidden; }
    .et-editor-header { padding: 14px 20px; border-bottom: 1px solid #f0f4f1; display: flex; align-items: center; justify-content: space-between; }
    .et-editor-title { font-size: 0.9rem; font-weight: 700; color: #17202a; margin: 0; }
    .et-editor-sub { font-size: 0.75rem; color: #6b7280; margin: 2px 0 0; }

    .et-field { padding: 16px 20px; border-bottom: 1px solid #f0f4f1; }
    .et-field-label { font-size: 0.72rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px; }
    .et-subject-input {
      width: 100%; padding: 9px 13px; border: 1.5px solid #e5ebe7; border-radius: 8px;
      font-size: 0.9rem; font-family: inherit; color: #17202a; background: #fff;
      outline: none; transition: border-color 0.15s; box-sizing: border-box;
    }
    .et-subject-input:focus { border-color: #1a4731; }

    .et-body-field { padding: 16px 20px; }
    .et-textarea {
      width: 100%; min-height: 360px; padding: 12px 14px; border: 1.5px solid #e5ebe7; border-radius: 8px;
      font-size: 0.78rem; font-family: ui-monospace, 'Cascadia Code', monospace; line-height: 1.65;
      color: #1e293b; background: #fafbf9; resize: vertical; outline: none;
      transition: border-color 0.15s; box-sizing: border-box;
    }
    .et-textarea:focus { border-color: #1a4731; background: #fff; }

    .et-editor-footer { padding: 14px 20px; border-top: 1.5px solid #e5ebe7; background: #fafbf8; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

    /* Right panel */
    .et-right { display: flex; flex-direction: column; gap: 16px; }

    .et-preview-card { background: #fff; border: 1.5px solid #e5ebe7; border-radius: 12px; overflow: hidden; }
    .et-preview-header { padding: 10px 16px; border-bottom: 1px solid #f0f4f1; }
    .et-preview-title { font-size: 0.72rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
    .et-preview-body { padding: 12px; min-height: 200px; }
    .et-preview-empty { display: flex; align-items: center; justify-content: center; min-height: 160px; color: #9ca3af; font-size: 0.8rem; text-align: center; padding: 20px; border: 2px dashed #e5ebe7; border-radius: 8px; }
    .et-preview-frame { width: 100%; min-height: 280px; border: none; border-radius: 6px; background: #fff; display: block; }

    .et-vars-card { background: #fff; border: 1.5px solid #e5ebe7; border-radius: 12px; overflow: hidden; }
    .et-vars-header { padding: 10px 16px; border-bottom: 1px solid #f0f4f1; }
    .et-vars-title { font-size: 0.72rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
    .et-vars-hint { font-size: 0.72rem; color: #9ca3af; margin: 2px 0 0; }
    .et-vars-list { padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
    .et-var-row { display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; align-items: start; padding: 6px 8px; border-radius: 7px; cursor: pointer; transition: background 0.1s; }
    .et-var-row:hover { background: #f0faf4; }
    .et-var-code { font-size: 0.72rem; font-family: ui-monospace, monospace; color: #1a4731; font-weight: 600; white-space: nowrap; }
    .et-var-code.copied { color: #16a34a; }
    .et-var-desc { font-size: 0.7rem; color: #9ca3af; line-height: 1.3; }

    /* Test email bar */
    .et-test-bar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: #f5f7f4; border: 1.5px solid #e5ebe7; border-radius: 10px; flex-wrap: wrap; }
    .et-test-label { font-size: 0.78rem; font-weight: 600; color: #4a5568; white-space: nowrap; }
    .et-test-input { flex: 1; min-width: 160px; padding: 7px 11px; border: 1.5px solid #e5ebe7; border-radius: 7px; font-size: 0.8rem; color: #17202a; background: #fff; outline: none; transition: border-color 0.15s; }
    .et-test-input:focus { border-color: #1a4731; }

    /* Buttons */
    .btn-primary { display: inline-flex; align-items: center; padding: 8px 18px; background: #1a4731; color: #fff; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background 0.12s; }
    .btn-primary:hover:not(:disabled) { background: #15392a; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { display: inline-flex; align-items: center; padding: 7px 14px; background: #f5f7f4; color: #344540; border: 1.5px solid #e5ebe7; border-radius: 8px; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: background 0.12s; }
    .btn-secondary:hover:not(:disabled) { background: #edf2ee; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-danger { display: inline-flex; align-items: center; padding: 7px 14px; background: #fff1f2; color: #be123c; border: 1.5px solid #fecdd3; border-radius: 8px; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: background 0.12s; }
    .btn-danger:hover:not(:disabled) { background: #ffe4e6; }
    .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-purple { display: inline-flex; align-items: center; padding: 7px 14px; background: #f5f3ff; color: #6d28d9; border: 1.5px solid #ddd6fe; border-radius: 8px; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: background 0.12s; }
    .btn-purple:hover:not(:disabled) { background: #ede9fe; }
    .btn-purple:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
  template: `
    <section class="content-section">
      <div class="section-heading" style="margin-bottom:20px">
        <p class="eyebrow">Admin</p>
        <h2>Email Templates</h2>
      </div>

      @if (globalMessage()) {
        <p class="form-message" [class.success]="globalSuccess()" style="margin-bottom:16px">{{ globalMessage() }}</p>
      }

      <!-- Email Provider Settings -->
      @if (emailConfig()) {
        <div class="es-card">
          <h3 class="es-card-title">Email Provider Settings</h3>
          <p class="es-card-sub">Emails are sent via {{ emailConfig()!.provider }}. Configuration is managed through environment variables.</p>
          <div class="es-fields">
            <div class="es-field">
              <span class="es-field-label">Provider</span>
              <span class="es-field-value">{{ emailConfig()!.provider }}</span>
            </div>
            <div class="es-field">
              <span class="es-field-label">API Key</span>
              <span class="es-field-value">
                @if (emailConfig()!.apiKeyConfigured) {
                  <span class="es-status ok"><span class="es-dot"></span>Configured</span>
                } @else {
                  <span class="es-status err"><span class="es-dot"></span>Not configured</span>
                }
              </span>
            </div>
            <div class="es-field">
              <span class="es-field-label">From Email</span>
              <span class="es-field-value">{{ emailConfig()!.fromEmail ?? '—' }}</span>
            </div>
            <div class="es-field">
              <span class="es-field-label">App URL</span>
              <span class="es-field-value">{{ emailConfig()!.appUrl }}</span>
            </div>
          </div>
        </div>
      }

      @if (isLoading()) {
        <p class="loading-text">Loading templates…</p>
      } @else {

        <!-- Template selector -->
        <div class="et-selector-row">
          <span class="et-selector-label">Template</span>
          @for (type of emailTypes; track type.id) {
            <button
              class="et-type-btn"
              [class.active]="selectedTypeId() === type.id"
              (click)="selectType(type.id)"
            >{{ type.name }}</button>
          }
          @if (isCustom(selectedType()?.htmlKey) || isCustom(selectedType()?.subjectKey)) {
            <span class="et-custom-badge">Custom</span>
          }
        </div>

        <!-- Editor + right panel -->
        <div class="et-layout">

          <!-- Left: editor -->
          <div class="et-editor">
            <div class="et-editor-header">
              <div>
                <h3 class="et-editor-title">Customize Template — {{ selectedType()?.name }}</h3>
                <p class="et-editor-sub">Override the default template content for this email type.</p>
              </div>
              @if (isCustom(selectedType()?.htmlKey) || isCustom(selectedType()?.subjectKey)) {
                <button class="btn-danger" [disabled]="isResetting()" (click)="resetAll()">
                  {{ isResetting() ? 'Resetting…' : '✕ Reset to Default' }}
                </button>
              }
            </div>

            <div class="et-field">
              <p class="et-field-label">Subject</p>
              <input class="et-subject-input" type="text" [(ngModel)]="subjectDraft" placeholder="Enter subject template…" />
            </div>

            <div class="et-body-field">
              <p class="et-field-label">HTML Body</p>
              <textarea class="et-textarea" [(ngModel)]="htmlDraft" spellcheck="false" placeholder="Enter HTML body…"></textarea>
            </div>

            <div class="et-editor-footer">
              <button class="btn-primary" [disabled]="isSaving()" (click)="saveAll()">
                {{ isSaving() ? 'Saving…' : 'Save Template' }}
              </button>
              <button class="btn-secondary" [disabled]="isLoadingPreview()" (click)="loadPreview()">
                {{ isLoadingPreview() ? 'Loading…' : 'Preview with Sample Data' }}
              </button>
            </div>
          </div>

          <!-- Right: preview + variables -->
          <div class="et-right">

            <!-- Send test email -->
            <div class="et-test-bar">
              <span class="et-test-label">Send Test</span>
              <input class="et-test-input" type="email" [(ngModel)]="testEmail" placeholder="recipient@example.com" />
              <button class="btn-purple" [disabled]="isSendingTest() || !testEmail" (click)="sendTest()">
                {{ isSendingTest() ? 'Sending…' : 'Send' }}
              </button>
            </div>

            <!-- Live preview -->
            <div class="et-preview-card">
              <div class="et-preview-header">
                <p class="et-preview-title">Live Preview</p>
              </div>
              <div class="et-preview-body">
                @if (isLoadingPreview()) {
                  <div class="et-preview-empty">Loading preview…</div>
                } @else if (previewHtml()) {
                  <iframe class="et-preview-frame" [srcdoc]="previewHtml()" sandbox="allow-same-origin"></iframe>
                } @else {
                  <div class="et-preview-empty">Click "Preview with Sample Data" to render the template.</div>
                }
              </div>
            </div>

            <!-- Available variables -->
            <div class="et-vars-card">
              <div class="et-vars-header">
                <p class="et-vars-title">Available Variables</p>
                <p class="et-vars-hint">Click a variable to copy it.</p>
              </div>
              <div class="et-vars-list">
                @for (v of selectedType()?.variables ?? []; track v.name) {
                  <div class="et-var-row" (click)="copyVar(v.name)" [title]="'Copy ' + '{{' + v.name + '}}'">
                    <span class="et-var-code" [class.copied]="copiedVar() === v.name">
                      {{ copiedVar() === v.name ? '✓ Copied!' : '{{' + v.name + '}}' }}
                    </span>
                    <span class="et-var-desc">{{ v.description }}</span>
                  </div>
                }
              </div>
            </div>

          </div>
        </div>

      }
    </section>
  `,
})
export class EmailTemplateEditorComponent implements OnInit {
  private readonly api = inject(AuthApiClient);

  protected readonly emailTypes = EMAIL_TYPES;
  protected readonly templates = signal<EmailTemplate[]>([]);
  protected readonly emailConfig = signal<EmailConfig | null>(null);
  protected readonly selectedTypeId = signal<string>(EMAIL_TYPES[0]?.id ?? '');
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly isResetting = signal(false);
  protected readonly isLoadingPreview = signal(false);
  protected readonly isSendingTest = signal(false);
  protected readonly globalMessage = signal('');
  protected readonly globalSuccess = signal(false);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly previewHtml = signal<SafeHtml | null>(null);
  protected readonly copiedVar = signal<string | null>(null);

  protected subjectDraft = '';
  protected htmlDraft = '';
  protected testEmail = '';

  protected readonly selectedType = computed(() =>
    this.emailTypes.find((t) => t.id === this.selectedTypeId()) ?? null,
  );

  ngOnInit(): void {
    void Promise.all([this.loadTemplates(), this.loadEmailConfig()]);
  }

  protected selectType(id: string): void {
    this.selectedTypeId.set(id);
    this.previewHtml.set(null);
    this.loadDrafts();
  }

  protected isCustom(key: string | undefined): boolean {
    if (!key) return false;
    return this.templates().find((t) => t.key === key)?.isCustom ?? false;
  }

  protected copyVar(name: string): void {
    void navigator.clipboard.writeText(`{{${name}}}`);
    this.copiedVar.set(name);
    setTimeout(() => this.copiedVar.set(null), 1500);
  }

  protected async loadPreview(): Promise<void> {
    const type = this.selectedType();
    if (!type) return;
    this.isLoadingPreview.set(true);
    this.previewHtml.set(null);
    try {
      const result = await this.api.adminPreviewEmailTemplate(type.htmlKey);
      this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(result.html));
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : String(err);
      this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(`<p style="color:red;padding:20px">Could not load preview: ${msg}</p>`));
    } finally {
      this.isLoadingPreview.set(false);
    }
  }

  protected async saveAll(): Promise<void> {
    const type = this.selectedType();
    if (!type || this.isSaving()) return;
    this.isSaving.set(true);
    try {
      const [us, uh] = await Promise.all([
        this.api.updateEmailTemplate(type.subjectKey, this.subjectDraft),
        this.api.updateEmailTemplate(type.htmlKey, this.htmlDraft),
      ]);
      this.updateTemplate(us);
      this.updateTemplate(uh);
      this.showMessage('Template saved successfully.', true);
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : 'Could not save template.', false);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async resetAll(): Promise<void> {
    const type = this.selectedType();
    if (!type || this.isResetting()) return;
    this.isResetting.set(true);
    try {
      const [rs, rh] = await Promise.all([
        this.api.resetEmailTemplate(type.subjectKey),
        this.api.resetEmailTemplate(type.htmlKey),
      ]);
      this.updateTemplate(rs);
      this.updateTemplate(rh);
      this.subjectDraft = rs.value;
      this.htmlDraft = rh.value;
      this.previewHtml.set(null);
      this.showMessage('Template reset to default.', true);
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : 'Could not reset template.', false);
    } finally {
      this.isResetting.set(false);
    }
  }

  protected async sendTest(): Promise<void> {
    const type = this.selectedType();
    if (!type || !this.testEmail || this.isSendingTest()) return;
    this.isSendingTest.set(true);
    try {
      const result = await this.api.adminSendTestEmail(type.htmlKey, this.testEmail);
      this.showMessage(result.message || `Test email sent to ${this.testEmail}.`, true);
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : 'Could not send test email.', false);
    } finally {
      this.isSendingTest.set(false);
    }
  }

  private async loadTemplates(): Promise<void> {
    this.isLoading.set(true);
    try {
      const response = await this.api.getEmailTemplates();
      this.templates.set(response.templates);
      this.loadDrafts();
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : 'Could not load templates.', false);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadEmailConfig(): Promise<void> {
    try {
      this.emailConfig.set(await this.api.getEmailConfig());
    } catch { /* non-critical */ }
  }

  private loadDrafts(): void {
    const type = this.selectedType();
    if (!type) return;
    const list = this.templates();
    this.subjectDraft = list.find((t) => t.key === type.subjectKey)?.value ?? '';
    this.htmlDraft = list.find((t) => t.key === type.htmlKey)?.value ?? '';
  }

  private updateTemplate(updated: EmailTemplate): void {
    this.templates.update((list) => list.map((t) => (t.key === updated.key ? updated : t)));
  }

  private showMessage(msg: string, success: boolean): void {
    this.globalMessage.set(msg);
    this.globalSuccess.set(success);
    setTimeout(() => this.globalMessage.set(''), 4000);
  }
}
