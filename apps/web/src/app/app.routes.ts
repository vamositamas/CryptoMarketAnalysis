import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Route, Router, RouterLink } from '@angular/router';
import type { RecentChart } from '@crypto-market-analysis/data-access/api-client';
import {
  ApiClientError,
  AuthApiClient,
  type DashboardWidget,
  type DataRefreshConfigurationResponse,
  type HistoricalDepth,
  type RefreshFrequency,
} from '@crypto-market-analysis/data-access/api-client';
import { AddWidgetModalComponent } from './components/add-widget-modal/add-widget-modal.component';
import { OnboardingCarouselComponent } from './components/onboarding-carousel/onboarding-carousel.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { AuthSessionService } from './services/auth-session.service';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
  template: `
    <section class="landing-hero" aria-labelledby="landing-title">
      <div class="landing-copy">
        <p class="eyebrow" i18n="Landing eyebrow@@landing.eyebrow">
          Bitcoin cycle intelligence
        </p>
        <h1 id="landing-title" i18n="Landing title@@landing.title">
          CryptoMarketAnalysis
        </h1>
        <p i18n="Landing supporting copy@@landing.text">
          A focused research workspace for Bitcoin valuation models, cycle signals,
          and long-term market context. Create an account to open the live charts.
        </p>
        <div class="hero-actions">
          <a class="primary-link" routerLink="/register" i18n="Landing primary CTA@@landing.primaryCta">
            Create account
          </a>
          <a class="ghost-link" routerLink="/login" i18n="Landing secondary CTA@@landing.secondaryCta">
            Login
          </a>
        </div>
      </div>

      <div
        class="market-panel landing-preview"
        aria-label="Bitcoin analytics preview"
        i18n-aria-label="Landing preview accessibility label@@landing.previewAria"
      >
        <div class="panel-header">
          <span i18n="Landing preview label@@landing.previewLabel">Research preview</span>
          <strong>Members only</strong>
        </div>
        <div class="signal-chart" aria-hidden="true">
          <span class="bar bar-one"></span>
          <span class="bar bar-two"></span>
          <span class="bar bar-three"></span>
          <span class="bar bar-four"></span>
          <span class="bar bar-five"></span>
          <span class="bar bar-six"></span>
        </div>
        <div class="metric-strip">
          <span><ng-container i18n="Landing preview rainbow@@landing.rainbow">Rainbow</ng-container> <strong>Locked</strong></span>
          <span><ng-container i18n="Landing preview pi cycle@@landing.piCycle">Pi Cycle</ng-container> <strong>Locked</strong></span>
        </div>
      </div>
    </section>

    <section
      class="landing-section"
      aria-labelledby="models-title"
    >
      <div class="section-heading">
        <p class="eyebrow" i18n="Landing models eyebrow@@landing.modelsEyebrow">
          Model library
        </p>
        <h2 id="models-title" i18n="Landing models title@@landing.modelsTitle">
          Professional Bitcoin market tools after login
        </h2>
      </div>
      <div class="feature-grid">
        <article>
          <span>01</span>
          <h3>Bitcoin Rainbow</h3>
          <p i18n="Landing rainbow copy@@landing.rainbowCopy">
            Long-term logarithmic valuation bands for market-cycle context.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Pi Cycle Top</h3>
          <p i18n="Landing pi cycle copy@@landing.piCycleCopy">
            Moving-average crossover signals designed for cycle-top awareness.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Stock-to-Flow</h3>
          <p i18n="Landing stock to flow copy@@landing.stockToFlowCopy">
            Scarcity model tracking with halving context and divergence views.
          </p>
        </article>
      </div>
    </section>

    <section class="landing-section landing-access">
      <div>
        <p class="eyebrow" i18n="Landing access eyebrow@@landing.accessEyebrow">
          Private workspace
        </p>
        <h2 i18n="Landing access title@@landing.accessTitle">
          Charts, annotations, exports, and admin tools require an account.
        </h2>
      </div>
      <a class="primary-link" routerLink="/register" i18n="Landing access CTA@@landing.accessCta">
        Start with registration
      </a>
    </section>
  `,
})
export class LandingPage {
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  constructor() {
    if (this.authSession.currentUser()) {
      void this.router.navigate(['/dashboard']);
    }
  }
}

