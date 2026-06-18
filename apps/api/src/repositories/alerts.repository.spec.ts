import { AlertsRepository, type CreateAlertInput } from './alerts.repository';

function createDatabase(rows: unknown[] = []) {
  return { query: jest.fn().mockResolvedValue({ rows }) };
}

const userId = 'user-uuid';

const validInput: CreateAlertInput = {
  chartId: 'bitcoin-rainbow',
  metricName: 'rainbow_band',
  condition: 'crosses_above',
  thresholdValue: 7.5,
  alertName: 'Rainbow hits FOMO zone',
};

describe('AlertsRepository', () => {
  it('inserts an alert and returns the mapped record', async () => {
    const now = new Date('2026-06-17T12:00:00.000Z');
    const db = createDatabase([
      {
        id: 'alert-uuid',
        user_id: userId,
        chart_id: 'bitcoin-rainbow',
        metric_name: 'rainbow_band',
        condition: 'crosses_above',
        threshold_value: '7.500000',
        alert_name: 'Rainbow hits FOMO zone',
        status: 'active',
        created_at: now,
        last_evaluated_at: null,
        triggered_at: null,
      },
    ]);
    const repo = new AlertsRepository(db);

    const record = await repo.create(userId, validInput);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_alerts'),
      [userId, validInput.chartId, validInput.metricName, validInput.condition, validInput.thresholdValue, validInput.alertName],
    );
    expect(record).toEqual({
      id: 'alert-uuid',
      userId,
      chartId: 'bitcoin-rainbow',
      metricName: 'rainbow_band',
      condition: 'crosses_above',
      thresholdValue: 7.5,
      alertName: 'Rainbow hits FOMO zone',
      status: 'active',
      createdAt: now.toISOString(),
      lastEvaluatedAt: null,
      triggeredAt: null,
    });
  });

  it('counts active alerts for a user', async () => {
    const db = createDatabase([{ count: '3' }]);
    const repo = new AlertsRepository(db);

    const count = await repo.countActiveForUser(userId);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)'), [userId]);
    expect(count).toBe(3);
  });

  it('returns 0 when there are no active alerts', async () => {
    const db = createDatabase([{ count: '0' }]);
    const repo = new AlertsRepository(db);

    expect(await repo.countActiveForUser(userId)).toBe(0);
  });

  it('lists all alerts for a user ordered by created_at DESC', async () => {
    const now = new Date('2026-06-17T12:00:00.000Z');
    const row = {
      id: 'alert-uuid',
      user_id: userId,
      chart_id: 'bitcoin-rainbow',
      metric_name: 'rainbow_band',
      condition: 'crosses_above',
      threshold_value: '7.500000',
      alert_name: 'Rainbow alert',
      status: 'active',
      created_at: now,
      last_evaluated_at: null,
      triggered_at: null,
    };
    const db = createDatabase([row]);
    const repo = new AlertsRepository(db);

    const records = await repo.listForUser(userId);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC'), [userId]);
    expect(records).toHaveLength(1);
    expect(records[0].thresholdValue).toBe(7.5);
  });

  it('deletes an alert belonging to the user and returns true', async () => {
    const db = createDatabase([{ id: 'alert-uuid' }]);
    const repo = new AlertsRepository(db);

    const deleted = await repo.deleteForUser(userId, 'alert-uuid');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM user_alerts'), ['alert-uuid', userId]);
    expect(deleted).toBe(true);
  });

  it('returns false when delete finds no matching alert', async () => {
    const db = createDatabase([]);
    const repo = new AlertsRepository(db);

    expect(await repo.deleteForUser(userId, 'nonexistent')).toBe(false);
  });

  it('resets a triggered alert to active and returns the updated record', async () => {
    const now = new Date('2026-06-17T12:00:00.000Z');
    const db = createDatabase([
      {
        id: 'alert-uuid',
        user_id: userId,
        chart_id: 'bitcoin-rainbow',
        metric_name: 'rainbow_band',
        condition: 'crosses_above',
        threshold_value: '7.500000',
        alert_name: 'Rainbow alert',
        status: 'active',
        created_at: now,
        last_evaluated_at: null,
        triggered_at: null,
      },
    ]);
    const repo = new AlertsRepository(db);

    const record = await repo.resetForUser(userId, 'alert-uuid');

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("status = 'active'"), ['alert-uuid', userId]);
    expect(record?.status).toBe('active');
    expect(record?.triggeredAt).toBeNull();
  });

  it('returns null when resetting a non-triggered or non-existent alert', async () => {
    const db = createDatabase([]);
    const repo = new AlertsRepository(db);

    expect(await repo.resetForUser(userId, 'nonexistent')).toBeNull();
  });

  it('throws when database is not configured', () => {
    const repo = new AlertsRepository(undefined);

    expect(() => repo.create(userId, validInput)).rejects.toThrow('Database is not configured');
    expect(() => repo.countActiveForUser(userId)).rejects.toThrow('Database is not configured');
  });
});
