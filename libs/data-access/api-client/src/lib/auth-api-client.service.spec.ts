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
});

function waitForRequestQueue(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
