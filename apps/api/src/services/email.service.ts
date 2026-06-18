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

export class ResendEmailService
  implements
    PasswordResetEmailSender,
    DailyDataRefreshFailureEmailSender,
    AlertTriggeredEmailSender,
    DonationThankYouEmailSender
{
  async sendPasswordResetEmail(input: {
    email: string;
    resetUrl: string;
  }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) {
      logPasswordResetEmail(input.email, input.resetUrl);
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.email,
        subject: 'Reset your CryptoMarketAnalysis password',
        html: `<p>Use this link to reset your password:</p><p><a href="${input.resetUrl}">${input.resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
      }),
    });

    if (!response.ok) {
      throw new Error('Password reset email could not be sent');
    }
  }

  async sendDailyDataRefreshFailureAlert(input: {
    date: string;
    attempts: number;
    error: string;
  }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const to = process.env.ADMIN_ALERT_EMAIL ?? 'admin@cryptomarketanalysis.com';

    if (!apiKey || !from) {
      logDailyDataRefreshFailureAlert(input, to);
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: '[ALERT] Daily Data Refresh Failed',
        text: `Data refresh job failed for date ${input.date} after ${input.attempts} attempts.\nError: ${input.error}\nPlease investigate manually.`,
      }),
    });

    if (!response.ok) {
      throw new Error('Daily data refresh failure alert could not be sent');
    }
  }

  async sendAlertTriggeredEmail(input: AlertTriggeredEmailInput): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const appUrl = process.env.APP_URL ?? 'https://cryptomarketanalysis.com';

    if (!apiKey || !from) {
      logAlertTriggeredEmail(input);
      return;
    }

    const vars = buildTemplateVars(input, appUrl);
    const subject = input.subjectTemplate
      ? substituteTemplateVars(input.subjectTemplate, vars)
      : `Alert Triggered: ${input.alertName}`;
    const html = input.htmlTemplate
      ? substituteTemplateVars(input.htmlTemplate, vars)
      : buildAlertTriggeredHtml(input, appUrl);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from, to: input.userEmail, subject, html }),
    });

    if (!response.ok) {
      throw new Error('Alert triggered email could not be sent');
    }
  }

  async sendDonationThankYouEmail(input: DonationThankYouEmailInput): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) {
      logDonationThankYouEmail(input);
      return;
    }

    const donationDate = new Date(input.donationDate).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      dateStyle: 'long',
    });
    const formattedAmount = `$${input.donationAmount.toFixed(2)} ${input.currency}`;
    const displayName = escapeHtml(input.userName || 'Supporter');
    const thankYouUrl = `${input.appUrl}/donate/thank-you?donation_id=${input.donationId}`;

    const html = `
      <h2 style="color:#1a1a2e">Thank You for Your Support!</h2>
      <p>Hello ${displayName}, thank you for your ${formattedAmount} donation!</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:6px 12px;font-weight:bold;color:#555">Amount</td>
          <td style="padding:6px 12px">${formattedAmount}</td>
        </tr>
        <tr style="background:#f5f5f5">
          <td style="padding:6px 12px;font-weight:bold;color:#555">Transaction ID</td>
          <td style="padding:6px 12px">${escapeHtml(input.transactionId)}</td>
        </tr>
        <tr>
          <td style="padding:6px 12px;font-weight:bold;color:#555">Date</td>
          <td style="padding:6px 12px">${donationDate}</td>
        </tr>
      </table>
      <h3 style="color:#1a1a2e">Premium benefits unlocked:</h3>
      <ul>
        <li>Unlimited price alerts (previously limited to 5)</li>
        <li>Access to future premium charts</li>
        <li>Priority support</li>
        <li>Recognition as a platform supporter</li>
      </ul>
      <p>Please log in again to activate your Premium account.</p>
      <p>
        <a href="${thankYouUrl}" style="color:#6c63ff">View donation confirmation</a>
      </p>
      <p style="color:#888;font-size:12px">
        CryptoMarketAnalysis is a personal project. Donations are voluntary and non-refundable.
      </p>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.userEmail,
        subject: 'Thank You for Your Donation!',
        html,
      }),
    });

    if (!response.ok) {
      throw new Error('Donation thank-you email could not be sent');
    }
  }
} // end ResendEmailService

export function substituteTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function buildTemplateVars(input: AlertTriggeredEmailInput, appUrl: string): Record<string, string> {
  const date = new Date(input.triggeredAt).toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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
  return `
    <h2 style="color:#1a1a2e">Alert Triggered: ${v.alertName}</h2>
    <p>Your alert on the <strong>${v.chartTitle}</strong> has been triggered.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:6px 12px;font-weight:bold;color:#555">Condition</td>
        <td style="padding:6px 12px">${v.metricLabel} ${v.conditionLabel} ${v.thresholdValue}</td>
      </tr>
      <tr style="background:#f5f5f5">
        <td style="padding:6px 12px;font-weight:bold;color:#555">Current value</td>
        <td style="padding:6px 12px"><strong>${v.currentValue}</strong></td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-weight:bold;color:#555">Triggered at</td>
        <td style="padding:6px 12px">${v.triggeredAt} UTC</td>
      </tr>
    </table>
    <p><a href="${v.appUrl}/alerts" style="color:#6c63ff">View your alerts</a></p>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function logPasswordResetEmail(email: string, resetUrl: string): void {
  console.info(
    JSON.stringify({
      event: 'auth.password_reset_email',
      email,
      resetUrl,
      timestamp: new Date().toISOString(),
    }),
  );
}

function logDailyDataRefreshFailureAlert(
  input: { date: string; attempts: number; error: string },
  to: string,
): void {
  console.info(
    JSON.stringify({
      event: 'jobs.daily_data_refresh_failed',
      to,
      date: input.date,
      attempts: input.attempts,
      error: input.error,
      timestamp: new Date().toISOString(),
    }),
  );
}

function logDonationThankYouEmail(input: DonationThankYouEmailInput): void {
  console.info(
    JSON.stringify({
      event: 'donations.thank_you_email',
      to: input.userEmail,
      donationId: input.donationId,
      amount: input.donationAmount,
      currency: input.currency,
      transactionId: input.transactionId,
      timestamp: new Date().toISOString(),
    }),
  );
}

function logAlertTriggeredEmail(input: AlertTriggeredEmailInput): void {
  console.info(
    JSON.stringify({
      event: 'alerts.alert_triggered_email',
      to: input.userEmail,
      alertName: input.alertName,
      chartTitle: input.chartTitle,
      condition: `${input.metricLabel} ${input.conditionLabel} ${input.thresholdValue}`,
      currentValue: input.currentValue,
      triggeredAt: input.triggeredAt,
      timestamp: new Date().toISOString(),
    }),
  );
}
