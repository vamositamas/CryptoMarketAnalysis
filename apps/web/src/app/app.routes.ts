import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Route, Router, RouterLink } from '@angular/router';
import type { RecentChart, SignalSummary } from '@crypto-market-analysis/data-access/api-client';
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
    <section class="content-section content-section--wide">
      <div class="section-heading dashboard-heading">
        <div>
          <p class="eyebrow" i18n="Dashboard eyebrow@@dashboard.eyebrow">
            Model overview
          </p>
          <h2 i18n="Dashboard title@@dashboard.title">Bitcoin cycle dashboard</h2>
        </div>
        <div class="dashboard-heading-actions">
          <button
            type="button"
            class="secondary-button"
            [disabled]="isRefreshing()"
            (click)="refreshData()"
          >
            @if (isRefreshing()) {
              Refreshing...
            } @else {
              Refresh Data
            }
          </button>
          <button
            type="button"
            class="secondary-button"
            (click)="openAddWidget()"
            i18n="Add widget button@@dashboard.openAddWidget"
          >
            Add Widget
          </button>
        </div>
        @if (refreshMessage()) {
          <p class="dashboard-refresh-message" [class.dashboard-refresh-message--error]="refreshError()">
            {{ refreshMessage() }}
          </p>
        }
      </div>

      <!-- Market Signals Banner -->
      @if (signals()) {
        @let s = signals()!;
        <a class="msi-banner" routerLink="/trading-plans" [attr.data-zone]="s.overallZone">
          <!-- Score ring -->
          <div class="msi-score">
            <svg viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="6"/>
              <circle cx="40" cy="40" r="32" fill="none"
                [attr.stroke]="signalColor(s.overallZone)"
                stroke-width="6" stroke-linecap="round"
                transform="rotate(-90 40 40)"
                [attr.stroke-dasharray]="201.06"
                [attr.stroke-dashoffset]="201.06 * (1 - (s.normalizedScore + 100) / 200)"/>
            </svg>
            <span class="msi-score-num">{{ s.normalizedScore }}</span>
          </div>
          <!-- Summary -->
          <div class="msi-summary">
            <span class="msi-zone-badge" [attr.data-zone]="s.overallZone">{{ s.overallLabel }}</span>
            <span class="msi-btc">BTC: {{ formatUsd(s.btcPriceUsd) }}</span>
            <span class="msi-link">View Trade Planner →</span>
          </div>
          <!-- Signal grid -->
          <div class="msi-grid">
            @for (sig of s.signals; track sig.name) {
              <div class="msi-sig" [attr.data-zone]="sig.zone">
                <span class="msi-sig-label">{{ sig.label }}</span>
                <span class="msi-sig-value">{{ sig.zone === 'no_data' ? 'N/A' : sig.formattedValue }}</span>
                <span class="msi-sig-zone">{{ sig.zone === 'no_data' ? '—' : sig.zone.replace('_', ' ') }}</span>
              </div>
            }
          </div>
        </a>
      }

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
              >⠿</span>
              <button
                type="button"
                class="widget-remove-btn"
                aria-label="Remove widget"
                (click)="removeWidget(widget.id)"
              >✕</button>
              <span class="widget-title">{{ widget.title }}</span>
              @if (widget.type !== 'halving_progress') {
                <strong class="widget-value">{{ widget.formattedValue }}</strong>
                <small class="widget-trend" [class]="'trend-' + widget.trend">
                  {{ trendIndicator(widget.trend) }}
                  @if (widget.trendPercent !== null) {
                    {{ formatTrendPercent(widget.trendPercent) }}
                  }
                </small>
              }
              @if (widget.type === 'fear_greed' && widget.value !== null) {
                <div class="wi-gauge">
                  <div class="wi-gauge-bar wi-gauge-bar--fg">
                    <span class="wi-gauge-marker" [style.left.%]="widget.value"></span>
                  </div>
                  <div class="wi-gauge-labels">
                    <span>0</span><span>25</span><span>46</span><span>54</span><span>75</span><span>100</span>
                  </div>
                  <div class="wi-gauge-footer">
                    <span class="wi-gauge-label" [attr.data-zone]="fearGreedZone(widget.value)">{{ fearGreedLabel(widget.value) }}</span>
                    <span class="wi-gauge-score">{{ widget.value }}/100</span>
                  </div>
                </div>
              }
              @if (widget.type === 'mvrv_zscore' && widget.value !== null) {
                <div class="wi-gauge">
                  <div class="wi-gauge-bar wi-gauge-bar--mvrv">
                    <span class="wi-gauge-marker" [style.left.%]="mvrvPosition(widget.value)"></span>
                  </div>
                  <div class="wi-gauge-labels">
                    <span>-1</span><span>0</span><span>2</span><span>5</span><span>7</span><span>10</span>
                  </div>
                  <div class="wi-gauge-footer">
                    <span class="wi-gauge-label" [attr.data-zone]="mvrvZone(widget.value)">{{ mvrvLabel(widget.value) }}</span>
                    <span class="wi-gauge-score">Z = {{ widget.formattedValue }}</span>
                  </div>
                </div>
              }
              @if (widget.type === 'stock_to_flow' && widget.value !== null) {
                <div class="wi-gauge">
                  <div class="wi-gauge-bar wi-gauge-bar--s2f">
                    <span class="wi-gauge-marker" [style.left.%]="s2fPosition(widget.value)"></span>
                  </div>
                  <div class="wi-gauge-labels">
                    <span>0</span><span>28</span><span>56</span><span>113</span><span>200</span>
                  </div>
                  <div class="wi-gauge-footer">
                    <span class="wi-gauge-label" [attr.data-zone]="s2fZone(widget.value)">{{ s2fLabel(widget.value) }}</span>
                    <span class="wi-gauge-score">S2F {{ widget.formattedValue }}</span>
                  </div>
                </div>
              }
              @if (widget.type === 'halving_progress') {
                <div class="wi-halving">
                  <div class="wi-halving-ring-wrap">
                    <svg viewBox="0 0 80 80" aria-hidden="true">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(156,163,175,0.2)" stroke-width="8"/>
                      <circle cx="40" cy="40" r="34" fill="none"
                        stroke="#60a5fa" stroke-width="8" stroke-linecap="round"
                        transform="rotate(-90 40 40)"
                        [attr.stroke-dasharray]="halvingData.circumference"
                        [attr.stroke-dashoffset]="halvingData.offset"/>
                    </svg>
                    <div class="wi-halving-center-text">
                      <span class="wi-halving-pct">{{ halvingData.pct }}</span>
                      <span class="wi-halving-of">of cycle</span>
                    </div>
                  </div>
                  <div class="wi-halving-stats">
                    <div class="wi-halving-stat">
                      <span>Days left</span>
                      <strong>{{ halvingData.daysRemaining }}</strong>
                    </div>
                    <div class="wi-halving-stat">
                      <span>Est. next</span>
                      <strong>Apr '28</strong>
                    </div>
                    <div class="wi-halving-stat">
                      <span>Cycle</span>
                      <strong>5 / 2024</strong>
                    </div>
                  </div>
                </div>
              }
              @if ((widget.type === 'realized_price' || widget.type === 'ma_200_day') && widget.value !== null) {
                @let cmp = priceComparison(widget.type, widget.value);
                @if (cmp !== null) {
                  <div class="wi-gauge">
                    <div class="wi-gauge-bar" [class]="'wi-gauge-bar--' + widget.type">
                      <span class="wi-gauge-marker" [style.left.%]="cmp.position"></span>
                    </div>
                    <div class="wi-gauge-labels">
                      @if (widget.type === 'realized_price') {
                        <span>−50%</span><span>0%</span><span>+50%</span><span>+100%</span><span>+200%</span>
                      } @else {
                        <span>−50%</span><span>−20%</span><span>0%</span><span>+50%</span><span>+150%</span>
                      }
                    </div>
                    <div class="wi-gauge-footer">
                      <span class="wi-gauge-label" [attr.data-zone]="cmp.zone">{{ cmp.label }}</span>
                      <span class="wi-gauge-score">BTC {{ cmp.pct >= 0 ? '+' : '' }}{{ cmp.pct.toFixed(1) }}%</span>
                    </div>
                  </div>
                }
              }
              @if (widget.type !== 'halving_progress') {
                <small class="widget-updated">{{ lastUpdatedText(widget.lastUpdated) }}</small>
              }
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
                  @if (chart.chartId === 'bitcoin-rainbow') {
                    <svg viewBox='0 0 800 360' preserveAspectRatio='none' aria-hidden='true'>
                      <rect x='0' y='0'   width='800' height='46'  fill='rgba(127,29,29,0.65)'/>
                      <rect x='0' y='46'  width='800' height='37'  fill='rgba(239,68,68,0.65)'/>
                      <rect x='0' y='83'  width='800' height='35'  fill='rgba(249,115,22,0.65)'/>
                      <rect x='0' y='118' width='800' height='34'  fill='rgba(234,179,8,0.65)'/>
                      <rect x='0' y='152' width='800' height='35'  fill='rgba(132,204,22,0.65)'/>
                      <rect x='0' y='187' width='800' height='32'  fill='rgba(34,197,94,0.65)'/>
                      <rect x='0' y='219' width='800' height='37'  fill='rgba(6,182,212,0.65)'/>
                      <rect x='0' y='256' width='800' height='35'  fill='rgba(37,99,235,0.65)'/>
                      <rect x='0' y='291' width='800' height='69'  fill='rgba(30,58,138,0.65)'/>
                      <path d='M 0,322 C 80,318 130,312 155,307 C 168,228 200,76 213,70 C 228,285 260,312 272,308 C 308,294 346,264 355,254 C 372,188 408,34 424,28 C 441,90 472,247 507,242 C 522,236 542,230 555,226 C 573,186 617,93 632,96 C 649,165 678,226 685,220 C 703,210 741,198 763,195 C 776,194 792,196 800,196' stroke='#111820' stroke-width='2.5' fill='none'/>
                    </svg>
                  } @else if (chart.chartId === 'stock-to-flow') {
                    <svg viewBox='0 0 800 360' preserveAspectRatio='none' aria-hidden='true'>
                      <rect width='800' height='360' fill='#fff'/>
                      <line x1='0' y1='90'  x2='800' y2='90'  stroke='#e8eeea' stroke-width='1'/>
                      <line x1='0' y1='180' x2='800' y2='180' stroke='#e8eeea' stroke-width='1'/>
                      <line x1='0' y1='270' x2='800' y2='270' stroke='#e8eeea' stroke-width='1'/>
                      <rect x='186' y='0' width='58'  height='360' fill='rgba(239,68,68,0.07)'/>
                      <rect x='398' y='0' width='62'  height='360' fill='rgba(239,68,68,0.07)'/>
                      <rect x='608' y='0' width='56'  height='360' fill='rgba(239,68,68,0.07)'/>
                      <line x1='155' y1='0' x2='155' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='347' y1='0' x2='347' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='555' y1='0' x2='555' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='763' y1='0' x2='763' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <path d='M 0,358 C 120,352 200,325 280,280 C 360,230 445,165 555,72 C 648,28 730,10 800,5' stroke='#f59e0b' stroke-width='2.5' stroke-dasharray='10,5' fill='none' opacity='0.9'/>
                      <path d='M 0,358 C 100,356 140,350 155,345 C 168,285 196,181 213,173 C 228,278 260,260 272,243 C 305,228 338,204 347,196 C 368,162 407,66 424,63 C 440,118 468,265 477,131 C 493,103 505,87 510,87 C 528,116 541,113 555,92 C 574,56 618,14 632,12 C 648,40 677,268 685,72 C 702,50 737,25 763,17 C 775,12 792,14 800,14' stroke='#17202a' stroke-width='2.5' fill='none'/>
                    </svg>
                  } @else if (chart.chartId === 'pi-cycle-top') {
                    <svg viewBox='0 0 800 360' preserveAspectRatio='none' aria-hidden='true'>
                      <rect width='800' height='360' fill='#fff'/>
                      <line x1='155' y1='0' x2='155' y2='360' stroke='#e5ebe7' stroke-width='1' stroke-dasharray='6,5'/>
                      <line x1='347' y1='0' x2='347' y2='360' stroke='#e5ebe7' stroke-width='1' stroke-dasharray='6,5'/>
                      <line x1='555' y1='0' x2='555' y2='360' stroke='#e5ebe7' stroke-width='1' stroke-dasharray='6,5'/>
                      <line x1='763' y1='0' x2='763' y2='360' stroke='#e5ebe7' stroke-width='1' stroke-dasharray='6,5'/>
                      <path d='M 0,355 C 100,351 140,344 155,340 C 168,278 194,173 210,163 C 226,272 258,252 270,237 C 303,218 336,196 346,188 C 366,152 405,57 424,62 C 440,112 468,254 477,122 C 492,94 504,78 509,79 C 526,108 540,105 555,84 C 572,48 617,10 630,12 C 645,33 675,258 685,62 C 700,42 735,18 763,10 C 774,7 792,9 800,10' stroke='#2dafe6' stroke-width='2.5' fill='none'/>
                      <path d='M 0,357 C 100,354 140,348 155,344 C 168,284 196,181 216,172 C 232,276 263,258 274,244 C 308,228 340,204 350,196 C 369,161 407,64 423,62 C 441,116 469,262 480,132 C 495,104 508,87 513,89 C 530,114 542,111 558,94 C 576,58 619,14 643,12 C 658,38 678,265 688,72 C 703,50 738,24 763,16 C 776,11 792,13 800,14' stroke='#17202a' stroke-width='2.5' fill='none'/>
                      <circle cx='424' cy='63' r='9' fill='rgba(245,158,11,0.22)' stroke='#f59e0b' stroke-width='2'/>
                      <circle cx='630' cy='12' r='9' fill='rgba(245,158,11,0.22)' stroke='#f59e0b' stroke-width='2'/>
                    </svg>
                  } @else if (chart.chartId === 'mvrv-z-score') {
                    <svg viewBox='0 0 800 360' preserveAspectRatio='none' aria-hidden='true'>
                      <rect x='0' y='0'   width='800' height='88'  fill='rgba(239,68,68,0.20)'/>
                      <rect x='0' y='88'  width='800' height='53'  fill='rgba(249,115,22,0.15)'/>
                      <rect x='0' y='141' width='800' height='53'  fill='rgba(234,179,8,0.13)'/>
                      <rect x='0' y='194' width='800' height='88'  fill='rgba(34,197,94,0.12)'/>
                      <rect x='0' y='282' width='800' height='78'  fill='rgba(59,130,246,0.18)'/>
                      <line x1='155' y1='0' x2='155' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='347' y1='0' x2='347' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='555' y1='0' x2='555' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='763' y1='0' x2='763' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <path d='M 0,355 C 100,352 140,346 155,342 C 168,306 198,250 212,243 C 228,295 260,308 272,303 C 308,284 345,240 355,228 C 372,175 408,68 424,62 C 440,102 468,238 477,126 C 492,98 505,84 510,85 C 528,108 542,104 555,85 C 574,50 617,12 632,10 C 648,42 677,250 685,68 C 703,46 737,22 763,14 C 776,10 792,12 800,13' stroke='#17202a' stroke-width='2.5' fill='none'/>
                      <path d='M 0,300 C 50,288 90,175 108,62 C 120,240 148,310 168,298 C 210,272 268,186 300,118 C 318,280 356,312 380,302 C 415,258 448,105 462,55 C 476,188 510,308 528,292 C 548,242 584,95 605,58 C 622,175 652,300 668,286 C 696,254 745,224 778,232 C 790,236 797,240 800,242' stroke='#f59e0b' stroke-width='2.5' fill='none' opacity='0.95'/>
                    </svg>
                  } @else if (chart.chartId === 'puell-multiple') {
                    <svg viewBox='0 0 800 360' preserveAspectRatio='none' aria-hidden='true'>
                      <rect x='0' y='0'   width='800' height='90'  fill='rgba(239,68,68,0.18)'/>
                      <rect x='0' y='90'  width='800' height='180' fill='rgba(234,179,8,0.07)'/>
                      <rect x='0' y='270' width='800' height='90'  fill='rgba(34,197,94,0.18)'/>
                      <line x1='155' y1='0' x2='155' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='347' y1='0' x2='347' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='555' y1='0' x2='555' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='763' y1='0' x2='763' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <path d='M 0,355 C 100,352 140,346 155,342 C 168,306 198,250 212,243 C 228,295 260,308 272,303 C 308,284 345,240 355,228 C 372,175 408,68 424,62 C 440,102 468,238 477,126 C 492,98 505,84 510,85 C 528,108 542,104 555,85 C 574,50 617,12 632,10 C 648,42 677,250 685,68 C 703,46 737,22 763,14 C 776,10 792,12 800,13' stroke='#17202a' stroke-width='2.5' fill='none'/>
                      <path d='M 0,320 C 40,305 80,285 105,38 C 118,230 148,308 165,318 C 200,295 265,240 298,185 C 315,58 338,38 350,32 C 362,180 390,305 408,315 C 445,290 490,225 510,52 C 524,195 545,305 560,315 C 598,280 648,235 668,210 C 690,60 720,35 735,28 C 748,150 768,290 780,305 C 790,312 797,316 800,318' stroke='#6366f1' stroke-width='2.5' fill='none' opacity='0.95'/>
                    </svg>
                  } @else if (chart.chartId === 'bitcoin-power-law') {
                    <svg viewBox='0 0 800 360' preserveAspectRatio='none' aria-hidden='true'>
                      <rect width='800' height='360' fill='#fff'/>
                      <line x1='155' y1='0' x2='155' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='347' y1='0' x2='347' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='555' y1='0' x2='555' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='763' y1='0' x2='763' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <path d='M 0,290 L 800,30' stroke='#ef4444' stroke-width='2' fill='none' opacity='0.85'/>
                      <path d='M 0,330 L 800,110' stroke='#f97316' stroke-width='2' fill='none' opacity='0.85'/>
                      <path d='M 0,352 L 800,195' stroke='#60a5fa' stroke-width='2' fill='none' opacity='0.85'/>
                      <path d='M 0,354 C 60,352 100,348 115,345 C 130,328 148,295 158,282 C 175,312 200,330 218,325 C 255,305 300,270 315,255 C 335,212 365,150 380,145 C 394,175 415,238 430,210 C 445,185 460,165 468,166 C 482,184 492,182 504,168 C 518,140 545,102 558,104 C 570,124 588,228 596,148 C 608,128 630,108 645,104 C 670,110 720,92 745,80 C 762,74 785,68 800,65' stroke='#17202a' stroke-width='2.5' fill='none'/>
                    </svg>
                  } @else if (chart.chartId === 'bitcoin-cvdd') {
                    <svg viewBox='0 0 800 360' preserveAspectRatio='none' aria-hidden='true'>
                      <rect width='800' height='360' fill='#fff'/>
                      <line x1='155' y1='0' x2='155' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='347' y1='0' x2='347' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='555' y1='0' x2='555' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <line x1='763' y1='0' x2='763' y2='360' stroke='#9ca3af' stroke-width='1.5' stroke-dasharray='6,5'/>
                      <path d='M 0,358 C 80,354 140,346 200,330 C 280,310 360,280 440,245 C 520,210 620,175 700,155 C 740,145 770,138 800,132' stroke='#22c55e' stroke-width='2.5' fill='none' opacity='0.9'/>
                      <path d='M 0,355 C 60,352 100,348 115,345 C 130,308 158,254 172,247 C 188,295 220,310 232,305 C 268,288 305,246 315,232 C 334,180 368,72 384,66 C 400,106 428,240 437,128 C 452,100 465,86 470,87 C 488,110 502,107 515,89 C 534,54 575,16 590,14 C 606,44 633,252 641,72 C 657,50 693,26 717,18 C 768,15 800,100' stroke='#17202a' stroke-width='2.5' fill='none'/>
                    </svg>
                  }
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
  protected readonly isRefreshing = signal(false);
  protected readonly refreshMessage = signal('');
  protected readonly refreshError = signal(false);
  protected readonly signals = signal<SignalSummary | null>(null);

  private activePointerId: number | null = null;
  private pointerDragId: string | null = null;
  private pointerOverId: string | null = null;
  private readonly boundPointerMove = (e: PointerEvent) => this.onPointerMove(e);
  private readonly boundPointerUp = (e: PointerEvent) => this.onPointerUp(e);
  private readonly boundPointerCancel = (e: PointerEvent) => this.onPointerCancel(e);

  constructor() {
    void this.checkOnboardingStatus();
    void this.loadWidgets();
    void this.loadRecentCharts();
    void this.loadSignals();
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

  protected async refreshData(): Promise<void> {
    this.isRefreshing.set(true);
    this.refreshMessage.set('');
    this.refreshError.set(false);

    try {
      const result = await this.auth.triggerDashboardRefresh();
      await this.loadWidgets();
      this.refreshMessage.set(`Data updated for ${result.date} (${result.dataPoints} data points)`);
    } catch {
      this.refreshError.set(true);
      this.refreshMessage.set('Refresh failed. Please try again.');
    } finally {
      this.isRefreshing.set(false);
    }
  }

  protected handleWidgetAdded(widget: DashboardWidget): void {
    this.widgets.update((current) => [...current, widget]);
  }

  protected removeWidget(widgetId: string): void {
    const previous = this.widgets();
    this.widgets.update((current) => current.filter((w) => w.id !== widgetId));

    void this.auth.deleteDashboardWidget(widgetId).catch(() => {
      this.widgets.set(previous);
    });
  }

  protected onPointerDown(event: PointerEvent, widgetId: string): void {
    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.pointerDragId = widgetId;
    this.draggingId.set(widgetId);
    document.addEventListener('pointermove', this.boundPointerMove);
    document.addEventListener('pointerup', this.boundPointerUp);
    document.addEventListener('pointercancel', this.boundPointerCancel);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.pointerDragId || event.pointerId !== this.activePointerId) return;

    const el = document.elementFromPoint(event.clientX, event.clientY);
    const article = el?.closest('[data-widget-id]') as HTMLElement | null;
    const targetId = article?.dataset['widgetId'] ?? null;

    if (targetId !== this.pointerOverId) {
      this.pointerOverId = targetId;
      this.dragOverId.set(targetId);
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;

    const sourceId = this.pointerDragId;
    const targetId = this.pointerOverId;

    this.removeDragListeners();
    this.activePointerId = null;
    this.pointerDragId = null;
    this.pointerOverId = null;
    this.draggingId.set(null);
    this.dragOverId.set(null);

    if (sourceId && targetId && sourceId !== targetId) {
      this.performReorder(sourceId, targetId);
    }
  }

  private onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) return;

    this.removeDragListeners();
    this.activePointerId = null;
    this.pointerDragId = null;
    this.pointerOverId = null;
    this.draggingId.set(null);
    this.dragOverId.set(null);
  }

  private removeDragListeners(): void {
    document.removeEventListener('pointermove', this.boundPointerMove);
    document.removeEventListener('pointerup', this.boundPointerUp);
    document.removeEventListener('pointercancel', this.boundPointerCancel);
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

  protected readonly halvingData = (() => {
    const CURRENT_HALVING_MS = Date.parse('2024-04-19T00:00:00Z');
    const NEXT_HALVING_MS = Date.parse('2028-04-21T00:00:00Z');
    const now = Date.now();
    const pct = Math.min(100, Math.max(0, (now - CURRENT_HALVING_MS) / (NEXT_HALVING_MS - CURRENT_HALVING_MS) * 100));
    const daysRemaining = Math.max(0, Math.round((NEXT_HALVING_MS - now) / 86_400_000));
    const r = 34;
    const circumference = 2 * Math.PI * r;
    const offset = circumference * (1 - pct / 100);
    return { pct: `${pct.toFixed(1)}%`, daysRemaining, circumference, offset };
  })();

  protected fearGreedZone(value: number): string {
    if (value <= 25) return 'extreme-fear';
    if (value <= 46) return 'fear';
    if (value <= 54) return 'neutral';
    if (value <= 75) return 'greed';
    return 'extreme-greed';
  }

  protected fearGreedLabel(value: number): string {
    if (value <= 25) return 'Extreme Fear';
    if (value <= 46) return 'Fear';
    if (value <= 54) return 'Neutral';
    if (value <= 75) return 'Greed';
    return 'Extreme Greed';
  }

  // Realized Price & 200-day MA: BTC premium/discount vs reference price
  protected priceComparison(
    widgetType: string,
    referenceValue: number,
  ): { pct: number; position: number; zone: string; label: string } | null {
    const btc = this.widgets().find((w) => w.type === 'btc_price')?.value ?? null;
    if (btc === null || referenceValue === 0) return null;

    const pct = ((btc - referenceValue) / referenceValue) * 100;

    if (widgetType === 'ma_200_day') {
      // Scale: -50% .. +150%
      const position = Math.min(100, Math.max(0, (pct + 50) / 200 * 100));
      let zone: string;
      let label: string;
      if (pct < -20) { zone = 'deep-discount'; label = 'Deep discount'; }
      else if (pct < 0) { zone = 'discount'; label = 'Below 200-day MA'; }
      else if (pct < 50) { zone = 'above-ma'; label = 'Above 200-day MA'; }
      else { zone = 'far-above'; label = 'Far above MA'; }
      return { pct, position, zone, label };
    }

    // realized_price — Scale: -50% .. +200%
    const position = Math.min(100, Math.max(0, (pct + 50) / 250 * 100));
    let zone: string;
    let label: string;
    if (pct < 0) { zone = 'rp-below'; label = 'Investors at loss'; }
    else if (pct < 30) { zone = 'rp-fair'; label = 'Near fair value'; }
    else if (pct < 80) { zone = 'rp-premium'; label = 'In profit'; }
    else { zone = 'rp-extreme'; label = 'Overheated'; }
    return { pct, position, zone, label };
  }

  // MVRV Z-Score: scale -1..10 → 0..100%
  protected mvrvPosition(value: number): number {
    return Math.min(100, Math.max(0, (Math.min(value, 10) - (-1)) / 11 * 100));
  }

  protected mvrvZone(value: number): string {
    if (value < 0)  return 'buy';
    if (value < 2)  return 'undervalued';
    if (value < 5)  return 'fair';
    if (value < 7)  return 'overvalued';
    return 'sell';
  }

  protected mvrvLabel(value: number): string {
    if (value < 0)  return 'Buy Zone';
    if (value < 2)  return 'Undervalued';
    if (value < 5)  return 'Fair Value';
    if (value < 7)  return 'Overvalued';
    return 'Sell Zone';
  }

  // Stock-to-Flow: scale 0..200 → 0..100%
  // Key levels: 28 (pre-3rd halving), 56 (pre-4th halving), 113 (post-4th halving)
  protected s2fPosition(value: number): number {
    return Math.min(100, Math.max(0, Math.min(value, 200) / 200 * 100));
  }

  protected s2fZone(value: number): string {
    if (value < 28)  return 'low';
    if (value < 56)  return 'moderate';
    if (value < 113) return 'high';
    if (value < 170) return 'very-high';
    return 'extreme';
  }

  protected s2fLabel(value: number): string {
    if (value < 28)  return 'Low Scarcity';
    if (value < 56)  return 'Moderate Scarcity';
    if (value < 113) return 'High Scarcity';
    if (value < 170) return 'Very High Scarcity';
    return 'Extreme Scarcity';
  }

  private async loadSignals(): Promise<void> {
    try {
      const data = await this.auth.getTradingSignals();
      const fearGreedMissing = data.signals.find((s) => s.name === 'fear_greed')?.zone === 'no_data';
      if (fearGreedMissing) {
        try {
          const resp = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
          if (resp.ok) {
            const json = await resp.json() as { data?: Array<{ value?: string }> };
            const raw = json?.data?.[0]?.value;
            if (raw !== undefined) {
              const fgValue = parseInt(raw, 10);
              if (!isNaN(fgValue)) {
                const pct = fgValue <= 20 ? 1 : fgValue <= 40 ? 0.53 : fgValue <= 60 ? 0 : fgValue <= 80 ? -0.53 : -1;
                const zone = pct >= 0.6 ? 'very_bullish' : pct >= 0.2 ? 'bullish' : pct >= -0.2 ? 'neutral' : pct >= -0.6 ? 'bearish' : 'very_bearish';
                const score = Math.round(pct * 15);
                data.signals = data.signals.map((s) =>
                  s.name === 'fear_greed'
                    ? { ...s, value: fgValue, formattedValue: `${fgValue}/100`, score, zone, interpretation: `Fear & Greed live: ${fgValue}/100` }
                    : s,
                );
              }
            }
          }
        } catch { /* leave as no_data */ }
      }
      this.signals.set(data);
    } catch { /* banner stays hidden */ }
  }

  protected signalColor(zone: string): string {
    const map: Record<string, string> = {
      very_bullish: '#16a34a', bullish: '#22c55e', neutral: '#f59e0b',
      bearish: '#f97316', very_bearish: '#ef4444',
    };
    return map[zone] ?? '#9ca3af';
  }

  protected formatUsd(value: number | null): string {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }

  protected lastUpdatedText(lastUpdated: string | null): string {
    if (!lastUpdated) {
      return $localize`:Widget waiting for data@@dashboard.widgetWaiting:Waiting for data`;
    }

    return new Date(lastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) + ' UTC';
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

    return `${new Date(lastRefresh.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false })} UTC (${lastRefresh.status})`;
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
    path: 'charts/mvrv-z-score',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/mvrv-z-score-chart-page/mvrv-z-score-chart-page.component').then(
        (m) => m.MvrvZScoreChartPageComponent,
      ),
  },
  {
    path: 'charts/puell-multiple',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/puell-multiple-chart-page/puell-multiple-chart-page.component').then(
        (m) => m.PuellMultipleChartPageComponent,
      ),
  },
  {
    path: 'charts/vdd-multiple',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/vdd-multiple-chart-page/vdd-multiple-chart-page.component').then(
        (m) => m.VddMultipleChartPageComponent,
      ),
  },
  {
    path: 'charts/bitcoin-power-law',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/bitcoin-power-law-chart-page/bitcoin-power-law-chart-page.component').then(
        (m) => m.BitcoinPowerLawChartPageComponent,
      ),
  },
  {
    path: 'charts/bitcoin-cvdd',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/bitcoin-cvdd-chart-page/bitcoin-cvdd-chart-page.component').then(
        (m) => m.BitcoinCvddChartPageComponent,
      ),
  },
  {
    path: 'charts/halving-spiral',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/halving-spiral-chart-page/halving-spiral-chart-page.component').then(
        (m) => m.HavingSpiralChartPageComponent,
      ),
  },
  {
    path: 'charts/halving-progress',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/bitcoin-halving-progress-chart-page/bitcoin-halving-progress-chart-page.component').then(
        (m) => m.BitcoinHalvingProgressChartPageComponent,
      ),
  },
  {
    path: 'charts/2yr-ma-multiplier',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/two-yr-ma-multiplier-chart-page/two-yr-ma-multiplier-chart-page.component').then(
        (m) => m.TwoYrMaMultiplierChartPageComponent,
      ),
  },
  {
    path: 'charts/price-forecast-tools',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/price-forecast-tools-chart-page/price-forecast-tools-chart-page.component').then(
        (m) => m.PriceForecastToolsChartPageComponent,
      ),
  },
  {
    path: 'charts/mayer-multiple',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/mayer-multiple-chart-page/mayer-multiple-chart-page.component').then(
        (m) => m.MayerMultipleChartPageComponent,
      ),
  },
  {
    path: 'charts/200-week-ma-heatmap',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/two-hundred-week-ma-heatmap-chart-page/two-hundred-week-ma-heatmap-chart-page.component').then(
        (m) => m.TwoHundredWeekMAHeatmapChartPageComponent,
      ),
  },
  {
    path: 'charts/fear-greed-index',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/fear-greed-index-chart-page/fear-greed-index-chart-page.component').then(
        (m) => m.FearGreedIndexChartPageComponent,
      ),
  },
  {
    path: 'charts/hash-ribbons',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/hash-ribbons-chart-page/hash-ribbons-chart-page.component').then(
        (m) => m.HashRibbonsChartPageComponent,
      ),
  },
  {
    path: 'charts/difficulty-ribbon',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/difficulty-ribbon-chart-page/difficulty-ribbon-chart-page.component').then(
        (m) => m.DifficultyRibbonChartPageComponent,
      ),
  },
  {
    path: 'charts/nvt-ratio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/nvt-ratio-chart-page/nvt-ratio-chart-page.component').then(
        (m) => m.NvtRatioChartPageComponent,
      ),
  },
  {
    path: 'charts/thermocap-multiple',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/thermocap-multiple-chart-page/thermocap-multiple-chart-page.component').then(
        (m) => m.ThermocapMultipleChartPageComponent,
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
    path: 'trading-plans',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/trading-plans-page/trading-plans-page.component').then(
        (m) => m.TradingPlansPageComponent,
      ),
  },
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
