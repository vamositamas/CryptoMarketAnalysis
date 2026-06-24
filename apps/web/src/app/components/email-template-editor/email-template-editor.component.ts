import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import {
  ApiClientError,
  AuthApiClient,
  type EmailTemplate,
} from '@crypto-market-analysis/data-access/api-client';

function substituteTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

const PREVIEW_SAMPLE_DATA: Record<string, string> = {
  alertName: 'MVRV Overbought',
  chartTitle: 'Bitcoin Rainbow Price Chart',
  metricLabel: 'MVRV Z-Score',
  conditionLabel: 'crossed above',
  thresholdValue: '7.0',
  currentValue: '7.23',
  triggeredAt: new Date().toUTCString(),
  appUrl: 'https://bitwlab.com',
};

interface EmailType {
  id: string;
  name: string;
  description: string;
  subjectKeyBase: string;
  htmlKeyBase: string;
  variables: VariableInfo[];
  defaults: Record<'en' | 'hu', { subject: string; html: string }>;
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

const ALERT_TRIGGERED_DEFAULT_SUBJECT_EN = '⚡ Alert Triggered: {{alertName}} — {{metricLabel}} {{conditionLabel}} {{thresholdValue}}';
const ALERT_TRIGGERED_DEFAULT_SUBJECT_HU = '⚡ Riasztás aktiválódott: {{alertName}} — {{metricLabel}} {{conditionLabel}} {{thresholdValue}}';

const ALERT_TRIGGERED_DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>&#x26A1; Alert Triggered — {{alertName}}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f2d1e 0%,#1a4731 60%,#22613f 100%);border-radius:16px 16px 0 0;padding:36px 48px 32px;text-align:center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:center;padding-bottom:16px;">
                  <span style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:50px;padding:6px 18px;font-size:12px;font-weight:600;color:#a8d5b5;letter-spacing:0.08em;text-transform:uppercase;">Price Alert</span>
                </td>
              </tr>
              <tr>
                <td style="text-align:center;">
                  <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BitWLab</p>
                  <p style="margin:0;font-size:13px;color:#7ab594;letter-spacing:0.03em;">Bitcoin Blockchain Analysis</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Alert name strip -->
        <tr>
          <td style="background:#1e5c38;padding:0 48px;border-left:1px solid #1a4731;border-right:1px solid #1a4731;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
                  <p style="margin:0;font-size:13px;color:#a8d5b5;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Alert triggered</p>
                  <p style="margin:4px 0 0;font-size:19px;font-weight:700;color:#ffffff;">{{alertName}}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body card -->
        <tr>
          <td style="background:#ffffff;padding:36px 48px 32px;border-left:1px solid #dce8dd;border-right:1px solid #dce8dd;">
            <p style="margin:0 0 6px;font-size:15px;color:#374151;line-height:1.6;">Hello,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
              Your alert on the <strong style="color:#111827;">{{chartTitle}}</strong> chart just fired. Here&rsquo;s what happened:
            </p>

