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

export interface RequestPasswordResetRequest {
  email: string;
}

export interface RequestPasswordResetResponse {
  message: string;
}

export interface ValidatePasswordResetTokenResponse {
  valid: boolean;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  fullName?: string;
  languagePreference: 'en' | 'hu';
  role: 'administrator' | 'premium_user' | 'free_user';
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface UpdateUserProfileRequest {
  fullName?: string;
  languagePreference?: 'en' | 'hu';
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export type RefreshFrequency = 'daily' | 'hourly' | 'manual';
export type HistoricalDepth = '1_year' | '2_years' | '5_years' | 'all_time';

export interface DataRefreshConfigurationResponse {
  refreshFrequency: RefreshFrequency;
  historicalDepth: HistoricalDepth;
  lastRefresh: {
    timestamp: string | null;
    status: 'success' | 'failed' | 'never';
  };
}

export interface UpdateDataRefreshConfigurationRequest {
  refreshFrequency?: RefreshFrequency;
  historicalDepth?: HistoricalDepth;
}

export interface ManualDataRefreshResponse {
  success: true;
  date: string;
  dataPoints: number;
  source: 'coingecko' | 'blockchain-info';
  executionTimeMs: number;
}

export type ChartTimeframe = '1m' | '3m' | '6m' | '1y' | '2y' | 'all';

export interface BitcoinRainbowChartDataPoint {
  date: string;
  priceUsd: number;
  rainbowBand: number | null;
}

export interface BitcoinRainbowChartResponse {
  chartId: 'bitcoin-rainbow';
  title: 'Bitcoin Rainbow Price Chart';
  timeframe: ChartTimeframe;
  dataPoints: BitcoinRainbowChartDataPoint[];
  lastUpdated: string | null;
}

export interface PiCycleTopChartDataPoint {
  date: string;
  priceUsd: number;
  ma111: number | null;
  ma350x2: number | null;
}

export interface PiCycleTopChartResponse {
  chartId: 'pi-cycle-top';
  title: 'Pi Cycle Top Indicator';
  timeframe: ChartTimeframe;
  dataPoints: PiCycleTopChartDataPoint[];
  lastUpdated: string | null;
}

export interface StockToFlowChartDataPoint {
  date: string;
  priceUsd: number;
  stockToFlowRatio: number | null;
  modelPrice: number | null;
}

export interface StockToFlowChartResponse {
  chartId: 'stock-to-flow';
  title: 'Stock-to-Flow Model';
  timeframe: ChartTimeframe;
  dataPoints: StockToFlowChartDataPoint[];
  lastUpdated: string | null;
}

export type ChartAnnotation =
  | {
      id: string;
      userId: string;
      chartId: string;
      type: 'note';
      date: string;
      priceLevel: number;
      text: string;
      color: string;
      createdAt: string;
    }
  | {
      id: string;
      userId: string;
      chartId: string;
      type: 'trendline';
      startDate: string;
      startPrice: number;
      endDate: string;
      endPrice: number;
      color: string;
      createdAt: string;
    };

export type CreateChartAnnotationRequest =
  | {
      chartId: string;
      type: 'note';
      date: string;
      priceLevel: number;
      text: string;
      color: string;
    }
  | {
      chartId: string;
      type: 'trendline';
      startDate: string;
      startPrice: number;
      endDate: string;
      endPrice: number;
      color: string;
    };

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

  async requestPasswordReset(
    request: RequestPasswordResetRequest,
  ): Promise<RequestPasswordResetResponse> {
    return this.postWithCsrf<RequestPasswordResetResponse>(
      '/api/auth/password-reset/request',
      request,
    );
  }

  async validatePasswordResetToken(
    token: string,
  ): Promise<ValidatePasswordResetTokenResponse> {
    try {
      return await firstValueFrom(
        this.http.get<ValidatePasswordResetTokenResponse>(
          '/api/auth/password-reset/validate',
          {
            params: { token },
            withCredentials: true,
          },
        ),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    return this.postWithCsrf<ResetPasswordResponse>(
      '/api/auth/password-reset/confirm',
      request,
    );
  }

  async getCurrentUserProfile(): Promise<UserProfileResponse> {
    try {
      return await firstValueFrom(
        this.http.get<UserProfileResponse>('/api/users/me', {
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async updateCurrentUserProfile(
    request: UpdateUserProfileRequest,
  ): Promise<UserProfileResponse> {
    return this.patchWithCsrf<UserProfileResponse>('/api/users/me', request);
  }

  async changeCurrentUserPassword(
    request: ChangePasswordRequest,
  ): Promise<ChangePasswordResponse> {
    return this.postWithCsrf<ChangePasswordResponse>(
      '/api/users/me/change-password',
      request,
    );
  }

  async completeCurrentUserOnboarding(): Promise<UserProfileResponse> {
    return this.postWithCsrf<UserProfileResponse>(
      '/api/users/me/complete-onboarding',
      {},
    );
  }

  async getDataRefreshConfiguration(): Promise<DataRefreshConfigurationResponse> {
    try {
      return await firstValueFrom(
        this.http.get<DataRefreshConfigurationResponse>(
          '/api/admin/data-configuration',
          { withCredentials: true },
        ),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async updateDataRefreshConfiguration(
    request: UpdateDataRefreshConfigurationRequest,
  ): Promise<DataRefreshConfigurationResponse> {
    return this.patchWithCsrf<DataRefreshConfigurationResponse>(
      '/api/admin/data-configuration',
      request,
    );
  }

  async runDataRefreshNow(): Promise<ManualDataRefreshResponse> {
    return this.postWithCsrf<ManualDataRefreshResponse>(
      '/api/admin/data-configuration/refresh-now',
      {},
    );
  }

  async getBitcoinRainbowChartData(
    timeframe: ChartTimeframe,
  ): Promise<BitcoinRainbowChartResponse> {
    try {
      return await firstValueFrom(
        this.http.get<BitcoinRainbowChartResponse>('/api/charts/bitcoin-rainbow', {
          params: { timeframe },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getPiCycleTopChartData(timeframe: ChartTimeframe): Promise<PiCycleTopChartResponse> {
    try {
      return await firstValueFrom(
        this.http.get<PiCycleTopChartResponse>('/api/charts/pi-cycle-top', {
          params: { timeframe },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getStockToFlowChartData(timeframe: ChartTimeframe): Promise<StockToFlowChartResponse> {
    try {
      return await firstValueFrom(
        this.http.get<StockToFlowChartResponse>('/api/charts/stock-to-flow', {
          params: { timeframe },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getChartAnnotations(chartId: string): Promise<ChartAnnotation[]> {
    try {
      return await firstValueFrom(
        this.http.get<ChartAnnotation[]>('/api/users/me/annotations', {
          params: { chartId },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async createChartAnnotation(
    request: CreateChartAnnotationRequest,
  ): Promise<ChartAnnotation> {
    return this.postWithCsrf<ChartAnnotation>('/api/users/me/annotations', request);
  }

  async deleteChartAnnotation(annotationId: string): Promise<void> {
    try {
      const csrfToken = await this.getCsrfToken();
      await firstValueFrom(
        this.http.delete<void>(`/api/users/me/annotations/${annotationId}`, {
          headers: { 'x-csrf-token': csrfToken },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
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

  private async patchWithCsrf<TResponse>(
    url: string,
    body: unknown,
  ): Promise<TResponse> {
    try {
      const csrfToken = await this.getCsrfToken();

      return await firstValueFrom(
        this.http.patch<TResponse>(url, body, {
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
