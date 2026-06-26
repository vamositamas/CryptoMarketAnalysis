import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getDatabasePool } from '../config/database.config';

export interface PasswordResetEmailSender {
  sendPasswordResetEmail(input: { email: string; resetUrl: string; languagePreference?: 'en' | 'hu' }): Promise<void>;
}

export interface EmailVerificationEmailSender {
  sendEmailVerificationEmail(input: { email: string; verificationUrl: string; verificationCode?: string; languagePreference?: 'en' | 'hu' }): Promise<void>;
}

export interface ManualEmailVerifiedEmailSender {
  sendManualEmailVerifiedEmail(input: { email: string; fullName?: string | null; languagePreference?: 'en' | 'hu' }): Promise<void>;
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
  languagePreference?: 'en' | 'hu';
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
    const host = map.get('smtp_host') ?? '';
    const portStr = map.get('smtp_port') ?? '';
    const user = map.get('smtp_user') ?? '';
    const password = map.get('smtp_password') ?? '';
    const from = map.get('email_from_address') ?? '';
    if (host && user && password && from) {
      return { host, port: parseInt(portStr, 10) || 587, user, password, from };
    }
  }

  const host = process.env['SMTP_HOST'] ?? '';
  const user = process.env['SMTP_USER'] ?? '';
  const password = process.env['SMTP_PASSWORD'] ?? '';
  const from =
    process.env['SMTP_FROM_EMAIL'] ??
    process.env['EMAIL_FROM_ADDRESS'] ??
    process.env['RESEND_FROM_EMAIL'] ??
    '';
  if (host && user && password && from) {
    return { host, port: parseInt(process.env['SMTP_PORT'] ?? '587', 10), user, password, from };
  }
  return null;
}