            <!-- 3-column stat cards -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td width="32%" style="background:#f8faf8;border:1px solid #e3ede5;border-radius:10px;padding:16px 14px;vertical-align:top;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;">Condition</p>
                  <p style="margin:0;font-size:13px;font-weight:600;color:#1a4731;line-height:1.4;">{{metricLabel}}<br/>{{conditionLabel}}<br/>{{thresholdValue}}</p>
                </td>
                <td width="4%" style="font-size:0;">&nbsp;</td>
                <td width="32%" style="background:#f0faf4;border:2px solid #22c55e;border-radius:10px;padding:16px 14px;vertical-align:top;text-align:center;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.07em;">Current Value</p>
                  <p style="margin:0;font-size:28px;font-weight:800;color:#1a4731;line-height:1;">{{currentValue}}</p>
                </td>
                <td width="4%" style="font-size:0;">&nbsp;</td>
                <td width="28%" style="background:#f8faf8;border:1px solid #e3ede5;border-radius:10px;padding:16px 14px;vertical-align:top;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;">Triggered</p>
                  <p style="margin:0;font-size:13px;font-weight:600;color:#374151;line-height:1.4;">{{triggeredAt}}<br/><span style="font-size:11px;color:#9ca3af;font-weight:400;">UTC</span></p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;border-left:3px solid #d1e7d4;padding-left:14px;">
              Log in to your BitWLab account to review this alert, check the latest chart data, and update your notification settings.
            </p>

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a4731;border-radius:10px;box-shadow:0 2px 8px rgba(26,71,49,0.25);">
                  <a href="{{appUrl}}/alerts" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">View My Alerts &#x2192;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8faf8;border-radius:0 0 16px 16px;padding:20px 48px;text-align:center;border:1px solid #dce8dd;border-top:1px solid #e8f0e9;">
            <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">This is an automated alert notification. Please do not reply to this email.</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              <a href="{{appUrl}}" style="color:#1a4731;text-decoration:none;font-weight:600;">BitWLab</a>
              &nbsp;&middot;&nbsp; Bitcoin Blockchain Analysis
              &nbsp;&middot;&nbsp; <a href="{{appUrl}}/alerts" style="color:#6b7280;text-decoration:none;">Manage Alerts</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const ALERT_TRIGGERED_DEFAULT_HTML_HU = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>&#x26A1; Riasztás aktiválódott — {{alertName}}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#0f2d1e 0%,#1a4731 60%,#22613f 100%);border-radius:16px 16px 0 0;padding:36px 48px 32px;text-align:center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="text-align:center;padding-bottom:16px;">
                <span style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:50px;padding:6px 18px;font-size:12px;font-weight:600;color:#a8d5b5;letter-spacing:0.08em;text-transform:uppercase;">Áriasztás</span>
              </td></tr>
              <tr><td style="text-align:center;">
                <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BitWLab</p>
                <p style="margin:0;font-size:13px;color:#7ab594;letter-spacing:0.03em;">Bitcoin blokklánc elemzés</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#1e5c38;padding:0 48px;border-left:1px solid #1a4731;border-right:1px solid #1a4731;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
                <p style="margin:0;font-size:13px;color:#a8d5b5;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Riasztás aktiválódott</p>
                <p style="margin:4px 0 0;font-size:19px;font-weight:700;color:#ffffff;">{{alertName}}</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 48px 32px;border-left:1px solid #dce8dd;border-right:1px solid #dce8dd;">
            <p style="margin:0 0 6px;font-size:15px;color:#374151;line-height:1.6;">Szia,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
              A(z) <strong style="color:#111827;">{{chartTitle}}</strong> grafikonon figyelt riasztásod élesedett. Íme a részletek:
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td width="32%" style="background:#f8faf8;border:1px solid #e3ede5;border-radius:10px;padding:16px 14px;vertical-align:top;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;">Feltétel</p>
                  <p style="margin:0;font-size:13px;font-weight:600;color:#1a4731;line-height:1.4;">{{metricLabel}}<br/>{{conditionLabel}}<br/>{{thresholdValue}}</p>
                </td>
                <td width="4%" style="font-size:0;">&nbsp;</td>
                <td width="32%" style="background:#f0faf4;border:2px solid #22c55e;border-radius:10px;padding:16px 14px;vertical-align:top;text-align:center;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.07em;">Aktuális érték</p>
                  <p style="margin:0;font-size:28px;font-weight:800;color:#1a4731;line-height:1;">{{currentValue}}</p>
                </td>
                <td width="4%" style="font-size:0;">&nbsp;</td>
                <td width="28%" style="background:#f8faf8;border:1px solid #e3ede5;border-radius:10px;padding:16px 14px;vertical-align:top;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;">Aktiválódott</p>
                  <p style="margin:0;font-size:13px;font-weight:600;color:#374151;line-height:1.4;">{{triggeredAt}}<br/><span style="font-size:11px;color:#9ca3af;font-weight:400;">UTC</span></p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;border-left:3px solid #d1e7d4;padding-left:14px;">
              Jelentkezz be a BitWLab fiókodba a riasztás áttekintéséhez, az aktuális grafikonadatok megtekintéséhez és az értesítési beállítások módosításához.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a4731;border-radius:10px;box-shadow:0 2px 8px rgba(26,71,49,0.25);">
                  <a href="{{appUrl}}/alerts" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">Riasztásaim megtekintése &#x2192;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8faf8;border-radius:0 0 16px 16px;padding:20px 48px;text-align:center;border:1px solid #dce8dd;border-top:1px solid #e8f0e9;">
            <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">Ez egy automatikus értesítés. Kérjük, ne válaszolj erre az e-mailre.</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              <a href="{{appUrl}}" style="color:#1a4731;text-decoration:none;font-weight:600;">BitWLab</a>
              &nbsp;&middot;&nbsp; Bitcoin blokklánc elemzés
              &nbsp;&middot;&nbsp; <a href="{{appUrl}}/alerts" style="color:#6b7280;text-decoration:none;">Riasztások kezelése</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const EMAIL_TYPES: EmailType[] = [
  {
    id: 'alert_triggered',
    name: $localize`:Alert triggered email type@@emailTemplates.types.alertTriggered:Alert Triggered`,
    description: $localize`:Alert triggered email description@@emailTemplates.types.alertTriggeredDescription:Sent to users when one of their price alerts fires.`,
    subjectKeyBase: 'alert_triggered_subject',
    htmlKeyBase: 'alert_triggered_html',
    defaults: {
      en: { subject: ALERT_TRIGGERED_DEFAULT_SUBJECT_EN, html: ALERT_TRIGGERED_DEFAULT_HTML },
      hu: { subject: ALERT_TRIGGERED_DEFAULT_SUBJECT_HU, html: ALERT_TRIGGERED_DEFAULT_HTML_HU },
    },
    variables: [
      { name: 'alertName',       description: $localize`:Alert name variable@@emailTemplates.variables.alertName:Alert name set by the user` },
      { name: 'chartTitle',      description: $localize`:Chart title variable@@emailTemplates.variables.chartTitle:Chart title (e.g. Bitcoin Rainbow Price Chart)` },
      { name: 'metricLabel',     description: $localize`:Metric label variable@@emailTemplates.variables.metricLabel:Human-readable metric name` },
      { name: 'conditionLabel',  description: $localize`:Condition label variable@@emailTemplates.variables.conditionLabel:Condition (e.g. "crossed above")` },
      { name: 'thresholdValue',  description: $localize`:Threshold value variable@@emailTemplates.variables.thresholdValue:The threshold value` },
      { name: 'currentValue',    description: $localize`:Current value variable@@emailTemplates.variables.currentValue:Current metric value when alert fired` },
      { name: 'triggeredAt',     description: $localize`:Triggered at variable@@emailTemplates.variables.triggeredAt:Formatted timestamp` },
      { name: 'appUrl',          description: $localize`:App URL variable@@emailTemplates.variables.appUrl:Application base URL` },
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
    .et-preview-header { padding: 10px 16px; border-bottom: 1px solid #f0f4f1; display: flex; align-items: center; justify-content: space-between; }
    .et-preview-title { font-size: 0.72rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
    .et-preview-expand { background: none; border: 1px solid #e5ebe7; border-radius: 6px; padding: 3px 8px; font-size: 0.7rem; color: #6b7280; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: border-color 0.12s, color 0.12s; }
    .et-preview-expand:hover { border-color: #1a4731; color: #1a4731; }
    .et-preview-body { padding: 12px; min-height: 200px; }
    .et-preview-empty { display: flex; align-items: center; justify-content: center; min-height: 160px; color: #9ca3af; font-size: 0.8rem; text-align: center; padding: 20px; border: 2px dashed #e5ebe7; border-radius: 8px; }
    .et-preview-frame { width: 100%; min-height: 280px; border: none; border-radius: 6px; background: #fff; display: block; }

    /* Preview modal */
    .et-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .et-modal { background: #fff; border-radius: 14px; width: 100%; max-width: 760px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.3); }
    .et-modal-header { padding: 14px 20px; border-bottom: 1px solid #e5ebe7; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .et-modal-title { font-size: 0.9rem; font-weight: 700; color: #17202a; margin: 0; }
    .et-modal-close { background: none; border: 1.5px solid #e5ebe7; border-radius: 8px; width: 32px; height: 32px; font-size: 1.1rem; color: #6b7280; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color 0.12s, color 0.12s; }
    .et-modal-close:hover { border-color: #1a4731; color: #1a4731; }
    .et-modal-body { flex: 1; overflow: auto; padding: 16px; background: #f0f4f0; }
    .et-modal-frame { width: 100%; height: 100%; min-height: 500px; border: none; border-radius: 8px; background: #fff; display: block; }

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
        <h2 i18n="Email templates title@@emailTemplates.title">Email Templates</h2>
      </div>

      @if (globalMessage()) {
        <p class="form-message" [class.success]="globalSuccess()" style="margin-bottom:16px">{{ globalMessage() }}</p>
      }

      <!-- Email Provider Settings -->
      @if (emailConfig()) {
        <div class="es-card">
          <h3 class="es-card-title" i18n="Email provider settings title@@emailTemplates.provider.title">Email Provider Settings</h3>
          <p class="es-card-sub"><ng-container i18n="Email provider settings subtitle prefix@@emailTemplates.provider.subtitlePrefix">Emails are sent via</ng-container> {{ emailConfig()!.provider }}. <ng-container i18n="Email provider settings subtitle suffix@@emailTemplates.provider.subtitleSuffix">Configuration is managed through environment variables.</ng-container></p>
          <div class="es-fields">
            <div class="es-field">
              <span class="es-field-label" i18n="Provider label@@email.provider">Provider</span>
              <span class="es-field-value">{{ emailConfig()!.provider }}</span>
            </div>
            <div class="es-field">
              <span class="es-field-label" i18n="API key label@@email.apiKey">API Key</span>
              <span class="es-field-value">
                @if (emailConfig()!.apiKeyConfigured) {
                  <span class="es-status ok"><span class="es-dot"></span><ng-container i18n="Configured status@@email.configured">Configured</ng-container></span>
                } @else {
                  <span class="es-status err"><span class="es-dot"></span><ng-container i18n="Not configured status@@email.notConfigured">Not configured</ng-container></span>
                }
              </span>
            </div>
            <div class="es-field">
              <span class="es-field-label" i18n="From email label@@email.fromEmail">From Email</span>
              <span class="es-field-value">{{ emailConfig()!.fromEmail ?? '—' }}</span>
            </div>
            <div class="es-field">
              <span class="es-field-label" i18n="App URL label@@email.appUrl">App URL</span>
              <span class="es-field-value">{{ emailConfig()!.appUrl }}</span>
            </div>
          </div>
        </div>
      }

      @if (isLoading()) {
        <p class="loading-text" i18n="Loading templates@@emailTemplates.loading">Loading templates...</p>
      } @else {

        <!-- Template selector -->
        <div class="et-selector-row">
          <span class="et-selector-label" i18n="Template selector label@@emailTemplates.templateLabel">Template</span>
          @for (type of emailTypes; track type.id) {
            <button
              class="et-type-btn"
              [class.active]="selectedTypeId() === type.id"
              (click)="selectType(type.id)"
            >{{ type.name }}</button>
          }
          @if (isCustom(currentHtmlKey()) || isCustom(currentSubjectKey())) {
            <span class="et-custom-badge" i18n="Custom template badge@@emailTemplates.customBadge">Custom</span>
          }
          <span class="et-selector-label" i18n="Template language label@@emailTemplates.languageLabel">Language</span>
          <button class="et-type-btn" [class.active]="templateLanguage() === 'en'" (click)="selectLanguage('en')" i18n="English language option@@language.english">English</button>
          <button class="et-type-btn" [class.active]="templateLanguage() === 'hu'" (click)="selectLanguage('hu')" i18n="Hungarian language option@@language.hungarian">Hungarian</button>
        </div>

        <!-- Editor + right panel -->
        <div class="et-layout">

          <!-- Left: editor -->
          <div class="et-editor">
            <div class="et-editor-header">
              <div>
                <h3 class="et-editor-title"><ng-container i18n="Customize template heading@@emailTemplates.customize">Customize Template</ng-container> — {{ selectedType()?.name }} ({{ templateLanguage().toUpperCase() }})</h3>
                <p class="et-editor-sub" i18n="Template editor description@@emailTemplates.editorDescription">Override the default template content for this email type and language.</p>
              </div>
              @if (isCustom(currentHtmlKey()) || isCustom(currentSubjectKey())) {
                <button class="btn-danger" [disabled]="isResetting()" (click)="resetAll()">
                  {{ isResetting() ? resettingLabel() : resetToDefaultLabel() }}
                </button>
              }
            </div>

            <div class="et-field">
              <p class="et-field-label" i18n="Subject label@@emailTemplates.subject">Subject</p>
              <input class="et-subject-input" type="text" [(ngModel)]="subjectDraft" placeholder="Enter subject template..." i18n-placeholder="Subject placeholder@@emailTemplates.subjectPlaceholder" />
            </div>

            <div class="et-body-field">
              <p class="et-field-label" i18n="HTML body label@@emailTemplates.htmlBody">HTML Body</p>
              <textarea class="et-textarea" [(ngModel)]="htmlDraft" spellcheck="false" placeholder="Enter HTML body..." i18n-placeholder="HTML body placeholder@@emailTemplates.htmlPlaceholder"></textarea>
            </div>

            <div class="et-editor-footer">
              <button class="btn-primary" [disabled]="isSaving()" (click)="saveAll()">
                {{ isSaving() ? savingLabel() : saveTemplateLabel() }}
              </button>
              <button class="btn-secondary" [disabled]="isLoadingPreview()" (click)="loadPreview()">
                {{ isLoadingPreview() ? loadingLabel() : previewSampleLabel() }}
              </button>
            </div>
          </div>

          <!-- Right: preview + variables -->
          <div class="et-right">

            <!-- Send test email -->
            <div class="et-test-bar">
              <span class="et-test-label" i18n="Send test label@@emailTemplates.sendTest">Send Test</span>
              <input class="et-test-input" type="email" [(ngModel)]="testEmail" placeholder="recipient@example.com" />
              <button class="btn-purple" [disabled]="isSendingTest() || !testEmail" (click)="sendTest()">
                {{ isSendingTest() ? sendingLabel() : sendLabel() }}
              </button>
            </div>

            <!-- Live preview -->
            <div class="et-preview-card">
              <div class="et-preview-header">
                <p class="et-preview-title" i18n="Live preview title@@emailTemplates.livePreview">Live Preview</p>
                @if (previewHtml()) {
                  <button class="et-preview-expand" (click)="openPreviewModal()" title="Open full preview">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 1.5H10.5V4.5M10.5 1.5L6.5 5.5M4.5 10.5H1.5V7.5M1.5 10.5L5.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <ng-container i18n="Expand preview@@emailTemplates.expandPreview">Expand</ng-container>
                  </button>
                }
              </div>
              <div class="et-preview-body">
                @if (isLoadingPreview()) {
                  <div class="et-preview-empty" i18n="Loading preview@@emailTemplates.loadingPreview">Loading preview...</div>
                } @else if (previewHtml()) {
                  <iframe class="et-preview-frame" [srcdoc]="previewHtml()" sandbox="allow-same-origin"></iframe>
                } @else {
                  <div class="et-preview-empty" i18n="Preview empty state@@emailTemplates.previewEmpty">Click "Preview with Sample Data" to render the template.</div>
                }
              </div>
            </div>

            <!-- Available variables -->
            <div class="et-vars-card">
              <div class="et-vars-header">
                <p class="et-vars-title" i18n="Available variables title@@emailTemplates.availableVariables">Available Variables</p>
                <p class="et-vars-hint" i18n="Available variables hint@@emailTemplates.variablesHint">Click a variable to copy it.</p>
              </div>
              <div class="et-vars-list">
                @for (v of selectedType()?.variables ?? []; track v.name) {
                  <div class="et-var-row" (click)="copyVar(v.name)" [title]="'Copy ' + '{{' + v.name + '}}'">
                    <span class="et-var-code" [class.copied]="copiedVar() === v.name">
                      {{ copiedVar() === v.name ? copiedLabel() : '{{' + v.name + '}}' }}
                    </span>
                    <span class="et-var-desc">{{ v.description }}</span>
                  </div>
                }
              </div>
            </div>

          </div>
        </div>

      }

      <!-- Full-size preview modal -->
      @if (previewModalOpen()) {
        <div class="et-modal-backdrop" (click)="closePreviewModal()">
          <div class="et-modal" (click)="$event.stopPropagation()">
            <div class="et-modal-header">
              <p class="et-modal-title" i18n="Preview modal title@@emailTemplates.previewModalTitle">Email Preview — {{ selectedType()?.name }} ({{ templateLanguage().toUpperCase() }})</p>
              <button class="et-modal-close" (click)="closePreviewModal()" aria-label="Close">&#x2715;</button>
            </div>
            <div class="et-modal-body">
              <iframe class="et-modal-frame" [srcdoc]="previewHtml()" sandbox="allow-same-origin"></iframe>
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
  protected readonly templateLanguage = signal<'en' | 'hu'>('en');
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
  protected readonly previewModalOpen = signal(false);

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

  protected selectLanguage(language: 'en' | 'hu'): void {
    this.templateLanguage.set(language);
    this.previewHtml.set(null);
    this.loadDrafts();
  }

  protected isCustom(key: string | undefined): boolean {
    if (!key) return false;
    return this.templates().find((t) => t.key === key)?.isCustom ?? false;
  }

  protected currentSubjectKey(): string | undefined {
    const type = this.selectedType();
    return type ? templateKeyForLanguage(type.subjectKeyBase, this.templateLanguage()) : undefined;
  }

  protected currentHtmlKey(): string | undefined {
    const type = this.selectedType();
    return type ? templateKeyForLanguage(type.htmlKeyBase, this.templateLanguage()) : undefined;
  }

  protected resettingLabel(): string {
    return $localize`:Resetting state@@emailTemplates.resetting:Resetting...`;
  }

  protected resetToDefaultLabel(): string {
    return $localize`:Reset to default button@@emailTemplates.resetDefault:Reset to Default`;
  }

  protected savingLabel(): string {
    return $localize`:Saving state@@common.saving:Saving...`;
  }

  protected saveTemplateLabel(): string {
    return $localize`:Save template button@@emailTemplates.saveTemplate:Save Template`;
  }

  protected loadingLabel(): string {
    return $localize`:Loading state@@common.loading:Loading...`;
  }

  protected previewSampleLabel(): string {
    return $localize`:Preview sample button@@emailTemplates.previewSample:Preview with Sample Data`;
  }

  protected sendingLabel(): string {
    return $localize`:Sending state@@common.sending:Sending...`;
  }

  protected sendLabel(): string {
    return $localize`:Send button@@common.send:Send`;
  }

  protected copiedLabel(): string {
    return $localize`:Copied state@@common.copied:Copied!`;
  }

  protected openPreviewModal(): void {
    this.previewModalOpen.set(true);
  }

  protected closePreviewModal(): void {
    this.previewModalOpen.set(false);
  }

  protected copyVar(name: string): void {
    void navigator.clipboard.writeText(`{{${name}}}`);
    this.copiedVar.set(name);
    setTimeout(() => this.copiedVar.set(null), 1500);
  }

  protected loadPreview(): void {
    if (!this.htmlDraft) return;
    this.isLoadingPreview.set(true);
    this.previewHtml.set(null);
    const rendered = substituteTemplateVars(this.htmlDraft, PREVIEW_SAMPLE_DATA);
    this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(rendered));
    this.isLoadingPreview.set(false);
  }

  protected async saveAll(): Promise<void> {
    const type = this.selectedType();
    if (!type || this.isSaving()) return;
    const subjectKey = this.currentSubjectKey();
    const htmlKey = this.currentHtmlKey();
    if (!subjectKey || !htmlKey) return;
    this.isSaving.set(true);
    try {
      const [us, uh] = await Promise.all([
        this.api.updateEmailTemplate(subjectKey, this.subjectDraft),
        this.api.updateEmailTemplate(htmlKey, this.htmlDraft),
      ]);
      this.updateTemplate(us);
      this.updateTemplate(uh);
      this.showMessage($localize`:Template saved@@emailTemplates.messages.saved:Template saved successfully.`, true);
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : $localize`:Template save failed@@emailTemplates.messages.saveFailed:Could not save template.`, false);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async resetAll(): Promise<void> {
    const type = this.selectedType();
    if (!type || this.isResetting()) return;
    const subjectKey = this.currentSubjectKey();
    const htmlKey = this.currentHtmlKey();
    if (!subjectKey || !htmlKey) return;
    this.isResetting.set(true);
    try {
      const [rs, rh] = await Promise.all([
        this.api.resetEmailTemplate(subjectKey),
        this.api.resetEmailTemplate(htmlKey),
      ]);
      this.updateTemplate(rs);
      this.updateTemplate(rh);
      this.subjectDraft = rs.value;
      this.htmlDraft = rh.value;
      this.previewHtml.set(null);
      this.showMessage($localize`:Template reset@@emailTemplates.messages.reset:Template reset to default.`, true);
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : $localize`:Template reset failed@@emailTemplates.messages.resetFailed:Could not reset template.`, false);
    } finally {
      this.isResetting.set(false);
    }
  }

  protected async sendTest(): Promise<void> {
    const type = this.selectedType();
    if (!type || !this.testEmail || this.isSendingTest()) return;
    const htmlKey = this.currentHtmlKey();
    if (!htmlKey) return;
    this.isSendingTest.set(true);
    try {
      const result = await this.api.adminSendTestEmail(htmlKey, this.testEmail);
      this.showMessage(result.message || $localize`:Template test email sent@@emailTemplates.messages.testSent:Test email sent to ${this.testEmail}.`, true);
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : $localize`:Template test email failed@@emailTemplates.messages.testFailed:Could not send test email.`, false);
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
      this.showMessage(error instanceof ApiClientError ? error.message : $localize`:Template load failed@@emailTemplates.messages.loadFailed:Could not load templates.`, false);
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
    const lang = this.templateLanguage();
    const fallback = type.defaults[lang];
    this.subjectDraft = list.find((t) => t.key === this.currentSubjectKey())?.value || fallback.subject;
    this.htmlDraft = list.find((t) => t.key === this.currentHtmlKey())?.value || fallback.html;
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

function templateKeyForLanguage(baseKey: string, language: 'en' | 'hu'): string {
  return baseKey.replace('alert_triggered_', `alert_triggered_${language}_`);
}
