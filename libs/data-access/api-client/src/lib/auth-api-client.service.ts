import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  languagePreference: 'en' | 'hu';
  fullName?: string;
}

export interface RegisterResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
    role: 'administrator' | 'premium_user' | 'free_user';
    languagePreference: 'en' | 'hu';
  };
}

interface CsrfTokenResponse {
  csrfToken: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class AuthApiClient {
  private readonly http = inject(HttpClient);
  private csrfToken?: string;

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    return this.postWithCsrf<RegisterResponse>('/api/auth/register', request);
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    return this.postWithCsrf<LoginResponse>('/api/auth/login', request);
  }

  startGoogleLogin(): void {
    window.location.assign('/api/auth/google');
  }

  private async postWithCsrf<TResponse>(
    url: string,
    body: unknown,
  ): Promise<TResponse> {
    try {
      const csrfToken = await this.getCsrfToken();

      return await firstValueFrom(
        this.http.post<TResponse>(url, body, {
          headers: { 'x-csrf-token': csrfToken },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<CsrfTokenResponse>('/api/csrf-token', {
          withCredentials: true,
        }),
      );
      this.csrfToken = response.csrfToken;
      return response.csrfToken;
    } catch (error) {
      throw toApiClientError(error);
    }
  }
}

function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const serverMessage =
      typeof error.error === 'object' &&
      error.error !== null &&
      'error' in error.error &&
      typeof error.error.error === 'string'
        ? error.error.error
        : undefined;

    return new ApiClientError(
      serverMessage ?? 'The request could not be completed. Please try again.',
      error.status,
    );
  }

  return new ApiClientError('The request could not be completed. Please try again.');
}
