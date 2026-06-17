import jwt from 'jsonwebtoken';
import type { Request, Response, Router } from 'express';
import { createAdminRouter } from './admin.route';
import { createAlertsRouter } from './alerts.route';
import { createDashboardRouter } from './dashboard.route';
import { DashboardError } from '../services/dashboard.service';
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
    const response = createResponse();

    await runHandlers(
      getHandler(createAdminRouter(tokenInvalidations), '/users'),
      createRequest(createToken('administrator')),
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ users: [] });
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

  it('allows authenticated users to create alerts', async () => {
    const response = createResponse();

  await runHandlers(
      getHandler(createAlertsRouter(tokenInvalidations), '/', 'post'),
      createRequest(createToken('free_user')),
      response,
    );

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ message: 'Alert creation will be implemented next.' });
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
    const dashboardService = { getWidgets: jest.fn(), addWidget: jest.fn(), reorderWidgets: jest.fn() };
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
      addWidget: jest.fn().mockRejectedValue(new DashboardError('Maximum 20 widgets per dashboard', 400)),
      reorderWidgets: jest.fn(),
    };
    const response = createResponse();

    await runHandlers(
      getHandler(createDashboardRouter({ dashboardService }, tokenInvalidations), '/widgets', 'post'),
      createRequest(createToken('free_user'), { widgetType: 'hash_rate' }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Maximum 20 widgets per dashboard' });
  });

  it('reorders dashboard widgets for the authenticated user', async () => {
    const dashboardService = {
      getWidgets: jest.fn(),
      addWidget: jest.fn(),
      reorderWidgets: jest.fn().mockResolvedValue(undefined),
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
});