async function loadEmailAppUrl(): Promise<string> {
  const db = getDatabasePool();
  if (db) {
    try {
      const result = await db.query<{ value: string }>(
        `SELECT value FROM system_configuration WHERE key = 'email_app_url' LIMIT 1`,
      );
      const configuredUrl = result.rows[0]?.value.trim();
      if (configuredUrl) {
        return configuredUrl.replace(/\/+$/, '');
      }
    } catch {
      // Email sending should still work with the built-in fallback URL.
    }
  }

  return (process.env['APP_URL'] ?? 'https://bitwlab.com').replace(/\/+$/, '');
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

export interface EmailSendResult {
  provider: 'smtp';
  accepted: string[];
  rejected: string[];
  pending?: string[];
  response?: string;
  messageId?: string;
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

export async function sendRawEmail(msg: MailMessage): Promise<EmailSendResult> {
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
    return {
      provider: 'smtp',
      accepted: info.accepted ?? [],
      rejected: info.rejected ?? [],
      pending: info.pending,
      response: info.response,
      messageId: info.messageId,
    };
  }

  console.warn(JSON.stringify({ event: 'email.not_configured', to: msg.to, subject: msg.subject, timestamp: new Date().toISOString() }));
  throw new Error('No SMTP transport configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM_EMAIL.');
}

// ── Service class ─────────────────────────────────────────────────────────────

export class ResendEmailService
  implements
    PasswordResetEmailSender,
    EmailVerificationEmailSender,
    ManualEmailVerifiedEmailSender,
    DailyDataRefreshFailureEmailSender,
    AlertTriggeredEmailSender,
    DonationThankYouEmailSender
{
  async sendEmailVerificationEmail(input: { email: string; verificationUrl: string; verificationCode?: string; languagePreference?: 'en' | 'hu' }): Promise<void> {
    const hu = input.languagePreference === 'hu';
    const langKey = hu ? 'hu' : 'en';
    const appUrl = await loadEmailAppUrl();
    const vars = { verificationUrl: input.verificationUrl, verificationCode: input.verificationCode ?? '', appUrl };

    let htmlTemplate: string | null = null;
    let subjectTemplate: string | null = null;
    const db = getDatabasePool();
    if (db) {
      try {
        const htmlDbKey = `email_template_email_verification_${langKey}_html`;
        const subjectDbKey = `email_template_email_verification_${langKey}_subject`;
        const result = await db.query<{ key: string; value: string }>(
          `SELECT key, value FROM system_configuration WHERE key = ANY($1)`,
          [[htmlDbKey, subjectDbKey]],
        );
        const map = new Map(result.rows.map((r) => [r.key, r.value]));
        htmlTemplate = map.get(htmlDbKey) ?? null;
        subjectTemplate = map.get(subjectDbKey) ?? null;
      } catch { /* fall back to built-in */ }
    }

    const subject = subjectTemplate
      ? substituteTemplateVars(subjectTemplate, vars)
      : hu ? 'BitWLab kódod' : 'Your BitWLab code';
    const text = hu
      ? `Köszönjük a regisztrációt a BitWLab-ban.\n\nMegerősítő kódod: ${input.verificationCode ?? input.verificationUrl}\n\nEz a kód 24 óra múlva lejár.\n\nHa nem te hoztál létre fiókot, ezt az emailt figyelmen kívül hagyhatod.`
      : `Thanks for using BitWLab.\n\nYour BitWLab code: ${input.verificationCode ?? input.verificationUrl}\n\nThis code expires in 24 hours.\n\nIf you did not request this code, you can ignore this email.`;

    await sendRawEmail({ to: input.email, text, subject });
  }

  async sendManualEmailVerifiedEmail(input: { email: string; fullName?: string | null; languagePreference?: 'en' | 'hu' }): Promise<void> {
    const hu = input.languagePreference === 'hu';
    const langKey = hu ? 'hu' : 'en';
    const appUrl = await loadEmailAppUrl();
    const vars = {
      userName: escapeHtml(input.fullName?.trim() || input.email),
      userEmail: escapeHtml(input.email),
      appUrl,
    };

    let htmlTemplate: string | null = null;
    let subjectTemplate: string | null = null;
    const db = getDatabasePool();
    if (db) {
      try {
        const htmlDbKey = `email_template_manual_email_verified_${langKey}_html`;
        const subjectDbKey = `email_template_manual_email_verified_${langKey}_subject`;
        const result = await db.query<{ key: string; value: string }>(
          `SELECT key, value FROM system_configuration WHERE key = ANY($1)`,
          [[htmlDbKey, subjectDbKey]],
        );
        const map = new Map(result.rows.map((r) => [r.key, r.value]));
        htmlTemplate = map.get(htmlDbKey) ?? null;
        subjectTemplate = map.get(subjectDbKey) ?? null;
      } catch { /* fall back to built-in */ }
    }

    const subject = subjectTemplate
      ? substituteTemplateVars(subjectTemplate, vars)
      : hu ? 'BitWLab fiók frissítés' : 'BitWLab account update';
    const text = hu
      ? `Szia ${input.fullName?.trim() || input.email},\n\nA BitWLab fiókod frissült ehhez az email-címhez: ${input.email}.\n\nMostantól be tudsz jelentkezni, és használhatod a fiókodat.\n\nBitWLab`
      : `Hello ${input.fullName?.trim() || input.email},\n\nYour BitWLab account was updated for ${input.email}.\n\nYou can now sign in and use your account.\n\nBitWLab`;

    await sendRawEmail({ to: input.email, subject, text });
  }

  async sendPasswordResetEmail(input: { email: string; resetUrl: string; languagePreference?: 'en' | 'hu' }): Promise<void> {
    const hu = input.languagePreference === 'hu';
    await sendRawEmail({
      to: input.email,
      subject: hu ? 'BitWLab jelszó visszaállítása' : 'Reset your BitWLab password',
      html: hu
        ? `<p>Használd ezt a linket a jelszavad visszaállításához:</p><p><a href="${input.resetUrl}">${input.resetUrl}</a></p><p>Ez a link 1 óra múlva lejár.</p>`
        : `<p>Use this link to reset your password:</p><p><a href="${input.resetUrl}">${input.resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
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
      : input.languagePreference === 'hu'
        ? `Riasztás aktiválódott: ${input.alertName}`
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
  const locale = input.languagePreference === 'hu' ? 'hu-HU' : 'en-US';
  const date = new Date(input.triggeredAt).toLocaleString(locale, { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
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
  const hu = input.languagePreference === 'hu';
  const copy = {
    lang: hu ? 'hu' : 'en',
    title: hu ? `Riasztás aktiválódott — ${v.alertName}` : `Alert Triggered — ${v.alertName}`,
    subtitle: hu ? 'Bitcoin blokklánc elemzés' : 'Bitcoin Blockchain Analysis',
    heading: hu ? 'A riasztásod aktiválódott!' : 'Your alert has been triggered!',
    hello: hu ? 'Szia,' : 'Hello,',
    intro: hu
      ? `A(z) <strong>${v.alertName}</strong> riasztásod aktiválódott a(z) <strong>${v.chartTitle}</strong> grafikonon.`
      : `Your alert <strong>${v.alertName}</strong> on the <strong>${v.chartTitle}</strong> chart has been triggered.`,
    condition: hu ? 'Feltétel' : 'Condition',
    currentValue: hu ? 'Aktuális érték' : 'Current Value',
    triggeredAt: hu ? 'Aktiválódás ideje' : 'Triggered At',
    review: hu
      ? 'Jelentkezz be a BitWLab fiókodba a riasztás áttekintéséhez és a beállítások módosításához.'
      : 'Log in to your BitWLab account to review this alert and update your settings.',
    cta: hu ? 'Riasztásaim megtekintése →' : 'View My Alerts →',
    signoff: hu ? 'Örömmel segítünk naprakésznek maradni!' : 'We look forward to keeping you informed!',
    automated: hu
      ? 'Ez egy automatikus üzenet. Kérjük, ne válaszolj erre az emailre.'
      : 'This is an automated message. Please do not reply to this email.',
  };
  return `<!DOCTYPE html>
<html lang="${copy.lang}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${copy.title}</title></head>
<body style="margin:0;padding:0;background:#e8f0e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8f0e9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#1a4731;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
          <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;">BitWLab</p>
          <p style="margin:0;font-size:13px;color:#86b89a;">${copy.subtitle}</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #dce8dd;border-right:1px solid #dce8dd;">
          <h2 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111827;">${copy.heading}</h2>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">${copy.hello}</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${copy.intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f1;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding-bottom:12px;border-bottom:1px solid #d1e7d4;"><span style="font-size:13px;color:#6b7280;">${copy.condition}</span><br/><strong style="font-size:15px;color:#111827;">${v.metricLabel} ${v.conditionLabel} ${v.thresholdValue}</strong></td></tr>
                <tr><td style="padding-top:12px;padding-bottom:12px;border-bottom:1px solid #d1e7d4;"><span style="font-size:13px;color:#6b7280;">${copy.currentValue}</span><br/><strong style="font-size:22px;color:#1a4731;">${v.currentValue}</strong></td></tr>
                <tr><td style="padding-top:12px;"><span style="font-size:13px;color:#6b7280;">${copy.triggeredAt}</span><br/><strong style="font-size:15px;color:#111827;">${v.triggeredAt} UTC</strong></td></tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">${copy.review}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:32px;"><tr><td style="background:#1a4731;border-radius:8px;"><a href="${v.appUrl}/alerts" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${copy.cta}</a></td></tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="border-top:1px solid #e5e7eb;font-size:0;line-height:0;">&nbsp;</td></tr></table>
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">${copy.signoff}</p>
        </td></tr>
        <tr><td style="background:#d4e8d6;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border:1px solid #bdd9bf;border-top:none;">
          <p style="margin:0 0 4px;font-size:13px;color:#3d6b4a;">${copy.automated}</p>
          <p style="margin:0;font-size:12px;color:#5a8a68;"><a href="${v.appUrl}" style="color:#1a4731;text-decoration:none;">BitWLab</a> &nbsp;·&nbsp; ${copy.subtitle}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildEmailVerificationHtml(verificationUrl: string, appUrl: string, hu: boolean, verificationCode?: string): string {
  const code = escapeHtml(verificationCode ?? verificationUrl);
  const safe = escapeHtml(appUrl);
  const subtitle = hu ? 'Bitcoin blokklánc elemzés' : 'Bitcoin Blockchain Analysis';
  const intro = hu
    ? 'Köszönjük, hogy használod a BitWLab-ot. Írd be ezt a kódot a folytatáshoz:'
    : 'Thanks for using BitWLab. Enter this code to continue:';
  const expires = hu ? 'Ez a kód 24 óra múlva lejár.' : 'This code expires in 24 hours.';
  const ignore = hu
    ? 'Ha nem te kérted ezt a kódot, ezt az emailt figyelmen kívül hagyhatod.'
    : 'If you did not request this code, you can ignore this email.';
  return `<!DOCTYPE html>
<html lang="${hu ? 'hu' : 'en'}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${hu ? 'BitWLab kódod' : 'Your BitWLab code'}</title></head>
<body style="margin:0;padding:0;background:#e8f0e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8f0e9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#1a4731;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
          <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;">BitWLab</p>
          <p style="margin:0;font-size:13px;color:#86b89a;">${subtitle}</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #dce8dd;border-right:1px solid #dce8dd;">
          <h2 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111827;">${hu ? 'BitWLab kódod' : 'Your BitWLab code'}</h2>
          <p style="margin:0 0 18px;font-size:15px;color:#374151;line-height:1.6;">${intro}</p>
          <p style="margin:0 0 20px;padding:16px 18px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;font-size:28px;line-height:1.2;letter-spacing:6px;font-weight:800;text-align:center;color:#111827;">${code}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${expires}</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">${ignore}</p>
        </td></tr>
        <tr><td style="background:#d4e8d6;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border:1px solid #bdd9bf;border-top:none;">
          <p style="margin:0 0 4px;font-size:13px;color:#3d6b4a;">${hu ? 'Ez egy automatikus üzenet. Kérjük, ne válaszolj erre az emailre.' : 'This is an automated message. Please do not reply to this email.'}</p>
          <p style="margin:0;font-size:12px;color:#5a8a68;"><a href="${safe}" style="color:#1a4731;text-decoration:none;">BitWLab</a> &nbsp;·&nbsp; ${subtitle}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildManualEmailVerifiedHtml(userName: string, userEmail: string, appUrl: string, hu: boolean): string {
  const safeAppUrl = escapeHtml(appUrl);
  const title = hu ? 'BitWLab fiók frissítés' : 'BitWLab account update';
  const intro = hu
    ? `Szia ${userName},`
    : `Hello ${userName},`;
  const body = hu
    ? `A BitWLab fiókod frissült ehhez az email-címhez: <strong style="color:#111827;">${userEmail}</strong>. Mostantól be tudsz jelentkezni, és használhatod a fiókodat.`
    : `Your BitWLab account was updated for <strong style="color:#111827;">${userEmail}</strong>. You can now sign in and use your account.`;
  const cta = hu ? 'Bejelentkezés' : 'Sign in';
  const footer = hu
    ? 'Ez egy automatikus értesítés. Kérjük, ne válaszolj erre az emailre.'
    : 'This is an automated notification. Please do not reply to this email.';
  const subtitle = hu ? 'Bitcoin blokklánc elemzés' : 'Bitcoin Blockchain Analysis';

  return `<!DOCTYPE html>
<html lang="${hu ? 'hu' : 'en'}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${title} — BitWLab</title></head>
<body style="margin:0;padding:0;background:#e8f0e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8f0e9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#1a4731;border-radius:12px 12px 0 0;padding:30px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#ffffff;">BitWLab</p>
          <p style="margin:0;font-size:13px;color:#86b89a;">${subtitle}</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:40px;border-left:1px solid #dce8dd;border-right:1px solid #dce8dd;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.06em;">${hu ? 'Fiók frissítve' : 'Account update'}</p>
          <h2 style="margin:0 0 18px;font-size:24px;font-weight:800;color:#111827;">${title}</h2>
          <p style="margin:0 0 14px;font-size:15px;color:#374151;line-height:1.6;">${intro}</p>
          <p style="margin:0 0 26px;font-size:15px;color:#374151;line-height:1.6;">${body}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:26px;"><tr><td style="background:#1a4731;border-radius:8px;"><a href="${safeAppUrl}/login" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${cta} &#x2192;</a></td></tr></table>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">${hu ? 'Ha kérdésed van a fiókoddal kapcsolatban, kérjük, vedd fel velünk a kapcsolatot a BitWLab felületén.' : 'If you have any questions about your account, please contact us from the BitWLab application.'}</p>
        </td></tr>
        <tr><td style="background:#d4e8d6;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border:1px solid #bdd9bf;border-top:none;">
          <p style="margin:0 0 4px;font-size:13px;color:#3d6b4a;">${footer}</p>
          <p style="margin:0;font-size:12px;color:#5a8a68;"><a href="${safeAppUrl}" style="color:#1a4731;text-decoration:none;">BitWLab</a> &nbsp;&middot;&nbsp; ${subtitle}</p>
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
