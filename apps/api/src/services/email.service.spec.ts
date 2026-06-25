import nodemailer from 'nodemailer';
import { getDatabasePool } from '../config/database.config';
import { sendRawEmail } from './email.service';

jest.mock('../config/database.config', () => ({
  getDatabasePool: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

describe('sendRawEmail', () => {
  const originalEnv = process.env;
  const sendMail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASSWORD = 'smtp-password';
    process.env.SMTP_FROM_EMAIL = 'BitWLab <noreply@example.com>';
    (getDatabasePool as jest.Mock).mockReturnValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    sendMail.mockResolvedValue({ messageId: 'message-id', response: '250 OK' });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('sends mail with simple SMTP configuration from database settings', async () => {
    (getDatabasePool as jest.Mock).mockReturnValue({
      query: jest.fn().mockResolvedValue({
        rows: [
          { key: 'smtp_host', value: 'smtp.database.example.com' },
          { key: 'smtp_port', value: '465' },
          { key: 'smtp_user', value: 'database-user' },
          { key: 'smtp_password', value: 'database-password' },
          { key: 'email_from_address', value: 'BitWLab <database@example.com>' },
        ],
      }),
    });

    await sendRawEmail({
      to: 'user@example.com',
      subject: 'Verify your email address',
      html: '<p>Hello</p>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.database.example.com',
      port: 465,
      secure: true,
      auth: { user: 'database-user', pass: 'database-password' },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'BitWLab <database@example.com>',
        to: 'user@example.com',
        subject: 'Verify your email address',
      }),
    );
  });

  it('falls back to simple SMTP configuration from environment variables', async () => {
    await sendRawEmail({
      to: 'user@example.com',
      subject: 'Verify your email address',
      html: '<p>Hello</p>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-password' },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'BitWLab <noreply@example.com>',
        to: 'user@example.com',
        subject: 'Verify your email address',
      }),
    );
  });

  it('fails clearly when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;

    await expect(
      sendRawEmail({
        to: 'user@example.com',
        subject: 'Verify your email address',
        html: '<p>Hello</p>',
      }),
    ).rejects.toThrow('No SMTP transport configured');
  });
});
