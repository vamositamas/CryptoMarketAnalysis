import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClientError, AuthApiClient, type EmailTemplate } from '@crypto-market-analysis/data-access/api-client';

@Component({
  selector: 'app-email-settings-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="content-section">
      <div class="section-heading" style="margin-bottom:24px">
        <p class="eyebrow">Admin</p>
        <h2>Email Settings</h2>
      </div>

      @if (message()) {
        <p class="form-message" [class.success]="isSuccess()" style="margin-bottom:16px">{{ message() }}</p>
      }

      <!-- SMTP Settings -->
      <div class="es-card">
        <div class="es-card-head">
          <h3 class="es-card-title">Email Sending Settings</h3>
          <p class="es-card-sub">Configure SMTP to send emails. Leave SMTP Host blank to fall back to Resend API.</p>
        </div>

        @if (isLoading()) {
          <p class="loading-text">Loading…</p>
        } @else {
          <div class="es-grid">
            <div class="es-field">
              <label class="es-label">SMTP Host</label>
              <input class="es-input" type="text" [(ngModel)]="form.smtpHost" placeholder="smtp.resend.com" />
            </div>
            <div class="es-field">
              <label class="es-label">SMTP Port</label>
              <input class="es-input" type="number" [(ngModel)]="form.smtpPort" placeholder="587" />
            </div>
            <div class="es-field">
              <label class="es-label">SMTP User</label>
              <input class="es-input" type="text" [(ngModel)]="form.smtpUser" placeholder="resend" />
            </div>
            <div class="es-field">
              <label class="es-label">From Email</label>
              <input class="es-input" type="email" [(ngModel)]="form.fromAddress" placeholder="noreply@bitwlab.com" />
            </div>
            <div class="es-field es-field--full">
              <label class="es-label">SMTP Password</label>
              <input class="es-input" type="password" [(ngModel)]="form.smtpPassword"
                [placeholder]="smtpPasswordConfigured() ? 'Leave empty to keep current password' : 'Enter SMTP password'"
                autocomplete="new-password" />
              @if (smtpPasswordConfigured()) {
                <span class="es-hint ok">Password is configured.</span>
              }
            </div>
          </div>

          <div class="es-divider"></div>

          <div class="es-grid es-grid--secondary">
            <div class="es-field">
              <label class="es-label">Admin Alert Email</label>
              <input class="es-input" type="email" [(ngModel)]="form.adminEmail" placeholder="admin@bitwlab.com" />
            </div>
            <div class="es-field">
              <label class="es-label">App URL</label>
              <input class="es-input" type="url" [(ngModel)]="form.appUrl" placeholder="https://bitwlab.com" />
            </div>
          </div>

          <div class="es-actions">
            <button class="btn-primary" [disabled]="isSaving()" (click)="saveSettings()">
              {{ isSaving() ? 'Saving…' : 'Save' }}
            </button>
          </div>
        }
      </div>

      <!-- Send Test Email -->
      <div class="es-card">
        <div class="es-card-head">
          <h3 class="es-card-title">Send Test Email</h3>
          <p class="es-card-sub">Send a sample email to verify your configuration is working.</p>
        </div>

        <div class="es-grid">
          <div class="es-field">
            <label class="es-label">Template</label>
            <select class="es-input es-select" [(ngModel)]="testTemplateKey">
              @for (t of templates(); track t.key) {
                @if (!t.key.endsWith('_subject')) {
                  <option [value]="t.key">{{ t.label }}</option>
                }
              }
            </select>
          </div>
          <div class="es-field">
            <label class="es-label">Recipient Email</label>
            <input class="es-input" type="email" [(ngModel)]="testRecipient" placeholder="test@example.com" />
          </div>
        </div>
        <div class="es-actions">
          <button class="btn-secondary" [disabled]="isSendingTest() || !testRecipient" (click)="sendTest()">
            {{ isSendingTest() ? 'Sending…' : 'Send Test Email' }}
          </button>
        </div>
      </div>

      <!-- Link to template editor -->
      <div class="es-card es-card--subtle">
        <div class="es-card-link-row">
          <div>
            <h3 class="es-card-title">Email Templates</h3>
            <p class="es-card-sub">Customise the HTML body and subject line for each email type.</p>
          </div>
          <a class="btn-primary" routerLink="/admin/email-templates">Edit Templates →</a>
        </div>
      </div>

    </section>
  `,
  styles: [`
    .es-card { background:#fff; border:1.5px solid #e5ebe7; border-radius:12px; padding:22px 24px; margin-bottom:20px; }
    .es-card--subtle { background:#fafbf8; }
    .es-card-head { margin-bottom:18px; }
    .es-card-title { font-size:1rem; font-weight:700; color:#17202a; margin:0 0 4px; }
    .es-card-sub { font-size:0.8rem; color:#6b7280; margin:0; }
    .es-card-link-row { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }

    .es-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px 20px; margin-bottom:18px; }
    .es-grid--secondary { margin-top:0; }
    .es-field { display:flex; flex-direction:column; gap:5px; }
    .es-field--full { grid-column:1/-1; }
    .es-label { font-size:0.75rem; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; }
    .es-input {
      padding:9px 13px; border:1.5px solid #e5ebe7; border-radius:8px;
      font-size:0.9rem; font-family:inherit; color:#17202a; background:#fff;
      outline:none; transition:border-color 0.15s; width:100%; box-sizing:border-box;
    }
    .es-input:focus { border-color:#1a4731; }
    .es-select { cursor:pointer; }
    .es-hint { display:inline-flex; align-items:center; gap:5px; font-size:0.75rem; margin-top:2px; }
    .es-hint.ok { color:#15803d; }
    .es-hint.err { color:#dc2626; }
    .es-divider { border:none; border-top:1.5px solid #e5ebe7; margin:4px 0 18px; }

    .es-actions { display:flex; gap:10px; }

    .btn-primary { display:inline-flex; align-items:center; padding:8px 20px; background:#1a4731; color:#fff; border:none; border-radius:8px; font-size:0.875rem; font-weight:600; cursor:pointer; transition:background 0.12s; text-decoration:none; }
    .btn-primary:hover:not(:disabled) { background:#15392a; }
    .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
    .btn-secondary { display:inline-flex; align-items:center; padding:8px 20px; background:#f5f7f4; color:#344540; border:1.5px solid #e5ebe7; border-radius:8px; font-size:0.875rem; font-weight:600; cursor:pointer; transition:background 0.12s; }
    .btn-secondary:hover:not(:disabled) { background:#edf2ee; }
    .btn-secondary:disabled { opacity:0.5; cursor:not-allowed; }
  `],
})
export class EmailSettingsPageComponent implements OnInit {
  private readonly api = inject(AuthApiClient);

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly isSendingTest = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly smtpPasswordConfigured = signal(false);
  protected readonly templates = signal<EmailTemplate[]>([]);

  protected form = { smtpHost: '', smtpPort: '587', smtpUser: '', smtpPassword: '', fromAddress: '', appUrl: '', adminEmail: '' };
  protected testTemplateKey = '';
  protected testRecipient = '';

  ngOnInit(): void {
    void Promise.all([this.loadSettings(), this.loadTemplates()]);
  }

  protected async saveSettings(): Promise<void> {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    try {
      await this.api.saveEmailSettings({
        smtpHost: this.form.smtpHost,
        smtpPort: this.form.smtpPort,
        smtpUser: this.form.smtpUser,
        ...(this.form.smtpPassword ? { smtpPassword: this.form.smtpPassword } : {}),
        fromAddress: this.form.fromAddress,
        appUrl: this.form.appUrl,
        adminEmail: this.form.adminEmail,
      });
      this.form.smtpPassword = '';
      if (this.form.smtpUser) this.smtpPasswordConfigured.set(true);
      this.showMessage('Settings saved successfully.', true);
      void this.loadSettings();
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : 'Could not save settings.', false);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async sendTest(): Promise<void> {
    if (!this.testRecipient || this.isSendingTest()) return;
    this.isSendingTest.set(true);
    try {
      const result = await this.api.adminSendTestEmail(this.testTemplateKey, this.testRecipient);
      this.showMessage(result.message || `Test email sent to ${this.testRecipient}.`, true);
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : 'Could not send test email.', false);
    } finally {
      this.isSendingTest.set(false);
    }
  }

  private async loadSettings(): Promise<void> {
    this.isLoading.set(true);
    try {
      const s = await this.api.getEmailSettings();
      this.smtpPasswordConfigured.set(s.smtpPasswordConfigured);
      this.form.smtpHost = s.smtpHost;
      this.form.smtpPort = s.smtpPort;
      this.form.smtpUser = s.smtpUser;
      this.form.fromAddress = s.fromAddress;
      this.form.appUrl = s.appUrl;
      this.form.adminEmail = s.adminEmail;
    } catch { /* non-critical */ } finally {
      this.isLoading.set(false);
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      const r = await this.api.getEmailTemplates();
      this.templates.set(r.templates);
      const first = r.templates.find((t) => !t.key.endsWith('_subject'));
      if (first) this.testTemplateKey = first.key;
    } catch { /* non-critical */ }
  }

  private showMessage(msg: string, success: boolean): void {
    this.message.set(msg);
    this.isSuccess.set(success);
    setTimeout(() => this.message.set(''), 4000);
  }
}
