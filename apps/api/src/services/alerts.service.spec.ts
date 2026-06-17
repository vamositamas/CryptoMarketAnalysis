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

  it('blocks free users at the 5-alert limit with 403', async () => {
    const repo = createRepositoryStub();
    repo.countActiveForUser.mockResolvedValue(5);
    const service = new AlertsService(repo);

    const error = await service.createAlert(userId, 'free_user', validBody).catch((e) => e);

    expect(error).toBeInstanceOf(AlertsError);
    expect((error as AlertsError).statusCode).toBe(403);
    expect((error as AlertsError).message).toContain('Free users can create maximum 5 alerts');
  });

  it('does not check the limit for premium users', async () => {
    const repo = createRepositoryStub();
    repo.countActiveForUser.mockResolvedValue(100);
    const service = new AlertsService(repo);

    await expect(service.createAlert(userId, 'premium_user', validBody)).resolves.toEqual(alertRecord);
    expect(repo.countActiveForUser).not.toHaveBeenCalled();
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
