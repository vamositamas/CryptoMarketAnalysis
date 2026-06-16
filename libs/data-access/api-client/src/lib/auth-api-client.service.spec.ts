import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthApiClient } from './auth-api-client.service';

describe('AuthApiClient', () => {
  let client: AuthApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthApiClient, provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(AuthApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('fetches a CSRF token before registration', async () => {
    const promise = client.register({
      email: 'user@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      languagePreference: 'en',
    });

    const csrfRequest = http.expectOne('/api/csrf-token');
    expect(csrfRequest.request.withCredentials).toBe(true);
    csrfRequest.flush({ csrfToken: 'csrf-token' });
    await waitForRequestQueue();

    const registerRequest = http.expectOne('/api/auth/register');
    expect(registerRequest.request.method).toBe('POST');
    expect(registerRequest.request.headers.get('x-csrf-token')).toBe('csrf-token');
    expect(registerRequest.request.withCredentials).toBe(true);
    registerRequest.flush({ message: 'ok' });

    await expect(promise).resolves.toEqual({ message: 'ok' });
  });

  it('reuses the CSRF token for later auth requests', async () => {
    const registerPromise = client.register({
      email: 'user@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      languagePreference: 'en',
    });
    http.expectOne('/api/csrf-token').flush({ csrfToken: 'csrf-token' });
    await waitForRequestQueue();
    http.expectOne('/api/auth/register').flush({ message: 'ok' });
    await registerPromise;

    const loginPromise = client.login({
      email: 'user@example.com',
      password: 'SecurePass123!',
    });
    await waitForRequestQueue();
    const loginRequest = http.expectOne('/api/auth/login');
    expect(loginRequest.request.headers.get('x-csrf-token')).toBe('csrf-token');
    loginRequest.flush({
      accessToken: 'jwt-token',
      user: {
        id: 'user-id',
        email: 'user@example.com',
        role: 'free_user',
        languagePreference: 'en',
      },
    });

    await expect(loginPromise).resolves.toMatchObject({ accessToken: 'jwt-token' });
  });

  it('normalizes API error responses', async () => {
    const promise = client.login({
      email: 'user@example.com',
      password: 'wrong',
    });

    http.expectOne('/api/csrf-token').flush({ csrfToken: 'csrf-token' });
    await waitForRequestQueue();
    http
      .expectOne('/api/auth/login')
      .flush({ error: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toMatchObject({
      message: 'Invalid email or password',
      statusCode: 401,
    });
  });

  it('requests password reset with CSRF protection', async () => {
    const promise = client.requestPasswordReset({ email: 'user@example.com' });

    http.expectOne('/api/csrf-token').flush({ csrfToken: 'csrf-token' });
    await waitForRequestQueue();

    const resetRequest = http.expectOne('/api/auth/password-reset/request');
    expect(resetRequest.request.method).toBe('POST');
    expect(resetRequest.request.headers.get('x-csrf-token')).toBe('csrf-token');
    resetRequest.flush({
      message: "If that email exists, we've sent password reset instructions",
    });

    await expect(promise).resolves.toEqual({
      message: "If that email exists, we've sent password reset instructions",
    });
  });

  it('validates password reset tokens without requiring CSRF', async () => {
    const promise = client.validatePasswordResetToken('reset-token');

    const validateRequest = http.expectOne(
      '/api/auth/password-reset/validate?token=reset-token',
    );
    expect(validateRequest.request.method).toBe('GET');
    validateRequest.flush({ valid: true });

    await expect(promise).resolves.toEqual({ valid: true });
  });

  it('fetches the current user profile without requiring CSRF', async () => {
    const promise = client.getCurrentUserProfile();

    const profileRequest = http.expectOne('/api/users/me');
    expect(profileRequest.request.method).toBe('GET');
    expect(profileRequest.request.withCredentials).toBe(true);
    profileRequest.flush({
      id: 'user-id',
      email: 'user@example.com',
      fullName: 'Ada Analyst',
      languagePreference: 'en',
      role: 'free_user',
      emailVerified: true,
      onboardingCompleted: false,
      createdAt: '2026-06-11T10:00:00.000Z',
    });

    await expect(promise).resolves.toMatchObject({
      id: 'user-id',
      email: 'user@example.com',
    });
  });

  it('updates the current user profile with CSRF protection', async () => {
    const promise = client.updateCurrentUserProfile({
      fullName: 'John Doe',
      languagePreference: 'hu',
    });

    http.expectOne('/api/csrf-token').flush({ csrfToken: 'csrf-token' });
    await waitForRequestQueue();

    const profileRequest = http.expectOne('/api/users/me');
    expect(profileRequest.request.method).toBe('PATCH');
    expect(profileRequest.request.headers.get('x-csrf-token')).toBe('csrf-token');
    expect(profileRequest.request.body).toEqual({
      fullName: 'John Doe',
      languagePreference: 'hu',
    });
    profileRequest.flush({
      id: 'user-id',
      email: 'user@example.com',
      fullName: 'John Doe',
      languagePreference: 'hu',
      role: 'free_user',
      emailVerified: true,
      onboardingCompleted: false,
      createdAt: '2026-06-11T10:00:00.000Z',
    });

    await expect(promise).resolves.toMatchObject({
      fullName: 'John Doe',
      languagePreference: 'hu',
    });
  });

  it('changes the current user password with CSRF protection', async () => {
    const promise = client.changeCurrentUserPassword({
      currentPassword: 'CurrentPass123!',
      newPassword: 'NewPass123!',
    });

    http.expectOne('/api/csrf-token').flush({ csrfToken: 'csrf-token' });
    await waitForRequestQueue();

    const passwordRequest = http.expectOne('/api/users/me/change-password');
    expect(passwordRequest.request.method).toBe('POST');
    expect(passwordRequest.request.headers.get('x-csrf-token')).toBe('csrf-token');
    passwordRequest.flush({
      message: 'Password changed successfully. Please log in again.',
    });

    await expect(promise).resolves.toEqual({
      message: 'Password changed successfully. Please log in again.',
    });
  });

  it('marks current user onboarding completed with CSRF protection', async () => {
    const promise = client.completeCurrentUserOnboarding();

    http.expectOne('/api/csrf-token').flush({ csrfToken: 'csrf-token' });
    await waitForRequestQueue();

    const onboardingRequest = http.expectOne('/api/users/me/complete-onboarding');
    expect(onboardingRequest.request.method).toBe('POST');
    expect(onboardingRequest.request.headers.get('x-csrf-token')).toBe('csrf-token');
    expect(onboardingRequest.request.body).toEqual({});
    onboardingRequest.flush({
      id: 'user-id',
      email: 'user@example.com',
      fullName: 'Ada Analyst',
      languagePreference: 'en',
      role: 'free_user',
      emailVerified: true,
      onboardingCompleted: true,
      createdAt: '2026-06-11T10:00:00.000Z',
    });

    await expect(promise).resolves.toMatchObject({
      onboardingCompleted: true,
    });
  });

  it('fetches Bitcoin Rainbow chart data without requiring CSRF', async () => {
    const promise = client.getBitcoinRainbowChartData('all');

    const chartRequest = http.expectOne('/api/charts/bitcoin-rainbow?timeframe=all');
    expect(chartRequest.request.method).toBe('GET');
    expect(chartRequest.request.withCredentials).toBe(true);
    chartRequest.flush({
      chartId: 'bitcoin-rainbow',
      title: 'Bitcoin Rainbow Price Chart',
      timeframe: 'all',
      dataPoints: [{ date: '2026-06-10', priceUsd: 67234.5, rainbowBand: 5 }],
      lastUpdated: '2026-06-10T00:05:23.000Z',
    });

    await expect(promise).resolves.toMatchObject({
      chartId: 'bitcoin-rainbow',
      dataPoints: [{ date: '2026-06-10', priceUsd: 67234.5, rainbowBand: 5 }],
    });
  });

  it('fetches Pi Cycle Top chart data without requiring CSRF', async () => {
    const promise = client.getPiCycleTopChartData('all');

    const chartRequest = http.expectOne('/api/charts/pi-cycle-top?timeframe=all');
    expect(chartRequest.request.method).toBe('GET');
    expect(chartRequest.request.withCredentials).toBe(true);
    chartRequest.flush({
      chartId: 'pi-cycle-top',
      title: 'Pi Cycle Top Indicator',
      timeframe: 'all',
      dataPoints: [
        {
          date: '2026-06-10',
          priceUsd: 67234.5,
          ma111: 65000,
          ma350x2: 63000,
        },
      ],
      lastUpdated: '2026-06-10T00:05:23.000Z',
    });

    await expect(promise).resolves.toMatchObject({
      chartId: 'pi-cycle-top',
      dataPoints: [{ date: '2026-06-10', ma111: 65000, ma350x2: 63000 }],
    });
  });

  it('fetches Stock-to-Flow chart data without requiring CSRF', async () => {
    const promise = client.getStockToFlowChartData('all');

    const chartRequest = http.expectOne('/api/charts/stock-to-flow?timeframe=all');
    expect(chartRequest.request.method).toBe('GET');
    expect(chartRequest.request.withCredentials).toBe(true);
    chartRequest.flush({
      chartId: 'stock-to-flow',
      title: 'Stock-to-Flow Model',
      timeframe: 'all',
      dataPoints: [
        {
          date: '2026-06-10',
          priceUsd: 67234.5,
          stockToFlowRatio: 56.2,
          modelPrice: 62000,
        },
      ],
      lastUpdated: '2026-06-10T00:05:23.000Z',
    });

    await expect(promise).resolves.toMatchObject({
      chartId: 'stock-to-flow',
      dataPoints: [{ date: '2026-06-10', stockToFlowRatio: 56.2, modelPrice: 62000 }],
    });
  });

  it('manages chart annotations with authenticated requests', async () => {
    const listPromise = client.getChartAnnotations('bitcoin-rainbow');
    const listRequest = http.expectOne('/api/users/me/annotations?chartId=bitcoin-rainbow');
    expect(listRequest.request.method).toBe('GET');
    listRequest.flush([]);
    await expect(listPromise).resolves.toEqual([]);

    const createPromise = client.createChartAnnotation({
      chartId: 'bitcoin-rainbow',
      type: 'note',
      date: '2026-06-10',
      priceLevel: 70000,
      text: 'Resistance',
      color: '#FFEB3B',
    });
    http.expectOne('/api/csrf-token').flush({ csrfToken: 'csrf-token' });
    await waitForRequestQueue();
    const createRequest = http.expectOne('/api/users/me/annotations');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.headers.get('x-csrf-token')).toBe('csrf-token');
    createRequest.flush({
      id: 'annotation-id',
      userId: 'user-id',
      chartId: 'bitcoin-rainbow',
      type: 'note',
      date: '2026-06-10',
      priceLevel: 70000,
      text: 'Resistance',
      color: '#FFEB3B',
      createdAt: '2026-06-10T00:00:00.000Z',
    });
    await expect(createPromise).resolves.toMatchObject({ id: 'annotation-id' });

    const deletePromise = client.deleteChartAnnotation('annotation-id');
    await waitForRequestQueue();
    const deleteRequest = http.expectOne('/api/users/me/annotations/annotation-id');
    expect(deleteRequest.request.method).toBe('DELETE');
    expect(deleteRequest.request.headers.get('x-csrf-token')).toBe('csrf-token');
    deleteRequest.flush(null, { status: 204, statusText: 'No Content' });
    await expect(deletePromise).resolves.toBeUndefined();
  });
});

function waitForRequestQueue(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
