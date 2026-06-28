import jwt from 'jsonwebtoken';
import type { Request, Response, Router } from 'express';
import { createAdminRouter } from './admin.route';
import { createAlertsRouter } from './alerts.route';
import { createDashboardRouter } from './dashboard.route';
import { createDonationsRouter } from './donations.route';
import { DashboardError } from '../services/dashboard.service';
import { RecentChartsError } from '../services/recent-charts.service';
import type { TokenInvalidationReader } from '../middleware/rbac.middleware';
import { createUsersRouter } from './users.route';

type Handler = (req: Request, res: Response, next: jest.Mock) => Promise<void> | void;

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response as Response & typeof response;
}

function createRequest(token?: string, body?: unknown): Request {
  const headers = new Map<string, string>();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  return {
    body,
    headers: Object.fromEntries(headers),
    get(name: string) {
      return headers.get(name.toLowerCase());
    },
  } as unknown as Request;
}

function createToken(role: 'administrator' | 'premium_user' | 'free_user'): string {
  return jwt.sign(
    {
      userId: 'user-id',
      email: 'user@example.com',
      role,
      languagePreference: 'en',
    },
    'test-jwt-secret',
  );
}

function getHandler(router: Router, path: string, method = 'get'): Handler[] {
  const layer = router.stack.find(
    (entry) =>
      entry.route?.path === path &&
      ((entry.route as unknown as { methods: Record<string, boolean> }).methods[method]),
  );

  if (!layer?.route?.stack) {
    throw new Error(`${path} route not found`);
  }

  return layer.route.stack.map((entry) => entry.handle as Handler);
}

async function runHandlers(handlers: Handler[], req: Request, res: Response): Promise<void> {
  for (const handler of handlers) {
    let shouldContinue = false;
    await handler(req, res, jest.fn(() => (shouldContinue = true)));

    if (!shouldContinue) {
      return;
    }
  }
}

