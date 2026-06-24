import { AlertsService, AlertsError } from './alerts.service';
import type { AlertRecord } from '../repositories/alerts.repository';

const userId = 'user-uuid';

const alertRecord: AlertRecord = {
  id: 'alert-uuid',
  userId,
  chartId: 'bitcoin-rainbow',
  metricName: 'rainbow_band',
  condition: 'crosses_above',
  thresholdValue: 7.5,
  alertName: 'Rainbow alert',
  status: 'active',
  createdAt: '2026-06-17T12:00:00.000Z',
  lastEvaluatedAt: null,
  triggeredAt: null,
};

function createRepositoryStub() {
  return {
    create: jest.fn().mockResolvedValue(alertRecord),
    countActiveForUser: jest.fn().mockResolvedValue(0),
    countForUser: jest.fn().mockResolvedValue(1),
    listForUser: jest.fn().mockResolvedValue([alertRecord]),
    deleteForUser: jest.fn().mockResolvedValue(true),
    resetForUser: jest.fn().mockResolvedValue({ ...alertRecord, status: 'active', triggeredAt: null }),
    updateForUser: jest.fn().mockResolvedValue(alertRecord),
  };
}

const validBody = {
  chartId: 'bitcoin-rainbow',
  metricName: 'rainbow_band',
  condition: 'crosses_above',
  thresholdValue: 7.5,
  alertName: 'Rainbow alert',
};

describe('AlertsService — createAlert', () => {
  it('creates an alert and returns the record', async () => {
    const repo = createRepositoryStub();
    const service = new AlertsService(repo);

    const result = await service.createAlert(userId, 'free_user', validBody);

    expect(repo.create).toHaveBeenCalledWith(userId, {
      chartId: 'bitcoin-rainbow',
      metricName: 'rainbow_band',
      condition: 'crosses_above',
      thresholdValue: 7.5,
      alertName: 'Rainbow alert',
    });
    expect(result).toEqual(alertRecord);
  });

  it('rejects an unknown chartId', async () => {
    const service = new AlertsService(createRepositoryStub());

    await expect(
      service.createAlert(userId, 'free_user', { ...validBody, chartId: 'unknown-chart' }),
    ).rejects.toThrow(AlertsError);
  });

  it('rejects an invalid condition', async () => {
    const service = new AlertsService(createRepositoryStub());

    await expect(
      service.createAlert(userId, 'free_user', { ...validBody, condition: 'explodes' }),
    ).rejects.toThrow(AlertsError);
  });

  it('rejects a non-numeric thresholdValue', async () => {
    const service = new AlertsService(createRepositoryStub());

    await expect(
      service.createAlert(userId, 'free_user', { ...validBody, thresholdValue: 'not-a-number' }),
    ).rejects.toThrow(AlertsError);
  });

  it('rejects an empty alertName', async () => {
    const service = new AlertsService(createRepositoryStub());

    await expect(
      service.createAlert(userId, 'free_user', { ...validBody, alertName: '   ' }),
    ).rejects.toThrow(AlertsError);
  });

  it('allows free users to create alerts without a cap', async () => {
    const repo = createRepositoryStub();
    repo.countActiveForUser.mockResolvedValue(5);
    const service = new AlertsService(repo);

    await expect(service.createAlert(userId, 'free_user', validBody)).resolves.toEqual(alertRecord);
  });

  it('allows premium users to create alerts', async () => {
    const repo = createRepositoryStub();
    repo.countActiveForUser.mockResolvedValue(100);
    const service = new AlertsService(repo);

    await expect(service.createAlert(userId, 'premium_user', validBody)).resolves.toEqual(alertRecord);
  });

  it('does not check the limit for administrators', async () => {
    const repo = createRepositoryStub();
    repo.countActiveForUser.mockResolvedValue(100);
    const service = new AlertsService(repo);

    await expect(service.createAlert(userId, 'administrator', validBody)).resolves.toEqual(alertRecord);
    expect(repo.countActiveForUser).not.toHaveBeenCalled();
  });

  it('rejects a non-object body', async () => {
    const service = new AlertsService(createRepositoryStub());

    await expect(service.createAlert(userId, 'free_user', null)).rejects.toThrow(AlertsError);
    await expect(service.createAlert(userId, 'free_user', 'string')).rejects.toThrow(AlertsError);
  });
});

describe('AlertsService — listAlerts', () => {
  it('returns alerts enriched with chartTitle and limit info', async () => {
    const repo = createRepositoryStub();
    repo.countForUser.mockResolvedValue(2);
    const service = new AlertsService(repo);

    const result = await service.listAlerts(userId);

    expect(result.alerts[0].chartTitle).toBe('Bitcoin Rainbow Price Chart');
    expect(result.alertLimit).toEqual({ used: 2, max: null, unlimited: true });
  });

  it('returns unlimited flag for all users', async () => {
    const repo = createRepositoryStub();
    repo.countForUser.mockResolvedValue(8);
    const service = new AlertsService(repo);

    const result = await service.listAlerts(userId);

    expect(result.alertLimit).toEqual({ used: 8, max: null, unlimited: true });
  });
});

describe('AlertsService — deleteAlert', () => {
  it('deletes an alert successfully', async () => {
    const repo = createRepositoryStub();
    const service = new AlertsService(repo);

    await expect(service.deleteAlert(userId, 'alert-uuid')).resolves.toBeUndefined();
    expect(repo.deleteForUser).toHaveBeenCalledWith(userId, 'alert-uuid');
  });

  it('throws 404 when alert is not found', async () => {
    const repo = createRepositoryStub();
    repo.deleteForUser.mockResolvedValue(false);
    const service = new AlertsService(repo);

    const error = await service.deleteAlert(userId, 'nonexistent').catch((e) => e);

    expect(error).toBeInstanceOf(AlertsError);
    expect((error as AlertsError).statusCode).toBe(404);
  });
});

describe('AlertsService — resetAlert', () => {
  it('resets a triggered alert and returns the updated record with chartTitle', async () => {
    const repo = createRepositoryStub();
    const service = new AlertsService(repo);

    const result = await service.resetAlert(userId, 'alert-uuid');

    expect(result.status).toBe('active');
    expect(result.chartTitle).toBe('Bitcoin Rainbow Price Chart');
  });

  it('throws 404 when alert is not in triggered state', async () => {
    const repo = createRepositoryStub();
    repo.resetForUser.mockResolvedValue(null);
    const service = new AlertsService(repo);

    const error = await service.resetAlert(userId, 'alert-uuid').catch((e) => e);

    expect(error).toBeInstanceOf(AlertsError);
    expect((error as AlertsError).statusCode).toBe(404);
  });
});
