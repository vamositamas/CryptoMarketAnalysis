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

export class ResendEmailService
  implements PasswordResetEmailSender, DailyDataRefreshFailureEmailSender
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