describe('protected route wiring', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const tokenInvalidations: TokenInvalidationReader = {
    findLatestInvalidationForUser: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('allows administrators to list admin users', async () => {
    const userManagementService = {
      listUsers: jest.fn().mockResolvedValue({ users: [], total: 0, page: 1, limit: 50 }),
      getUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      hardDeleteUser: jest.fn(),
      restoreUser: jest.fn(),
      verifyUserEmail: jest.fn(),
      forcePasswordReset: jest.fn(),
    };
    const response = createResponse();
    const req = { ...createRequest(createToken('administrator')), query: {} } as unknown as import('express').Request;

    await runHandlers(
      getHandler(createAdminRouter({ userManagementService, tokenInvalidations }), '/users'),
      req,
      response,
    );

    expect(response.statusCode).toBe(200);
    expect((response.body as { users: unknown[] }).users).toEqual([]);
  });

  it('rejects non-admin users from admin routes', async () => {
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter(tokenInvalidations), '/users'),
      createRequest(createToken('free_user')),
      response,
    );

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: 'Insufficient permissions' });
  });

  it('allows administrators to read data refresh configuration', async () => {
    const dataRefreshConfigurationService = {
      getConfiguration: jest.fn().mockResolvedValue({
        refreshFrequency: 'daily',
        historicalDepth: 'all_time',
        lastRefresh: { timestamp: '2026-06-09T00:05:23.000Z', status: 'success' },
      }),
      updateConfiguration: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(
        createAdminRouter({ dataRefreshConfigurationService, tokenInvalidations }),
        '/data-configuration',
      ),
      createRequest(createToken('administrator')),
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      refreshFrequency: 'daily',
      historicalDepth: 'all_time',
    });
  });

  it('allows administrators to update data refresh configuration', async () => {
    const dataRefreshConfigurationService = {
      getConfiguration: jest.fn(),
      updateConfiguration: jest.fn().mockResolvedValue({
        refreshFrequency: 'manual',
        historicalDepth: '1_year',
        lastRefresh: { timestamp: null, status: 'never' },
      }),
    };
    const response = createResponse();
    const requestBody = { refreshFrequency: 'manual', historicalDepth: '1_year' };

    await runHandlers(
      getHandler(
        createAdminRouter({ dataRefreshConfigurationService, tokenInvalidations }),
        '/data-configuration',
        'patch',
      ),
      createRequest(createToken('administrator'), requestBody),
      response,
    );

    expect(dataRefreshConfigurationService.updateConfiguration).toHaveBeenCalledWith(requestBody);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      refreshFrequency: 'manual',
      historicalDepth: '1_year',
    });
  });

  it('allows administrators to manually trigger data refresh', async () => {
    const dailyDataRefreshService = {
      run: jest.fn().mockResolvedValue({
        success: true,
        date: '2026-06-09',
        dataPoints: 1,
        source: 'coingecko',
      }),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(
        createAdminRouter({ dailyDataRefreshService, tokenInvalidations }),
        '/data-configuration/refresh-now',
        'post',
      ),
      createRequest(createToken('administrator')),
      response,
    );

    expect(dailyDataRefreshService.run).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ success: true, dataPoints: 1 });
  });

  it('allows administrators to list email templates', async () => {
    const emailTemplateRepository = {
      getTemplate: jest.fn(),
      setTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
      listTemplates: jest.fn().mockResolvedValue(new Map()),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ emailTemplateRepository, tokenInvalidations }), '/email-templates'),
      createRequest(createToken('administrator')),
      response,
    );

    expect(response.statusCode).toBe(200);
    expect((response.body as { templates: unknown[] }).templates).toHaveLength(12);
    expect((response.body as { templates: { key: string }[] }).templates[0].key).toBe('alert_triggered_en_html');
  });

  it('allows administrators to update an email template', async () => {
    const customValue = '<p>custom</p>';
    const emailTemplateRepository = {
      getTemplate: jest.fn(),
      setTemplate: jest.fn().mockResolvedValue({ key: 'alert_triggered_en_html', value: customValue, updatedAt: '2026-06-17T08:00:00.000Z' }),
      deleteTemplate: jest.fn(),
      listTemplates: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ emailTemplateRepository, tokenInvalidations }), '/email-templates/:key', 'put'),
      { ...createRequest(createToken('administrator'), { value: customValue }), params: { key: 'alert_triggered_en_html' } } as unknown as import('express').Request,
      response,
    );

    expect(emailTemplateRepository.setTemplate).toHaveBeenCalledWith('alert_triggered_en_html', customValue);
    expect(response.statusCode).toBe(200);
    expect((response.body as { isCustom: boolean }).isCustom).toBe(true);
  });

  it('allows administrators to reset an email template to default', async () => {
    const emailTemplateRepository = {
      getTemplate: jest.fn(),
      setTemplate: jest.fn(),
      deleteTemplate: jest.fn().mockResolvedValue(true),
      listTemplates: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ emailTemplateRepository, tokenInvalidations }), '/email-templates/:key', 'delete'),
      { ...createRequest(createToken('administrator')), params: { key: 'alert_triggered_en_html' } } as unknown as import('express').Request,
      response,
    );

    expect(emailTemplateRepository.deleteTemplate).toHaveBeenCalledWith('alert_triggered_en_html');
    expect(response.statusCode).toBe(200);
    expect((response.body as { isCustom: boolean }).isCustom).toBe(false);
  });

  it('allows authenticated users to create alerts and returns 201 with the alert record', async () => {
    const alertRecord = {
      id: 'alert-uuid',
      userId: 'user-id',
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
    const alertsService = { createAlert: jest.fn().mockResolvedValue(alertRecord), listAlerts: jest.fn(), deleteAlert: jest.fn(), resetAlert: jest.fn(), updateAlert: jest.fn() };
    const response = createResponse();
    const body = {
      chartId: 'bitcoin-rainbow',
      metricName: 'rainbow_band',
      condition: 'crosses_above',
      thresholdValue: 7.5,
      alertName: 'Rainbow alert',
    };

    await runHandlers(
      getHandler(createAlertsRouter({ alertsService }, tokenInvalidations), '/', 'post'),
      createRequest(createToken('free_user'), body),
      response,
    );

    expect(alertsService.createAlert).toHaveBeenCalledWith('user-id', 'free_user', body);
    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual(alertRecord);
  });

  it('returns 403 when a free user exceeds the alert limit', async () => {
    const { AlertsError } = await import('../services/alerts.service');
    const alertsService = {
      createAlert: jest.fn().mockRejectedValue(
        new AlertsError('Free users can create maximum 5 alerts. Upgrade to Premium for unlimited alerts.', 403),
      ),
      listAlerts: jest.fn(),
      deleteAlert: jest.fn(),
      resetAlert: jest.fn(),
      updateAlert: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createAlertsRouter({ alertsService }, tokenInvalidations), '/', 'post'),
      createRequest(createToken('free_user'), { chartId: 'bitcoin-rainbow', metricName: 'x', condition: 'equals', thresholdValue: 1, alertName: 'x' }),
      response,
    );

    expect(response.statusCode).toBe(403);
    expect((response.body as { error: string }).error).toContain('Free users');
  });

  it('rejects unauthenticated alert creation', async () => {
    const response = createResponse();

    await runHandlers(
      getHandler(createAlertsRouter(tokenInvalidations), '/', 'post'),
      createRequest(),
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
  });

  it('lists alerts with limit info', async () => {
    const listResponse = {
      alerts: [],
      alertLimit: { used: 0, max: 5, unlimited: false },
    };
    const alertsService = { listAlerts: jest.fn().mockResolvedValue(listResponse), createAlert: jest.fn(), deleteAlert: jest.fn(), resetAlert: jest.fn(), updateAlert: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAlertsRouter({ alertsService }, tokenInvalidations), '/', 'get'),
      createRequest(createToken('free_user')),
      response,
    );

    expect(alertsService.listAlerts).toHaveBeenCalledWith('user-id');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(listResponse);
  });

  it('deletes an alert and returns 200', async () => {
    const alertsService = { listAlerts: jest.fn(), createAlert: jest.fn(), deleteAlert: jest.fn().mockResolvedValue(undefined), resetAlert: jest.fn(), updateAlert: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAlertsRouter({ alertsService }, tokenInvalidations), '/:alertId', 'delete'),
      { ...createRequest(createToken('free_user')), params: { alertId: 'alert-uuid' } } as unknown as import('express').Request,
      response,
    );

    expect(alertsService.deleteAlert).toHaveBeenCalledWith('user-id', 'alert-uuid');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('resets a triggered alert and returns 200 with updated record', async () => {
    const resetResult = { id: 'alert-uuid', status: 'active', chartTitle: 'Bitcoin Rainbow Price Chart' };
    const alertsService = { listAlerts: jest.fn(), createAlert: jest.fn(), deleteAlert: jest.fn(), resetAlert: jest.fn().mockResolvedValue(resetResult), updateAlert: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAlertsRouter({ alertsService }, tokenInvalidations), '/:alertId/reset', 'patch'),
      { ...createRequest(createToken('free_user')), params: { alertId: 'alert-uuid' } } as unknown as import('express').Request,
      response,
    );

    expect(alertsService.resetAlert).toHaveBeenCalledWith('user-id', 'alert-uuid');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ status: 'active' });
  });

  it('returns the authenticated user profile', async () => {
    const userProfileService = {
      getProfile: jest.fn().mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        languagePreference: 'en',
        role: 'free_user',
        emailVerified: true,
        onboardingCompleted: false,
        createdAt: '2026-06-11T10:00:00.000Z',
      }),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      completeOnboarding: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createUsersRouter(userProfileService, tokenInvalidations), '/me'),
      createRequest(createToken('free_user')),
      response,
    );

    expect(userProfileService.getProfile).toHaveBeenCalledWith('user-id');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      id: 'user-id',
      email: 'user@example.com',
    });
  });

  it('updates the authenticated user profile', async () => {
    const userProfileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn().mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        fullName: 'John Doe',
        languagePreference: 'hu',
        role: 'free_user',
        emailVerified: true,
        onboardingCompleted: false,
        createdAt: '2026-06-11T10:00:00.000Z',
      }),
      changePassword: jest.fn(),
      completeOnboarding: jest.fn(),
    };
    const response = createResponse();
    const requestBody = { fullName: 'John Doe', languagePreference: 'hu' };

    await runHandlers(
      getHandler(createUsersRouter(userProfileService, tokenInvalidations), '/me', 'patch'),
      createRequest(createToken('free_user'), requestBody),
      response,
    );

    expect(userProfileService.updateProfile).toHaveBeenCalledWith('user-id', requestBody);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      fullName: 'John Doe',
      languagePreference: 'hu',
    });
  });

  it('changes the authenticated user password', async () => {
    const userProfileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn().mockResolvedValue({
        message: 'Password changed successfully. Please log in again.',
      }),
      completeOnboarding: jest.fn(),
    };
    const response = createResponse();
    const requestBody = {
      currentPassword: 'CurrentPass123!',
      newPassword: 'NewPass123!',
    };

    await runHandlers(
      getHandler(
        createUsersRouter(userProfileService, tokenInvalidations),
        '/me/change-password',
        'post',
      ),
      createRequest(createToken('free_user'), requestBody),
      response,
    );

    expect(userProfileService.changePassword).toHaveBeenCalledWith('user-id', requestBody);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: 'Password changed successfully. Please log in again.',
    });
  });

  it('returns dashboard widgets for the authenticated user', async () => {
    const dashboardService = {
      getWidgets: jest.fn().mockResolvedValue({
        widgets: [
          {
            id: 'widget-1',
            type: 'btc_price',
            title: 'Current BTC Price',
            value: 67234.5,
            formattedValue: '$67,234.50',
            trend: 'up',
            trendPercent: 1.87,
            lastUpdated: '2026-06-10T00:00:00.000Z',
          },
        ],
      }),
      addWidget: jest.fn(),
      reorderWidgets: jest.fn(),
      removeWidget: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createDashboardRouter({ dashboardService }, tokenInvalidations), '/widgets'),
      createRequest(createToken('free_user')),
      response,
    );

    expect(dashboardService.getWidgets).toHaveBeenCalledWith('user-id');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      widgets: [expect.objectContaining({ type: 'btc_price' })],
    });
  });

  it('rejects unauthenticated dashboard widget requests', async () => {
    const dashboardService = { getWidgets: jest.fn(), addWidget: jest.fn(), reorderWidgets: jest.fn(), removeWidget: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createDashboardRouter({ dashboardService }, tokenInvalidations), '/widgets'),
      createRequest(),
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(dashboardService.getWidgets).not.toHaveBeenCalled();
  });

  it('adds a dashboard widget for the authenticated user', async () => {
    const dashboardService = {
      getWidgets: jest.fn(),
      reorderWidgets: jest.fn(),
      removeWidget: jest.fn(),
      addWidget: jest.fn().mockResolvedValue({
        id: 'widget-2',
        type: 'ma_200_day',
        title: '200-day Moving Average',
        value: 65000.5,
        formattedValue: '$65,000.50',
        trend: 'flat',
        trendPercent: null,
        lastUpdated: '2026-06-10T00:00:00.000Z',
      }),
    };
    const response = createResponse();
    const requestBody = {
      widgetType: 'ma_200_day',
      widgetConfig: { title: '200-day Moving Average', decimals: 2 },
    };

    await runHandlers(
      getHandler(createDashboardRouter({ dashboardService }, tokenInvalidations), '/widgets', 'post'),
      createRequest(createToken('free_user'), requestBody),
      response,
    );

    expect(dashboardService.addWidget).toHaveBeenCalledWith('user-id', requestBody);
    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({ id: 'widget-2', type: 'ma_200_day' });
  });

  it('returns 400 when adding a widget fails validation', async () => {
    const dashboardService = {
      getWidgets: jest.fn(),
      addWidget: jest.fn().mockRejectedValue(new DashboardError('Maximum 40 widgets per dashboard', 400)),
      reorderWidgets: jest.fn(),
      removeWidget: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createDashboardRouter({ dashboardService }, tokenInvalidations), '/widgets', 'post'),
      createRequest(createToken('free_user'), { widgetType: 'hash_rate' }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Maximum 40 widgets per dashboard' });
  });

  it('reorders dashboard widgets for the authenticated user', async () => {
    const dashboardService = {
      getWidgets: jest.fn(),
      addWidget: jest.fn(),
      reorderWidgets: jest.fn().mockResolvedValue(undefined),
      removeWidget: jest.fn(),
    };
    const response = createResponse();
    const orderedIds = ['widget-b', 'widget-a', 'widget-c'];

    await runHandlers(
      getHandler(createDashboardRouter({ dashboardService }, tokenInvalidations), '/widgets/reorder', 'patch'),
      createRequest(createToken('free_user'), { orderedIds }),
      response,
    );

    expect(dashboardService.reorderWidgets).toHaveBeenCalledWith('user-id', orderedIds);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('returns 400 when reordering fails validation', async () => {
    const dashboardService = {
      getWidgets: jest.fn(),
      addWidget: jest.fn(),
      reorderWidgets: jest.fn().mockRejectedValue(new DashboardError('orderedIds must be a non-empty array', 400)),
      removeWidget: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createDashboardRouter({ dashboardService }, tokenInvalidations), '/widgets/reorder', 'patch'),
      createRequest(createToken('free_user'), { orderedIds: [] }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'orderedIds must be a non-empty array' });
  });

  it('records a recent chart view for the authenticated user', async () => {
    const recentChartsService = {
      recordView: jest.fn().mockResolvedValue(undefined),
      listRecent: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(
        createUsersRouter(
          { getProfile: jest.fn(), updateProfile: jest.fn(), changePassword: jest.fn(), completeOnboarding: jest.fn() },
          tokenInvalidations,
          { list: jest.fn(), create: jest.fn(), delete: jest.fn() },
          recentChartsService,
        ),
        '/me/recent-charts',
        'post',
      ),
      createRequest(createToken('free_user'), { chartId: 'bitcoin-rainbow' }),
      response,
    );

    expect(recentChartsService.recordView).toHaveBeenCalledWith('user-id', 'bitcoin-rainbow');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('returns 400 when recording an unknown chart ID', async () => {
    const recentChartsService = {
      recordView: jest.fn().mockRejectedValue(new RecentChartsError('Unknown chart', 400)),
      listRecent: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(
        createUsersRouter(
          { getProfile: jest.fn(), updateProfile: jest.fn(), changePassword: jest.fn(), completeOnboarding: jest.fn() },
          tokenInvalidations,
          { list: jest.fn(), create: jest.fn(), delete: jest.fn() },
          recentChartsService,
        ),
        '/me/recent-charts',
        'post',
      ),
      createRequest(createToken('free_user'), { chartId: 'bad-chart' }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Unknown chart' });
  });

  it('returns recent charts for the authenticated user', async () => {
    const recentChartsService = {
      recordView: jest.fn(),
      listRecent: jest.fn().mockResolvedValue({
        recentCharts: [
          {
            chartId: 'bitcoin-rainbow',
            title: 'Bitcoin Rainbow Price Chart',
            url: '/charts/bitcoin-rainbow',
            thumbnailUrl: '/assets/charts/bitcoin-rainbow-thumb.png',
            viewedAt: '2026-06-17T10:00:00.000Z',
          },
        ],
      }),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(
        createUsersRouter(
          { getProfile: jest.fn(), updateProfile: jest.fn(), changePassword: jest.fn(), completeOnboarding: jest.fn() },
          tokenInvalidations,
          { list: jest.fn(), create: jest.fn(), delete: jest.fn() },
          recentChartsService,
        ),
        '/me/recent-charts',
      ),
      createRequest(createToken('free_user')),
      response,
    );

    expect(recentChartsService.listRecent).toHaveBeenCalledWith('user-id');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      recentCharts: [expect.objectContaining({ chartId: 'bitcoin-rainbow' })],
    });
  });

  it('marks onboarding completed for the authenticated user', async () => {
    const userProfileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      completeOnboarding: jest.fn().mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        languagePreference: 'en',
        role: 'free_user',
        emailVerified: true,
        onboardingCompleted: true,
        createdAt: '2026-06-11T10:00:00.000Z',
      }),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(
        createUsersRouter(userProfileService, tokenInvalidations),
        '/me/complete-onboarding',
        'post',
      ),
      createRequest(createToken('free_user')),
      response,
    );

    expect(userProfileService.completeOnboarding).toHaveBeenCalledWith('user-id');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      onboardingCompleted: true,
    });
  });

  it('allows administrators to list donations', async () => {
    const donationsService = {
      listDonations: jest.fn().mockResolvedValue({
        donations: [
          {
            id: 'donation-uuid',
            userId: 'user-uuid',
            amount: 10,
            currency: 'USD',
            paypalOrderId: 'ORDER-123',
            paypalTransactionId: null,
            status: 'completed',
            userUpgraded: true,
            createdAt: '2026-06-18T08:00:00.000Z',
            completedAt: '2026-06-18T08:05:00.000Z',
          },
        ],
        total: 1,
      }),
      exportDonations: jest.fn(),
    };
    const response = createResponse();
    const req = { ...createRequest(createToken('administrator')), query: {} } as unknown as import('express').Request;

    await runHandlers(
      getHandler(createAdminRouter({ donationsService, tokenInvalidations }), '/donations'),
      req,
      response,
    );

    expect(donationsService.listDonations).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 50 }));
    expect(response.statusCode).toBe(200);
    expect((response.body as { donations: unknown[] }).donations).toHaveLength(1);
  });

  it('rejects non-admin from donations admin route', async () => {
    const donationsService = { listDonations: jest.fn(), exportDonations: jest.fn() };
    const response = createResponse();
    const req = { ...createRequest(createToken('free_user')), query: {} } as unknown as import('express').Request;

    await runHandlers(
      getHandler(createAdminRouter({ donationsService, tokenInvalidations }), '/donations'),
      req,
      response,
    );

    expect(response.statusCode).toBe(403);
  });

  it('allows administrators to get a specific user by id', async () => {
    const user = { id: 'user-1', email: 'alice@example.com', role: 'free_user' };
    const userManagementService = {
      listUsers: jest.fn(),
      getUser: jest.fn().mockResolvedValue(user),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      hardDeleteUser: jest.fn(),
      restoreUser: jest.fn(),
      verifyUserEmail: jest.fn(),
      forcePasswordReset: jest.fn(),
    };
    const auditLogRepository = { create: jest.fn(), list: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ userManagementService, auditLogRepository, tokenInvalidations }), '/users/:userId'),
      { ...createRequest(createToken('administrator')), params: { userId: 'user-1' } } as unknown as import('express').Request,
      response,
    );

    expect(userManagementService.getUser).toHaveBeenCalledWith('user-1');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ id: 'user-1', email: 'alice@example.com' });
  });

  it('returns 404 when updating a non-existent user', async () => {
    const { UserManagementError } = await import('../services/user-management.service');
    const userManagementService = {
      listUsers: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn().mockRejectedValue(new UserManagementError('User not found', 404)),
      deleteUser: jest.fn(),
      hardDeleteUser: jest.fn(),
      restoreUser: jest.fn(),
      verifyUserEmail: jest.fn(),
      forcePasswordReset: jest.fn(),
    };
    const auditLogRepository = { create: jest.fn(), list: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ userManagementService, auditLogRepository, tokenInvalidations }), '/users/:userId', 'patch'),
      { ...createRequest(createToken('administrator'), { role: 'premium_user' }), params: { userId: 'missing' } } as unknown as import('express').Request,
      response,
    );

    expect(response.statusCode).toBe(404);
    expect((response.body as { error: string }).error).toBe('User not found');
  });

  it('allows administrators to update a user role and logs the action', async () => {
    const updated = { id: 'user-1', role: 'premium_user' };
    const userManagementService = {
      listUsers: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn().mockResolvedValue(updated),
      deleteUser: jest.fn(),
      hardDeleteUser: jest.fn(),
      restoreUser: jest.fn(),
      verifyUserEmail: jest.fn(),
      forcePasswordReset: jest.fn(),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ userManagementService, auditLogRepository, tokenInvalidations }), '/users/:userId', 'patch'),
      { ...createRequest(createToken('administrator'), { role: 'premium_user' }), params: { userId: 'user-1' } } as unknown as import('express').Request,
      response,
    );

    expect(userManagementService.updateUser).toHaveBeenCalledWith('user-1', { role: 'premium_user' }, 'user-id');
    expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'user_edit', targetId: 'user-1' }));
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ role: 'premium_user' });
  });

  it('allows administrators to delete a user and logs the action', async () => {
    const userManagementService = {
      listUsers: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      hardDeleteUser: jest.fn(),
      restoreUser: jest.fn(),
      verifyUserEmail: jest.fn(),
      forcePasswordReset: jest.fn(),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ userManagementService, auditLogRepository, tokenInvalidations }), '/users/:userId', 'delete'),
      { ...createRequest(createToken('administrator')), params: { userId: 'user-1' } } as unknown as import('express').Request,
      response,
    );

    expect(userManagementService.deleteUser).toHaveBeenCalledWith('user-1', 'user-id');
    expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'user_delete', targetId: 'user-1' }));
    expect(response.statusCode).toBe(200);
    expect((response.body as { success: boolean }).success).toBe(true);
  });

  it('allows administrators to permanently delete a deactivated user and logs the action', async () => {
    const userManagementService = {
      listUsers: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      hardDeleteUser: jest.fn().mockResolvedValue(undefined),
      restoreUser: jest.fn(),
      verifyUserEmail: jest.fn(),
      forcePasswordReset: jest.fn(),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ userManagementService, auditLogRepository, tokenInvalidations }), '/users/:userId/permanent', 'delete'),
      { ...createRequest(createToken('administrator')), params: { userId: 'user-1' } } as unknown as import('express').Request,
      response,
    );

    expect(userManagementService.hardDeleteUser).toHaveBeenCalledWith('user-1', 'user-id');
    expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'user_hard_delete',
      changes: { deletedUserId: 'user-1' },
      targetId: null,
    }));
    expect(response.statusCode).toBe(200);
    expect((response.body as { success: boolean }).success).toBe(true);
  });

  it('allows administrators to restore a deleted user', async () => {
    const restored = { id: 'user-1', deletedAt: null };
    const userManagementService = {
      listUsers: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      hardDeleteUser: jest.fn(),
      restoreUser: jest.fn().mockResolvedValue(restored),
      verifyUserEmail: jest.fn(),
      forcePasswordReset: jest.fn(),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ userManagementService, auditLogRepository, tokenInvalidations }), '/users/:userId/restore', 'patch'),
      { ...createRequest(createToken('administrator')), params: { userId: 'user-1' } } as unknown as import('express').Request,
      response,
    );

    expect(userManagementService.restoreUser).toHaveBeenCalledWith('user-1');
    expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'user_restore' }));
    expect(response.statusCode).toBe(200);
  });

  it('allows administrators to verify a user email and logs the action', async () => {
    const verified = { id: 'user-1', email: 'alice@example.com', emailVerified: true };
    const userManagementService = {
      listUsers: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      hardDeleteUser: jest.fn(),
      restoreUser: jest.fn(),
      verifyUserEmail: jest.fn().mockResolvedValue(verified),
      forcePasswordReset: jest.fn(),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ userManagementService, auditLogRepository, tokenInvalidations }), '/users/:userId/verify-email', 'post'),
      { ...createRequest(createToken('administrator')), params: { userId: 'user-1' } } as unknown as import('express').Request,
      response,
    );

    expect(userManagementService.verifyUserEmail).toHaveBeenCalledWith('user-1');
    expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'user_verify_email',
      changes: { emailVerified: true },
      targetId: 'user-1',
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ emailVerified: true });
  });

  it('allows administrators to force a password reset', async () => {
    const userManagementService = {
      listUsers: jest.fn(),
      getUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      hardDeleteUser: jest.fn(),
      restoreUser: jest.fn(),
      verifyUserEmail: jest.fn(),
      forcePasswordReset: jest.fn().mockResolvedValue({ email: 'alice@example.com' }),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ userManagementService, auditLogRepository, tokenInvalidations }), '/users/:userId/force-password-reset', 'post'),
      { ...createRequest(createToken('administrator')), params: { userId: 'user-1' } } as unknown as import('express').Request,
      response,
    );

    expect(userManagementService.forcePasswordReset).toHaveBeenCalledWith('user-1');
    expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'user_force_password_reset' }));
    expect(response.statusCode).toBe(200);
    expect((response.body as { success: boolean }).success).toBe(true);
  });

  it('allows administrators to list charts', async () => {
    const chartConfigRepository = {
      list: jest.fn().mockResolvedValue({ charts: [{ id: 'chart-1', chartId: 'mvrv-z-score' }], total: 1 }),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const response = createResponse();
    const req = { ...createRequest(createToken('administrator')), query: {} } as unknown as import('express').Request;

    await runHandlers(
      getHandler(createAdminRouter({ chartConfigRepository, tokenInvalidations }), '/charts'),
      req,
      response,
    );

    expect(chartConfigRepository.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 50 }));
    expect(response.statusCode).toBe(200);
    expect((response.body as { charts: unknown[] }).charts).toHaveLength(1);
  });

  it('allows administrators to create a chart and logs the action', async () => {
    const created = { id: 'chart-1', chartId: 'mvrv-z-score', title: 'MVRV', status: 'draft', createdAt: '2024-01-01T00:00:00.000Z' };
    const chartConfigRepository = {
      list: jest.fn(),
      getById: jest.fn(),
      create: jest.fn().mockResolvedValue(created),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    const response = createResponse();
    const body = { chartId: 'mvrv-z-score', title: 'MVRV', category: 'Valuation', accessTier: 'free', status: 'draft' };

    await runHandlers(
      getHandler(createAdminRouter({ chartConfigRepository, auditLogRepository, tokenInvalidations }), '/charts', 'post'),
      createRequest(createToken('administrator'), body),
      response,
    );

    expect(chartConfigRepository.create).toHaveBeenCalledWith(expect.objectContaining({ chartId: 'mvrv-z-score' }));
    expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'chart_create' }));
    expect(response.statusCode).toBe(201);
  });

  it('allows administrators to delete a chart and logs the action', async () => {
    const chartConfigRepository = {
      list: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(true),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ chartConfigRepository, auditLogRepository, tokenInvalidations }), '/charts/:chartId', 'delete'),
      { ...createRequest(createToken('administrator')), params: { chartId: 'chart-1' } } as unknown as import('express').Request,
      response,
    );

    expect(chartConfigRepository.delete).toHaveBeenCalledWith('chart-1');
    expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'chart_delete' }));
    expect(response.statusCode).toBe(200);
    expect((response.body as { success: boolean }).success).toBe(true);
  });

  it('allows administrators to list audit logs', async () => {
    const auditLogRepository = {
      create: jest.fn(),
      list: jest.fn().mockResolvedValue({ logs: [{ id: 'log-1', actionType: 'user_edit', createdAt: '2024-01-01T00:00:00.000Z' }], total: 1 }),
    };
    const response = createResponse();
    const req = { ...createRequest(createToken('administrator')), query: {} } as unknown as import('express').Request;

    await runHandlers(
      getHandler(createAdminRouter({ auditLogRepository, tokenInvalidations }), '/audit-logs'),
      req,
      response,
    );

    expect(auditLogRepository.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 50 }));
    expect(response.statusCode).toBe(200);
    expect((response.body as { logs: unknown[] }).logs).toHaveLength(1);
  });

  it('allows administrators to preview an email template with sample data', async () => {
    const emailTemplateRepository = {
      getTemplate: jest.fn().mockResolvedValue('<p>Hello {{alertName}}</p>'),
      setTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
      listTemplates: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ emailTemplateRepository, tokenInvalidations }), '/email-templates/:key/preview', 'post'),
      { ...createRequest(createToken('administrator'), {}), params: { key: 'alert_triggered_en_html' } } as unknown as import('express').Request,
      response,
    );

    expect(response.statusCode).toBe(200);
    expect((response.body as { html: string }).html).toContain('MVRV Overbought');
  });

  it('returns 404 when previewing a non-existent template key', async () => {
    const emailTemplateRepository = { getTemplate: jest.fn(), setTemplate: jest.fn(), deleteTemplate: jest.fn(), listTemplates: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ emailTemplateRepository, tokenInvalidations }), '/email-templates/:key/preview', 'post'),
      { ...createRequest(createToken('administrator'), {}), params: { key: 'unknown_key' } } as unknown as import('express').Request,
      response,
    );

    expect(response.statusCode).toBe(404);
  });

  it('validates recipientEmail when sending a test email', async () => {
    const emailTemplateRepository = { getTemplate: jest.fn(), setTemplate: jest.fn(), deleteTemplate: jest.fn(), listTemplates: jest.fn() };
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter({ emailTemplateRepository, tokenInvalidations }), '/email-templates/:key/send-test', 'post'),
      { ...createRequest(createToken('administrator'), { recipientEmail: 'not-an-email' }), params: { key: 'alert_triggered_en_html' } } as unknown as import('express').Request,
      response,
    );

    expect(response.statusCode).toBe(400);
    expect((response.body as { error: string }).error).toContain('recipientEmail');
  });

  it('allows authenticated users to initiate a donation', async () => {
    const donationsService = {
      initiate: jest.fn().mockResolvedValue({ donationId: 'donation-uuid', approvalUrl: 'https://paypal.com/checkout' }),
      handleSuccess: jest.fn(),
      handleCancel: jest.fn(),
      getDonation: jest.fn(),
      listDonations: jest.fn(),
      exportDonations: jest.fn(),
    };
    const response = createResponse();
    const req = {
      ...createRequest(createToken('free_user'), { amount: 10, currency: 'USD' }),
      protocol: 'https',
      headers: { authorization: `Bearer ${createToken('free_user')}` },
      get: (h: string) => (h === 'host' ? 'localhost' : h === 'authorization' ? `Bearer ${createToken('free_user')}` : undefined),
    } as unknown as import('express').Request;

    await runHandlers(
      getHandler(createDonationsRouter(donationsService as never, tokenInvalidations), '/initiate', 'post'),
      req,
      response,
    );

    expect(donationsService.initiate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-id', amount: 10, currency: 'USD' }),
    );
    expect(response.statusCode).toBe(201);
    expect((response.body as { approvalUrl: string }).approvalUrl).toBe('https://paypal.com/checkout');
  });
});
