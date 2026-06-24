import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getDatabasePool } from '../config/database.config';

export interface PasswordResetEmailSender {
  sendPasswordResetEmail(input: { email: string; resetUrl: string }): Promise<void>;
}

export interface DailyDataRefreshFailureEmailSender {
  sendDailyDataRefreshFailureAlert(input: {
    date: string;
    attempts: number;
    error: string;
  }): Promise<void>;
}

export interface AlertTriggeredEmailInput {
  userEmail: string;
  alertName: string;
  chartTitle: string;
  metricLabel: string;
  conditionLabel: string;
  thresholdValue: number;
  currentValue: number;
  triggeredAt: string;
  htmlTemplate?: string | null;
  subjectTemplate?: string | null;
}

export interface AlertTriggeredEmailSender {
  sendAlertTriggeredEmail(input: AlertTriggeredEmailInput): Promise<void>;
}

export interface DonationThankYouEmailInput {
  userEmail: string;
  userName: string;
  donationAmount: number;
  currency: string;
  transactionId: string;
  donationDate: string;
  donationId: string;
  appUrl: string;
}

export interface DonationThankYouEmailSender {
  sendDonationThankYouEmail(input: DonationThankYouEmailInput): Promise<void>;
}

// ── SMTP config loader ────────────────────────────────────────────────────────

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

async function loadSmtpConfig(): Promise<SmtpConfig | null> {
  const db = getDatabasePool();
  if (db) {
    const KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'email_from_address'];
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM system_configuration WHERE key = ANY($1)`,
      [KEYS],
    );
    const map = new Map(result.rows.map((r) => [r.key, r.value]));
    const host = map.get('smtp_host') ?? process.env['SMTP_HOST'] ?? '';
    const portStr = map.get('smtp_port') ?? process.env['SMTP_PORT'] ?? '';
    const user = map.get('smtp_user') ?? process.env['SMTP_USER'] ?? '';
    const password = map.get('smtp_password') ?? process.env['SMTP_PASSWORD'] ?? '';
    const from = map.get('email_from_address') ?? process.env['RESEND_FROM_EMAIL'] ?? '';
    if (host && user && password && from) {
      return { host, port: parseInt(portStr, 10) || 587, user, password, from };
    }
  }
  // env-only fallback
  const host = process.env['SMTP_HOST'] ?? '';
  const user = process.env['SMTP_USER'] ?? '';
  const password = process.env['SMTP_PASSWORD'] ?? '';
  const from = process.env['RESEND_FROM_EMAIL'] ?? '';
  if (host && user && password && from) {
    return { host, port: parseInt(process.env['SMTP_PORT'] ?? '587', 10), user, password, from };
  }
  return null;
}

function createTransporter(cfg: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.password },
  });
}

// ── Unified send helper ───────────────────────────────────────────────────────

const APP_NAME = process.env['EMAIL_FROM_NAME'] ?? 'BitWLab';

function formatFromAddress(address: string): string {
  // If already has display name (e.g. "BitWLab <noreply@...>"), leave as-is
  if (address.includes('<')) return address;
  return `${APP_NAME} <${address}>`;
}

interface MailMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
}

function buildDeliverabilityHeaders(from: string): Record<string, string> {
  const appUrl = process.env['APP_URL'] ?? 'https://bitwlab.com';
  const email = from.includes('<') ? (from.match(/<(.+)>/)?.[1] ?? from) : from;
  return {
    'List-Unsubscribe': `<mailto:${email}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'X-Mailer': APP_NAME,
    'X-Entity-Ref-ID': `${appUrl}-${Date.now()}`,
  };
}

export async function sendRawEmail(msg: MailMessage): Promise<void> {
  const smtp = await loadSmtpConfig();
  if (smtp) {
    const from = formatFromAddress(smtp.from);
    const transporter = createTransporter(smtp);
    const info = await transporter.sendMail({
      from,
      headers: { ...buildDeliverabilityHeaders(from), ...msg.headers },
      ...msg,
    });
    console.info(JSON.stringify({ event: 'email.sent_smtp', to: msg.to, subject: msg.subject, messageId: info.messageId, response: info.response }));
    return;
  }

  // Resend HTTP API fallback
  const apiKey = process.env['RESEND_API_KEY'];
  const from = process.env['RESEND_FROM_EMAIL'];
  if (apiKey && from) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: formatFromAddress(from), ...msg }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      throw new Error(`Email send failed (${response.status}): ${body}`);
    }
    return;
  }

  // No transport configured
  console.warn(JSON.stringify({ event: 'email.not_configured', to: msg.to, subject: msg.subject, timestamp: new Date().toISOString() }));
  throw new Error('No email transport configured. Set SMTP credentials or a Resend API key in Email Settings.');
}

// ── Service class ─────────────────────────────────────────────────────────────

