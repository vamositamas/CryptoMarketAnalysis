export interface PasswordResetEmailSender {
  sendPasswordResetEmail(input: { email: string; resetUrl: string }): Promise<void>;
}

export class ResendEmailService implements PasswordResetEmailSender {
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

