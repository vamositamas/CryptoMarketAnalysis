import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Route, Router, RouterLink } from '@angular/router';
import {
  ApiClientError,
  AuthApiClient,
  type DataRefreshConfigurationResponse,
  type HistoricalDepth,
  type RefreshFrequency,
} from '@crypto-market-analysis/data-access/api-client';
import { OnboardingCarouselComponent } from './components/onboarding-carousel/onboarding-carousel.component';
import { roleGuard } from './guards/role.guard';
import { AuthSessionService } from './services/auth-session.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [OnboardingCarouselComponent],
  template: `
    <section class="content-section">
      <div class="section-heading">
        <p class="eyebrow" i18n="Dashboard eyebrow@@dashboard.eyebrow">
          Model overview
        </p>
        <h2 i18n="Dashboard title@@dashboard.title">Bitcoin cycle dashboard</h2>
      </div>
      <div class="model-grid">
        <article>
          <span>MVRV Z-Score</span>
          <strong>1.84</strong>
          <small i18n="MVRV summary@@dashboard.mvrvSummary">
            Valuation stretch is below overheated territory.
          </small>
        </article>
        <article>
          <span>Bitcoin Rainbow</span>
          <strong>Green</strong>
          <small i18n="Rainbow summary@@dashboard.rainbowSummary">
            Price sits in the accumulation-to-fair-value band.
          </small>
        </article>
        <article>
          <span>Pi Cycle Top</span>
          <strong>Clear</strong>
          <small i18n="Pi Cycle summary@@dashboard.piCycleSummary">
            Moving averages have not produced a top signal.
          </small>
        </article>
      </div>

      @if (showOnboarding()) {
        <div
          class="onboarding-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Onboarding"
          i18n-aria-label="Onboarding dialog label@@onboarding.dialog"
        >
          <app-onboarding-carousel
            (skipped)="completeOnboarding()"
            (completed)="completeOnboarding()"
          ></app-onboarding-carousel>
        </div>
      }
    </section>
  `,
})
export class DashboardPage {
  private readonly auth = inject(AuthApiClient);
  private readonly authSession = inject(AuthSessionService);
  protected readonly showOnboarding = signal(false);

  constructor() {
    void this.checkOnboardingStatus();
  }

  protected async completeOnboarding(): Promise<void> {
    try {
      const profile = await this.auth.completeCurrentUserOnboarding();
      this.authSession.setCurrentUser(profile);
      this.showOnboarding.set(false);
    } catch {
      this.showOnboarding.set(true);
    }
  }

  private async checkOnboardingStatus(): Promise<void> {
    try {
      const profile = await this.auth.getCurrentUserProfile();
      this.authSession.setCurrentUser(profile);
      this.showOnboarding.set(!profile.onboardingCompleted);
    } catch {
      this.showOnboarding.set(false);
    }
  }
}

@Component({
  selector: 'app-charts-page',
  template: `
    <section class="content-section">
      <div class="section-heading">
        <p class="eyebrow" i18n="Chart library eyebrow@@charts.eyebrow">
          Chart library
        </p>
        <h2 i18n="Chart library title@@charts.title">Tracked Bitcoin models</h2>
      </div>
      <div class="chart-list">
        <a href="/docs/specificaton/MVRVZ-Score.md">MVRV Z-Score</a>
        <a href="/docs/specificaton/BitcoinRainbowPriceChartIndicator.md">Bitcoin Rainbow Price Chart</a>
        <a href="/docs/specificaton/PiCycleTopIndicator.md">Pi Cycle Top Indicator</a>
        <a href="/docs/specificaton/Stock-to-FlowModel.md">Stock-to-Flow Model</a>
        <a href="/docs/specificaton/RealizedPrice.md">Realized Price</a>
      </div>
    </section>
  `,
})
export class ChartsPage {}

