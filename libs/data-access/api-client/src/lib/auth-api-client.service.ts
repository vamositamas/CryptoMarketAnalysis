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

export interface RequestEmailVerificationRequest {
  email: string;
}

export interface RequestEmailVerificationResponse {
  message: string;
  verificationUrl?: string;
}

export interface VerifyEmailCodeRequest {
  email: string;
  code: string;
}

export interface VerifyEmailCodeResponse {
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

export interface MvrvZScoreChartDataPoint {
  date: string;
  priceUsd: number;
  mvrvZScore: number | null;
}

export interface MvrvZScoreChartResponse {
  chartId: 'mvrv-z-score';
  title: 'MVRV Z-Score';
  timeframe: ChartTimeframe;
  dataPoints: MvrvZScoreChartDataPoint[];
  lastUpdated: string | null;
}

export interface PuellMultipleChartDataPoint {
  date: string;
  priceUsd: number;
}

export interface PuellMultipleChartResponse {
  chartId: 'puell-multiple';
  title: 'Puell Multiple';
  timeframe: ChartTimeframe;
  dataPoints: PuellMultipleChartDataPoint[];
  lastUpdated: string | null;
}

export interface VddMultipleChartDataPoint {
  date: string;
  priceUsd: number;
  vddMultiple: number | null;
}

export interface VddMultipleChartResponse {
  chartId: 'vdd-multiple';
  title: 'VDD Multiple';
  timeframe: ChartTimeframe;
  dataPoints: VddMultipleChartDataPoint[];
  lastUpdated: string | null;
}

export interface TwoYrMaMultiplierDataPoint {
  date: string;
  priceUsd: number;
  ma730: number | null;
  ma730x2: number | null;
  ma730x3: number | null;
  ma730x4: number | null;
  ma730x5: number | null;
}

export interface TwoYrMaMultiplierChartResponse {
  chartId: '2yr-ma-multiplier';
  title: string;
  timeframe: string;
  dataPoints: TwoYrMaMultiplierDataPoint[];
  lastUpdated: string | null;
}

export interface RealizePriceChartDataPoint {
  date: string;
  priceUsd: number;
  realizedPrice: number | null;
  mvrvRatio: number | null;
}

export interface RealizePriceChartResponse {
  chartId: 'realized-price';
  title: string;
  timeframe: string;
  dataPoints: RealizePriceChartDataPoint[];
  lastUpdated: string | null;
}

export interface StockToIncomeDataPoint {
  date: string;
  priceUsd: number | null;
  modelPrice: number | null;
  upperBand: number | null;
  lowerBand: number | null;
  s2iRatio: number | null;
}

export interface StockToIncomeChartResponse {
  chartId: 'stock-to-income';
  title: string;
  timeframe: string;
  dataPoints: StockToIncomeDataPoint[];
  regressionA: number;
  regressionB: number;
  sigma: number;
  lastUpdated: string | null;
}

export interface PriceForecastDataPoint {
  date: string;
  priceUsd: number;
  topCap: number | null;
  deltaTop: number | null;
  cvdd: number | null;
  balancedPrice: number | null;
  terminalPrice: number | null;
}

export interface PriceForecastChartResponse {
  chartId: 'price-forecast-tools';
  title: string;
  timeframe: string;
  dataPoints: PriceForecastDataPoint[];
  lastUpdated: string | null;
}

export interface MayerMultipleChartResponse {
  chartId: 'mayer-multiple';
  title: string;
  timeframe: string;
  dataPoints: { date: string; priceUsd: number; ma200: number | null; mayerMultiple: number | null; }[];
  lastUpdated: string | null;
}

export interface TwoHundredWeekMAHeatmapChartResponse {
  chartId: '200-week-ma-heatmap';
  title: string;
  timeframe: string;
  dataPoints: { date: string; priceUsd: number; ma200w: number | null; multiplier: number | null; }[];
  lastUpdated: string | null;
}

export interface FearGreedIndexChartResponse {
  chartId: 'fear-greed-index';
  title: string;
  timeframe: string;
  dataPoints: { date: string; priceUsd: number; fearGreedValue: number | null; }[];
  lastUpdated: string | null;
}

export interface HashRibbonsChartResponse {
  chartId: 'hash-ribbons';
  title: string;
  timeframe: string;
  dataPoints: { date: string; priceUsd: number; ma30: number | null; ma60: number | null; isBuySignal: boolean; }[];
  lastUpdated: string | null;
}

export interface DifficultyRibbonChartResponse {
  chartId: 'difficulty-ribbon';
  title: string;
  timeframe: string;
  dataPoints: { date: string; priceUsd: number; ma9: number | null; ma14: number | null; ma25: number | null; ma40: number | null; ma60: number | null; ma90: number | null; ma128: number | null; ma200: number | null; }[];
  lastUpdated: string | null;
}

export interface NvtRatioChartResponse {
  chartId: 'nvt-ratio';
  title: string;
  timeframe: string;
  dataPoints: { date: string; priceUsd: number; nvtRatio: number | null; nvtSignal: number | null; }[];
  lastUpdated: string | null;
}

export interface ThermocapMultipleChartResponse {
  chartId: 'thermocap-multiple';
  title: string;
  timeframe: string;
  dataPoints: { date: string; priceUsd: number; thermocapMultiple: number | null; }[];
  lastUpdated: string | null;
}

export interface ExcessLiquidityChartResponse {
  chartId: 'excess-liquidity';
  title: string;
  timeframe: string;
  dataPoints: { date: string; yieldCurve1yChange: number | null; excessLiquidityLeading: number | null; }[];
  lastUpdated: string | null;
}

export interface SpxLiquidityChartResponse {
  chartId: 'spx-liquidity';
  title: string;
  timeframe: string;
  dataPoints: { date: string; spxYoyChange: number | null; excessLiquidityLeading: number | null; }[];
  lastUpdated: string | null;
}

export interface MidtermCyclesChartResponse {
  chartId: 'midterm-cycles';
  title: string;
  dataPoints: { date: string; btcRsi12m: number | null; spxRsi12m: number | null; cfnai: number | null; }[];
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

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  value: number | null;
  formattedValue: string;
  trend: 'up' | 'down' | 'flat';
  trendPercent: number | null;
  lastUpdated: string | null;
}

export interface DashboardWidgetsResponse {
  widgets: DashboardWidget[];
}

export interface CreatePredefinedWidgetRequest {
  widgetType: string;
  widgetConfig: { title: string; decimals: number };
}

export interface CreateCustomWidgetRequest {
  widgetType: 'custom';
  widgetConfig: { title: string; formula: string; description?: string };
}

export type CreateDashboardWidgetRequest = CreatePredefinedWidgetRequest | CreateCustomWidgetRequest;

export type AlertCondition = 'crosses_above' | 'crosses_below' | 'greater_than' | 'less_than' | 'equals';
export type AlertStatus = 'active' | 'triggered' | 'paused';

export interface AlertLimit {
  used: number;
  max: number | null;
  unlimited: boolean;
}

export interface AlertWithTitle {
  id: string;
  chartId: string;
  chartTitle: string;
  metricName: string;
  condition: AlertCondition;
  thresholdValue: number;
  alertName: string;
  status: AlertStatus;
  createdAt: string;
  lastEvaluatedAt: string | null;
  triggeredAt: string | null;
}

export interface AlertsListResponse {
  alerts: AlertWithTitle[];
  alertLimit: AlertLimit;
}

export interface CreateAlertRequest {
  chartId: string;
  metricName: string;
  condition: AlertCondition;
  thresholdValue: number;
  alertName: string;
}

export interface AlertResponse {
  id: string;
  chartId: string;
  metricName: string;
  condition: AlertCondition;
  thresholdValue: number;
  alertName: string;
  status: 'active' | 'triggered' | 'paused';
  createdAt: string;
  lastEvaluatedAt: string | null;
  triggeredAt: string | null;
}

export interface EmailTemplate {
  key: string;
  label: string;
  value: string;
  isCustom: boolean;
  updatedAt: string | null;
  variables: string[];
  language?: 'en' | 'hu';
  kind?: 'html' | 'subject';
}

export interface EmailTemplatesResponse {
  templates: EmailTemplate[];
}

export interface EmailTestDelivery {
  provider: 'smtp';
  accepted: string[];
  rejected: string[];
  pending?: string[];
  response?: string;
  messageId?: string;
}

export interface SendTestEmailResponse {
  success: boolean;
  message: string;
  delivery?: EmailTestDelivery;
}

export interface RecentChart {
  chartId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  viewedAt: string;
}

export interface RecentChartsResponse {
  recentCharts: RecentChart[];
}

export interface FavouriteChart {
  chartId: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface FavouriteChartsResponse {
  favouriteCharts: FavouriteChart[];
}

export interface ToggleFavouriteResponse {
  chartId: string;
  isFavourite: boolean;
}

export type DonationStatus = 'pending' | 'completed' | 'cancelled' | 'refunded';

export interface InitiateDonationRequest {
  amount: number;
  currency?: string;
}

export interface InitiateDonationResponse {
  donationId: string;
  approvalUrl: string;
}

export interface DonationDetailsResponse {
  id: string;
  amount: number;
  currency: string;
  status: DonationStatus;
  userUpgraded: boolean;
  transactionId: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AdminUserRecord {
  id: string;
  fullName: string | null;
  email: string;
  role: 'administrator' | 'premium_user' | 'free_user';
  emailVerified: boolean;
  onboardingCompleted: boolean;
  languagePreference: 'en' | 'hu';
  createdAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
}

export interface AdminUsersResponse {
  users: AdminUserRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUpdateUserRequest {
  fullName?: string | null;
  role?: 'administrator' | 'premium_user' | 'free_user';
  emailVerified?: boolean;
  onboardingCompleted?: boolean;
  languagePreference?: 'en' | 'hu';
}

export interface AuditLogRecord {
  id: string;
  adminUserId: string;
  actionType: string;
  targetType: string;
  targetId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AdminAuditLogsResponse {
  logs: AuditLogRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface ChartConfigRecord {
  id: string;
  chartId: string;
  title: string;
  category: string;
  accessTier: 'free' | 'premium';
  description: string | null;
  methodology: string | null;
  status: 'draft' | 'active' | 'inactive';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminChartsResponse {
  charts: ChartConfigRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminCreateChartRequest {
  chartId: string;
  title: string;
  category: string;
  accessTier: 'free' | 'premium';
  description?: string | null;
  methodology?: string | null;
  status: 'draft' | 'active' | 'inactive';
}

// ── Trading Plans types ──────────────────────────────────────────────────────

export type PlanDirection = 'long' | 'short' | 'neutral';
export type PlanStatus = 'active' | 'closed' | 'cancelled';

export interface TradingPlanRecord {
  id: string;
  userId: string;
  title: string;
  direction: PlanDirection;
  entryPrice: number;
  targetPrice: number | null;
  stopLoss: number | null;
  positionSizeUsd: number | null;
  riskPercent: number | null;
  expiryDate: string | null;
  notes: string | null;
  status: PlanStatus;
  closePrice: number | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTradingPlanRequest {
  title: string;
  direction: PlanDirection;
  entryPrice: number;
  targetPrice?: number | null;
  stopLoss?: number | null;
  positionSizeUsd?: number | null;
  riskPercent?: number | null;
  expiryDate?: string | null;
  notes?: string | null;
}

export type SignalZone = 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish' | 'no_data';

export interface SignalScore {
  name: string;
  label: string;
  value: number | null;
  formattedValue: string;
  score: number;
  maxScore: number;
  interpretation: string;
  zone: SignalZone;
}

export interface SignalSummary {
  totalScore: number;
  maxPossibleScore: number;
  normalizedScore: number;
  overallZone: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
  overallLabel: string;
  btcPriceUsd: number | null;
  signals: SignalScore[];
  lastUpdated: string | null;
  fearGreedMissing: boolean;
}

export interface PriceTarget {
  label: string;
  model: string;
  priceUsd: number;
  description: string;
  timeframe: string;
}

export interface ProjectionScenario {
  scenario: 'bear' | 'base' | 'bull' | 'ultra_bull';
  label: string;
  color: string;
  targets: PriceTarget[];
}

export interface PriceProjectionsResponse {
  btcPriceUsd: number | null;
  scenarios: ProjectionScenario[];
  historicalPoints: { date: string; priceUsd: number }[];
  lastUpdated: string | null;
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

  async requestEmailVerification(
    request: RequestEmailVerificationRequest,
  ): Promise<RequestEmailVerificationResponse> {
    return this.postWithCsrf<RequestEmailVerificationResponse>(
      '/api/auth/verify/resend',
      request,
    );
  }

  async verifyEmailCode(request: VerifyEmailCodeRequest): Promise<VerifyEmailCodeResponse> {
    return this.postWithCsrf<VerifyEmailCodeResponse>('/api/auth/verify/code', request);
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

  async initHistoricalData(startDate: string, endDate: string): Promise<{ fetchedDays: number; failedRanges: unknown[] }> {
    return this.postWithCsrf('/api/admin/data-configuration/init-historical', { startDate, endDate });
  }

  async backfillMetric(metric: 'vdd' | 'miner-fees' | 'price-forecast' | 'fear-greed' | 'hash-rate' | 'difficulty' | 'transaction-volume' | 'miners-revenue'): Promise<{ inserted: number }> {
    return this.postWithCsrf(`/api/admin/data-configuration/backfill-${metric}`, {});
  }

  async triggerDashboardRefresh(): Promise<ManualDataRefreshResponse> {
    return this.postWithCsrf<ManualDataRefreshResponse>('/api/dashboard/refresh', {});
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

  async getMvrvZScoreChartData(timeframe: ChartTimeframe): Promise<MvrvZScoreChartResponse> {
    try {
      return await firstValueFrom(
        this.http.get<MvrvZScoreChartResponse>('/api/charts/mvrv-z-score', {
          params: { timeframe },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getPuellMultipleChartData(timeframe: ChartTimeframe): Promise<PuellMultipleChartResponse> {
    try {
      return await firstValueFrom(
        this.http.get<PuellMultipleChartResponse>('/api/charts/puell-multiple', {
          params: { timeframe },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getVddMultipleChartData(timeframe: ChartTimeframe): Promise<VddMultipleChartResponse> {
    try {
      return await firstValueFrom(
        this.http.get<VddMultipleChartResponse>('/api/charts/vdd-multiple', {
          params: { timeframe },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getTwoYrMaMultiplierChartData(timeframe: ChartTimeframe): Promise<TwoYrMaMultiplierChartResponse> {
    try {
      return await firstValueFrom(
        this.http.get<TwoYrMaMultiplierChartResponse>('/api/charts/2yr-ma-multiplier', {
          params: { timeframe },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getRealizePriceChartData(timeframe: ChartTimeframe): Promise<RealizePriceChartResponse> {
    try {
      return await firstValueFrom(
        this.http.get<RealizePriceChartResponse>('/api/charts/realized-price', {
          params: { timeframe },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getStockToIncomeChartData(timeframe: ChartTimeframe): Promise<StockToIncomeChartResponse> {
    try {
      return await firstValueFrom(
        this.http.get<StockToIncomeChartResponse>('/api/charts/stock-to-income', {
          params: { timeframe },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getPriceForecastChartData(timeframe: ChartTimeframe): Promise<PriceForecastChartResponse> {
    try {
      return await firstValueFrom(
        this.http.get<PriceForecastChartResponse>('/api/charts/price-forecast-tools', {
          params: { timeframe },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getMayerMultipleChartData(timeframe: ChartTimeframe): Promise<MayerMultipleChartResponse> {
    try {
      return await firstValueFrom(this.http.get<MayerMultipleChartResponse>('/api/charts/mayer-multiple', { params: { timeframe }, withCredentials: true }));
    } catch (error) { throw toApiClientError(error); }
  }

  async get200WeekMAHeatmapChartData(timeframe: ChartTimeframe): Promise<TwoHundredWeekMAHeatmapChartResponse> {
    try {
      return await firstValueFrom(this.http.get<TwoHundredWeekMAHeatmapChartResponse>('/api/charts/200-week-ma-heatmap', { params: { timeframe }, withCredentials: true }));
    } catch (error) { throw toApiClientError(error); }
  }

  async getFearGreedIndexChartData(timeframe: ChartTimeframe): Promise<FearGreedIndexChartResponse> {
    try {
      return await firstValueFrom(this.http.get<FearGreedIndexChartResponse>('/api/charts/fear-greed-index', { params: { timeframe }, withCredentials: true }));
    } catch (error) { throw toApiClientError(error); }
  }

  async getHashRibbonsChartData(timeframe: ChartTimeframe): Promise<HashRibbonsChartResponse> {
    try {
      return await firstValueFrom(this.http.get<HashRibbonsChartResponse>('/api/charts/hash-ribbons', { params: { timeframe }, withCredentials: true }));
    } catch (error) { throw toApiClientError(error); }
  }

  async getDifficultyRibbonChartData(timeframe: ChartTimeframe): Promise<DifficultyRibbonChartResponse> {
    try {
      return await firstValueFrom(this.http.get<DifficultyRibbonChartResponse>('/api/charts/difficulty-ribbon', { params: { timeframe }, withCredentials: true }));
    } catch (error) { throw toApiClientError(error); }
  }

  async getNvtRatioChartData(timeframe: ChartTimeframe): Promise<NvtRatioChartResponse> {
    try {
      return await firstValueFrom(this.http.get<NvtRatioChartResponse>('/api/charts/nvt-ratio', { params: { timeframe }, withCredentials: true }));
    } catch (error) { throw toApiClientError(error); }
  }

  async getThermocapMultipleChartData(timeframe: ChartTimeframe): Promise<ThermocapMultipleChartResponse> {
    try {
      return await firstValueFrom(this.http.get<ThermocapMultipleChartResponse>('/api/charts/thermocap-multiple', { params: { timeframe }, withCredentials: true }));
    } catch (error) { throw toApiClientError(error); }
  }

  async getExcessLiquidityChartData(timeframe: ChartTimeframe): Promise<ExcessLiquidityChartResponse> {
    try {
      return await firstValueFrom(this.http.get<ExcessLiquidityChartResponse>('/api/charts/excess-liquidity', { params: { timeframe }, withCredentials: true }));
    } catch (error) { throw toApiClientError(error); }
  }

  async getSpxLiquidityChartData(timeframe: ChartTimeframe): Promise<SpxLiquidityChartResponse> {
    try {
      return await firstValueFrom(this.http.get<SpxLiquidityChartResponse>('/api/charts/spx-liquidity', { params: { timeframe }, withCredentials: true }));
    } catch (error) { throw toApiClientError(error); }
  }

  async getMidtermCyclesChartData(): Promise<MidtermCyclesChartResponse> {
    try {
      return await firstValueFrom(this.http.get<MidtermCyclesChartResponse>('/api/charts/midterm-cycles', { withCredentials: true }));
    } catch (error) { throw toApiClientError(error); }
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

  async getDashboardWidgets(): Promise<DashboardWidgetsResponse> {
    try {
      return await firstValueFrom(
        this.http.get<DashboardWidgetsResponse>('/api/dashboard/widgets', {
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async createDashboardWidget(request: CreateDashboardWidgetRequest): Promise<DashboardWidget> {
    return this.postWithCsrf<DashboardWidget>('/api/dashboard/widgets', request);
  }

  async reorderDashboardWidgets(orderedIds: string[]): Promise<void> {
    await this.patchWithCsrf<{ success: boolean }>('/api/dashboard/widgets/reorder', { orderedIds });
  }

  async deleteDashboardWidget(widgetId: string): Promise<void> {
    await this.deleteWithCsrf(`/api/dashboard/widgets/${widgetId}`);
  }

  async getLivePrice(): Promise<{ priceUsd: number; change24hPercent: number | null; fetchedAt: string }> {
    try {
      return await firstValueFrom(
        this.http.get<{ priceUsd: number; change24hPercent: number | null; fetchedAt: string }>(
          '/api/dashboard/live-price',
          { withCredentials: true },
        ),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async getAlerts(): Promise<AlertsListResponse> {
    try {
      return await firstValueFrom(
        this.http.get<AlertsListResponse>('/api/alerts', { withCredentials: true }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async createAlert(request: CreateAlertRequest): Promise<AlertResponse> {
    return this.postWithCsrf<AlertResponse>('/api/alerts', request);
  }

  async deleteAlert(alertId: string): Promise<void> {
    try {
      const csrfToken = await this.getCsrfToken();
      await firstValueFrom(
        this.http.delete<void>(`/api/alerts/${alertId}`, {
          headers: { 'x-csrf-token': csrfToken },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async resetAlert(alertId: string): Promise<AlertWithTitle> {
    return this.patchWithCsrf<AlertWithTitle>(`/api/alerts/${alertId}/reset`, {});
  }

  async updateAlert(alertId: string, data: Partial<{ alertName: string; condition: string; thresholdValue: number; status: string }>): Promise<AlertWithTitle> {
    return this.patchWithCsrf<AlertWithTitle>(`/api/alerts/${alertId}`, data);
  }

  async getEmailConfig(): Promise<{ provider: string; apiKeyConfigured: boolean; fromEmail: string | null; appUrl: string }> {
    try {
      return await firstValueFrom(
        this.http.get<{ provider: string; apiKeyConfigured: boolean; fromEmail: string | null; appUrl: string }>(
          '/api/admin/email-config', { withCredentials: true },
        ),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  async getEmailSettings(): Promise<{ fromAddress: string; appUrl: string; adminEmail: string; smtpHost: string; smtpPort: string; smtpUser: string; smtpPasswordConfigured: boolean }> {
    try {
      return await firstValueFrom(
        this.http.get<{ fromAddress: string; appUrl: string; adminEmail: string; smtpHost: string; smtpPort: string; smtpUser: string; smtpPasswordConfigured: boolean }>(
          '/api/admin/email-settings', { withCredentials: true },
        ),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  async saveEmailSettings(data: { fromAddress?: string; appUrl?: string; adminEmail?: string; smtpHost?: string; smtpPort?: string; smtpUser?: string; smtpPassword?: string }): Promise<{ success: boolean }> {
    try {
      const csrfToken = await this.getCsrfToken();
      return await firstValueFrom(
        this.http.put<{ success: boolean }>('/api/admin/email-settings', data, {
          headers: { 'x-csrf-token': csrfToken },
          withCredentials: true,
        }),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  async getEmailTemplates(): Promise<EmailTemplatesResponse> {
    try {
      return await firstValueFrom(
        this.http.get<EmailTemplatesResponse>('/api/admin/email-templates', { withCredentials: true }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async updateEmailTemplate(key: string, value: string): Promise<EmailTemplate> {
    try {
      const csrfToken = await this.getCsrfToken();
      return await firstValueFrom(
        this.http.put<EmailTemplate>(`/api/admin/email-templates/${key}`, { value }, {
          headers: { 'x-csrf-token': csrfToken },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async resetEmailTemplate(key: string): Promise<EmailTemplate> {
    try {
      const csrfToken = await this.getCsrfToken();
      return await firstValueFrom(
        this.http.delete<EmailTemplate>(`/api/admin/email-templates/${key}`, {
          headers: { 'x-csrf-token': csrfToken },
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async initiateDonation(request: InitiateDonationRequest): Promise<InitiateDonationResponse> {
    return this.postWithCsrf<InitiateDonationResponse>('/api/donations/initiate', request);
  }

  async getDonationDetails(donationId: string): Promise<DonationDetailsResponse> {
    try {
      return await firstValueFrom(
        this.http.get<DonationDetailsResponse>(`/api/donations/${donationId}`, {
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async recordRecentChart(chartId: string): Promise<void> {
    await this.postWithCsrf<{ success: boolean }>('/api/users/me/recent-charts', { chartId });
  }

  async getRecentCharts(): Promise<RecentChartsResponse> {
    try {
      return await firstValueFrom(
        this.http.get<RecentChartsResponse>('/api/users/me/recent-charts', {
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  async toggleFavouriteChart(chartId: string): Promise<ToggleFavouriteResponse> {
    return this.postWithCsrf<ToggleFavouriteResponse>('/api/users/me/favourite-charts', { chartId });
  }

  async getFavouriteCharts(): Promise<FavouriteChartsResponse> {
    try {
      return await firstValueFrom(
        this.http.get<FavouriteChartsResponse>('/api/users/me/favourite-charts', {
          withCredentials: true,
        }),
      );
    } catch (error) {
      throw toApiClientError(error);
    }
  }

  // ── Admin: User Management ──────────────────────────────────────────────────

  async adminListUsers(params?: {
    page?: number; limit?: number; search?: string; role?: string; show?: string;
  }): Promise<AdminUsersResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.role) query.set('role', params.role);
    if (params?.show) query.set('show', params.show);
    const qs = query.toString();
    try {
      return await firstValueFrom(
        this.http.get<AdminUsersResponse>(`/api/admin/users${qs ? `?${qs}` : ''}`, { withCredentials: true }),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  async adminUpdateUser(userId: string, params: AdminUpdateUserRequest): Promise<AdminUserRecord> {
    return this.patchWithCsrf<AdminUserRecord>(`/api/admin/users/${userId}`, params);
  }

  async adminDeleteUser(userId: string): Promise<{ success: boolean }> {
    try {
      const csrfToken = await this.getCsrfToken();
      return await firstValueFrom(
        this.http.delete<{ success: boolean }>(`/api/admin/users/${userId}`, {
          headers: { 'x-csrf-token': csrfToken }, withCredentials: true,
        }),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  async adminHardDeleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const csrfToken = await this.getCsrfToken();
      return await firstValueFrom(
        this.http.delete<{ success: boolean; message: string }>(`/api/admin/users/${userId}/permanent`, {
          headers: { 'x-csrf-token': csrfToken }, withCredentials: true,
        }),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  async adminRestoreUser(userId: string): Promise<AdminUserRecord> {
    return this.patchWithCsrf<AdminUserRecord>(`/api/admin/users/${userId}/restore`, {});
  }

  async adminVerifyUserEmail(userId: string): Promise<AdminUserRecord> {
    return this.postWithCsrf<AdminUserRecord>(`/api/admin/users/${userId}/verify-email`, {});
  }

  async adminForcePasswordReset(userId: string): Promise<{ success: boolean; message: string }> {
    return this.postWithCsrf<{ success: boolean; message: string }>(
      `/api/admin/users/${userId}/force-password-reset`, {},
    );
  }

  // ── Admin: Audit Logs ───────────────────────────────────────────────────────

  async adminListAuditLogs(params?: {
    page?: number; limit?: number; actionType?: string; targetType?: string;
  }): Promise<AdminAuditLogsResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.actionType) query.set('actionType', params.actionType);
    if (params?.targetType) query.set('targetType', params.targetType);
    const qs = query.toString();
    try {
      return await firstValueFrom(
        this.http.get<AdminAuditLogsResponse>(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`, { withCredentials: true }),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  // ── Admin: Chart Management ─────────────────────────────────────────────────

  async adminListCharts(params?: { page?: number; limit?: number; status?: string }): Promise<AdminChartsResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    try {
      return await firstValueFrom(
        this.http.get<AdminChartsResponse>(`/api/admin/charts${qs ? `?${qs}` : ''}`, { withCredentials: true }),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  async adminCreateChart(data: AdminCreateChartRequest): Promise<ChartConfigRecord> {
    return this.postWithCsrf<ChartConfigRecord>('/api/admin/charts', data);
  }

  async adminUpdateChart(chartId: string, data: Partial<AdminCreateChartRequest>): Promise<ChartConfigRecord> {
    return this.patchWithCsrf<ChartConfigRecord>(`/api/admin/charts/${chartId}`, data);
  }

  async adminDeleteChart(chartId: string): Promise<{ success: boolean }> {
    try {
      const csrfToken = await this.getCsrfToken();
      return await firstValueFrom(
        this.http.delete<{ success: boolean }>(`/api/admin/charts/${chartId}`, {
          headers: { 'x-csrf-token': csrfToken }, withCredentials: true,
        }),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  // ── Admin: Email Template Preview & Test ────────────────────────────────────

  async adminPreviewEmailTemplate(key: string, sampleData?: Record<string, string>): Promise<{ html: string }> {
    return this.postWithCsrf<{ html: string }>(`/api/admin/email-templates/${key}/preview`, { sampleData });
  }

  async adminSendTestEmail(key: string, recipientEmail: string, sampleData?: Record<string, string>): Promise<SendTestEmailResponse> {
    return this.postWithCsrf<SendTestEmailResponse>(
      `/api/admin/email-templates/${key}/send-test`, { recipientEmail, sampleData },
    );
  }

  // ── Trading Plans ───────────────────────────────────────────────────────────

  async getTradingSignals(): Promise<SignalSummary> {
    try {
      return await firstValueFrom(
        this.http.get<SignalSummary>('/api/trading-plans/signals', { withCredentials: true }),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  async getPriceProjections(): Promise<PriceProjectionsResponse> {
    try {
      return await firstValueFrom(
        this.http.get<PriceProjectionsResponse>('/api/trading-plans/projections', { withCredentials: true }),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  async listTradingPlans(): Promise<{ plans: TradingPlanRecord[] }> {
    try {
      return await firstValueFrom(
        this.http.get<{ plans: TradingPlanRecord[] }>('/api/trading-plans', { withCredentials: true }),
      );
    } catch (error) { throw toApiClientError(error); }
  }

  async createTradingPlan(input: CreateTradingPlanRequest): Promise<TradingPlanRecord> {
    return this.postWithCsrf<TradingPlanRecord>('/api/trading-plans', input);
  }

  async closeTradingPlan(planId: string, closePrice: number): Promise<TradingPlanRecord> {
    return this.patchWithCsrf<TradingPlanRecord>(`/api/trading-plans/${planId}/close`, { closePrice });
  }

  async cancelTradingPlan(planId: string): Promise<TradingPlanRecord> {
    return this.patchWithCsrf<TradingPlanRecord>(`/api/trading-plans/${planId}/cancel`, {});
  }

  async deleteTradingPlan(planId: string): Promise<{ success: boolean }> {
    try {
      const csrfToken = await this.getCsrfToken();
      return await firstValueFrom(
        this.http.delete<{ success: boolean }>(`/api/trading-plans/${planId}`, {
          headers: { 'x-csrf-token': csrfToken }, withCredentials: true,
        }),
      );
    } catch (error) { throw toApiClientError(error); }
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

  private async deleteWithCsrf(url: string): Promise<void> {
    try {
      const csrfToken = await this.getCsrfToken();

      await firstValueFrom(
        this.http.delete(url, {
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
