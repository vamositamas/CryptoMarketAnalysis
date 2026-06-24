import { AlertEvaluationService, evaluateCondition } from './alert-evaluation.service';
import type { AlertTriggeredEmailSender } from './email.service';

function makeAlertRow(overrides: Partial<{
  id: string;
  alert_name: string;
  chart_id: string;
  metric_name: string;
  condition: string;
  threshold_value: string;
  user_email: string;
  language_preference: 'en' | 'hu' | null;
}> = {}) {
  return {
    id: 'alert-uuid',
    alert_name: 'Rainbow alert',
    chart_id: 'bitcoin-rainbow',
    metric_name: 'rainbow_band',
    condition: 'crosses_above',
    threshold_value: '7.5',
    user_email: 'user@example.com',
    language_preference: null as 'en' | 'hu' | null,
    ...overrides,
  };
}

const NOW = new Date('2026-06-17T08:00:00.000Z');
const NOW_ISO = NOW.toISOString();

describe('AlertEvaluationService', () => {
  it('returns zeros when no active alerts exist', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const service = new AlertEvaluationService(db);

    await expect(service.evaluateAlerts(NOW)).resolves.toEqual({
      evaluated: 0,
      triggered: 0,
      skipped: 0,
    });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('throws when database is not configured', async () => {
    const service = new AlertEvaluationService(undefined);
    await expect(service.evaluateAlerts()).rejects.toThrow('Database is not configured');
  });

  it('triggers an alert when crosses_above condition is met', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [makeAlertRow({ condition: 'crosses_above', threshold_value: '7.0' })] })
        .mockResolvedValueOnce({ rows: [{ metric_name: 'rainbow_band', metric_value: '7.5' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'trigger-uuid' }] }),
    };
    const service = new AlertEvaluationService(db);

    const result = await service.evaluateAlerts(NOW);

    expect(result).toEqual({ evaluated: 1, triggered: 1, skipped: 0 });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'triggered'"),
      [NOW_ISO, 'alert-uuid'],
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO alert_triggers'),
      ['alert-uuid', NOW_ISO, 7.5],
    );
  });

  it('does not trigger when crosses_above condition is not met', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [makeAlertRow({ condition: 'crosses_above', threshold_value: '8.0' })] })
        .mockResolvedValueOnce({ rows: [{ metric_name: 'rainbow_band', metric_value: '7.5' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new AlertEvaluationService(db);

    const result = await service.evaluateAlerts(NOW);

    expect(result).toEqual({ evaluated: 1, triggered: 0, skipped: 0 });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SET last_evaluated_at'),
      [NOW_ISO, 'alert-uuid'],
    );
  });

  it('triggers an alert when crosses_below condition is met', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [makeAlertRow({ condition: 'crosses_below', threshold_value: '8.0' })] })
        .mockResolvedValueOnce({ rows: [{ metric_name: 'rainbow_band', metric_value: '7.5' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'trigger-uuid' }] }),
    };
    const service = new AlertEvaluationService(db);

    const result = await service.evaluateAlerts(NOW);

    expect(result).toEqual({ evaluated: 1, triggered: 1, skipped: 0 });
  });

  it('triggers an alert when equals condition is met within tolerance', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [makeAlertRow({ condition: 'equals', threshold_value: '7.5' })] })
        .mockResolvedValueOnce({ rows: [{ metric_name: 'rainbow_band', metric_value: '7.505' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'trigger-uuid' }] }),
    };
    const service = new AlertEvaluationService(db);

    const result = await service.evaluateAlerts(NOW);

    expect(result).toEqual({ evaluated: 1, triggered: 1, skipped: 0 });
  });

  it('does not trigger when equals condition is outside tolerance', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [makeAlertRow({ condition: 'equals', threshold_value: '7.5' })] })
        .mockResolvedValueOnce({ rows: [{ metric_name: 'rainbow_band', metric_value: '7.52' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new AlertEvaluationService(db);

    const result = await service.evaluateAlerts(NOW);

    expect(result).toEqual({ evaluated: 1, triggered: 0, skipped: 0 });
  });

  it('skips an alert when metric value is unavailable', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [makeAlertRow({ metric_name: 'unknown_metric' })] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const service = new AlertEvaluationService(db);

    const result = await service.evaluateAlerts(NOW);

    expect(result).toEqual({ evaluated: 1, triggered: 0, skipped: 1 });
  });

  it('fetches btc_price from bitcoin_price_daily', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [makeAlertRow({ metric_name: 'btc_price', condition: 'greater_than', threshold_value: '60000' })] })
        .mockResolvedValueOnce({ rows: [{ price_usd: '67000' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'trigger-uuid' }] }),
    };
    const service = new AlertEvaluationService(db);

    const result = await service.evaluateAlerts(NOW);

    expect(result).toEqual({ evaluated: 1, triggered: 1, skipped: 0 });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM bitcoin_price_daily'),
    );
  });

  it('applies ×2 multiplier for ma_350x2_day metric', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [makeAlertRow({ metric_name: 'ma_350x2_day', condition: 'greater_than', threshold_value: '100000' })] })
        .mockResolvedValueOnce({ rows: [{ metric_name: 'ma_350_day', metric_value: '55000' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'trigger-uuid' }] }),
    };
    const service = new AlertEvaluationService(db);

    const result = await service.evaluateAlerts(NOW);

    // 55000 * 2 = 110000 > 100000 → triggered
    expect(result).toEqual({ evaluated: 1, triggered: 1, skipped: 0 });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO alert_triggers'),
      ['alert-uuid', NOW_ISO, 110000],
    );
  });

  it('counts multiple alerts independently', async () => {
    const alerts = [
      makeAlertRow({ id: 'alert-1', condition: 'crosses_above', threshold_value: '7.0' }),
      makeAlertRow({ id: 'alert-2', condition: 'crosses_above', threshold_value: '8.0' }),
      makeAlertRow({ id: 'alert-3', metric_name: 'unknown_metric' }),
    ];
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: alerts })
        .mockResolvedValueOnce({ rows: [{ metric_name: 'rainbow_band', metric_value: '7.5' }] })
        .mockResolvedValue({ rows: [{ id: 'trigger-uuid' }] }),
    };
    const service = new AlertEvaluationService(db);

    const result = await service.evaluateAlerts(NOW);

    expect(result).toEqual({ evaluated: 3, triggered: 1, skipped: 1 });
  });

  describe('email notifications', () => {
    function makeTriggeredDb() {
      return {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [makeAlertRow({ condition: 'greater_than', threshold_value: '7.0' })] })
          .mockResolvedValueOnce({ rows: [{ metric_name: 'rainbow_band', metric_value: '7.5' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 'trigger-uuid' }] })
          .mockResolvedValueOnce({ rows: [] }),
      };
    }

    it('sends an email when an alert is triggered', async () => {
      const emailService: AlertTriggeredEmailSender = {
        sendAlertTriggeredEmail: jest.fn().mockResolvedValue(undefined),
      };
      const db = makeTriggeredDb();
      const service = new AlertEvaluationService(db, { emailService });

      await service.evaluateAlerts(NOW);

      expect(emailService.sendAlertTriggeredEmail).toHaveBeenCalledWith({
        userEmail: 'user@example.com',
        alertName: 'Rainbow alert',
        chartTitle: 'Bitcoin Rainbow Price Chart',
        metricLabel: 'Rainbow Band',
        conditionLabel: 'is greater than',
        thresholdValue: 7.0,
        currentValue: 7.5,
        triggeredAt: NOW_ISO,
        languagePreference: 'en',
        htmlTemplate: null,
        subjectTemplate: null,
      });
    });

    it('marks notification_sent on the trigger row after successful email', async () => {
      const emailService: AlertTriggeredEmailSender = {
        sendAlertTriggeredEmail: jest.fn().mockResolvedValue(undefined),
      };
      const db = makeTriggeredDb();
      const service = new AlertEvaluationService(db, { emailService });

      await service.evaluateAlerts(NOW);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('notification_sent = true'),
        [NOW_ISO, 'trigger-uuid'],
      );
    });

    it('does not fail evaluation when email sending throws', async () => {
      const emailService: AlertTriggeredEmailSender = {
        sendAlertTriggeredEmail: jest.fn().mockRejectedValue(new Error('SMTP error')),
      };
      const logger = { warn: jest.fn() };
      const db = makeTriggeredDb();
      const service = new AlertEvaluationService(db, { emailService, logger });

      const result = await service.evaluateAlerts(NOW);

      expect(result).toEqual({ evaluated: 1, triggered: 1, skipped: 0 });
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to send alert triggered email',
        expect.objectContaining({ error: 'SMTP error' }),
      );
    });

    it('does not send email when no email service is provided', async () => {
      const db = makeTriggeredDb();
      const service = new AlertEvaluationService(db);

      await service.evaluateAlerts(NOW);

      // Only 4 queries: list alerts, fetch metrics, update status, insert trigger (no notification update)
      const notificationCall = db.query.mock.calls.find(
        ([sql]: [string]) => sql && String(sql).includes('notification_sent'),
      );
      expect(notificationCall).toBeUndefined();
    });

    it('passes custom HTML template to email service when templateLoader provides one', async () => {
      const customHtml = '<p>Custom: {{alertName}}</p>';
      const emailService: AlertTriggeredEmailSender = {
        sendAlertTriggeredEmail: jest.fn().mockResolvedValue(undefined),
      };
      const templateLoader = {
        getTemplate: jest.fn().mockImplementation((key: string) =>
          Promise.resolve(key === 'alert_triggered_en_html' ? customHtml : null),
        ),
      };
      const db = makeTriggeredDb();
      const service = new AlertEvaluationService(db, { emailService, templateLoader });

      await service.evaluateAlerts(NOW);

      expect(emailService.sendAlertTriggeredEmail).toHaveBeenCalledWith(
        expect.objectContaining({ htmlTemplate: customHtml, subjectTemplate: null }),
      );
    });
  });
});

describe('evaluateCondition', () => {
  it.each([
    ['crosses_above', 8, 7.5, true],
    ['crosses_above', 7, 7.5, false],
    ['greater_than', 8, 7.5, true],
    ['greater_than', 7, 7.5, false],
    ['crosses_below', 7, 7.5, true],
    ['crosses_below', 8, 7.5, false],
    ['less_than', 7, 7.5, true],
    ['less_than', 8, 7.5, false],
    ['equals', 7.505, 7.5, true],
    ['equals', 7.52, 7.5, false],
    ['unknown', 7, 7, false],
  ])('%s: value=%s threshold=%s → %s', (condition, value, threshold, expected) => {
    expect(evaluateCondition(condition, value as number, threshold as number)).toBe(expected);
  });
});