@Component({
  selector: 'app-admin-users-page',
  template: `
    <section class="content-section">
      <div class="section-heading">
        <p class="eyebrow" i18n="Admin eyebrow@@admin.eyebrow">Admin</p>
        <h2 i18n="User management title@@admin.usersTitle">User management</h2>
      </div>
      <div class="model-grid">
        <article>
          <span i18n="Users label@@admin.users">Users</span>
          <strong i18n="Ready status@@status.ready">Ready</strong>
          <small i18n="Admin user access summary@@admin.usersSummary">
            Administrative user list API access is role protected.
          </small>
        </article>
      </div>
    </section>
  `,
})
export class AdminUsersPage {}

@Component({
  selector: 'app-admin-data-configuration-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="content-section admin-config-section">
      <div class="section-heading">
        <p class="eyebrow" i18n="Admin data configuration eyebrow@@adminDataConfig.eyebrow">
          Admin
        </p>
        <h2 i18n="Data configuration title@@adminDataConfig.title">
          Data refresh configuration
        </h2>
      </div>

      <form class="admin-config-form" [formGroup]="form" (ngSubmit)="save()">
        <fieldset>
          <legend i18n="Refresh frequency legend@@adminDataConfig.refreshFrequency">
            Refresh frequency
          </legend>
          <label>
            <input type="radio" formControlName="refreshFrequency" value="daily" />
            <span i18n="Daily frequency option@@adminDataConfig.daily">Daily</span>
          </label>
          <label>
            <input type="radio" formControlName="refreshFrequency" value="hourly" />
            <span i18n="Hourly frequency option@@adminDataConfig.hourly">Hourly</span>
          </label>
          <label>
            <input type="radio" formControlName="refreshFrequency" value="manual" />
            <span i18n="Manual frequency option@@adminDataConfig.manual">Manual</span>
          </label>
        </fieldset>

        <label class="select-label">
          <span i18n="Historical depth label@@adminDataConfig.historicalDepth">
            Historical depth
          </span>
          <select formControlName="historicalDepth">
            <option value="1_year" i18n="One year depth@@adminDataConfig.oneYear">1 Year</option>
            <option value="2_years" i18n="Two years depth@@adminDataConfig.twoYears">2 Years</option>
            <option value="5_years" i18n="Five years depth@@adminDataConfig.fiveYears">5 Years</option>
            <option value="all_time" i18n="All time depth@@adminDataConfig.allTime">All-time</option>
          </select>
        </label>

        <div class="refresh-status">
          <span i18n="Last refresh label@@adminDataConfig.lastRefresh">Last refresh</span>
          <strong>{{ lastRefreshText() }}</strong>
        </div>

        @if (message()) {
          <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
        }

        <div class="admin-actions">
          <button type="submit" [disabled]="form.invalid || isSaving()">
            @if (isSaving()) {
              <ng-container i18n="Saving configuration state@@adminDataConfig.saving">
                Saving...
              </ng-container>
            } @else {
              <ng-container i18n="Save configuration button@@adminDataConfig.save">
                Save Configuration
              </ng-container>
            }
          </button>

          @if (configuration()?.refreshFrequency === 'manual') {
            <button
              type="button"
              class="secondary-button"
              (click)="refreshNow()"
              [disabled]="isRefreshing()"
            >
              @if (isRefreshing()) {
                <ng-container i18n="Refreshing now state@@adminDataConfig.refreshing">
                  Refreshing...
                </ng-container>
              } @else {
                <ng-container i18n="Refresh now button@@adminDataConfig.refreshNow">
                  Refresh Now
                </ng-container>
              }
            </button>
          }
        </div>
      </form>
    </section>
  `,
})
export class AdminDataConfigurationPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiClient);
  protected readonly configuration = signal<DataRefreshConfigurationResponse | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly isRefreshing = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    refreshFrequency: this.fb.nonNullable.control<RefreshFrequency>('daily', Validators.required),
    historicalDepth: this.fb.nonNullable.control<HistoricalDepth>('all_time', Validators.required),
  });

  constructor() {
    void this.loadConfiguration();
  }

  protected lastRefreshText(): string {
    const lastRefresh = this.configuration()?.lastRefresh;

    if (!lastRefresh || !lastRefresh.timestamp) {
      return $localize`:Never refreshed status@@adminDataConfig.never:Never`;
    }

    return `${new Date(lastRefresh.timestamp).toISOString().replace('T', ' ').replace('.000Z', ' UTC')} (${lastRefresh.status})`;
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.message.set('');
    this.isSuccess.set(false);

    try {
      const configuration = await this.auth.updateDataRefreshConfiguration(
        this.form.getRawValue(),
      );
      this.configuration.set(configuration);
      this.form.setValue({
        refreshFrequency: configuration.refreshFrequency,
        historicalDepth: configuration.historicalDepth,
      });
      this.isSuccess.set(true);
      this.message.set(
        $localize`:Configuration updated success@@adminDataConfig.updated:Configuration updated successfully`,
      );
    } catch (error) {
      this.message.set(getErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async refreshNow(): Promise<void> {
    if (this.isRefreshing()) {
      return;
    }

    this.isRefreshing.set(true);
    this.message.set('');
    this.isSuccess.set(false);

    try {
      await this.auth.runDataRefreshNow();
      await this.loadConfiguration();
      this.isSuccess.set(true);
      this.message.set(
        $localize`:Manual refresh success@@adminDataConfig.refreshComplete:Data refresh completed successfully`,
      );
    } catch (error) {
      this.message.set(getErrorMessage(error));
    } finally {
      this.isRefreshing.set(false);
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const configuration = await this.auth.getDataRefreshConfiguration();
      this.configuration.set(configuration);
      this.form.setValue({
        refreshFrequency: configuration.refreshFrequency,
        historicalDepth: configuration.historicalDepth,
      });
    } catch (error) {
      this.message.set(getErrorMessage(error));
    }
  }
}

@Component({
  selector: 'app-onboarding-page',
  imports: [OnboardingCarouselComponent],
  template: `
    <section class="content-section">
      <app-onboarding-carousel
        (skipped)="closeCarousel()"
        (completed)="closeCarousel()"
      ></app-onboarding-carousel>
      @if (message()) {
        <p class="form-message success">{{ message() }}</p>
      }
    </section>
  `,
})
export class OnboardingPage {
  protected readonly message = signal('');

  protected closeCarousel(): void {
    this.message.set(
      $localize`:Onboarding dismissed message@@onboarding.dismissed:Onboarding dismissed. Account completion tracking will be enabled next.`,
    );
  }
}

@Component({
  selector: 'app-login-page',
  template: `
    <section class="content-section auth-section">
      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
        <h2 i18n="Login title@@auth.login">Login</h2>
        <label i18n="Email label@@form.email">
          Email<input type="email" autocomplete="email" formControlName="email" />
        </label>
        <label i18n="Password label@@form.password">
          Password
          <input type="password" autocomplete="current-password" formControlName="password" />
        </label>
        @if (message()) {
          <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
        }
        <button type="submit" [disabled]="form.invalid || isSubmitting()">
          @if (isSubmitting()) {
            <ng-container i18n="Logging in state@@auth.loggingIn">Logging in...</ng-container>
          } @else {
            <ng-container i18n="Login button@@auth.login">Login</ng-container>
          }
        </button>
        <button
          type="button"
          class="secondary-button"
          (click)="continueWithGoogle()"
          i18n="Continue with Google button@@auth.google"
        >
          Continue with Google
        </button>
        <a
          class="form-link"
          routerLink="/forgot-password"
          i18n="Forgot password link@@auth.forgotPassword"
        >
          Forgot password?
        </a>
      </form>

      @if (showOnboarding()) {
        <div
          class="onboarding-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Onboarding"
          i18n-aria-label="Onboarding dialog label@@onboarding.dialog"
        >
          <app-onboarding-carousel
            (skipped)="completeOnboarding()"
            (completed)="completeOnboarding()"
          ></app-onboarding-carousel>
        </div>
      }
    </section>
  `,
  imports: [ReactiveFormsModule, RouterLink, OnboardingCarouselComponent],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiClient);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);
  protected readonly isSubmitting = signal(false);
  protected readonly isCompletingOnboarding = signal(false);
  protected readonly showOnboarding = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.message.set('');
    this.isSuccess.set(false);

    try {
      await this.auth.login(this.form.getRawValue());
      const profile = await this.auth.getCurrentUserProfile();
      this.authSession.setCurrentUser(profile);
      this.isSuccess.set(true);

      if (!profile.onboardingCompleted) {
        this.showOnboarding.set(true);
        this.message.set(
          $localize`:Login onboarding required message@@auth.loginOnboardingRequired:Login successful. Complete the quick orientation to continue.`,
        );
        return;
      }

      this.message.set(
        $localize`:Login success message@@auth.loginSuccess:Login successful. Redirecting to dashboard.`,
      );
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.message.set(getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected async completeOnboarding(): Promise<void> {
    if (this.isCompletingOnboarding()) {
      return;
    }

    this.isCompletingOnboarding.set(true);
    this.message.set(
      $localize`:Completing onboarding state@@onboarding.completing:Completing onboarding...`,
    );

    try {
      const profile = await this.auth.completeCurrentUserOnboarding();
      this.authSession.setCurrentUser(profile);
      this.showOnboarding.set(false);
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.message.set(getErrorMessage(error));
    } finally {
      this.isCompletingOnboarding.set(false);
    }
  }

  protected continueWithGoogle(): void {
    this.auth.startGoogleLogin();
  }
}

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="content-section auth-section">
      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
        <h2 i18n="Reset password title@@passwordReset.title">Reset password</h2>
        <label i18n="Email label@@form.email">
          Email<input type="email" autocomplete="email" formControlName="email" />
        </label>
        @if (message()) {
          <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
        }
        <button type="submit" [disabled]="form.invalid || isSubmitting()">
          @if (isSubmitting()) {
            <ng-container i18n="Sending state@@passwordReset.sending">Sending...</ng-container>
          } @else {
            <ng-container i18n="Send reset instructions button@@passwordReset.send">
              Send reset instructions
            </ng-container>
          }
        </button>
      </form>
    </section>
  `,
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiClient);
  protected readonly isSubmitting = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.message.set('');
    this.isSuccess.set(false);

    try {
      const response = await this.auth.requestPasswordReset(this.form.getRawValue());
      this.isSuccess.set(true);
      this.message.set(response.message);
    } catch (error) {
      this.message.set(getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="content-section auth-section">
      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
        <h2 i18n="Choose new password title@@passwordReset.chooseNew">
          Choose a new password
        </h2>
        @if (isTokenValid() === false) {
          <p class="form-message" i18n="Invalid reset token message@@passwordReset.invalidToken">
            Reset link is invalid or expired
          </p>
        } @else {
          <label i18n="New password label@@form.newPassword">
            New password
            <input type="password" autocomplete="new-password" formControlName="password" />
          </label>
          <label i18n="Confirm password label@@form.confirmPassword">
            Confirm password
            <input
              type="password"
              autocomplete="new-password"
              formControlName="confirmPassword"
            />
          </label>
          @if (passwordMismatch()) {
            <p class="form-message" i18n="Passwords mismatch@@form.passwordMismatch">
              Passwords do not match.
            </p>
          }
          @if (message()) {
            <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
          }
          <button
            type="submit"
            [disabled]="form.invalid || passwordMismatch() || isSubmitting() || !isTokenValid()"
          >
            @if (isSubmitting()) {
              <ng-container i18n="Resetting password state@@passwordReset.resetting">
                Resetting...
              </ng-container>
            } @else {
              <ng-container i18n="Reset password button@@passwordReset.reset">
                Reset password
              </ng-container>
            }
          </button>
        }
      </form>
    </section>
  `,
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected readonly isSubmitting = signal(false);
  protected readonly isTokenValid = signal<boolean | null>(null);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    password: ['', Validators.required],
    confirmPassword: ['', Validators.required],
  });
  protected readonly passwordMismatch = computed(() => {
    const { password, confirmPassword } = this.form.getRawValue();
    return Boolean(password && confirmPassword && password !== confirmPassword);
  });

  constructor() {
    void this.validateToken();
  }

  protected async submit(): Promise<void> {
    if (
      this.form.invalid ||
      this.passwordMismatch() ||
      this.isSubmitting() ||
      !this.isTokenValid()
    ) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.message.set('');
    this.isSuccess.set(false);

    try {
      const response = await this.auth.resetPassword({
        token: this.token,
        ...this.form.getRawValue(),
      });
      this.isSuccess.set(true);
      this.message.set(response.message);
      await this.router.navigate(['/login'], {
        queryParams: { message: response.message },
      });
    } catch (error) {
      this.message.set(getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async validateToken(): Promise<void> {
    if (!this.token) {
      this.isTokenValid.set(false);
      return;
    }

    try {
      const response = await this.auth.validatePasswordResetToken(this.token);
      this.isTokenValid.set(response.valid);
    } catch {
      this.isTokenValid.set(false);
    }
  }
}

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="content-section auth-section">
      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
        <h2 i18n="Register title@@auth.register">Register</h2>
        <label i18n="Full name label@@form.fullName">
          Full name<input type="text" autocomplete="name" formControlName="fullName" />
        </label>
        <label i18n="Email label@@form.email">
          Email<input type="email" autocomplete="email" formControlName="email" />
        </label>
        <label i18n="Password label@@form.password">
          Password
          <input type="password" autocomplete="new-password" formControlName="password" />
        </label>
        <label i18n="Confirm password label@@form.confirmPassword">
          Confirm password
          <input
            type="password"
            autocomplete="new-password"
            formControlName="confirmPassword"
          />
        </label>
        <label>
          <span i18n="Language form label@@form.language">Language</span>
          <select formControlName="languagePreference">
            <option value="en" i18n="English language option@@language.english">English</option>
            <option value="hu" i18n="Hungarian language option@@language.hungarian">Hungarian</option>
          </select>
        </label>
        @if (passwordMismatch()) {
          <p class="form-message" i18n="Passwords mismatch@@form.passwordMismatch">
            Passwords do not match.
          </p>
        }
        @if (message()) {
          <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
        }
        <button type="submit" [disabled]="form.invalid || passwordMismatch() || isSubmitting()">
          @if (isSubmitting()) {
            <ng-container i18n="Creating account state@@auth.creatingAccount">
              Creating account...
            </ng-container>
          } @else {
            <ng-container i18n="Create account button@@auth.createAccount">
              Create account
            </ng-container>
          }
        </button>
      </form>
    </section>
  `,
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiClient);
  protected readonly isSubmitting = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    fullName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    confirmPassword: ['', Validators.required],
    languagePreference: this.fb.nonNullable.control<'en' | 'hu'>('en', Validators.required),
  });
  protected readonly passwordMismatch = computed(() => {
    const { password, confirmPassword } = this.form.getRawValue();
    return Boolean(password && confirmPassword && password !== confirmPassword);
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.passwordMismatch() || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.message.set('');
    this.isSuccess.set(false);

    try {
      const response = await this.auth.register(this.form.getRawValue());
      this.isSuccess.set(true);
      this.message.set(response.message);
      this.form.reset({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        languagePreference: 'en',
      });
    } catch (error) {
      this.message.set(getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : $localize`:Generic request failure@@errors.requestFailed:The request could not be completed. Please try again.`;
}

export const appRoutes: Route[] = [
  { path: '', component: DashboardPage },
  { path: 'dashboard', component: DashboardPage },
  { path: 'charts', component: ChartsPage },
  {
    path: 'admin/users',
    component: AdminUsersPage,
    canActivate: [roleGuard],
    data: { roles: ['administrator'] },
  },
  {
    path: 'admin/data-configuration',
    component: AdminDataConfigurationPage,
    canActivate: [roleGuard],
    data: { roles: ['administrator'] },
  },
  { path: 'onboarding', component: OnboardingPage },
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'reset-password', component: ResetPasswordPage },
  { path: 'register', component: RegisterPage },
  { path: '**', redirectTo: '' },
];