export class ResendEmailService
  implements
    PasswordResetEmailSender,
    DailyDataRefreshFailureEmailSender,
    AlertTriggeredEmailSender,
    DonationThankYouEmailSender
{
  async sendPasswordResetEmail(input: { email: string; resetUrl: string }): Promise<void> {
    await sendRawEmail({
      to: input.email,
      subject: 'Reset your BitWLab password',
      html: `<p>Use this link to reset your password:</p><p><a href="${input.resetUrl}">${input.resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
    });
  }

  async sendDailyDataRefreshFailureAlert(input: { date: string; attempts: number; error: string }): Promise<void> {
    const to = process.env['ADMIN_ALERT_EMAIL'] ?? 'admin@bitwlab.com';
    await sendRawEmail({
      to,
      subject: '[ALERT] Daily Data Refresh Failed',
      text: `Data refresh job failed for date ${input.date} after ${input.attempts} attempts.\nError: ${input.error}\nPlease investigate manually.`,
    });
  }

  async sendAlertTriggeredEmail(input: AlertTriggeredEmailInput): Promise<void> {
    const appUrl = process.env['APP_URL'] ?? 'https://bitwlab.com';
    const vars = buildTemplateVars(input, appUrl);
    const subject = input.subjectTemplate
      ? substituteTemplateVars(input.subjectTemplate, vars)
      : `Alert Triggered: ${input.alertName}`;
    const html = input.htmlTemplate
      ? substituteTemplateVars(input.htmlTemplate, vars)
      : buildAlertTriggeredHtml(input, appUrl);
    await sendRawEmail({ to: input.userEmail, subject, html });
  }

  async sendDonationThankYouEmail(input: DonationThankYouEmailInput): Promise<void> {
    const donationDate = new Date(input.donationDate).toLocaleDateString('en-US', { timeZone: 'UTC', dateStyle: 'long' });
    const formattedAmount = `$${input.donationAmount.toFixed(2)} ${input.currency}`;
    const displayName = escapeHtml(input.userName || 'Supporter');
    const thankYouUrl = `${input.appUrl}/donate/thank-you?donation_id=${input.donationId}`;

    const html = `
      <h2 style="color:#1a1a2e">Thank You for Your Support!</h2>
      <p>Hello ${displayName}, thank you for your ${formattedAmount} donation!</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 12px;font-weight:bold;color:#555">Amount</td><td style="padding:6px 12px">${formattedAmount}</td></tr>
        <tr style="background:#f5f5f5"><td style="padding:6px 12px;font-weight:bold;color:#555">Transaction ID</td><td style="padding:6px 12px">${escapeHtml(input.transactionId)}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;color:#555">Date</td><td style="padding:6px 12px">${donationDate}</td></tr>
      </table>
      <h3 style="color:#1a1a2e">Premium benefits unlocked:</h3>
      <ul>
        <li>Unlimited price alerts (previously limited to 5)</li>
        <li>Access to future premium charts</li>
        <li>Priority support</li>
        <li>Recognition as a platform supporter</li>
      </ul>
      <p>Please log in again to activate your Premium account.</p>
      <p><a href="${thankYouUrl}" style="color:#6c63ff">View donation confirmation</a></p>
      <p style="color:#888;font-size:12px">BitWLab is a personal project. Donations are voluntary and non-refundable.</p>
    `;
    await sendRawEmail({ to: input.userEmail, subject: 'Thank You for Your Donation!', html });
  }
} // end ResendEmailService

export function substituteTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function buildTemplateVars(input: AlertTriggeredEmailInput, appUrl: string): Record<string, string> {
  const date = new Date(input.triggeredAt).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
  return {
    alertName: escapeHtml(input.alertName),
    chartTitle: escapeHtml(input.chartTitle),
    metricLabel: escapeHtml(input.metricLabel),
    conditionLabel: escapeHtml(input.conditionLabel),
    thresholdValue: String(input.thresholdValue),
    currentValue: String(input.currentValue),
    triggeredAt: date,
    appUrl,
  };
}

function buildAlertTriggeredHtml(input: AlertTriggeredEmailInput, appUrl: string): string {
  const v = buildTemplateVars(input, appUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Alert Triggered — ${v.alertName}</title></head>
<body style="margin:0;padding:0;background:#e8f0e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8f0e9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#1a4731;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
          <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;">BitWLab</p>
          <p style="margin:0;font-size:13px;color:#86b89a;">Bitcoin Blockchain Analysis</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #dce8dd;border-right:1px solid #dce8dd;">
          <h2 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111827;">Your alert has been triggered!</h2>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">Hello,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">Your alert <strong>${v.alertName}</strong> on the <strong>${v.chartTitle}</strong> chart has been triggered.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f1;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding-bottom:12px;border-bottom:1px solid #d1e7d4;"><span style="font-size:13px;color:#6b7280;">Condition</span><br/><strong style="font-size:15px;color:#111827;">${v.metricLabel} ${v.conditionLabel} ${v.thresholdValue}</strong></td></tr>
                <tr><td style="padding-top:12px;padding-bottom:12px;border-bottom:1px solid #d1e7d4;"><span style="font-size:13px;color:#6b7280;">Current Value</span><br/><strong style="font-size:22px;color:#1a4731;">${v.currentValue}</strong></td></tr>
                <tr><td style="padding-top:12px;"><span style="font-size:13px;color:#6b7280;">Triggered At</span><br/><strong style="font-size:15px;color:#111827;">${v.triggeredAt} UTC</strong></td></tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">Log in to your BitWLab account to review this alert and update your settings.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:32px;"><tr><td style="background:#1a4731;border-radius:8px;"><a href="${v.appUrl}/alerts" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View My Alerts →</a></td></tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e5e7eb;font-size:0;line-height:0;">&nbsp;</td></tr></table>
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">We look forward to keeping you informed!</p>
        </td></tr>
        <tr><td style="background:#d4e8d6;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border:1px solid #bdd9bf;border-top:none;">
          <p style="margin:0 0 4px;font-size:13px;color:#3d6b4a;">This is an automated message. Please do not reply to this email.</p>
          <p style="margin:0;font-size:12px;color:#5a8a68;"><a href="${v.appUrl}" style="color:#1a4731;text-decoration:none;">BitWLab</a> &nbsp;·&nbsp; Bitcoin Blockchain Analysis</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
