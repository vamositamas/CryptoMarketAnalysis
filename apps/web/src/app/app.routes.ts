import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Route, Router, RouterLink } from '@angular/router';
import {
  ApiClientError,
  AuthApiClient,
} from '@crypto-market-analysis/data-access/api-client';
import { roleGuard } from './guards/role.guard';
import { AuthSessionService } from './services/auth-session.service';

@Component({
  selector: 'app-dashboard-page',
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
    </section>
  `,
})
export class DashboardPage {}

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
  selector: 'app-onboarding-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="content-section split-section">
      <div>
        <p class="eyebrow" i18n="Onboarding eyebrow@@onboarding.eyebrow">
          Onboarding
        </p>
        <h2 i18n="Onboarding title@@onboarding.title">Set your analysis profile</h2>
        <p i18n="Onboarding description@@onboarding.description">
          Choose a trading horizon, preferred language, and alert sensitivity after registration.
        </p>
      </div>
      <form class="compact-form" [formGroup]="form" (ngSubmit)="save()">
        <label>
          <span i18n="Trading horizon label@@onboarding.tradingHorizon">
            Trading horizon
          </span>
          <select formControlName="tradingHorizon">
            <option i18n="Cycle investor option@@onboarding.cycleInvestor">
              Cycle investor
            </option>
            <option i18n="Swing trader option@@onboarding.swingTrader">Swing trader</option>
            <option i18n="Research only option@@onboarding.researchOnly">Research only</option>
          </select>
        </label>
        <label i18n="Alert sensitivity label@@onboarding.alertSensitivity">
          Alert sensitivity
          <input type="range" min="1" max="5" formControlName="alertSensitivity" />
        </label>
        @if (message()) {
          <p class="form-message success">{{ message() }}</p>
        }
        <button type="submit" i18n="Save preferences button@@onboarding.save">
          Save preferences
        </button>
      </form>
    </section>
  `,
})
export class OnboardingPage {
  private readonly fb = inject(FormBuilder);
  protected readonly message = signal('');
  protected readonly form = this.fb.nonNullable.group({
    tradingHorizon: ['Cycle investor', Validators.required],
    alertSensitivity: [3, Validators.required],
  });

  protected save(): void {
    this.message.set(
      $localize`:Onboarding saved message@@onboarding.saved:Preferences saved locally. Account sync will be enabled next.`,
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
    </section>
  `,
  imports: [ReactiveFormsModule, RouterLink],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiClient);
  private readonly authSession = inject(AuthSessionService);
  protected readonly isSubmitting = signal(false);
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
      const response = await this.auth.login(this.form.getRawValue());
      this.authSession.setCurrentUser(response.user);
      this.isSuccess.set(true);
      this.message.set(
        $localize`:Login success message@@auth.loginSuccess:Login successful. Redirecting to dashboard is coming next.`,
      );
    } catch (error) {
      this.message.set(getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
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
            <option value="en" i18n="English language option@@language.english">
              English
            </option>
            <option value="hu" i18n="Hungarian language option@@language.hungarian">
              Hungarian
            </option>
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
  { path: 'onboarding', component: OnboardingPage },
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'reset-password', component: ResetPasswordPage },
  { path: 'register', component: RegisterPage },
  { path: '**', redirectTo: '' },
];
