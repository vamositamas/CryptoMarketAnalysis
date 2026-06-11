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
        <p class="eyebrow">Model overview</p>
        <h2>Bitcoin cycle dashboard</h2>
      </div>
      <div class="model-grid">
        <article>
          <span>MVRV Z-Score</span>
          <strong>1.84</strong>
          <small>Valuation stretch is below overheated territory.</small>
        </article>
        <article>
          <span>Bitcoin Rainbow</span>
          <strong>Green</strong>
          <small>Price sits in the accumulation-to-fair-value band.</small>
        </article>
        <article>
          <span>Pi Cycle Top</span>
          <strong>Clear</strong>
          <small>Moving averages have not produced a top signal.</small>
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
        <p class="eyebrow">Chart library</p>
        <h2>Tracked Bitcoin models</h2>
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
        <p class="eyebrow">Admin</p>
        <h2>User management</h2>
      </div>
      <div class="model-grid">
        <article>
          <span>Users</span>
          <strong>Ready</strong>
          <small>Administrative user list API access is role protected.</small>
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
        <p class="eyebrow">Onboarding</p>
        <h2>Set your analysis profile</h2>
        <p>Choose a trading horizon, preferred language, and alert sensitivity after registration.</p>
      </div>
      <form class="compact-form" [formGroup]="form" (ngSubmit)="save()">
        <label>
          Trading horizon
          <select formControlName="tradingHorizon">
            <option>Cycle investor</option>
            <option>Swing trader</option>
            <option>Research only</option>
          </select>
        </label>
        <label>
          Alert sensitivity
          <input type="range" min="1" max="5" formControlName="alertSensitivity" />
        </label>
        @if (message()) {
          <p class="form-message success">{{ message() }}</p>
        }
        <button type="submit">Save preferences</button>
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
    this.message.set('Preferences saved locally. Account sync will be enabled next.');
  }
}

@Component({
  selector: 'app-login-page',
  template: `
    <section class="content-section auth-section">
      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
        <h2>Login</h2>
        <label>Email<input type="email" autocomplete="email" formControlName="email" /></label>
        <label>
          Password
          <input type="password" autocomplete="current-password" formControlName="password" />
        </label>
        @if (message()) {
          <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
        }
        <button type="submit" [disabled]="form.invalid || isSubmitting()">
          {{ isSubmitting() ? 'Logging in...' : 'Login' }}
        </button>
        <button type="button" class="secondary-button" (click)="continueWithGoogle()">
          Continue with Google
        </button>
        <a class="form-link" routerLink="/forgot-password">Forgot password?</a>
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
      this.message.set('Login successful. Redirecting to dashboard is coming next.');
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
        <h2>Reset password</h2>
        <label>Email<input type="email" autocomplete="email" formControlName="email" /></label>
        @if (message()) {
          <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
        }
        <button type="submit" [disabled]="form.invalid || isSubmitting()">
          {{ isSubmitting() ? 'Sending...' : 'Send reset instructions' }}
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
        <h2>Choose a new password</h2>
        @if (isTokenValid() === false) {
          <p class="form-message">Reset link is invalid or expired</p>
        } @else {
          <label>
            New password
            <input type="password" autocomplete="new-password" formControlName="password" />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              autocomplete="new-password"
              formControlName="confirmPassword"
            />
          </label>
          @if (passwordMismatch()) {
            <p class="form-message">Passwords do not match.</p>
          }
          @if (message()) {
            <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
          }
          <button
            type="submit"
            [disabled]="form.invalid || passwordMismatch() || isSubmitting() || !isTokenValid()"
          >
            {{ isSubmitting() ? 'Resetting...' : 'Reset password' }}
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
        <h2>Register</h2>
        <label>Full name<input type="text" autocomplete="name" formControlName="fullName" /></label>
        <label>Email<input type="email" autocomplete="email" formControlName="email" /></label>
        <label>
          Password
          <input type="password" autocomplete="new-password" formControlName="password" />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            autocomplete="new-password"
            formControlName="confirmPassword"
          />
        </label>
        <label>
          Language
          <select formControlName="languagePreference">
            <option value="en">English</option>
            <option value="hu">Hungarian</option>
          </select>
        </label>
        @if (passwordMismatch()) {
          <p class="form-message">Passwords do not match.</p>
        }
        @if (message()) {
          <p class="form-message" [class.success]="isSuccess()">{{ message() }}</p>
        }
        <button type="submit" [disabled]="form.invalid || passwordMismatch() || isSubmitting()">
          {{ isSubmitting() ? 'Creating account...' : 'Create account' }}
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
    : 'The request could not be completed. Please try again.';
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