@Component({
  selector: 'app-dashboard-page',
  imports: [OnboardingCarouselComponent, AddWidgetModalComponent, RouterLink],
  template: `
    <section class="content-section">
      <div class="section-heading dashboard-heading">
        <div>
          <p class="eyebrow" i18n="Dashboard eyebrow@@dashboard.eyebrow">
            Model overview
          </p>
          <h2 i18n="Dashboard title@@dashboard.title">Bitcoin cycle dashboard</h2>
        </div>
        <button
          type="button"
          class="secondary-button"
          (click)="openAddWidget()"
          i18n="Add widget button@@dashboard.openAddWidget"
        >
          Add Widget
        </button>
      </div>

      @if (isLoadingWidgets()) {
        <p i18n="Dashboard widgets loading@@dashboard.widgetsLoading">Loading...</p>
      } @else {
        <div class="dashboard-widget-grid">
          @for (widget of widgets(); track widget.id) {
            <article
              [attr.data-widget-id]="widget.id"
              [class.is-dragging]="draggingId() === widget.id"
              [class.drag-over]="dragOverId() === widget.id && draggingId() !== widget.id"
            >
              <span
                class="widget-drag-handle"
                aria-hidden="true"
                (pointerdown)="onPointerDown($event, widget.id)"
                (pointermove)="onPointerMove($event)"
                (pointerup)="onPointerUp($event)"
                (pointercancel)="onPointerCancel($event)"
              >⠿</span>
              <span class="widget-title">{{ widget.title }}</span>
              <strong class="widget-value">{{ widget.formattedValue }}</strong>
              <small class="widget-trend" [class]="'trend-' + widget.trend">
                {{ trendIndicator(widget.trend) }}
                @if (widget.trendPercent !== null) {
                  {{ formatTrendPercent(widget.trendPercent) }}
                }
              </small>
              <small class="widget-updated">{{ lastUpdatedText(widget.lastUpdated) }}</small>
            </article>
          }
        </div>
      }

      <div class="recent-charts-section">
        <h3 class="recent-charts-heading" i18n="Recent charts heading@@dashboard.recentChartsHeading">
          Recently Viewed Charts
        </h3>
        @if (isLoadingRecentCharts()) {
          <p class="recent-charts-loading" i18n="Recent charts loading@@dashboard.recentChartsLoading">
            Loading...
          </p>
        } @else if (recentCharts().length === 0) {
          <p class="recent-charts-empty" i18n="No recent charts message@@dashboard.noRecentCharts">
            No charts viewed yet. Explore the chart library to get started!
          </p>
          <a
            routerLink="/charts"
            class="secondary-button"
            i18n="Explore charts button@@dashboard.exploreCharts"
          >Explore Charts</a>
        } @else {
          <div class="recent-charts-grid">
            @for (chart of recentCharts(); track chart.chartId) {
              <a class="recent-chart-card" [routerLink]="chart.url">
                <div class="recent-chart-thumb">
                  <img [src]="chart.thumbnailUrl" [alt]="chart.title" loading="lazy" />
                </div>
                <span class="recent-chart-title">{{ chart.title }}</span>
                <small class="recent-chart-time">{{ formatRelativeTime(chart.viewedAt) }}</small>
              </a>
            }
          </div>
        }
      </div>

      @if (isAddWidgetOpen()) {
        <app-add-widget-modal
          [existingWidgetTypes]="widgetTypes()"
          (widgetAdded)="handleWidgetAdded($event)"
          (closed)="closeAddWidget()"
        ></app-add-widget-modal>
      }

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
  protected readonly widgets = signal<DashboardWidget[]>([]);
  protected readonly isLoadingWidgets = signal(true);
  protected readonly isAddWidgetOpen = signal(false);
  protected readonly widgetTypes = computed(() => this.widgets().map((widget) => widget.type));
  protected readonly draggingId = signal<string | null>(null);
  protected readonly dragOverId = signal<string | null>(null);
  protected readonly recentCharts = signal<RecentChart[]>([]);
  protected readonly isLoadingRecentCharts = signal(true);

  private activePointerId: number | null = null;
  private pointerDragId: string | null = null;
  private pointerOverId: string | null = null;

  constructor() {
    void this.checkOnboardingStatus();
    void this.loadWidgets();
    void this.loadRecentCharts();
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

  protected openAddWidget(): void {
    this.isAddWidgetOpen.set(true);
  }

  protected closeAddWidget(): void {
    this.isAddWidgetOpen.set(false);
  }

  protected handleWidgetAdded(widget: DashboardWidget): void {
    this.widgets.update((current) => [...current, widget]);
  }

  protected onPointerDown(event: PointerEvent, widgetId: string): void {
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.activePointerId = event.pointerId;
    this.pointerDragId = widgetId;
    this.draggingId.set(widgetId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.pointerDragId || event.pointerId !== this.activePointerId) return;

    const el = document.elementFromPoint(event.clientX, event.clientY);
    const article = el?.closest('[data-widget-id]') as HTMLElement | null;
    const targetId = article?.dataset['widgetId'] ?? null;

    if (targetId !== this.pointerOverId) {
      this.pointerOverId = targetId;
      this.dragOverId.set(targetId);
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.pointerDragId || event.pointerId !== this.activePointerId) return;

    const sourceId = this.pointerDragId;
    const targetId = this.pointerOverId;

    this.activePointerId = null;
    this.pointerDragId = null;
    this.pointerOverId = null;
    this.draggingId.set(null);
    this.dragOverId.set(null);

    if (sourceId && targetId && sourceId !== targetId) {
      this.performReorder(sourceId, targetId);
    }
  }

  protected onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;

    this.activePointerId = null;
    this.pointerDragId = null;
    this.pointerOverId = null;
    this.draggingId.set(null);
    this.dragOverId.set(null);
  }

  protected performReorder(sourceId: string, targetId: string): void {
    const current = this.widgets();
    const sourceIndex = current.findIndex((w) => w.id === sourceId);
    const targetIndex = current.findIndex((w) => w.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = [...current];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    this.widgets.set(reordered);
    void this.saveWidgetOrder(reordered.map((w) => w.id));
  }

  private async saveWidgetOrder(orderedIds: string[]): Promise<void> {
    try {
      await this.auth.reorderDashboardWidgets(orderedIds);
    } catch {
      void this.loadWidgets();
    }
  }

  private async loadRecentCharts(): Promise<void> {
    this.isLoadingRecentCharts.set(true);

    try {
      const response = await this.auth.getRecentCharts();
      this.recentCharts.set(response.recentCharts);
    } catch {
      this.recentCharts.set([]);
    } finally {
      this.isLoadingRecentCharts.set(false);
    }
  }

  protected formatRelativeTime(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

    const diffHours = Math.floor(diffMins / 60);

    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

    const diffDays = Math.floor(diffHours / 24);

    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  protected trendIndicator(trend: DashboardWidget['trend']): string {
    if (trend === 'up') {
      return '↑';
    }

    if (trend === 'down') {
      return '↓';
    }

    return '–';
  }

  protected formatTrendPercent(trendPercent: number): string {
    return `${trendPercent >= 0 ? '+' : ''}${trendPercent.toFixed(1)}%`;
  }

  protected lastUpdatedText(lastUpdated: string | null): string {
    if (!lastUpdated) {
      return $localize`:Widget waiting for data@@dashboard.widgetWaiting:Waiting for data`;
    }

    return new Date(lastUpdated).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
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

  private async loadWidgets(): Promise<void> {
    this.isLoadingWidgets.set(true);

    try {
      const response = await this.auth.getDashboardWidgets();
      this.widgets.set(response.widgets);
    } catch {
      this.widgets.set([]);
    } finally {
      this.isLoadingWidgets.set(false);
    }
  }
}


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
        @if (showDevelopmentAdminHelper) {
          <button
            type="button"
            class="secondary-button"
            (click)="useDevelopmentAdminCredentials()"
            i18n="Use development admin button@@auth.useDevelopmentAdmin"
          >
            Use dev admin
          </button>
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly isSubmitting = signal(false);
  protected readonly isCompletingOnboarding = signal(false);
  protected readonly showOnboarding = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly showDevelopmentAdminHelper = !window.location.hostname.endsWith(
    'cryptomarketanalysis.com',
  );
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected useDevelopmentAdminCredentials(): void {
    this.form.setValue({
      email: 'admin@cryptomarketanalysis.com',
      password: 'AdminPass123!',
    });
    this.message.set('');
    this.isSuccess.set(false);
  }

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
      await this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard');
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
  { path: '', component: LandingPage },
  { path: 'dashboard', component: DashboardPage, canActivate: [authGuard] },
  {
    path: 'charts',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/chart-library/chart-library.component').then(
        (module) => module.ChartLibraryComponent,
      ),
  },
  {
    path: 'charts/bitcoin-rainbow',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './components/bitcoin-rainbow-chart-page/bitcoin-rainbow-chart-page.component'
      ).then((module) => module.BitcoinRainbowChartPageComponent),
  },
  {
    path: 'charts/pi-cycle-top',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/pi-cycle-top-chart-page/pi-cycle-top-chart-page.component').then(
        (module) => module.PiCycleTopChartPageComponent,
      ),
  },
  {
    path: 'charts/stock-to-flow',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/stock-to-flow-chart-page/stock-to-flow-chart-page.component').then(
        (module) => module.StockToFlowChartPageComponent,
      ),
  },
  {
    path: 'charts/:chartId',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './components/chart-detail-placeholder/chart-detail-placeholder.component'
      ).then((module) => module.ChartDetailPlaceholderComponent),
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['administrator'] },
    loadComponent: () =>
      import('./components/admin-users-page/admin-users-page.component').then(
        (m) => m.AdminUsersPageComponent,
      ),
  },
  {
    path: 'admin/audit-logs',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['administrator'] },
    loadComponent: () =>
      import('./components/admin-audit-logs-page/admin-audit-logs-page.component').then(
        (m) => m.AdminAuditLogsPageComponent,
      ),
  },
  {
    path: 'admin/charts',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['administrator'] },
    loadComponent: () =>
      import('./components/admin-charts-page/admin-charts-page.component').then(
        (m) => m.AdminChartsPageComponent,
      ),
  },
  {
    path: 'admin/data-configuration',
    component: AdminDataConfigurationPage,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['administrator'] },
  },
  {
    path: 'admin/email-templates',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['administrator'] },
    loadComponent: () =>
      import('./components/email-template-editor/email-template-editor.component').then(
        (m) => m.EmailTemplateEditorComponent,
      ),
  },
  { path: 'alerts', canActivate: [authGuard], loadComponent: () => import('./components/alerts-page/alerts-page.component').then((m) => m.AlertsPageComponent) },
  {
    path: 'donate/thank-you',
    loadComponent: () =>
      import('./components/donate-thank-you/donate-thank-you.component').then(
        (m) => m.DonateThankYouComponent,
      ),
  },
  { path: 'onboarding', component: OnboardingPage, canActivate: [authGuard] },
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'reset-password', component: ResetPasswordPage },
  { path: 'register', component: RegisterPage },
  { path: '**', redirectTo: '' },
];
