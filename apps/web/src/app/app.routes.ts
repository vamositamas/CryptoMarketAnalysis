import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Route, Router, RouterLink } from '@angular/router';
import type { FavouriteChart, RecentChart, SignalScore, SignalSummary } from '@crypto-market-analysis/data-access/api-client';
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
import { LanguageService } from './services/language.service';
import { LegalDialogService } from './services/legal-dialog.service';

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
          BitWLab — Bitcoin Blockchain Analysis
        </h1>
        <p i18n="Landing supporting copy@@landing.text">
          A focused research workspace for Bitcoin valuation models, cycle signals,
          and long-term market context. Create an account to open the live charts.
        </p>
        <div class="landing-promises" aria-label="Platform promises">
          <p>
            <strong i18n="Landing free promise lead@@landing.freePromiseLead">Free forever.</strong>
            <ng-container i18n="Landing free promise body@@landing.freePromiseBody">
              Every chart, alert, dashboard, and research tool is available without subscriptions, premium tiers, or paywalls.
            </ng-container>
          </p>
          <p>
            <strong i18n="Landing data promise lead@@landing.dataPromiseLead">Built on free data.</strong>
            <ng-container i18n="Landing data promise body@@landing.dataPromiseBody">
              BitWLab uses publicly available and no-cost data sources, so the analysis stays transparent and accessible.
            </ng-container>
          </p>
        </div>
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
        <div class="lp-chart" aria-hidden="true">
          <svg viewBox="0 0 560 180" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <!-- Valuation zone bands: top = overheated, bottom = accumulation -->
            <rect width="560" height="36" fill="rgba(239,68,68,0.13)"/>
            <rect y="36" width="560" height="36" fill="rgba(249,115,22,0.10)"/>
            <rect y="72" width="560" height="36" fill="rgba(234,179,8,0.10)"/>
            <rect y="108" width="560" height="36" fill="rgba(132,204,22,0.08)"/>
            <rect y="144" width="560" height="36" fill="rgba(20,92,75,0.09)"/>
            <!-- Zone separators -->
            <line x1="0" y1="36"  x2="560" y2="36"  stroke="rgba(0,0,0,0.06)" stroke-width="1"/>
            <line x1="0" y1="72"  x2="560" y2="72"  stroke="rgba(0,0,0,0.06)" stroke-width="1"/>
            <line x1="0" y1="108" x2="560" y2="108" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>
            <line x1="0" y1="144" x2="560" y2="144" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>
            <!-- Vertical time grid -->
            <line x1="112" y1="0" x2="112" y2="180" stroke="rgba(0,0,0,0.04)" stroke-width="1"/>
            <line x1="224" y1="0" x2="224" y2="180" stroke="rgba(0,0,0,0.04)" stroke-width="1"/>
            <line x1="336" y1="0" x2="336" y2="180" stroke="rgba(0,0,0,0.04)" stroke-width="1"/>
            <line x1="448" y1="0" x2="448" y2="180" stroke="rgba(0,0,0,0.04)" stroke-width="1"/>
            <!-- Area fill under BTC price line -->
            <path d="M0,158 C18,154 38,148 62,138 C84,128 100,112 122,88
                     C136,72 148,32 170,10 C184,6 196,46 216,58
                     C232,68 242,16 265,10 C282,6 295,24 312,46
                     C326,64 334,138 356,152 C374,164 392,166 410,158
                     C428,150 440,132 458,110 C474,90 484,62 504,36
                     C516,20 530,10 548,8 L560,10
                     L560,180 L0,180 Z"
                  fill="rgba(20,92,75,0.09)"/>
            <!-- BTC price line -->
            <path d="M0,158 C18,154 38,148 62,138 C84,128 100,112 122,88
                     C136,72 148,32 170,10 C184,6 196,46 216,58
                     C232,68 242,16 265,10 C282,6 295,24 312,46
                     C326,64 334,138 356,152 C374,164 392,166 410,158
                     C428,150 440,132 458,110 C474,90 484,62 504,36
                     C516,20 530,10 548,8 L560,10"
                  stroke="#145c4b" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <!-- 200-day MA — dashed amber -->
            <path d="M0,158 C25,154 55,148 85,136 C108,126 125,106 148,82
                     C163,66 174,48 198,40 C218,34 232,54 250,66
                     C266,77 272,40 295,34 C310,30 322,54 336,90
                     C350,122 362,152 382,158 C400,164 416,158 434,146
                     C452,134 464,114 482,90 C496,72 508,46 528,28
                     C542,16 554,12 560,14"
                  stroke="#f7b731" stroke-width="1.5" fill="none"
                  stroke-dasharray="5,4" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="metric-strip">
          <span><ng-container i18n="Landing preview rainbow@@landing.rainbow">Rainbow</ng-container> <strong>Locked</strong></span>
          <span><ng-container i18n="Landing preview pi cycle@@landing.piCycle">Pi Cycle</ng-container> <strong>Locked</strong></span>
          <span><ng-container i18n="Landing preview NUPL@@landing.nupl">NUPL</ng-container> <strong>Locked</strong></span>
          <span><ng-container i18n="Landing preview Global M2@@landing.globalM2">Global M2</ng-container> <strong>Locked</strong></span>
          <span><ng-container i18n="Landing preview DXY@@landing.dxy">DXY</ng-container> <strong>Locked</strong></span>
        </div>
      </div>
    </section>

    <!-- Indicators strip -->
    <div class="lp-strip" aria-label="Available analytical models" role="list">
      <span class="lp-strip__label" aria-hidden="true" i18n="Indicators strip label@@landing.stripLabel">Models (40)</span>
      <ul class="lp-strip__list">
        <li tabindex="0" data-tooltip="Compares Bitcoin market value with realized value to highlight historically overheated or undervalued cycle zones.">
          MVRV Z-Score
        </li>
        <li tabindex="0" data-tooltip="Logarithmic valuation bands that place Bitcoin price into long-term market-cycle ranges.">
          Rainbow Band
        </li>
        <li tabindex="0" data-tooltip="Moving-average crossover indicator designed to flag potential late-cycle Bitcoin market tops.">
          Pi Cycle Top
        </li>
        <li tabindex="0" data-tooltip="Scarcity model comparing Bitcoin supply issuance with market price around halving cycles.">
          Stock-to-Flow
        </li>
        <li tabindex="0" data-tooltip="Extends Stock-to-Flow by including miner transaction fees in issuance flow for scarcity-model context.">
          Stock to Income
        </li>
        <li tabindex="0" data-tooltip="Market sentiment gauge that blends volatility, momentum, social, dominance, and trend inputs.">
          Fear &amp; Greed
        </li>
        <li tabindex="0" data-tooltip="Net Unrealized Profit/Loss maps aggregate holder profit and loss into Bitcoin sentiment-cycle phases.">
          Bitcoin NUPL
        </li>
        <li
          tabindex="0"
          data-tooltip="Compares long-term and short-term holder profit-taking behavior through the LTH/STH SOPR ratio."
          i18n-data-tooltip="Landing SOPR Ratio tooltip@@landing.model.soprRatio.tooltip"
          i18n="Landing SOPR Ratio label@@landing.model.soprRatio"
        >
          SOPR Ratio
        </li>
        <li tabindex="0" data-tooltip="Miner revenue multiple used to spot periods of miner stress or cycle euphoria.">
          Puell Multiple
        </li>
        <li tabindex="0" data-tooltip="Long-term power-law trend with floor and ceiling bands based on Bitcoin history since genesis.">
          Power Law
        </li>
        <li tabindex="0" data-tooltip="Cumulative Value Coin Days Destroyed model used as a historical Bitcoin cycle-bottom signal.">
          CVDD
        </li>
        <li tabindex="0" data-tooltip="Polar chart that overlays Bitcoin halving cycles to compare current cycle position with past cycles.">
          Halving Spiral
        </li>
        <li tabindex="0" data-tooltip="Tracks Bitcoin price history across halving cycles to show current-cycle progress against prior market eras.">
          Bitcoin Halving Progress
        </li>
        <li
          tabindex="0"
          data-tooltip="Aligns Bitcoin bull-market breakouts by days since the prior all-time high and scales previous eras to the current reward era."
          i18n-data-tooltip="Landing Compare Bull Markets tooltip@@landing.model.compareBullMarkets.tooltip"
          i18n="Landing Compare Bull Markets label@@landing.model.compareBullMarkets"
        >
          Compare Bull Markets
        </li>
        <li tabindex="0" data-tooltip="Average on-chain acquisition price of circulating coins, often used as a cycle support baseline.">
          Realized Price
        </li>
        <li tabindex="0" data-tooltip="Long-term moving average used to compare current price against broad market trend.">
          200-Day MA
        </li>
        <li tabindex="0" data-tooltip="Compares Bitcoin price with the 2-year moving average and multiplier bands for broad buy and sell zones.">
          2-Year MA Multiplier
        </li>
        <li tabindex="0" data-tooltip="Combines several top and bottom models into a cycle price-target toolkit.">
          Price Forecast Tools
        </li>
        <li tabindex="0" data-tooltip="Hash-rate moving averages used to identify miner capitulation and recovery phases.">
          Hash Ribbons
        </li>
        <li tabindex="0" data-tooltip="Value Days Destroyed metric that relates coin movement age and value to market-cycle extremes.">
          VDD Multiple
        </li>
        <li tabindex="0" data-tooltip="Ratio of Bitcoin price to the 200-day moving average, used for overheated and undervalued zones.">
          Mayer Multiple
        </li>
        <li tabindex="0" data-tooltip="Mining difficulty moving averages that compress and expand around miner stress and recovery.">
          Difficulty Ribbon
        </li>
        <li tabindex="0" data-tooltip="Shows Bitcoin price relative to its 200-week moving average, a long-term cycle floor reference.">
          200-Week MA Heatmap
        </li>
        <li tabindex="0" data-tooltip="Network Value to Transactions ratio, comparing Bitcoin market cap with on-chain transaction volume.">
          NVT Ratio
        </li>
        <li tabindex="0" data-tooltip="Compares market cap with cumulative miner revenue to show how expensive Bitcoin is relative to security spend.">
          Thermocap Multiple
        </li>
        <li
          tabindex="0"
          data-tooltip="Tracks the total BTC held on exchanges. Rising reserves imply more coins available for sale (bearish); falling reserves imply accumulation and increasing scarcity (bullish)."
          i18n-data-tooltip="Landing Exchange Reserve tooltip@@landing.model.exchangeReserve.tooltip"
          i18n="Landing Exchange Reserve label@@landing.model.exchangeReserve"
        >
          Exchange Reserve
        </li>
        <li
          tabindex="0"
          data-tooltip="Tracks perpetual futures funding rate and open interest as a gauge of leveraged market sentiment. Extreme positive funding with rising open interest has historically marked overheated, squeeze-prone conditions."
          i18n-data-tooltip="Landing Funding Rate tooltip@@landing.model.fundingRateOi.tooltip"
          i18n="Landing Funding Rate label@@landing.model.fundingRateOi"
        >
          Funding Rate &amp; Open Interest
        </li>
        <li
          tabindex="0"
          data-tooltip="Tracks the daily net BTC flow into or out of exchanges — the leading edge of the Exchange Reserve trend. Positive netflow implies more coins available for sale (bearish); negative netflow implies accumulation and increasing scarcity (bullish)."
          i18n-data-tooltip="Landing Exchange Netflow tooltip@@landing.model.exchangeNetflow.tooltip"
          i18n="Landing Exchange Netflow label@@landing.model.exchangeNetflow"
        >
          Exchange Netflow
        </li>
        <li tabindex="0" data-tooltip="Macro liquidity indicator using money growth and economic growth to identify risk-on conditions.">
          Excess Liquidity
        </li>
        <li tabindex="0" data-tooltip="Compares S&P 500 performance with excess liquidity to show broader macro risk conditions.">
          S&amp;P 500 Liquidity
        </li>
        <li tabindex="0" data-tooltip="Compares global broad-money growth with Bitcoin year-over-year returns to show liquidity-cycle alignment.">
          Global M2 vs BTC
        </li>
        <li tabindex="0" data-tooltip="Compares US dollar year-over-year strength with Bitcoin price to show the inverse dollar-liquidity signal.">
          DXY vs Bitcoin
        </li>
        <li tabindex="0" data-tooltip="Overlays Bitcoin and S&P 500 12-month RSI with the Chicago Fed National Activity Index, aligned to US midterm election cycles.">
          Midterm Cycles
        </li>
        <li
          tabindex="0"
          data-tooltip="Compares market cap with realized cap in dollar terms, the same relationship behind the MVRV Z-Score presented as raw cap values."
          i18n-data-tooltip="Landing Realized Cap tooltip@@landing.model.realizedCap.tooltip"
          i18n="Landing Realized Cap label@@landing.model.realizedCap"
        >
          Realized Cap
        </li>
        <li
          tabindex="0"
          data-tooltip="Splits SOPR into long-term and short-term holder cohorts. LTH capitulation below 1 has historically clustered near major cycle bottoms."
          i18n-data-tooltip="Landing LTH STH SOPR split tooltip@@landing.model.lthSthSoprSplit.tooltip"
          i18n="Landing LTH STH SOPR split label@@landing.model.lthSthSoprSplit"
        >
          LTH-SOPR / STH-SOPR Split
        </li>
        <li
          tabindex="0"
          data-tooltip="Tracks worldwide Google search interest for bitcoin, a classic retail-euphoria proxy that complements the Fear & Greed Index."
          i18n-data-tooltip="Landing Google Trends tooltip@@landing.model.googleTrendsBitcoin.tooltip"
          i18n="Landing Google Trends label@@landing.model.googleTrendsBitcoin"
        >
          Google Trends: Bitcoin
        </li>
        <li
          tabindex="0"
          data-tooltip="Annualized 30-day / 90-day price volatility computed from BTC's own price history — volatility compression has historically preceded large moves in either direction."
          i18n-data-tooltip="Landing Realized Volatility tooltip@@landing.model.realizedVolatility.tooltip"
          i18n="Landing Realized Volatility label@@landing.model.realizedVolatility"
        >
          Realized Volatility
        </li>
        <li
          tabindex="0"
          data-tooltip="Unique daily active addresses — a fundamentals-based network usage trend, independent of the valuation-ratio charts elsewhere in this library."
          i18n-data-tooltip="Landing Active Addresses tooltip@@landing.model.activeAddresses.tooltip"
          i18n="Landing Active Addresses label@@landing.model.activeAddresses"
        >
          Active Addresses
        </li>
        <li
          tabindex="0"
          data-tooltip="Total network computational power — a raw miner-investment and network-security trend, complementing Hash Ribbons and Puell Multiple."
          i18n-data-tooltip="Landing Hash Rate tooltip@@landing.model.hashRate.tooltip"
          i18n="Landing Hash Rate label@@landing.model.hashRate"
        >
          Hash Rate
        </li>
        <li
          tabindex="0"
          data-tooltip="Deribit's options-implied volatility index (DVOL) — a forward-looking counterpart to Realized Volatility, with history since 2021 only."
          i18n-data-tooltip="Landing BTC DVOL tooltip@@landing.model.btcDvol.tooltip"
          i18n="Landing BTC DVOL label@@landing.model.btcDvol"
        >
          Implied Volatility (DVOL)
        </li>
      </ul>
    </div>

    <section class="landing-section" aria-labelledby="platform-title">
      <div class="section-heading">
        <p class="eyebrow" i18n="Landing platform eyebrow@@landing.platformEyebrow">
          Platform functions
        </p>
        <h2 id="platform-title" i18n="Landing platform title@@landing.platformTitle">
          A focused Bitcoin research workspace for everyday market analysis
        </h2>
      </div>
      <div class="feature-grid">
        <article>
          <span>01</span>
          <h3 i18n="Landing function charts title@@landing.functionChartsTitle">Interactive charts</h3>
          <p i18n="Landing function charts copy@@landing.functionChartsCopy">
            Explore valuation models, cycle indicators, moving averages, and macro context in one chart library.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3 i18n="Landing function workspace title@@landing.functionWorkspaceTitle">Personal workspace</h3>
          <p i18n="Landing function workspace copy@@landing.functionWorkspaceCopy">
            Save dashboards, follow recent charts, and organize the signals that matter to your research.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3 i18n="Landing function workflow title@@landing.functionWorkflowTitle">Research workflow</h3>
          <p i18n="Landing function workflow copy@@landing.functionWorkflowCopy">
            Use alerts, trading plans, exports, and admin tools without subscriptions or paid data feeds.
          </p>
        </article>
      </div>
    </section>

    <section class="landing-section landing-access">
      <div>
        <p class="eyebrow" i18n="Landing access eyebrow@@landing.accessEyebrow">
          Free access
        </p>
        <h2 i18n="Landing access title@@landing.accessTitle">
          The full platform is totally free to use and relies only on free data sources.
        </h2>
      </div>
      <a class="primary-link" routerLink="/register" i18n="Landing access CTA@@landing.accessCta">
        Start with registration
      </a>
    </section>

    <footer class="landing-footer">
      <div class="lp-footer-info">
        <strong>BitWLab</strong>
        <p i18n="Landing copyright@@landing.copyright">
          © 2026 BitWLab. All rights reserved.
        </p>
        <p i18n="Landing risk notice@@landing.riskNotice">
          Not financial advice. Cryptocurrency investments carry risk.
        </p>
      </div>
      <nav class="lp-footer-links" aria-label="Legal">
        <button type="button" (click)="legal.open('disclaimer')" i18n="Landing disclaimer link@@landing.disclaimerLink">Disclaimer</button>
        <button type="button" (click)="legal.open('privacy-policy')" i18n="Landing privacy policy link@@landing.privacyPolicy">Privacy Policy</button>
        <button type="button" (click)="legal.open('terms-of-use')" i18n="Landing terms of use link@@landing.termsOfUse">Terms of Use</button>
      </nav>
    </footer>
  `,
})
export class LandingPage {
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);
  protected readonly legal = inject(LegalDialogService);

  constructor() {
    if (this.authSession.currentUser()) {
      void this.router.navigate(['/dashboard']);
    }
  }
}

@Component({
  selector: 'app-disclaimer-page',
  imports: [RouterLink],
  template: `
    <article class="disclaimer-page">
      <a routerLink="/" class="disclaimer-back" i18n="Disclaimer back link@@disclaimer.back">← Back</a>
      <h1 i18n="Disclaimer page title@@disclaimer.title">Disclaimer – No Financial Advice</h1>

      <p i18n="Disclaimer intro@@disclaimer.intro">
        The information, data, charts, analytics, metrics, indicators, and blockchain-related content provided
        on this platform are for informational and educational purposes only.
      </p>

      <p i18n="Disclaimer not advisor@@disclaimer.notAdvisor">
        This platform is not a financial advisor, investment advisor, broker, dealer, or financial institution.
        Nothing displayed on this website constitutes financial advice, investment advice, trading advice,
        legal advice, tax advice, or any recommendation to buy, sell, hold, or trade any cryptocurrency,
        digital asset, token, security, or financial instrument.
      </p>

      <p i18n="Disclaimer data sources@@disclaimer.dataSources">
        All information presented on this platform is derived from publicly available blockchain data,
        third-party data providers, or automated analytical processes. The platform merely aggregates,
        visualizes, and presents blockchain information and current network activity through charts,
        dashboards, statistics, and other analytical tools.
      </p>

      <p i18n="Disclaimer historical data@@disclaimer.historicalData">
        The charts, indicators, rankings, wallet information, transaction data, market metrics, and other
        visualizations displayed on this website reflect historical or real-time blockchain data and should
        not be interpreted as predictions, guarantees, recommendations, or endorsements of future performance.
      </p>

      <p i18n="Disclaimer volatility@@disclaimer.volatility">
        Cryptocurrency and digital asset markets are highly volatile and involve substantial risk. Users are
        solely responsible for conducting their own research and due diligence before making any financial,
        investment, or trading decisions. Any actions taken based on information obtained from this platform
        are done entirely at the user's own risk.
      </p>

      <p i18n="Disclaimer accuracy@@disclaimer.accuracy">
        While we strive to provide accurate and up-to-date information, we make no representations or
        warranties regarding the accuracy, completeness, reliability, availability, or timeliness of any
        information displayed. Blockchain data may be delayed, incomplete, inaccurate, or subject to
        technical limitations.
      </p>

      <p i18n="Disclaimer acknowledgement intro@@disclaimer.acknowledgementIntro">
        By using this platform, you acknowledge and agree that:
      </p>
      <ul>
        <li i18n="Disclaimer ack 1@@disclaimer.ack1">The platform provides informational blockchain data only.</li>
        <li i18n="Disclaimer ack 2@@disclaimer.ack2">No financial, investment, legal, or tax advice is being provided.</li>
        <li i18n="Disclaimer ack 3@@disclaimer.ack3">You are solely responsible for your own investment and trading decisions.</li>
        <li i18n="Disclaimer ack 4@@disclaimer.ack4">The platform and its operators shall not be liable for any losses, damages, or consequences arising from the use of the information provided.</li>
      </ul>

      <p i18n="Disclaimer consult@@disclaimer.consult">
        Always consult qualified financial, legal, and tax professionals before making any investment decisions.
      </p>
    </article>
  `,
})
export class DisclaimerPage {}

@Component({
  selector: 'app-privacy-policy-page',
  imports: [RouterLink],
  template: `
    <article class="disclaimer-page">
      <a routerLink="/" class="disclaimer-back" i18n="Privacy policy back link@@privacy.back">← Back</a>
      <h1 i18n="Privacy policy title@@privacy.title">Privacy Policy</h1>
      <p class="legal-meta" i18n="Privacy policy date@@privacy.date">Last updated: 24 June 2026</p>

      <h2 i18n="Privacy section 1 title@@privacy.s1.title">1. What we collect</h2>
      <p i18n="Privacy section 1 body@@privacy.s1.body">
        When you create an account we collect your email address and, if provided, your full name.
        During normal use we collect standard server logs (IP address, browser type, pages visited) for
        security and performance purposes. We do not collect payment information.
      </p>

      <h2 i18n="Privacy section 2 title@@privacy.s2.title">2. How we use your data</h2>
      <p i18n="Privacy section 2 body@@privacy.s2.body">
        Your data is used solely to operate the service: authenticate your account, deliver email
        notifications and alerts you have configured, and improve the platform. We do not sell, rent, or
        share your personal data with third parties for marketing purposes.
      </p>

      <h2 i18n="Privacy section 3 title@@privacy.s3.title">3. Data storage and security</h2>
      <p i18n="Privacy section 3 body@@privacy.s3.body">
        Data is stored on servers within the European Union. We use industry-standard encryption (TLS) for
        data in transit and apply access controls to data at rest. Passwords are stored as
        one-way cryptographic hashes and are never stored in plain text.
      </p>

      <h2 i18n="Privacy section 4 title@@privacy.s4.title">4. Cookies and local storage</h2>
      <p i18n="Privacy section 4 body@@privacy.s4.body">
        We use a single session cookie to keep you logged in and browser local storage to remember your
        language preference and dashboard layout. No third-party tracking cookies are used.
      </p>

      <h2 i18n="Privacy section 5 title@@privacy.s5.title">5. Your rights</h2>
      <p i18n="Privacy section 5 body@@privacy.s5.body">
        You may request access to, correction of, or deletion of your personal data at any time by
        contacting us. Accounts can be deleted on request. We will respond within 30 days.
      </p>

      <h2 i18n="Privacy section 6 title@@privacy.s6.title">6. Changes to this policy</h2>
      <p i18n="Privacy section 6 body@@privacy.s6.body">
        We may update this policy from time to time. Material changes will be communicated via the
        platform or email. Continued use of the service after changes constitutes acceptance.
      </p>

      <h2 i18n="Privacy section 7 title@@privacy.s7.title">7. Contact</h2>
      <p i18n="Privacy section 7 body@@privacy.s7.body">
        Questions about this policy can be directed to the platform operator via the contact information
        provided on the platform.
      </p>
    </article>
  `,
})
export class PrivacyPolicyPage {}

@Component({
  selector: 'app-terms-of-use-page',
  imports: [RouterLink],
  template: `
    <article class="disclaimer-page">
      <a routerLink="/" class="disclaimer-back" i18n="Terms of use back link@@terms.back">← Back</a>
      <h1 i18n="Terms of use title@@terms.title">Terms of Use</h1>
      <p class="legal-meta" i18n="Terms of use date@@terms.date">Last updated: 24 June 2026</p>

      <h2 i18n="Terms section 1 title@@terms.s1.title">1. Acceptance of terms</h2>
      <p i18n="Terms section 1 body@@terms.s1.body">
        By registering for or using BitWLab you agree to these Terms of Use in full. If you do not agree
        you must not use the platform. You must be at least 18 years of age to use this service.
      </p>

      <h2 i18n="Terms section 2 title@@terms.s2.title">2. Description of service</h2>
      <p i18n="Terms section 2 body@@terms.s2.body">
        BitWLab provides Bitcoin on-chain analytics, valuation model charts, cycle indicators, and related
        informational tools. All content is provided for informational purposes only and does not constitute
        financial advice. See the full Disclaimer for details.
      </p>

      <h2 i18n="Terms section 3 title@@terms.s3.title">3. Your account</h2>
      <p i18n="Terms section 3 body@@terms.s3.body">
        You are responsible for maintaining the confidentiality of your login credentials and for all
        activity that occurs under your account. You must notify us immediately of any unauthorised use
        of your account.
      </p>

      <h2 i18n="Terms section 4 title@@terms.s4.title">4. Acceptable use</h2>
      <p i18n="Terms section 4 body@@terms.s4.body">
        You agree not to: attempt to reverse-engineer, scrape, or systematically extract data from the
        platform; interfere with or disrupt the service or its servers; use the service for any unlawful
        purpose; or impersonate any person or entity.
      </p>

      <h2 i18n="Terms section 5 title@@terms.s5.title">5. Intellectual property</h2>
      <p i18n="Terms section 5 body@@terms.s5.body">
        All platform content, design, code, and branding are the property of the platform operator and
        are protected by applicable intellectual-property laws. You may not copy, reproduce, or redistribute
        any part of the platform without prior written permission.
      </p>

      <h2 i18n="Terms section 6 title@@terms.s6.title">6. Disclaimer of warranties</h2>
      <p i18n="Terms section 6 body@@terms.s6.body">
        The service is provided "as is" and "as available" without warranties of any kind, either express
        or implied. We do not warrant that the service will be uninterrupted, error-free, or that data
        will be accurate, complete, or current at all times.
      </p>

      <h2 i18n="Terms section 7 title@@terms.s7.title">7. Limitation of liability</h2>
      <p i18n="Terms section 7 body@@terms.s7.body">
        To the fullest extent permitted by law, the platform operator shall not be liable for any
        indirect, incidental, special, consequential, or punitive damages, including loss of profits or
        data, arising from your use of the service or reliance on any information provided.
      </p>

      <h2 i18n="Terms section 8 title@@terms.s8.title">8. Termination</h2>
      <p i18n="Terms section 8 body@@terms.s8.body">
        We reserve the right to suspend or terminate your account at any time if you violate these terms
        or for any other reason at our sole discretion, with or without notice.
      </p>

      <h2 i18n="Terms section 9 title@@terms.s9.title">9. Governing law</h2>
      <p i18n="Terms section 9 body@@terms.s9.body">
        These terms are governed by the laws of Hungary. Any disputes shall be subject to the exclusive
        jurisdiction of the courts of Hungary.
      </p>

      <h2 i18n="Terms section 10 title@@terms.s10.title">10. Changes to terms</h2>
      <p i18n="Terms section 10 body@@terms.s10.body">
        We may revise these terms at any time. The updated version will be posted on this page with a new
        effective date. Continued use of the service after changes constitutes your acceptance of the
        revised terms.
      </p>
    </article>
  `,
})
export class TermsOfUsePage {}

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
            class="dashboard-actions-trigger"
            [attr.aria-expanded]="isDashboardActionsOpen()"
            aria-haspopup="menu"
            aria-label="Dashboard actions"
            i18n-aria-label="Dashboard actions button@@dashboard.actions"
            (click)="toggleDashboardActions()"
          >
            <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a9 9 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"></path>
            </svg>
          </button>
          @if (isDashboardActionsOpen()) {
            <div class="dashboard-actions-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                [disabled]="isRefreshing()"
                (click)="refreshData()"
              >
                <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h8V3l-3.3 3.3Z"></path>
                </svg>
                @if (isRefreshing()) {
                  <ng-container i18n="Refreshing state@@dashboard.refreshing">Refreshing...</ng-container>
                } @else {
                  <ng-container i18n="Refresh data button@@dashboard.refreshData">Refresh Data</ng-container>
                }
              </button>
              <button
                type="button"
                role="menuitem"
                (click)="openAddSignal()"
              >
                <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"></path>
                </svg>
                <ng-container i18n="Add signal button@@dashboard.openAddSignal">Add Signal</ng-container>
              </button>
              <button
                type="button"
                role="menuitem"
                (click)="openAddWidget()"
              >
                <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"></path>
                </svg>
                <ng-container i18n="Add widget button@@dashboard.openAddWidget">Add Widget</ng-container>
              </button>
            </div>
          }
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
        <div class="msi-banner" [attr.data-zone]="s.overallZone">
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
            <span class="msi-zone-badge" [attr.data-zone]="s.overallZone">{{ getZoneLabel(s.overallZone) }}</span>
            <span class="msi-btc">BTC: {{ formatUsd(s.btcPriceUsd) }}</span>
            <a class="msi-link" routerLink="/trading-plans" i18n="View Trade Planner link@@dashboard.viewTradePlanner">View Trade Planner →</a>
          </div>
          <!-- Signal grid -->
          <div class="msi-grid" [style.--signal-columns]="signalColumnCount(s)">
            @for (sig of visibleSignals(s); track sig.name) {
              <div class="msi-sig" [attr.data-zone]="sig.zone">
                <button
                  type="button"
                  class="msi-sig-remove"
                  aria-label="Remove signal"
                  i18n-aria-label="Remove signal aria label@@dashboard.removeSignal"
                  (click)="removeSignal(sig.name)"
                >×</button>
                <span class="msi-sig-label">{{ getSignalLabel(sig.name, sig.label) }}</span>
                <span class="msi-sig-value">{{ sig.zone === 'no_data' ? 'N/A' : sig.formattedValue }}</span>
                <span class="msi-sig-zone">{{ sig.zone === 'no_data' ? '—' : getZoneLabel(sig.zone) }}</span>
              </div>
            }
          </div>
        </div>
      }

      @if (isAddSignalOpen() && signals()) {
        @let s = signals()!;
        <div class="widget-modal-overlay" role="presentation" (click)="closeAddSignal()">
          <section
            class="widget-modal signal-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add signal"
            i18n-aria-label="Add signal dialog label@@dashboard.addSignalDialog"
            (click)="$event.stopPropagation()"
          >
            <div class="widget-modal-header">
              <h2 i18n="Add signal modal title@@dashboard.addSignalTitle">Add Signal</h2>
              <button
                type="button"
                class="modal-close-button"
                aria-label="Close add signal modal"
                i18n-aria-label="Close add signal modal@@dashboard.closeAddSignal"
                (click)="closeAddSignal()"
              >×</button>
            </div>
            <div class="signal-library">
              @for (sig of s.signals; track sig.name) {
                <article class="signal-library-item" [attr.data-zone]="sig.zone">
                  <div>
                    <strong>{{ getSignalLabel(sig.name, sig.label) }}</strong>
                    <span>{{ sig.zone === 'no_data' ? 'N/A' : sig.formattedValue }} · {{ sig.zone === 'no_data' ? '—' : getZoneLabel(sig.zone) }}</span>
                  </div>
                  <button
                    type="button"
                    class="secondary-button"
                    [disabled]="isSignalVisible(sig.name)"
                    (click)="addSignal(sig.name)"
                  >
                    @if (isSignalVisible(sig.name)) {
                      <ng-container i18n="Signal already added label@@dashboard.signalAdded">Added</ng-container>
                    } @else {
                      <ng-container i18n="Add signal item button@@dashboard.addSignalButton">Add</ng-container>
                    }
                  </button>
                </article>
              }
            </div>
          </section>
        </div>
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
              <span class="widget-title">{{ getWidgetTitle(widget) }}</span>
              @if (widget.type === '24h_change') {
                <strong class="widget-value" [class]="'widget-value--' + widget.trend">
                  {{ trendIndicator(widget.trend) }}{{ widget.formattedValue }}
                </strong>
                @if (livePriceData(); as lp) {
                  <div class="widget-price-details">
                    <div class="widget-price-row">
                      <span class="widget-price-label" i18n="Open price label@@widget.openPrice">Open</span>
                      <span class="widget-price-val">{{ formatUsdDetailed(lp.openPriceUsd) }}</span>
                    </div>
                    <div class="widget-price-row">
                      <span class="widget-price-label" i18n="Current price label@@widget.currentPrice">Current</span>
                      <span class="widget-price-val">{{ formatUsdDetailed(lp.priceUsd) }}</span>
                    </div>
                  </div>
                }
              } @else if (widget.type !== 'halving_progress') {
                <strong class="widget-value">{{ widget.formattedValue }}</strong>
                @if (widget.type === 'btc_price' && livePriceData(); as lp) {
                  <small class="widget-trend" [class]="livePriceChangePct(lp) >= 0 ? 'trend-up' : 'trend-down'">
                    {{ livePriceChangePct(lp) >= 0 ? '↑' : '↓' }}{{ formatTrendPercent(livePriceChangePct(lp)) }}
                  </small>
                } @else {
                  <small class="widget-trend" [class]="'trend-' + widget.trend">
                    {{ trendIndicator(widget.trend) }}
                    @if (widget.trendPercent !== null) {
                      {{ formatTrendPercent(widget.trendPercent) }}
                    }
                  </small>
                }
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
              @if (widget.type === 'nupl' && widget.value !== null) {
                <div class="wi-gauge">
                  <div class="wi-gauge-bar wi-gauge-bar--nupl">
                    <span class="wi-gauge-marker" [style.left.%]="nuplPosition(widget.value)"></span>
                  </div>
                  <div class="wi-gauge-labels">
                    <span>-50%</span><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                  <div class="wi-gauge-footer">
                    <span class="wi-gauge-label" [attr.data-zone]="nuplZone(widget.value)">{{ nuplLabel(widget.value) }}</span>
                    <span class="wi-gauge-score">{{ widget.formattedValue }}</span>
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
                      <span class="wi-halving-of" i18n="Halving of cycle label@@dashboard.halvingOfCycle">of cycle</span>
                    </div>
                  </div>
                  <div class="wi-halving-stats">
                    <div class="wi-halving-stat">
                      <span i18n="Days left label@@dashboard.halvingDaysLeft">Days left</span>
                      <strong>{{ halvingData.daysRemaining }}</strong>
                    </div>
                    <div class="wi-halving-stat">
                      <span i18n="Est next halving label@@dashboard.halvingEstNext">Est. next</span>
                      <strong>Apr '28</strong>
                    </div>
                    <div class="wi-halving-stat">
                      <span i18n="Cycle label@@dashboard.halvingCycle">Cycle</span>
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
              @let context = widgetContext(widget);
              @if (context !== null) {
                <div class="widget-context" [attr.data-zone]="context.zone">
                  <div class="widget-context-top">
                    <span>{{ context.label }}</span>
                    <strong>{{ context.detail }}</strong>
                  </div>
                  @if (context.position !== null) {
                    <div class="widget-context-bar" [attr.data-zone]="context.zone">
                      <span [style.left.%]="context.position"></span>
                    </div>
                    <div class="widget-context-scale">
                      <span>{{ context.minLabel }}</span>
                      <span>{{ context.maxLabel }}</span>
                    </div>
                  }
                </div>
              }
              @if (widget.type !== 'halving_progress') {
                <small class="widget-updated">{{ lastUpdatedText(widget.lastUpdated) }}</small>
              }
            </article>
          }
        </div>
      }

      <div class="recent-charts-section">
        <div class="charts-tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            class="charts-tab-btn"
            [class.active]="chartTab() === 'favourites'"
            [attr.aria-selected]="chartTab() === 'favourites'"
            (click)="chartTab.set('favourites')"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13"
              [attr.fill]="chartTab() === 'favourites' ? 'currentColor' : 'none'"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <ng-container i18n="Favourites tab label@@dashboard.favouritesTab">Favourites</ng-container>
            @if (favouriteCharts().length > 0) {
              <span class="charts-tab-count">{{ favouriteCharts().length }}</span>
            }
          </button>
          <button
            type="button"
            role="tab"
            class="charts-tab-btn"
            [class.active]="chartTab() === 'recent'"
            [attr.aria-selected]="chartTab() === 'recent'"
            (click)="chartTab.set('recent')"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <ng-container i18n="Recently viewed tab label@@dashboard.recentlyViewedTab">Recently Viewed</ng-container>
          </button>
        </div>

        @if (chartTab() === 'favourites') {
          @if (isLoadingFavouriteCharts()) {
            <p class="recent-charts-loading" i18n="Favourites loading@@dashboard.favouritesLoading">Loading...</p>
          } @else if (favouriteCharts().length === 0) {
            <p class="recent-charts-empty" i18n="No favourites message@@dashboard.noFavourites">
              No favourite charts yet. Open any chart and click <strong>Save</strong> to bookmark it here.
            </p>
            <a routerLink="/charts" class="secondary-button" i18n="Explore charts button@@dashboard.exploreCharts">Explore Charts</a>
          } @else {
            <div class="recent-charts-grid">
              @for (chart of favouriteCharts(); track chart.chartId) {
                <a class="recent-chart-card" [routerLink]="chart.url">
                  <div class="recent-chart-thumb">
                    @if (chart.chartId === 'stock-to-flow') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                        <rect x="186" y="0" width="58"  height="360" fill="rgba(239,68,68,0.07)"/>
                        <rect x="398" y="0" width="62"  height="360" fill="rgba(239,68,68,0.07)"/>
                        <rect x="608" y="0" width="56"  height="360" fill="rgba(239,68,68,0.07)"/>
                        <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <path d="M 0,358 C 120,352 200,325 280,280 C 360,230 445,165 555,72 C 648,28 730,10 800,5"
                              stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="10,5" fill="none" opacity="0.9"/>
                        <path d="M 0,358 C 100,356 140,350 155,345 C 168,285 196,181 213,173 C 228,278 260,260 272,243 C 305,228 338,204 347,196 C 368,162 407,66 424,63 C 440,118 468,265 477,131 C 493,103 505,87 510,87 C 528,116 541,113 555,92 C 574,56 618,14 632,12 C 648,40 677,268 685,72 C 702,50 737,25 763,17 C 775,12 792,14 800,14"
                              stroke="#17202a" stroke-width="2.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'bitcoin-rainbow') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                        <rect x="0" y="0"   width="800" height="46"  fill="rgba(127,29,29,0.06)"/>
                        <rect x="0" y="46"  width="800" height="37"  fill="rgba(239,68,68,0.05)"/>
                        <rect x="0" y="83"  width="800" height="35"  fill="rgba(249,115,22,0.05)"/>
                        <rect x="0" y="118" width="800" height="34"  fill="rgba(234,179,8,0.05)"/>
                        <rect x="0" y="152" width="800" height="35"  fill="rgba(132,204,22,0.05)"/>
                        <rect x="0" y="187" width="800" height="32"  fill="rgba(34,197,94,0.05)"/>
                        <rect x="0" y="219" width="800" height="37"  fill="rgba(6,182,212,0.05)"/>
                        <rect x="0" y="256" width="800" height="35"  fill="rgba(37,99,235,0.05)"/>
                        <rect x="0" y="291" width="800" height="69"  fill="rgba(30,58,138,0.05)"/>
                        <path d="M 0,322 C 80,318 130,312 155,307 C 168,228 200,76 213,70 C 228,285 260,312 272,308 C 308,294 346,264 355,254 C 372,188 408,34 424,28 C 441,90 472,247 507,242 C 522,236 542,230 555,226 C 573,186 617,93 632,96 C 649,165 678,226 685,220 C 703,210 741,198 763,195 C 776,194 792,196 800,196"
                              stroke="#111820" stroke-width="2.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'pi-cycle-top') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="155" y1="0" x2="155" y2="360" stroke="#e5ebe7" stroke-width="1" stroke-dasharray="6,5"/>
                        <line x1="347" y1="0" x2="347" y2="360" stroke="#e5ebe7" stroke-width="1" stroke-dasharray="6,5"/>
                        <line x1="555" y1="0" x2="555" y2="360" stroke="#e5ebe7" stroke-width="1" stroke-dasharray="6,5"/>
                        <line x1="763" y1="0" x2="763" y2="360" stroke="#e5ebe7" stroke-width="1" stroke-dasharray="6,5"/>
                        <path d="M 0,355 C 100,351 140,344 155,340 C 168,278 194,173 210,163 C 226,272 258,252 270,237 C 303,218 336,196 346,188 C 366,152 405,57 424,62 C 440,112 468,254 477,122 C 492,94 504,78 509,79 C 526,108 540,105 555,84 C 572,48 617,10 630,12 C 645,33 675,258 685,62 C 700,42 735,18 763,10 C 774,7 792,9 800,10"
                              stroke="#2dafe6" stroke-width="2.5" fill="none"/>
                        <path d="M 0,357 C 100,354 140,348 155,344 C 168,284 196,181 216,172 C 232,276 263,258 274,244 C 308,228 340,204 350,196 C 369,161 407,64 423,62 C 441,116 469,262 480,132 C 495,104 508,87 513,89 C 530,114 542,111 558,94 C 576,58 619,14 643,12 C 658,38 678,265 688,72 C 703,50 738,24 763,16 C 776,11 792,13 800,14"
                              stroke="#17202a" stroke-width="2.5" fill="none"/>
                        <circle cx="424" cy="63"  r="9" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" stroke-width="2"/>
                        <circle cx="630" cy="12"  r="9" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" stroke-width="2"/>
                      </svg>
                    } @else if (chart.chartId === 'mvrv-z-score') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                        <rect x="0" y="0"   width="800" height="88"  fill="rgba(239,68,68,0.04)"/>
                        <rect x="0" y="88"  width="800" height="53"  fill="rgba(249,115,22,0.035)"/>
                        <rect x="0" y="141" width="800" height="53"  fill="rgba(234,179,8,0.03)"/>
                        <rect x="0" y="194" width="800" height="88"  fill="rgba(34,197,94,0.03)"/>
                        <rect x="0" y="282" width="800" height="78"  fill="rgba(59,130,246,0.04)"/>
                        <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <path d="M 0,355 C 100,352 140,346 155,342 C 168,306 198,250 212,243 C 228,295 260,308 272,303 C 308,284 345,240 355,228 C 372,175 408,68 424,62 C 440,102 468,238 477,126 C 492,98 505,84 510,85 C 528,108 542,104 555,85 C 574,50 617,12 632,10 C 648,42 677,250 685,68 C 703,46 737,22 763,14 C 776,10 792,12 800,13"
                              stroke="#17202a" stroke-width="2.5" fill="none"/>
                      <path d="M 0,300 C 50,288 90,175 108,62 C 120,240 148,310 168,298 C 210,272 268,186 300,118 C 318,280 356,312 380,302 C 415,258 448,105 462,55 C 476,188 510,308 528,292 C 548,242 584,95 605,58 C 622,175 652,300 668,286 C 696,254 745,224 778,232 C 790,236 797,240 800,242"
                              stroke="#f59e0b" stroke-width="2.5" fill="none" opacity="0.95"/>
                      </svg>
                    } @else if (chart.chartId === 'nupl') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect x="0" y="0" width="800" height="60" fill="rgba(244,114,182,0.18)"/>
                        <rect x="0" y="60" width="800" height="60" fill="rgba(253,186,116,0.28)"/>
                        <rect x="0" y="120" width="800" height="60" fill="rgba(254,249,195,0.52)"/>
                        <rect x="0" y="180" width="800" height="60" fill="rgba(236,253,245,0.86)"/>
                        <rect x="0" y="240" width="800" height="120" fill="rgba(16,185,129,0.12)"/>
                        <path d="M 0,350 C 80,345 125,325 155,295 C 175,278 192,252 212,230 C 232,212 258,214 276,224 C 318,246 354,246 380,228 C 420,200 445,136 462,84 C 485,118 512,226 532,252 C 560,288 594,188 610,92 C 638,126 656,252 678,284 C 704,252 740,216 778,222 C 790,225 797,229 800,232"
                              stroke="#20bde8" stroke-width="3" fill="none"/>
                        <path d="M 0,355 C 100,352 140,346 155,342 C 168,306 198,250 212,243 C 228,295 260,308 272,303 C 308,284 345,240 355,228 C 372,175 408,68 424,62 C 440,102 468,238 477,126 C 492,98 505,84 510,85 C 528,108 542,104 555,85 C 574,50 617,12 632,10 C 648,42 677,250 685,68 C 703,46 737,22 763,14 C 776,10 792,12 800,13"
                              stroke="#1f2933" stroke-width="2.25" fill="none" opacity="0.92"/>
                      </svg>
                    } @else if (chart.chartId === 'realized-price') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="72" x2="800" y2="72" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="144" x2="800" y2="144" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="216" x2="800" y2="216" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="288" x2="800" y2="288" stroke="#e5e7eb" stroke-width="1"/>
                        <path d="M 0,350 C 70,340 105,240 132,225 C 150,214 170,310 196,298 C 245,276 286,238 320,212 C 352,188 378,66 405,72 C 430,78 448,170 472,146 C 506,112 535,106 566,98 C 602,90 620,34 650,32 C 684,30 704,74 728,68 C 754,62 780,50 800,54"
                              stroke="#1f2933" stroke-width="2.5" fill="none"/>
                        <path d="M 0,354 C 70,330 112,320 150,310 C 176,304 196,298 230,294 C 276,288 312,280 345,260 C 382,236 398,182 426,176 C 468,166 510,158 548,150 C 590,140 606,112 642,105 C 686,96 725,92 760,86 C 780,82 792,80 800,80"
                              stroke="#ff8a1f" stroke-width="2.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'sopr-ratio') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="72" x2="800" y2="72" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="144" x2="800" y2="144" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="216" x2="800" y2="216" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="288" x2="800" y2="288" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="rgba(107,114,128,0.65)" stroke-width="1.5" stroke-dasharray="7,5"/>
                        <path d="M 0,300 C 80,260 120,120 165,160 C 210,205 250,250 310,218 C 370,188 390,108 450,130 C 510,152 540,238 600,218 C 660,198 705,128 760,150 C 780,158 794,168 800,170"
                              stroke="#16a34a" stroke-width="3" fill="none"/>
                        <path d="M 0,300 C 90,268 140,160 185,172 C 235,185 280,230 330,214 C 390,196 420,145 470,145 C 530,146 560,210 620,206 C 675,202 712,160 770,164 C 785,166 795,168 800,170"
                              stroke="#f59e0b" stroke-width="2" fill="none" opacity="0.9"/>
                        <path d="M 0,295 C 110,270 175,205 245,205 C 330,206 380,178 455,168 C 535,158 600,182 665,180 C 720,178 760,174 800,172"
                              stroke="#64748b" stroke-width="2" fill="none" opacity="0.9"/>
                        <path d="M 0,355 C 105,350 150,342 175,336 C 215,300 250,270 300,240 C 350,210 390,150 430,132 C 475,112 520,124 560,94 C 620,48 705,28 800,22"
                              stroke="#111820" stroke-width="2.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'puell-multiple') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                        <rect x="0" y="0"   width="800" height="90"  fill="rgba(239,68,68,0.04)"/>
                        <rect x="0" y="90"  width="800" height="180" fill="rgba(234,179,8,0.025)"/>
                        <rect x="0" y="270" width="800" height="90"  fill="rgba(34,197,94,0.04)"/>
                        <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <path d="M 0,355 C 100,352 140,346 155,342 C 168,306 198,250 212,243 C 228,295 260,308 272,303 C 308,284 345,240 355,228 C 372,175 408,68 424,62 C 440,102 468,238 477,126 C 492,98 505,84 510,85 C 528,108 542,104 555,85 C 574,50 617,12 632,10 C 648,42 677,250 685,68 C 703,46 737,22 763,14 C 776,10 792,12 800,13"
                              stroke="#17202a" stroke-width="2.5" fill="none"/>
                        <path d="M 0,320 C 40,305 80,285 105,38 C 118,230 148,308 165,318 C 155,345 158,350 165,318 C 200,295 265,240 298,185 C 315,58 338,38 350,32 C 362,180 390,305 408,315 C 350,340 348,345 408,315 C 445,290 490,225 510,52 C 524,195 545,305 560,315 C 548,342 548,345 560,315 C 598,280 648,235 668,210 C 690,60 720,35 735,28 C 748,150 768,290 780,305 C 790,312 797,316 800,318"
                              stroke="#6366f1" stroke-width="2.5" fill="none" opacity="0.95"/>
                      </svg>
                    } @else if (chart.chartId === 'bitcoin-power-law') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <path d="M 0,290 L 800,30" stroke="#ef4444" stroke-width="2" fill="none" opacity="0.85"/>
                        <path d="M 0,330 L 800,110" stroke="#f97316" stroke-width="2" fill="none" opacity="0.85"/>
                        <path d="M 0,352 L 800,195" stroke="#60a5fa" stroke-width="2" fill="none" opacity="0.85"/>
                        <path d="M 0,354 C 60,352 100,348 115,345 C 130,328 148,295 158,282 C 175,312 200,330 218,325 C 255,305 300,270 315,255 C 335,212 365,150 380,145 C 394,175 415,238 430,210 C 445,185 460,165 468,166 C 482,184 492,182 504,168 C 518,140 545,102 558,104 C 570,124 588,228 596,148 C 608,128 630,108 645,104 C 654,103 664,108 670,110 C 682,108 720,92 745,80 C 762,74 785,68 800,65"
                              stroke="#17202a" stroke-width="2.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'bitcoin-cvdd') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <path d="M 0,358 C 80,354 140,346 200,330 C 280,310 360,280 440,245 C 520,210 620,175 700,155 C 740,145 770,138 800,132"
                              stroke="#22c55e" stroke-width="2.5" fill="none" opacity="0.9"/>
                        <path d="M 0,355 C 60,352 100,348 115,345 C 130,308 158,254 172,247 C 188,295 220,310 232,305 C 268,288 305,246 315,232 C 334,180 368,72 384,66 C 400,106 428,240 437,128 C 452,100 465,86 470,87 C 488,110 502,107 515,89 C 534,54 575,16 590,14 C 606,44 633,252 641,72 C 657,50 693,26 717,18 C 728,14 745,16 752,17 C 768,15 782,16 800,100"
                              stroke="#17202a" stroke-width="2.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'halving-spiral') {
                      <svg viewBox="0 0 360 360" preserveAspectRatio="xMidYMid meet">
                        <rect width="360" height="360" fill="#fff"/>
                        <circle cx="180" cy="180" r="30"  stroke="#e5e7eb" stroke-width="1" fill="none"/>
                        <circle cx="180" cy="180" r="60"  stroke="#e5e7eb" stroke-width="1" fill="none"/>
                        <circle cx="180" cy="180" r="90"  stroke="#e5e7eb" stroke-width="1" fill="none"/>
                        <circle cx="180" cy="180" r="120" stroke="#e5e7eb" stroke-width="1" fill="none"/>
                        <circle cx="180" cy="180" r="150" stroke="#e5e7eb" stroke-width="1" fill="none"/>
                        <line x1="180" y1="30"  x2="180" y2="180" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,4"/>
                        <line x1="330" y1="180" x2="180" y2="180" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,4"/>
                        <line x1="180" y1="330" x2="180" y2="180" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,4"/>
                        <line x1="30"  y1="180" x2="180" y2="180" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,4"/>
                        <path d="M 180,155 C 196,148 210,154 215,168 C 220,183 214,198 200,206 C 185,214 168,210 158,197 C 148,183 152,165 165,157 C 174,152 182,153 186,160"
                              stroke="#94a3b8" stroke-width="1.5" fill="none"/>
                        <path d="M 180,120 C 220,108 255,126 264,162 C 273,198 252,232 219,244 C 185,256 149,241 132,210 C 115,178 128,141 158,126 C 170,120 182,120 188,128"
                              stroke="#60a5fa" stroke-width="1.5" fill="none"/>
                        <path d="M 180,80 C 240,62 294,94 310,152 C 326,210 295,268 240,286 C 184,304 126,276 100,222 C 74,168 96,108 148,86 C 160,81 174,80 182,88"
                              stroke="#22d3ee" stroke-width="1.5" fill="none"/>
                        <path d="M 180,46 C 264,24 336,72 352,156 C 368,240 320,318 240,338 C 158,358 80,308 52,228 C 24,148 68,72 144,50 C 155,47 170,45 178,52"
                              stroke="#f59e0b" stroke-width="1.5" fill="none"/>
                        <path d="M 180,46 C 216,38 252,50 276,76 C 300,102 308,138 298,168"
                              stroke="#f43f5e" stroke-width="2" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'vdd-multiple') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="72"  x2="800" y2="72"  stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="144" x2="800" y2="144" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="216" x2="800" y2="216" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="288" x2="800" y2="288" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="100" x2="800" y2="100" stroke="rgba(239,68,68,0.55)" stroke-width="1.5" stroke-dasharray="8,5"/>
                        <line x1="0" y1="282" x2="800" y2="282" stroke="rgba(34,197,94,0.55)" stroke-width="1.5" stroke-dasharray="8,5"/>
                        <rect x="0"   y="310" width="6" height="50" fill="rgba(34,197,94,0.82)"/>
                        <rect x="8"   y="295" width="6" height="65" fill="rgba(34,197,94,0.82)"/>
                        <rect x="16"  y="305" width="6" height="55" fill="rgba(34,197,94,0.82)"/>
                        <rect x="24"  y="300" width="6" height="60" fill="rgba(34,197,94,0.82)"/>
                        <rect x="32"  y="290" width="6" height="70" fill="rgba(34,197,94,0.82)"/>
                        <rect x="48"  y="240" width="6" height="120" fill="rgba(249,115,22,0.85)"/>
                        <rect x="56"  y="220" width="6" height="140" fill="rgba(249,115,22,0.85)"/>
                        <rect x="64"  y="200" width="6" height="160" fill="rgba(249,115,22,0.85)"/>
                        <rect x="72"  y="180" width="6" height="180" fill="rgba(249,115,22,0.85)"/>
                        <rect x="88"  y="55"  width="6" height="305" fill="rgba(239,68,68,0.88)"/>
                        <rect x="96"  y="80"  width="6" height="280" fill="rgba(239,68,68,0.88)"/>
                        <rect x="112" y="310" width="6" height="50" fill="rgba(34,197,94,0.82)"/>
                        <rect x="120" y="305" width="6" height="55" fill="rgba(34,197,94,0.82)"/>
                        <rect x="128" y="295" width="6" height="65" fill="rgba(34,197,94,0.82)"/>
                        <rect x="144" y="240" width="6" height="120" fill="rgba(249,115,22,0.85)"/>
                        <rect x="152" y="215" width="6" height="145" fill="rgba(249,115,22,0.85)"/>
                        <rect x="160" y="195" width="6" height="165" fill="rgba(249,115,22,0.85)"/>
                        <rect x="168" y="185" width="6" height="175" fill="rgba(249,115,22,0.85)"/>
                        <rect x="184" y="50"  width="6" height="310" fill="rgba(239,68,68,0.88)"/>
                        <rect x="192" y="70"  width="6" height="290" fill="rgba(239,68,68,0.88)"/>
                        <rect x="208" y="308" width="6" height="52" fill="rgba(34,197,94,0.82)"/>
                        <rect x="216" y="300" width="6" height="60" fill="rgba(34,197,94,0.82)"/>
                        <rect x="224" y="295" width="6" height="65" fill="rgba(34,197,94,0.82)"/>
                        <rect x="240" y="245" width="6" height="115" fill="rgba(249,115,22,0.85)"/>
                        <rect x="248" y="220" width="6" height="140" fill="rgba(249,115,22,0.85)"/>
                        <rect x="256" y="200" width="6" height="160" fill="rgba(249,115,22,0.85)"/>
                        <rect x="264" y="185" width="6" height="175" fill="rgba(249,115,22,0.85)"/>
                        <rect x="272" y="175" width="6" height="185" fill="rgba(249,115,22,0.85)"/>
                        <rect x="288" y="45"  width="6" height="315" fill="rgba(239,68,68,0.88)"/>
                        <rect x="296" y="62"  width="6" height="298" fill="rgba(239,68,68,0.88)"/>
                        <rect x="312" y="312" width="6" height="48" fill="rgba(34,197,94,0.82)"/>
                        <rect x="320" y="305" width="6" height="55" fill="rgba(34,197,94,0.82)"/>
                        <rect x="328" y="298" width="6" height="62" fill="rgba(34,197,94,0.82)"/>
                        <rect x="344" y="250" width="6" height="110" fill="rgba(249,115,22,0.85)"/>
                        <rect x="352" y="228" width="6" height="132" fill="rgba(249,115,22,0.85)"/>
                        <rect x="360" y="208" width="6" height="152" fill="rgba(249,115,22,0.85)"/>
                        <rect x="368" y="192" width="6" height="168" fill="rgba(249,115,22,0.85)"/>
                        <rect x="384" y="58"  width="6" height="302" fill="rgba(239,68,68,0.88)"/>
                        <rect x="392" y="75"  width="6" height="285" fill="rgba(239,68,68,0.88)"/>
                        <rect x="416" y="265" width="6" height="95"  fill="rgba(249,115,22,0.85)"/>
                        <rect x="424" y="255" width="6" height="105" fill="rgba(249,115,22,0.85)"/>
                        <rect x="432" y="248" width="6" height="112" fill="rgba(249,115,22,0.85)"/>
                        <rect x="440" y="240" width="6" height="120" fill="rgba(249,115,22,0.85)"/>
                        <rect x="448" y="250" width="6" height="110" fill="rgba(249,115,22,0.85)"/>
                        <path d="M 0,355 C 30,354 55,350 80,342 C 110,328 130,310 160,288
                                 C 185,272 205,262 220,248 C 240,228 255,210 285,185
                                 C 310,165 330,155 350,140 C 375,122 395,108 410,95
                                 C 425,84 440,78 455,72"
                              stroke="#000000" stroke-width="2" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'halving-progress') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <rect x="0"   y="0" width="160" height="360" fill="rgba(220,252,231,0.08)"/>
                        <rect x="320" y="0" width="160" height="360" fill="rgba(220,252,231,0.08)"/>
                        <rect x="640" y="0" width="160" height="360" fill="rgba(219,234,254,0.08)"/>
                        <line x1="0" y1="60"  x2="800" y2="60"  stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="140" x2="800" y2="140" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="220" x2="800" y2="220" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="300" x2="800" y2="300" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="160" y1="0" x2="160" y2="360" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                        <line x1="320" y1="0" x2="320" y2="360" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                        <line x1="480" y1="0" x2="480" y2="360" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                        <line x1="640" y1="0" x2="640" y2="360" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                        <line x1="85"  y1="0" x2="85"  y2="360" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>
                        <line x1="245" y1="0" x2="245" y2="360" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>
                        <line x1="405" y1="0" x2="405" y2="360" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>
                        <line x1="565" y1="0" x2="565" y2="360" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>
                        <line x1="727" y1="0" x2="727" y2="360" stroke="#f59e0b" stroke-width="2" opacity="0.9"/>
                        <path d="M 0,355 C 20,354 40,353 55,349 C 70,342 80,330 90,300 C 100,260 110,240 130,210 C 145,188 155,172 160,165
                                 C 175,156 205,153 220,150 C 245,145 270,140 290,120 C 310,90 320,62 340,48 C 355,38 370,34 385,32 C 400,31 430,34 450,40
                                 C 468,48 480,58 495,80 C 510,105 520,120 530,105 C 540,88 555,65 570,56 C 585,46 600,42 615,38 C 625,35 635,34 640,34
                                 C 656,35 670,38 685,50 C 700,64 710,80 720,90 C 728,98 735,102 745,104"
                              stroke="#16a34a" stroke-width="2.5" fill="none"/>
                        <circle cx="90"  cy="300" r="3.5" fill="#dc2626"/>
                        <circle cx="340" cy="48"  r="3.5" fill="#dc2626"/>
                        <circle cx="570" cy="56"  r="3.5" fill="#dc2626"/>
                        <circle cx="745" cy="104" r="3.5" fill="#dc2626"/>
                      </svg>
                    } @else if (chart.chartId === 'compare-bull-markets') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="60" x2="800" y2="60" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="130" x2="800" y2="130" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="200" x2="800" y2="200" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="360" y1="0" x2="360" y2="360" stroke="rgba(22,163,74,0.55)" stroke-width="1.5" stroke-dasharray="5,5"/>
                        <path d="M 0,285 C 45,210 75,82 110,58 C 135,112 155,30 190,22 C 230,36 255,145 300,155 C 360,168 405,130 470,105 C 540,92 595,118 660,82 C 710,62 760,70 800,78"
                              stroke="#1d75b9" stroke-width="2.4" fill="none"/>
                        <path d="M 0,300 C 58,292 95,240 142,180 C 188,118 222,74 262,80 C 310,92 330,150 370,190 C 430,230 500,210 555,186 C 625,160 698,174 800,132"
                              stroke="#f97316" stroke-width="2.4" fill="none"/>
                        <path d="M 0,292 C 52,252 82,205 125,158 C 170,112 220,134 268,165 C 332,205 390,224 452,205 C 540,178 590,154 650,110 C 710,75 760,62 800,70"
                              stroke="#16a34a" stroke-width="2.4" fill="none"/>
                        <path d="M 0,284 C 50,276 92,265 138,254 C 186,242 230,232 275,220 C 328,205 372,188 420,174"
                              stroke="#dc2626" stroke-width="2.4" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === '2yr-ma-multiplier') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <path d="M 340,355 C 380,310 440,230 520,140 C 600,60 680,28 800,18"
                              stroke="#ef4444" stroke-width="2" fill="none" opacity="0.85"/>
                        <path d="M 320,358 C 360,320 420,250 500,168 C 580,88 660,50 800,40"
                              stroke="rgba(239,68,68,0.55)" stroke-width="1.5" fill="none"/>
                        <path d="M 300,360 C 340,332 400,270 480,198 C 560,120 640,78 800,62"
                              stroke="rgba(239,68,68,0.35)" stroke-width="1.5" fill="none"/>
                        <path d="M 280,360 C 320,345 380,296 460,232 C 540,162 620,112 800,88"
                              stroke="rgba(239,68,68,0.2)" stroke-width="1" fill="none"/>
                        <path d="M 260,360 C 300,356 360,330 440,268 C 520,198 620,148 800,118"
                              stroke="#22c55e" stroke-width="2.5" fill="none" opacity="0.9"/>
                        <path d="M 0,358 C 100,356 140,350 155,345 C 168,285 196,181 213,173 C 228,278 260,308 272,295 C 308,272 345,228 355,216 C 372,162 408,52 424,48 C 440,102 468,248 477,128 C 492,100 505,86 510,87 C 528,110 542,106 555,87 C 574,50 617,10 632,8 C 648,40 677,250 685,68 C 703,46 737,22 763,14 C 776,10 792,12 800,13"
                              stroke="#1f2937" stroke-width="1.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'price-forecast-tools') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                        <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                        <path d="M 0,358 C 60,350 120,320 180,270 C 250,210 320,140 400,90 C 480,48 560,22 640,12 C 700,8 750,8 800,7"
                              stroke="#3b82f6" stroke-width="2" fill="none" opacity="0.9"/>
                        <path d="M 0,360 C 80,356 160,345 240,320 C 320,290 400,240 480,180 C 560,120 640,70 720,40 C 760,26 780,20 800,18"
                              stroke="#ef4444" stroke-width="2" fill="none" opacity="0.85"/>
                        <path d="M 240,360 C 300,340 360,295 430,232 C 500,168 570,110 640,70 C 700,42 750,26 800,20"
                              stroke="#a855f7" stroke-width="2" fill="none" opacity="0.85"/>
                        <path d="M 0,360 C 100,358 200,355 300,348 C 380,340 440,320 520,280 C 600,238 680,190 760,150 C 780,140 792,135 800,132"
                              stroke="#f97316" stroke-width="2" fill="none" opacity="0.85"/>
                        <path d="M 480,360 C 540,345 600,310 660,268 C 710,234 750,205 800,185"
                              stroke="#22c55e" stroke-width="2" fill="none" opacity="0.85"/>
                        <path d="M 0,358 C 80,356 130,350 155,340 C 170,295 195,200 215,195 C 230,295 262,320 275,305 C 310,280 345,235 358,220 C 375,168 410,60 426,52 C 442,110 470,255 480,140 C 494,108 508,90 513,91 C 530,115 545,110 557,92 C 576,55 618,14 634,10 C 650,44 678,255 687,72 C 704,50 738,24 763,16 C 777,11 792,13 800,14"
                              stroke="#1f2937" stroke-width="1.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'mayer-multiple') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="80" x2="800" y2="80" stroke="rgba(239,68,68,0.5)" stroke-width="1" stroke-dasharray="6,4"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="rgba(34,197,94,0.5)" stroke-width="1" stroke-dasharray="6,4"/>
                        <path d="M 0,200 C 60,190 100,240 150,220 C 200,200 230,100 280,80 C 320,65 360,160 400,170 C 440,180 480,90 530,70 C 570,55 620,160 680,140 C 720,130 760,120 800,125" stroke="#0d9488" stroke-width="2" fill="none"/>
                        <path d="M 0,355 C 80,340 150,290 220,240 C 290,190 360,150 430,120 C 500,95 570,85 640,75 C 700,68 760,65 800,63" stroke="#1f2937" stroke-width="1.5" fill="none" opacity="0.6"/>
                      </svg>
                    } @else if (chart.chartId === '200-week-ma-heatmap') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <path d="M 0,340 C 100,320 200,280 300,230 C 380,190 450,150 540,110 C 620,78 700,65 800,58" stroke="#ef4444" stroke-width="2" fill="none"/>
                        <path d="M 0,355 C 60,350 110,335 160,305 C 220,268 270,228 340,195 C 410,163 460,135 530,108 C 600,82 680,62 740,50 C 765,45 785,42 800,40" stroke="#1f2937" stroke-width="1.5" fill="none"/>
                        <circle cx="200" cy="290" r="5" fill="#22c55e" opacity="0.8"/>
                        <circle cx="340" cy="205" r="5" fill="#86efac" opacity="0.8"/>
                        <circle cx="480" cy="140" r="5" fill="#fbbf24" opacity="0.8"/>
                        <circle cx="620" cy="82" r="5" fill="#f97316" opacity="0.8"/>
                        <circle cx="760" cy="48" r="5" fill="#ef4444" opacity="0.8"/>
                      </svg>
                    } @else if (chart.chartId === 'fear-greed-index') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <rect x="0" y="260" width="800" height="100" fill="rgba(239,68,68,0.08)"/>
                        <rect x="0" y="0" width="800" height="80" fill="rgba(34,197,94,0.08)"/>
                        <rect x="0" y="280" width="60" height="80" fill="rgba(239,68,68,0.7)" rx="2"/>
                        <rect x="65" y="240" width="60" height="120" fill="rgba(239,68,68,0.55)" rx="2"/>
                        <rect x="130" y="200" width="60" height="160" fill="rgba(239,68,68,0.4)" rx="2"/>
                        <rect x="195" y="160" width="60" height="200" fill="rgba(239,68,68,0.25)" rx="2"/>
                        <rect x="260" y="120" width="60" height="240" fill="rgba(250,204,21,0.5)" rx="2"/>
                        <rect x="325" y="100" width="60" height="260" fill="rgba(250,204,21,0.5)" rx="2"/>
                        <rect x="390" y="60" width="60" height="300" fill="rgba(34,197,94,0.4)" rx="2"/>
                        <rect x="455" y="20" width="60" height="340" fill="rgba(34,197,94,0.6)" rx="2"/>
                        <rect x="520" y="80" width="60" height="280" fill="rgba(34,197,94,0.45)" rx="2"/>
                        <rect x="585" y="130" width="60" height="230" fill="rgba(250,204,21,0.5)" rx="2"/>
                        <rect x="650" y="90" width="60" height="270" fill="rgba(34,197,94,0.5)" rx="2"/>
                        <rect x="715" y="110" width="85" height="250" fill="rgba(250,204,21,0.5)" rx="2"/>
                        <path d="M 0,355 C 80,340 150,300 220,265 C 290,230 360,195 430,160 C 500,125 560,100 620,90 C 680,80 740,85 800,82" stroke="#1f2937" stroke-width="1.5" fill="none" opacity="0.7"/>
                      </svg>
                    } @else if (chart.chartId === 'hash-ribbons') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <path d="M 0,300 C 60,280 100,240 150,220 C 200,200 240,210 290,200 C 340,190 380,170 430,160 C 480,150 520,155 570,145 C 620,135 680,125 800,115" stroke="#3b82f6" stroke-width="2" fill="none"/>
                        <path d="M 0,320 C 60,305 100,270 150,255 C 200,240 240,245 290,238 C 340,231 380,218 430,210 C 480,202 520,204 570,196 C 620,188 680,178 800,168" stroke="#f97316" stroke-width="2" fill="none"/>
                        <circle cx="180" cy="218" r="7" fill="#22c55e" opacity="0.9"/>
                        <circle cx="520" cy="153" r="7" fill="#22c55e" opacity="0.9"/>
                        <path d="M 0,358 C 80,350 150,320 220,280 C 290,240 360,200 430,175 C 500,150 570,135 640,118 C 700,105 760,98 800,95" stroke="#1f2937" stroke-width="1.5" fill="none" opacity="0.6"/>
                      </svg>
                    } @else if (chart.chartId === 'difficulty-ribbon') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <path d="M 200,340 C 280,310 360,255 440,210 C 520,168 620,130 800,105" stroke="#ef4444" stroke-width="1.5" fill="none"/>
                        <path d="M 180,342 C 260,314 340,260 420,216 C 500,174 600,138 800,114" stroke="#f97316" stroke-width="1.5" fill="none"/>
                        <path d="M 160,344 C 240,318 320,266 400,223 C 480,181 580,147 800,123" stroke="#eab308" stroke-width="1.5" fill="none"/>
                        <path d="M 140,346 C 220,322 300,272 380,231 C 460,190 560,158 800,132" stroke="#84cc16" stroke-width="1.5" fill="none"/>
                        <path d="M 120,348 C 200,326 280,278 360,239 C 440,200 540,169 800,141" stroke="#22c55e" stroke-width="1.5" fill="none"/>
                        <path d="M 100,350 C 180,330 260,284 340,247 C 420,210 520,180 800,150" stroke="#06b6d4" stroke-width="1.5" fill="none"/>
                        <path d="M 80,352 C 160,334 240,290 320,255 C 400,220 500,191 800,159" stroke="#6366f1" stroke-width="1.5" fill="none"/>
                        <path d="M 60,354 C 140,338 220,296 300,263 C 380,230 480,202 800,168" stroke="#a855f7" stroke-width="1.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'nvt-ratio') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="100" x2="800" y2="100" stroke="rgba(239,68,68,0.3)" stroke-width="1" stroke-dasharray="6,4"/>
                        <line x1="0" y1="280" x2="800" y2="280" stroke="rgba(34,197,94,0.3)" stroke-width="1" stroke-dasharray="6,4"/>
                        <path d="M 0,200 C 60,180 100,120 150,80 C 190,50 220,130 270,160 C 310,185 350,120 400,100 C 440,82 480,160 530,200 C 570,230 620,160 680,130 C 720,110 760,150 800,145" stroke="#f97316" stroke-width="2" fill="none"/>
                        <path d="M 0,220 C 60,205 100,175 150,148 C 200,122 250,145 300,158 C 350,170 400,140 450,132 C 500,124 550,155 600,170 C 650,183 720,155 800,150" stroke="#ef4444" stroke-width="1.5" fill="none" stroke-dasharray="5,3"/>
                        <path d="M 0,355 C 80,340 150,305 220,268 C 290,232 360,196 430,165 C 500,135 570,118 640,105 C 700,95 760,90 800,88" stroke="#1f2937" stroke-width="1.5" fill="none" opacity="0.6"/>
                      </svg>
                    } @else if (chart.chartId === 'thermocap-multiple') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <rect x="0" y="0" width="800" height="80" fill="rgba(239,68,68,0.08)"/>
                        <rect x="0" y="270" width="800" height="90" fill="rgba(34,197,94,0.08)"/>
                        <line x1="0" y1="80" x2="800" y2="80" stroke="rgba(239,68,68,0.4)" stroke-width="1" stroke-dasharray="6,4"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="rgba(34,197,94,0.4)" stroke-width="1" stroke-dasharray="6,4"/>
                        <path d="M 0,310 C 60,295 100,240 140,180 C 175,128 200,60 240,52 C 275,115 310,300 345,310 C 380,305 410,250 445,200 C 475,158 500,65 535,55 C 565,120 595,295 625,308 C 655,305 680,265 720,230 C 750,203 775,175 800,165" stroke="#0d9488" stroke-width="2" fill="none"/>
                        <path d="M 0,355 C 80,340 150,305 220,268 C 290,232 360,196 430,165 C 500,135 570,118 640,105 C 700,95 760,90 800,88" stroke="#1f2937" stroke-width="1.5" fill="none" opacity="0.6"/>
                      </svg>
                    } @else if (chart.chartId === 'excess-liquidity') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                        <path d="M 0,195 C 30,210 55,240 80,260 C 105,280 120,300 140,310 C 160,320 175,300 195,270 C 215,240 230,200 250,175 C 270,150 285,130 305,110 C 325,90 345,75 365,70 C 385,65 405,80 425,105 C 445,130 460,160 480,185 C 500,210 515,230 535,240 C 555,250 575,240 595,215 C 615,190 635,160 655,135 C 675,110 695,90 720,80 C 745,70 770,75 800,85" stroke="#1f2937" stroke-width="2" fill="none"/>
                        <path d="M 0,160 C 40,155 75,145 110,138 C 145,130 175,118 210,108 C 245,98 275,90 310,88 C 345,86 375,92 410,102 C 445,113 475,128 510,148 C 545,168 575,188 610,198 C 645,208 675,205 710,195 C 745,185 775,172 800,165" stroke="rgba(234,179,8,0.9)" stroke-width="2.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'spx-liquidity') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="200" x2="800" y2="200" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                        <path d="M 0,215 C 15,210 25,195 40,185 C 55,175 65,160 80,150 C 95,140 105,148 120,155 C 135,162 145,168 160,162 C 175,156 185,140 200,125 C 215,110 225,100 240,92 C 255,84 265,80 280,75 C 295,70 310,72 325,78 C 340,84 350,88 365,82 C 380,76 390,65 405,52 C 420,39 430,28 445,20 C 460,12 475,15 490,22 C 505,29 515,40 530,52 C 545,64 555,80 570,95 C 585,110 595,128 610,145 C 625,162 640,178 655,188 C 670,198 685,202 700,198 C 715,194 730,182 750,172 C 770,162 785,155 800,150" stroke="#111827" stroke-width="2" fill="none"/>
                        <path d="M 0,155 C 40,148 80,138 120,128 C 160,118 200,108 240,102 C 280,96 320,95 360,98 C 400,101 440,110 480,125 C 520,140 560,158 600,170 C 640,182 680,185 720,178 C 750,172 775,162 800,155" stroke="#2563eb" stroke-width="2.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'midterm-cycles') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="0" y1="270" x2="800" y2="270" stroke="#e5e7eb" stroke-width="1"/>
                        <line x1="88" y1="20" x2="88" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                        <line x1="196" y1="20" x2="196" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                        <line x1="304" y1="20" x2="304" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                        <line x1="412" y1="20" x2="412" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                        <line x1="520" y1="20" x2="520" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                        <line x1="628" y1="20" x2="628" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                        <line x1="736" y1="20" x2="736" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                        <path d="M 0,270 C 30,260 55,240 80,210 C 100,185 110,150 130,120 C 150,90 165,70 185,65 C 205,75 220,120 240,160 C 255,190 265,230 285,255 C 305,270 320,265 340,240 C 360,215 375,180 395,150 C 415,120 430,95 450,80 C 470,75 485,100 505,140 C 520,170 530,210 550,235 C 570,255 585,258 605,240 C 625,218 640,185 660,155 C 680,125 695,100 715,88 C 730,80 748,90 768,118 C 785,142 795,170 800,185" stroke="#e07b39" stroke-width="2" fill="none"/>
                        <path d="M 0,255 C 30,248 55,235 80,215 C 100,198 115,175 135,155 C 155,135 170,120 190,118 C 210,125 225,148 245,175 C 262,198 272,225 292,242 C 312,255 327,250 347,232 C 367,212 382,185 402,162 C 422,140 437,122 457,115 C 477,118 492,140 512,168 C 528,192 538,220 558,238 C 578,252 592,252 612,238 C 632,220 647,195 667,172 C 687,150 700,132 720,125 C 738,122 755,132 775,152 C 790,168 797,185 800,195" stroke="#7ab3d4" stroke-width="1.5" fill="none"/>
                        <path d="M 0,175 C 40,172 80,168 120,165 C 160,162 200,160 240,162 C 280,165 320,170 360,172 C 400,174 440,172 480,168 C 520,164 560,158 600,155 C 640,152 680,152 720,156 C 755,160 780,165 800,168" stroke="#1a2e5e" stroke-width="2" fill="none" opacity="0.7"/>
                      </svg>
                    } @else if (chart.chartId === 'funding-rate-oi') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="rgba(180,83,9,0.4)" stroke-width="1" stroke-dasharray="6,4"/>
                        <path d="M 0,60 C 70,56 130,48 200,60 C 260,70 310,110 380,100 C 440,92 480,50 550,40 C 610,32 670,30 800,20"
                              stroke="#1f2933" stroke-width="2.5" fill="none"/>
                        <path d="M 0,190 C 60,170 110,150 160,185 C 210,220 250,140 300,120 C 350,100 400,230 450,210 C 500,195 550,150 600,175 C 650,198 700,160 800,150"
                              stroke="#f59e0b" stroke-width="2" fill="none"/>
                        <path d="M 0,330 C 100,326 200,320 300,310 C 400,298 500,270 600,240 C 680,215 740,200 800,190"
                              stroke="#7c3aed" stroke-width="2.5" fill="none"/>
                      </svg>
                    } @else if (chart.chartId === 'exchange-netflow') {
                      <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                        <rect width="800" height="360" fill="#fff"/>
                        <line x1="0" y1="180" x2="800" y2="180" stroke="rgba(75,85,99,0.4)" stroke-width="1" stroke-dasharray="6,4"/>
                        <rect x="10" y="140" width="34" height="40" fill="rgba(220,38,38,0.75)"/>
                        <rect x="54" y="160" width="34" height="20" fill="rgba(22,163,74,0.75)"/>
                        <rect x="98" y="100" width="34" height="80" fill="rgba(220,38,38,0.75)"/>
                        <rect x="142" y="180" width="34" height="30" fill="rgba(22,163,74,0.75)"/>
                        <rect x="186" y="150" width="34" height="30" fill="rgba(220,38,38,0.75)"/>
                        <rect x="230" y="180" width="34" height="55" fill="rgba(22,163,74,0.75)"/>
                        <rect x="274" y="120" width="34" height="60" fill="rgba(220,38,38,0.75)"/>
                        <rect x="318" y="180" width="34" height="15" fill="rgba(22,163,74,0.75)"/>
                        <rect x="362" y="90" width="34" height="90" fill="rgba(220,38,38,0.75)"/>
                        <rect x="406" y="180" width="34" height="70" fill="rgba(22,163,74,0.75)"/>
                        <rect x="450" y="160" width="34" height="20" fill="rgba(220,38,38,0.75)"/>
                        <rect x="494" y="180" width="34" height="40" fill="rgba(22,163,74,0.75)"/>
                        <rect x="538" y="110" width="34" height="70" fill="rgba(220,38,38,0.75)"/>
                        <rect x="582" y="180" width="34" height="25" fill="rgba(22,163,74,0.75)"/>
                        <rect x="626" y="150" width="34" height="30" fill="rgba(220,38,38,0.75)"/>
                        <rect x="670" y="180" width="34" height="60" fill="rgba(22,163,74,0.75)"/>
                        <rect x="714" y="130" width="34" height="50" fill="rgba(220,38,38,0.75)"/>
                        <rect x="758" y="180" width="34" height="35" fill="rgba(22,163,74,0.75)"/>
                        <path d="M 0,320 C 80,300 150,260 210,220 C 280,175 340,120 410,95 C 470,74 540,80 600,60 C 660,42 730,36 800,28"
                              stroke="#1f2933" stroke-width="2.5" fill="none"/>
                      </svg>
                    }
                  </div>
                  <div class="recent-chart-info">
                    <span class="recent-chart-title">{{ chart.title }}</span>
                  </div>
                </a>
              }
            </div>
          }
        }

        @if (chartTab() === 'recent') {
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
                  @if (chart.chartId === 'stock-to-flow') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                      <rect x="186" y="0" width="58"  height="360" fill="rgba(239,68,68,0.07)"/>
                      <rect x="398" y="0" width="62"  height="360" fill="rgba(239,68,68,0.07)"/>
                      <rect x="608" y="0" width="56"  height="360" fill="rgba(239,68,68,0.07)"/>
                      <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <path d="M 0,358 C 120,352 200,325 280,280 C 360,230 445,165 555,72 C 648,28 730,10 800,5"
                            stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="10,5" fill="none" opacity="0.9"/>
                      <path d="M 0,358 C 100,356 140,350 155,345 C 168,285 196,181 213,173 C 228,278 260,260 272,243 C 305,228 338,204 347,196 C 368,162 407,66 424,63 C 440,118 468,265 477,131 C 493,103 505,87 510,87 C 528,116 541,113 555,92 C 574,56 618,14 632,12 C 648,40 677,268 685,72 C 702,50 737,25 763,17 C 775,12 792,14 800,14"
                            stroke="#17202a" stroke-width="2.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'bitcoin-rainbow') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                      <rect x="0" y="0"   width="800" height="46"  fill="rgba(127,29,29,0.06)"/>
                      <rect x="0" y="46"  width="800" height="37"  fill="rgba(239,68,68,0.05)"/>
                      <rect x="0" y="83"  width="800" height="35"  fill="rgba(249,115,22,0.05)"/>
                      <rect x="0" y="118" width="800" height="34"  fill="rgba(234,179,8,0.05)"/>
                      <rect x="0" y="152" width="800" height="35"  fill="rgba(132,204,22,0.05)"/>
                      <rect x="0" y="187" width="800" height="32"  fill="rgba(34,197,94,0.05)"/>
                      <rect x="0" y="219" width="800" height="37"  fill="rgba(6,182,212,0.05)"/>
                      <rect x="0" y="256" width="800" height="35"  fill="rgba(37,99,235,0.05)"/>
                      <rect x="0" y="291" width="800" height="69"  fill="rgba(30,58,138,0.05)"/>
                      <path d="M 0,322 C 80,318 130,312 155,307 C 168,228 200,76 213,70 C 228,285 260,312 272,308 C 308,294 346,264 355,254 C 372,188 408,34 424,28 C 441,90 472,247 507,242 C 522,236 542,230 555,226 C 573,186 617,93 632,96 C 649,165 678,226 685,220 C 703,210 741,198 763,195 C 776,194 792,196 800,196"
                            stroke="#111820" stroke-width="2.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'pi-cycle-top') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="155" y1="0" x2="155" y2="360" stroke="#e5ebe7" stroke-width="1" stroke-dasharray="6,5"/>
                      <line x1="347" y1="0" x2="347" y2="360" stroke="#e5ebe7" stroke-width="1" stroke-dasharray="6,5"/>
                      <line x1="555" y1="0" x2="555" y2="360" stroke="#e5ebe7" stroke-width="1" stroke-dasharray="6,5"/>
                      <line x1="763" y1="0" x2="763" y2="360" stroke="#e5ebe7" stroke-width="1" stroke-dasharray="6,5"/>
                      <path d="M 0,355 C 100,351 140,344 155,340 C 168,278 194,173 210,163 C 226,272 258,252 270,237 C 303,218 336,196 346,188 C 366,152 405,57 424,62 C 440,112 468,254 477,122 C 492,94 504,78 509,79 C 526,108 540,105 555,84 C 572,48 617,10 630,12 C 645,33 675,258 685,62 C 700,42 735,18 763,10 C 774,7 792,9 800,10"
                            stroke="#2dafe6" stroke-width="2.5" fill="none"/>
                      <path d="M 0,357 C 100,354 140,348 155,344 C 168,284 196,181 216,172 C 232,276 263,258 274,244 C 308,228 340,204 350,196 C 369,161 407,64 423,62 C 441,116 469,262 480,132 C 495,104 508,87 513,89 C 530,114 542,111 558,94 C 576,58 619,14 643,12 C 658,38 678,265 688,72 C 703,50 738,24 763,16 C 776,11 792,13 800,14"
                            stroke="#17202a" stroke-width="2.5" fill="none"/>
                      <circle cx="424" cy="63"  r="9" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" stroke-width="2"/>
                      <circle cx="630" cy="12"  r="9" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" stroke-width="2"/>
                    </svg>
                  } @else if (chart.chartId === 'mvrv-z-score') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                      <rect x="0" y="0"   width="800" height="88"  fill="rgba(239,68,68,0.04)"/>
                      <rect x="0" y="88"  width="800" height="53"  fill="rgba(249,115,22,0.035)"/>
                      <rect x="0" y="141" width="800" height="53"  fill="rgba(234,179,8,0.03)"/>
                      <rect x="0" y="194" width="800" height="88"  fill="rgba(34,197,94,0.03)"/>
                      <rect x="0" y="282" width="800" height="78"  fill="rgba(59,130,246,0.04)"/>
                      <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <path d="M 0,355 C 100,352 140,346 155,342 C 168,306 198,250 212,243 C 228,295 260,308 272,303 C 308,284 345,240 355,228 C 372,175 408,68 424,62 C 440,102 468,238 477,126 C 492,98 505,84 510,85 C 528,108 542,104 555,85 C 574,50 617,12 632,10 C 648,42 677,250 685,68 C 703,46 737,22 763,14 C 776,10 792,12 800,13"
                            stroke="#17202a" stroke-width="2.5" fill="none"/>
                      <path d="M 0,300 C 50,288 90,175 108,62 C 120,240 148,310 168,298 C 210,272 268,186 300,118 C 318,280 356,312 380,302 C 415,258 448,105 462,55 C 476,188 510,308 528,292 C 548,242 584,95 605,58 C 622,175 652,300 668,286 C 696,254 745,224 778,232 C 790,236 797,240 800,242"
                            stroke="#f59e0b" stroke-width="2.5" fill="none" opacity="0.95"/>
                    </svg>
                  } @else if (chart.chartId === 'nupl') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect x="0" y="0" width="800" height="60" fill="rgba(244,114,182,0.18)"/>
                      <rect x="0" y="60" width="800" height="60" fill="rgba(253,186,116,0.28)"/>
                      <rect x="0" y="120" width="800" height="60" fill="rgba(254,249,195,0.52)"/>
                      <rect x="0" y="180" width="800" height="60" fill="rgba(236,253,245,0.86)"/>
                      <rect x="0" y="240" width="800" height="120" fill="rgba(16,185,129,0.12)"/>
                      <path d="M 0,350 C 80,345 125,325 155,295 C 175,278 192,252 212,230 C 232,212 258,214 276,224 C 318,246 354,246 380,228 C 420,200 445,136 462,84 C 485,118 512,226 532,252 C 560,288 594,188 610,92 C 638,126 656,252 678,284 C 704,252 740,216 778,222 C 790,225 797,229 800,232"
                            stroke="#20bde8" stroke-width="3" fill="none"/>
                      <path d="M 0,355 C 100,352 140,346 155,342 C 168,306 198,250 212,243 C 228,295 260,308 272,303 C 308,284 345,240 355,228 C 372,175 408,68 424,62 C 440,102 468,238 477,126 C 492,98 505,84 510,85 C 528,108 542,104 555,85 C 574,50 617,12 632,10 C 648,42 677,250 685,68 C 703,46 737,22 763,14 C 776,10 792,12 800,13"
                            stroke="#1f2933" stroke-width="2.25" fill="none" opacity="0.92"/>
                    </svg>
                  } @else if (chart.chartId === 'realized-price') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="72" x2="800" y2="72" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="144" x2="800" y2="144" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="216" x2="800" y2="216" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="288" x2="800" y2="288" stroke="#e5e7eb" stroke-width="1"/>
                      <path d="M 0,350 C 70,340 105,240 132,225 C 150,214 170,310 196,298 C 245,276 286,238 320,212 C 352,188 378,66 405,72 C 430,78 448,170 472,146 C 506,112 535,106 566,98 C 602,90 620,34 650,32 C 684,30 704,74 728,68 C 754,62 780,50 800,54"
                            stroke="#1f2933" stroke-width="2.5" fill="none"/>
                      <path d="M 0,354 C 70,330 112,320 150,310 C 176,304 196,298 230,294 C 276,288 312,280 345,260 C 382,236 398,182 426,176 C 468,166 510,158 548,150 C 590,140 606,112 642,105 C 686,96 725,92 760,86 C 780,82 792,80 800,80"
                            stroke="#ff8a1f" stroke-width="2.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'sopr-ratio') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="72" x2="800" y2="72" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="144" x2="800" y2="144" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="216" x2="800" y2="216" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="288" x2="800" y2="288" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="rgba(107,114,128,0.65)" stroke-width="1.5" stroke-dasharray="7,5"/>
                      <path d="M 0,300 C 80,260 120,120 165,160 C 210,205 250,250 310,218 C 370,188 390,108 450,130 C 510,152 540,238 600,218 C 660,198 705,128 760,150 C 780,158 794,168 800,170"
                            stroke="#16a34a" stroke-width="3" fill="none"/>
                      <path d="M 0,300 C 90,268 140,160 185,172 C 235,185 280,230 330,214 C 390,196 420,145 470,145 C 530,146 560,210 620,206 C 675,202 712,160 770,164 C 785,166 795,168 800,170"
                            stroke="#f59e0b" stroke-width="2" fill="none" opacity="0.9"/>
                      <path d="M 0,295 C 110,270 175,205 245,205 C 330,206 380,178 455,168 C 535,158 600,182 665,180 C 720,178 760,174 800,172"
                            stroke="#64748b" stroke-width="2" fill="none" opacity="0.9"/>
                      <path d="M 0,355 C 105,350 150,342 175,336 C 215,300 250,270 300,240 C 350,210 390,150 430,132 C 475,112 520,124 560,94 C 620,48 705,28 800,22"
                            stroke="#111820" stroke-width="2.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'puell-multiple') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                      <rect x="0" y="0"   width="800" height="90"  fill="rgba(239,68,68,0.04)"/>
                      <rect x="0" y="90"  width="800" height="180" fill="rgba(234,179,8,0.025)"/>
                      <rect x="0" y="270" width="800" height="90"  fill="rgba(34,197,94,0.04)"/>
                      <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <path d="M 0,355 C 100,352 140,346 155,342 C 168,306 198,250 212,243 C 228,295 260,308 272,303 C 308,284 345,240 355,228 C 372,175 408,68 424,62 C 440,102 468,238 477,126 C 492,98 505,84 510,85 C 528,108 542,104 555,85 C 574,50 617,12 632,10 C 648,42 677,250 685,68 C 703,46 737,22 763,14 C 776,10 792,12 800,13"
                            stroke="#17202a" stroke-width="2.5" fill="none"/>
                      <path d="M 0,320 C 40,305 80,285 105,38 C 118,230 148,308 165,318 C 155,345 158,350 165,318 C 200,295 265,240 298,185 C 315,58 338,38 350,32 C 362,180 390,305 408,315 C 350,340 348,345 408,315 C 445,290 490,225 510,52 C 524,195 545,305 560,315 C 548,342 548,345 560,315 C 598,280 648,235 668,210 C 690,60 720,35 735,28 C 748,150 768,290 780,305 C 790,312 797,316 800,318"
                            stroke="#6366f1" stroke-width="2.5" fill="none" opacity="0.95"/>
                    </svg>
                  } @else if (chart.chartId === 'bitcoin-power-law') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <path d="M 0,290 L 800,30" stroke="#ef4444" stroke-width="2" fill="none" opacity="0.85"/>
                      <path d="M 0,330 L 800,110" stroke="#f97316" stroke-width="2" fill="none" opacity="0.85"/>
                      <path d="M 0,352 L 800,195" stroke="#60a5fa" stroke-width="2" fill="none" opacity="0.85"/>
                      <path d="M 0,354 C 60,352 100,348 115,345 C 130,328 148,295 158,282 C 175,312 200,330 218,325 C 255,305 300,270 315,255 C 335,212 365,150 380,145 C 394,175 415,238 430,210 C 445,185 460,165 468,166 C 482,184 492,182 504,168 C 518,140 545,102 558,104 C 570,124 588,228 596,148 C 608,128 630,108 645,104 C 654,103 664,108 670,110 C 682,108 720,92 745,80 C 762,74 785,68 800,65"
                            stroke="#17202a" stroke-width="2.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'bitcoin-cvdd') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <path d="M 0,358 C 80,354 140,346 200,330 C 280,310 360,280 440,245 C 520,210 620,175 700,155 C 740,145 770,138 800,132"
                            stroke="#22c55e" stroke-width="2.5" fill="none" opacity="0.9"/>
                      <path d="M 0,355 C 60,352 100,348 115,345 C 130,308 158,254 172,247 C 188,295 220,310 232,305 C 268,288 305,246 315,232 C 334,180 368,72 384,66 C 400,106 428,240 437,128 C 452,100 465,86 470,87 C 488,110 502,107 515,89 C 534,54 575,16 590,14 C 606,44 633,252 641,72 C 657,50 693,26 717,18 C 728,14 745,16 752,17 C 768,15 782,16 800,100"
                            stroke="#17202a" stroke-width="2.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'halving-spiral') {
                    <svg viewBox="0 0 360 360" preserveAspectRatio="xMidYMid meet">
                      <rect width="360" height="360" fill="#fff"/>
                      <circle cx="180" cy="180" r="30"  stroke="#e5e7eb" stroke-width="1" fill="none"/>
                      <circle cx="180" cy="180" r="60"  stroke="#e5e7eb" stroke-width="1" fill="none"/>
                      <circle cx="180" cy="180" r="90"  stroke="#e5e7eb" stroke-width="1" fill="none"/>
                      <circle cx="180" cy="180" r="120" stroke="#e5e7eb" stroke-width="1" fill="none"/>
                      <circle cx="180" cy="180" r="150" stroke="#e5e7eb" stroke-width="1" fill="none"/>
                      <line x1="180" y1="30"  x2="180" y2="180" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,4"/>
                      <line x1="330" y1="180" x2="180" y2="180" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,4"/>
                      <line x1="180" y1="330" x2="180" y2="180" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,4"/>
                      <line x1="30"  y1="180" x2="180" y2="180" stroke="#d1d5db" stroke-width="1" stroke-dasharray="4,4"/>
                      <path d="M 180,155 C 196,148 210,154 215,168 C 220,183 214,198 200,206 C 185,214 168,210 158,197 C 148,183 152,165 165,157 C 174,152 182,153 186,160"
                            stroke="#94a3b8" stroke-width="1.5" fill="none"/>
                      <path d="M 180,120 C 220,108 255,126 264,162 C 273,198 252,232 219,244 C 185,256 149,241 132,210 C 115,178 128,141 158,126 C 170,120 182,120 188,128"
                            stroke="#60a5fa" stroke-width="1.5" fill="none"/>
                      <path d="M 180,80 C 240,62 294,94 310,152 C 326,210 295,268 240,286 C 184,304 126,276 100,222 C 74,168 96,108 148,86 C 160,81 174,80 182,88"
                            stroke="#22d3ee" stroke-width="1.5" fill="none"/>
                      <path d="M 180,46 C 264,24 336,72 352,156 C 368,240 320,318 240,338 C 158,358 80,308 52,228 C 24,148 68,72 144,50 C 155,47 170,45 178,52"
                            stroke="#f59e0b" stroke-width="1.5" fill="none"/>
                      <path d="M 180,46 C 216,38 252,50 276,76 C 300,102 308,138 298,168"
                            stroke="#f43f5e" stroke-width="2" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'vdd-multiple') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="72"  x2="800" y2="72"  stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="144" x2="800" y2="144" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="216" x2="800" y2="216" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="288" x2="800" y2="288" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="100" x2="800" y2="100" stroke="rgba(239,68,68,0.55)" stroke-width="1.5" stroke-dasharray="8,5"/>
                      <line x1="0" y1="282" x2="800" y2="282" stroke="rgba(34,197,94,0.55)" stroke-width="1.5" stroke-dasharray="8,5"/>
                      <rect x="0"   y="310" width="6" height="50" fill="rgba(34,197,94,0.82)"/>
                      <rect x="8"   y="295" width="6" height="65" fill="rgba(34,197,94,0.82)"/>
                      <rect x="16"  y="305" width="6" height="55" fill="rgba(34,197,94,0.82)"/>
                      <rect x="24"  y="300" width="6" height="60" fill="rgba(34,197,94,0.82)"/>
                      <rect x="32"  y="290" width="6" height="70" fill="rgba(34,197,94,0.82)"/>
                      <rect x="48"  y="240" width="6" height="120" fill="rgba(249,115,22,0.85)"/>
                      <rect x="56"  y="220" width="6" height="140" fill="rgba(249,115,22,0.85)"/>
                      <rect x="64"  y="200" width="6" height="160" fill="rgba(249,115,22,0.85)"/>
                      <rect x="72"  y="180" width="6" height="180" fill="rgba(249,115,22,0.85)"/>
                      <rect x="88"  y="55"  width="6" height="305" fill="rgba(239,68,68,0.88)"/>
                      <rect x="96"  y="80"  width="6" height="280" fill="rgba(239,68,68,0.88)"/>
                      <rect x="112" y="310" width="6" height="50" fill="rgba(34,197,94,0.82)"/>
                      <rect x="120" y="305" width="6" height="55" fill="rgba(34,197,94,0.82)"/>
                      <rect x="128" y="295" width="6" height="65" fill="rgba(34,197,94,0.82)"/>
                      <rect x="144" y="240" width="6" height="120" fill="rgba(249,115,22,0.85)"/>
                      <rect x="152" y="215" width="6" height="145" fill="rgba(249,115,22,0.85)"/>
                      <rect x="160" y="195" width="6" height="165" fill="rgba(249,115,22,0.85)"/>
                      <rect x="168" y="185" width="6" height="175" fill="rgba(249,115,22,0.85)"/>
                      <rect x="184" y="50"  width="6" height="310" fill="rgba(239,68,68,0.88)"/>
                      <rect x="192" y="70"  width="6" height="290" fill="rgba(239,68,68,0.88)"/>
                      <rect x="208" y="308" width="6" height="52" fill="rgba(34,197,94,0.82)"/>
                      <rect x="216" y="300" width="6" height="60" fill="rgba(34,197,94,0.82)"/>
                      <rect x="224" y="295" width="6" height="65" fill="rgba(34,197,94,0.82)"/>
                      <rect x="240" y="245" width="6" height="115" fill="rgba(249,115,22,0.85)"/>
                      <rect x="248" y="220" width="6" height="140" fill="rgba(249,115,22,0.85)"/>
                      <rect x="256" y="200" width="6" height="160" fill="rgba(249,115,22,0.85)"/>
                      <rect x="264" y="185" width="6" height="175" fill="rgba(249,115,22,0.85)"/>
                      <rect x="272" y="175" width="6" height="185" fill="rgba(249,115,22,0.85)"/>
                      <rect x="288" y="45"  width="6" height="315" fill="rgba(239,68,68,0.88)"/>
                      <rect x="296" y="62"  width="6" height="298" fill="rgba(239,68,68,0.88)"/>
                      <rect x="312" y="312" width="6" height="48" fill="rgba(34,197,94,0.82)"/>
                      <rect x="320" y="305" width="6" height="55" fill="rgba(34,197,94,0.82)"/>
                      <rect x="328" y="298" width="6" height="62" fill="rgba(34,197,94,0.82)"/>
                      <rect x="344" y="250" width="6" height="110" fill="rgba(249,115,22,0.85)"/>
                      <rect x="352" y="228" width="6" height="132" fill="rgba(249,115,22,0.85)"/>
                      <rect x="360" y="208" width="6" height="152" fill="rgba(249,115,22,0.85)"/>
                      <rect x="368" y="192" width="6" height="168" fill="rgba(249,115,22,0.85)"/>
                      <rect x="384" y="58"  width="6" height="302" fill="rgba(239,68,68,0.88)"/>
                      <rect x="392" y="75"  width="6" height="285" fill="rgba(239,68,68,0.88)"/>
                      <rect x="416" y="265" width="6" height="95"  fill="rgba(249,115,22,0.85)"/>
                      <rect x="424" y="255" width="6" height="105" fill="rgba(249,115,22,0.85)"/>
                      <rect x="432" y="248" width="6" height="112" fill="rgba(249,115,22,0.85)"/>
                      <rect x="440" y="240" width="6" height="120" fill="rgba(249,115,22,0.85)"/>
                      <rect x="448" y="250" width="6" height="110" fill="rgba(249,115,22,0.85)"/>
                      <path d="M 0,355 C 30,354 55,350 80,342 C 110,328 130,310 160,288
                               C 185,272 205,262 220,248 C 240,228 255,210 285,185
                               C 310,165 330,155 350,140 C 375,122 395,108 410,95
                               C 425,84 440,78 455,72"
                            stroke="#000000" stroke-width="2" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'halving-progress') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <rect x="0"   y="0" width="160" height="360" fill="rgba(220,252,231,0.08)"/>
                      <rect x="320" y="0" width="160" height="360" fill="rgba(220,252,231,0.08)"/>
                      <rect x="640" y="0" width="160" height="360" fill="rgba(219,234,254,0.08)"/>
                      <line x1="0" y1="60"  x2="800" y2="60"  stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="140" x2="800" y2="140" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="220" x2="800" y2="220" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="300" x2="800" y2="300" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="160" y1="0" x2="160" y2="360" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                      <line x1="320" y1="0" x2="320" y2="360" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                      <line x1="480" y1="0" x2="480" y2="360" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                      <line x1="640" y1="0" x2="640" y2="360" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                      <line x1="85"  y1="0" x2="85"  y2="360" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>
                      <line x1="245" y1="0" x2="245" y2="360" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>
                      <line x1="405" y1="0" x2="405" y2="360" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>
                      <line x1="565" y1="0" x2="565" y2="360" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>
                      <line x1="727" y1="0" x2="727" y2="360" stroke="#f59e0b" stroke-width="2" opacity="0.9"/>
                      <path d="M 0,355 C 20,354 40,353 55,349 C 70,342 80,330 90,300 C 100,260 110,240 130,210 C 145,188 155,172 160,165
                               C 175,156 205,153 220,150 C 245,145 270,140 290,120 C 310,90 320,62 340,48 C 355,38 370,34 385,32 C 400,31 430,34 450,40
                               C 468,48 480,58 495,80 C 510,105 520,120 530,105 C 540,88 555,65 570,56 C 585,46 600,42 615,38 C 625,35 635,34 640,34
                               C 656,35 670,38 685,50 C 700,64 710,80 720,90 C 728,98 735,102 745,104"
                            stroke="#16a34a" stroke-width="2.5" fill="none"/>
                      <circle cx="90"  cy="300" r="3.5" fill="#dc2626"/>
                      <circle cx="340" cy="48"  r="3.5" fill="#dc2626"/>
                      <circle cx="570" cy="56"  r="3.5" fill="#dc2626"/>
                      <circle cx="745" cy="104" r="3.5" fill="#dc2626"/>
                    </svg>
                  } @else if (chart.chartId === 'compare-bull-markets') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="60" x2="800" y2="60" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="130" x2="800" y2="130" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="200" x2="800" y2="200" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="360" y1="0" x2="360" y2="360" stroke="rgba(22,163,74,0.55)" stroke-width="1.5" stroke-dasharray="5,5"/>
                      <path d="M 0,285 C 45,210 75,82 110,58 C 135,112 155,30 190,22 C 230,36 255,145 300,155 C 360,168 405,130 470,105 C 540,92 595,118 660,82 C 710,62 760,70 800,78"
                            stroke="#1d75b9" stroke-width="2.4" fill="none"/>
                      <path d="M 0,300 C 58,292 95,240 142,180 C 188,118 222,74 262,80 C 310,92 330,150 370,190 C 430,230 500,210 555,186 C 625,160 698,174 800,132"
                            stroke="#f97316" stroke-width="2.4" fill="none"/>
                      <path d="M 0,292 C 52,252 82,205 125,158 C 170,112 220,134 268,165 C 332,205 390,224 452,205 C 540,178 590,154 650,110 C 710,75 760,62 800,70"
                            stroke="#16a34a" stroke-width="2.4" fill="none"/>
                      <path d="M 0,284 C 50,276 92,265 138,254 C 186,242 230,232 275,220 C 328,205 372,188 420,174"
                            stroke="#dc2626" stroke-width="2.4" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === '2yr-ma-multiplier') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <path d="M 340,355 C 380,310 440,230 520,140 C 600,60 680,28 800,18"
                            stroke="#ef4444" stroke-width="2" fill="none" opacity="0.85"/>
                      <path d="M 320,358 C 360,320 420,250 500,168 C 580,88 660,50 800,40"
                            stroke="rgba(239,68,68,0.55)" stroke-width="1.5" fill="none"/>
                      <path d="M 300,360 C 340,332 400,270 480,198 C 560,120 640,78 800,62"
                            stroke="rgba(239,68,68,0.35)" stroke-width="1.5" fill="none"/>
                      <path d="M 280,360 C 320,345 380,296 460,232 C 540,162 620,112 800,88"
                            stroke="rgba(239,68,68,0.2)" stroke-width="1" fill="none"/>
                      <path d="M 260,360 C 300,356 360,330 440,268 C 520,198 620,148 800,118"
                            stroke="#22c55e" stroke-width="2.5" fill="none" opacity="0.9"/>
                      <path d="M 0,358 C 100,356 140,350 155,345 C 168,285 196,181 213,173 C 228,278 260,308 272,295 C 308,272 345,228 355,216 C 372,162 408,52 424,48 C 440,102 468,248 477,128 C 492,100 505,86 510,87 C 528,110 542,106 555,87 C 574,50 617,10 632,8 C 648,40 677,250 685,68 C 703,46 737,22 763,14 C 776,10 792,12 800,13"
                            stroke="#1f2937" stroke-width="1.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'price-forecast-tools') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e8eeea" stroke-width="1"/>
                      <line x1="155" y1="0" x2="155" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="347" y1="0" x2="347" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="555" y1="0" x2="555" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <line x1="763" y1="0" x2="763" y2="360" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6,5"/>
                      <path d="M 0,358 C 60,350 120,320 180,270 C 250,210 320,140 400,90 C 480,48 560,22 640,12 C 700,8 750,8 800,7"
                            stroke="#3b82f6" stroke-width="2" fill="none" opacity="0.9"/>
                      <path d="M 0,360 C 80,356 160,345 240,320 C 320,290 400,240 480,180 C 560,120 640,70 720,40 C 760,26 780,20 800,18"
                            stroke="#ef4444" stroke-width="2" fill="none" opacity="0.85"/>
                      <path d="M 240,360 C 300,340 360,295 430,232 C 500,168 570,110 640,70 C 700,42 750,26 800,20"
                            stroke="#a855f7" stroke-width="2" fill="none" opacity="0.85"/>
                      <path d="M 0,360 C 100,358 200,355 300,348 C 380,340 440,320 520,280 C 600,238 680,190 760,150 C 780,140 792,135 800,132"
                            stroke="#f97316" stroke-width="2" fill="none" opacity="0.85"/>
                      <path d="M 480,360 C 540,345 600,310 660,268 C 710,234 750,205 800,185"
                            stroke="#22c55e" stroke-width="2" fill="none" opacity="0.85"/>
                      <path d="M 0,358 C 80,356 130,350 155,340 C 170,295 195,200 215,195 C 230,295 262,320 275,305 C 310,280 345,235 358,220 C 375,168 410,60 426,52 C 442,110 470,255 480,140 C 494,108 508,90 513,91 C 530,115 545,110 557,92 C 576,55 618,14 634,10 C 650,44 678,255 687,72 C 704,50 738,24 763,16 C 777,11 792,13 800,14"
                            stroke="#1f2937" stroke-width="1.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'mayer-multiple') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="80" x2="800" y2="80" stroke="rgba(239,68,68,0.5)" stroke-width="1" stroke-dasharray="6,4"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="rgba(34,197,94,0.5)" stroke-width="1" stroke-dasharray="6,4"/>
                      <path d="M 0,200 C 60,190 100,240 150,220 C 200,200 230,100 280,80 C 320,65 360,160 400,170 C 440,180 480,90 530,70 C 570,55 620,160 680,140 C 720,130 760,120 800,125" stroke="#0d9488" stroke-width="2" fill="none"/>
                      <path d="M 0,355 C 80,340 150,290 220,240 C 290,190 360,150 430,120 C 500,95 570,85 640,75 C 700,68 760,65 800,63" stroke="#1f2937" stroke-width="1.5" fill="none" opacity="0.6"/>
                    </svg>
                  } @else if (chart.chartId === '200-week-ma-heatmap') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <path d="M 0,340 C 100,320 200,280 300,230 C 380,190 450,150 540,110 C 620,78 700,65 800,58" stroke="#ef4444" stroke-width="2" fill="none"/>
                      <path d="M 0,355 C 60,350 110,335 160,305 C 220,268 270,228 340,195 C 410,163 460,135 530,108 C 600,82 680,62 740,50 C 765,45 785,42 800,40" stroke="#1f2937" stroke-width="1.5" fill="none"/>
                      <circle cx="200" cy="290" r="5" fill="#22c55e" opacity="0.8"/>
                      <circle cx="340" cy="205" r="5" fill="#86efac" opacity="0.8"/>
                      <circle cx="480" cy="140" r="5" fill="#fbbf24" opacity="0.8"/>
                      <circle cx="620" cy="82" r="5" fill="#f97316" opacity="0.8"/>
                      <circle cx="760" cy="48" r="5" fill="#ef4444" opacity="0.8"/>
                    </svg>
                  } @else if (chart.chartId === 'fear-greed-index') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <rect x="0" y="260" width="800" height="100" fill="rgba(239,68,68,0.08)"/>
                      <rect x="0" y="0" width="800" height="80" fill="rgba(34,197,94,0.08)"/>
                      <rect x="0" y="280" width="60" height="80" fill="rgba(239,68,68,0.7)" rx="2"/>
                      <rect x="65" y="240" width="60" height="120" fill="rgba(239,68,68,0.55)" rx="2"/>
                      <rect x="130" y="200" width="60" height="160" fill="rgba(239,68,68,0.4)" rx="2"/>
                      <rect x="195" y="160" width="60" height="200" fill="rgba(239,68,68,0.25)" rx="2"/>
                      <rect x="260" y="120" width="60" height="240" fill="rgba(250,204,21,0.5)" rx="2"/>
                      <rect x="325" y="100" width="60" height="260" fill="rgba(250,204,21,0.5)" rx="2"/>
                      <rect x="390" y="60" width="60" height="300" fill="rgba(34,197,94,0.4)" rx="2"/>
                      <rect x="455" y="20" width="60" height="340" fill="rgba(34,197,94,0.6)" rx="2"/>
                      <rect x="520" y="80" width="60" height="280" fill="rgba(34,197,94,0.45)" rx="2"/>
                      <rect x="585" y="130" width="60" height="230" fill="rgba(250,204,21,0.5)" rx="2"/>
                      <rect x="650" y="90" width="60" height="270" fill="rgba(34,197,94,0.5)" rx="2"/>
                      <rect x="715" y="110" width="85" height="250" fill="rgba(250,204,21,0.5)" rx="2"/>
                      <path d="M 0,355 C 80,340 150,300 220,265 C 290,230 360,195 430,160 C 500,125 560,100 620,90 C 680,80 740,85 800,82" stroke="#1f2937" stroke-width="1.5" fill="none" opacity="0.7"/>
                    </svg>
                  } @else if (chart.chartId === 'hash-ribbons') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <path d="M 0,300 C 60,280 100,240 150,220 C 200,200 240,210 290,200 C 340,190 380,170 430,160 C 480,150 520,155 570,145 C 620,135 680,125 800,115" stroke="#3b82f6" stroke-width="2" fill="none"/>
                      <path d="M 0,320 C 60,305 100,270 150,255 C 200,240 240,245 290,238 C 340,231 380,218 430,210 C 480,202 520,204 570,196 C 620,188 680,178 800,168" stroke="#f97316" stroke-width="2" fill="none"/>
                      <circle cx="180" cy="218" r="7" fill="#22c55e" opacity="0.9"/>
                      <circle cx="520" cy="153" r="7" fill="#22c55e" opacity="0.9"/>
                      <path d="M 0,358 C 80,350 150,320 220,280 C 290,240 360,200 430,175 C 500,150 570,135 640,118 C 700,105 760,98 800,95" stroke="#1f2937" stroke-width="1.5" fill="none" opacity="0.6"/>
                    </svg>
                  } @else if (chart.chartId === 'difficulty-ribbon') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <path d="M 200,340 C 280,310 360,255 440,210 C 520,168 620,130 800,105" stroke="#ef4444" stroke-width="1.5" fill="none"/>
                      <path d="M 180,342 C 260,314 340,260 420,216 C 500,174 600,138 800,114" stroke="#f97316" stroke-width="1.5" fill="none"/>
                      <path d="M 160,344 C 240,318 320,266 400,223 C 480,181 580,147 800,123" stroke="#eab308" stroke-width="1.5" fill="none"/>
                      <path d="M 140,346 C 220,322 300,272 380,231 C 460,190 560,158 800,132" stroke="#84cc16" stroke-width="1.5" fill="none"/>
                      <path d="M 120,348 C 200,326 280,278 360,239 C 440,200 540,169 800,141" stroke="#22c55e" stroke-width="1.5" fill="none"/>
                      <path d="M 100,350 C 180,330 260,284 340,247 C 420,210 520,180 800,150" stroke="#06b6d4" stroke-width="1.5" fill="none"/>
                      <path d="M 80,352 C 160,334 240,290 320,255 C 400,220 500,191 800,159" stroke="#6366f1" stroke-width="1.5" fill="none"/>
                      <path d="M 60,354 C 140,338 220,296 300,263 C 380,230 480,202 800,168" stroke="#a855f7" stroke-width="1.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'nvt-ratio') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="100" x2="800" y2="100" stroke="rgba(239,68,68,0.3)" stroke-width="1" stroke-dasharray="6,4"/>
                      <line x1="0" y1="280" x2="800" y2="280" stroke="rgba(34,197,94,0.3)" stroke-width="1" stroke-dasharray="6,4"/>
                      <path d="M 0,200 C 60,180 100,120 150,80 C 190,50 220,130 270,160 C 310,185 350,120 400,100 C 440,82 480,160 530,200 C 570,230 620,160 680,130 C 720,110 760,150 800,145" stroke="#f97316" stroke-width="2" fill="none"/>
                      <path d="M 0,220 C 60,205 100,175 150,148 C 200,122 250,145 300,158 C 350,170 400,140 450,132 C 500,124 550,155 600,170 C 650,183 720,155 800,150" stroke="#ef4444" stroke-width="1.5" fill="none" stroke-dasharray="5,3"/>
                      <path d="M 0,355 C 80,340 150,305 220,268 C 290,232 360,196 430,165 C 500,135 570,118 640,105 C 700,95 760,90 800,88" stroke="#1f2937" stroke-width="1.5" fill="none" opacity="0.6"/>
                    </svg>
                  } @else if (chart.chartId === 'thermocap-multiple') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <rect x="0" y="0" width="800" height="80" fill="rgba(239,68,68,0.08)"/>
                      <rect x="0" y="270" width="800" height="90" fill="rgba(34,197,94,0.08)"/>
                      <line x1="0" y1="80" x2="800" y2="80" stroke="rgba(239,68,68,0.4)" stroke-width="1" stroke-dasharray="6,4"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="rgba(34,197,94,0.4)" stroke-width="1" stroke-dasharray="6,4"/>
                      <path d="M 0,310 C 60,295 100,240 140,180 C 175,128 200,60 240,52 C 275,115 310,300 345,310 C 380,305 410,250 445,200 C 475,158 500,65 535,55 C 565,120 595,295 625,308 C 655,305 680,265 720,230 C 750,203 775,175 800,165" stroke="#0d9488" stroke-width="2" fill="none"/>
                      <path d="M 0,355 C 80,340 150,305 220,268 C 290,232 360,196 430,165 C 500,135 570,118 640,105 C 700,95 760,90 800,88" stroke="#1f2937" stroke-width="1.5" fill="none" opacity="0.6"/>
                    </svg>
                  } @else if (chart.chartId === 'excess-liquidity') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                      <path d="M 0,195 C 30,210 55,240 80,260 C 105,280 120,300 140,310 C 160,320 175,300 195,270 C 215,240 230,200 250,175 C 270,150 285,130 305,110 C 325,90 345,75 365,70 C 385,65 405,80 425,105 C 445,130 460,160 480,185 C 500,210 515,230 535,240 C 555,250 575,240 595,215 C 615,190 635,160 655,135 C 675,110 695,90 720,80 C 745,70 770,75 800,85" stroke="#1f2937" stroke-width="2" fill="none"/>
                      <path d="M 0,160 C 40,155 75,145 110,138 C 145,130 175,118 210,108 C 245,98 275,90 310,88 C 345,86 375,92 410,102 C 445,113 475,128 510,148 C 545,168 575,188 610,198 C 645,208 675,205 710,195 C 745,185 775,172 800,165" stroke="rgba(234,179,8,0.9)" stroke-width="2.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'spx-liquidity') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="200" x2="800" y2="200" stroke="rgba(107,114,128,0.5)" stroke-width="1.5" stroke-dasharray="6,4"/>
                      <path d="M 0,215 C 15,210 25,195 40,185 C 55,175 65,160 80,150 C 95,140 105,148 120,155 C 135,162 145,168 160,162 C 175,156 185,140 200,125 C 215,110 225,100 240,92 C 255,84 265,80 280,75 C 295,70 310,72 325,78 C 340,84 350,88 365,82 C 380,76 390,65 405,52 C 420,39 430,28 445,20 C 460,12 475,15 490,22 C 505,29 515,40 530,52 C 545,64 555,80 570,95 C 585,110 595,128 610,145 C 625,162 640,178 655,188 C 670,198 685,202 700,198 C 715,194 730,182 750,172 C 770,162 785,155 800,150" stroke="#111827" stroke-width="2" fill="none"/>
                      <path d="M 0,155 C 40,148 80,138 120,128 C 160,118 200,108 240,102 C 280,96 320,95 360,98 C 400,101 440,110 480,125 C 520,140 560,158 600,170 C 640,182 680,185 720,178 C 750,172 775,162 800,155" stroke="#2563eb" stroke-width="2.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'midterm-cycles') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="90"  x2="800" y2="90"  stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="0" y1="270" x2="800" y2="270" stroke="#e5e7eb" stroke-width="1"/>
                      <line x1="88" y1="20" x2="88" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                      <line x1="196" y1="20" x2="196" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                      <line x1="304" y1="20" x2="304" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                      <line x1="412" y1="20" x2="412" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                      <line x1="520" y1="20" x2="520" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                      <line x1="628" y1="20" x2="628" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                      <line x1="736" y1="20" x2="736" y2="340" stroke="rgba(100,100,120,0.35)" stroke-width="1" stroke-dasharray="4,4"/>
                      <path d="M 0,270 C 30,260 55,240 80,210 C 100,185 110,150 130,120 C 150,90 165,70 185,65 C 205,75 220,120 240,160 C 255,190 265,230 285,255 C 305,270 320,265 340,240 C 360,215 375,180 395,150 C 415,120 430,95 450,80 C 470,75 485,100 505,140 C 520,170 530,210 550,235 C 570,255 585,258 605,240 C 625,218 640,185 660,155 C 680,125 695,100 715,88 C 730,80 748,90 768,118 C 785,142 795,170 800,185" stroke="#e07b39" stroke-width="2" fill="none"/>
                      <path d="M 0,255 C 30,248 55,235 80,215 C 100,198 115,175 135,155 C 155,135 170,120 190,118 C 210,125 225,148 245,175 C 262,198 272,225 292,242 C 312,255 327,250 347,232 C 367,212 382,185 402,162 C 422,140 437,122 457,115 C 477,118 492,140 512,168 C 528,192 538,220 558,238 C 578,252 592,252 612,238 C 632,220 647,195 667,172 C 687,150 700,132 720,125 C 738,122 755,132 775,152 C 790,168 797,185 800,195" stroke="#7ab3d4" stroke-width="1.5" fill="none"/>
                      <path d="M 0,175 C 40,172 80,168 120,165 C 160,162 200,160 240,162 C 280,165 320,170 360,172 C 400,174 440,172 480,168 C 520,164 560,158 600,155 C 640,152 680,152 720,156 C 755,160 780,165 800,168" stroke="#1a2e5e" stroke-width="2" fill="none" opacity="0.7"/>
                    </svg>
                  } @else if (chart.chartId === 'funding-rate-oi') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="rgba(180,83,9,0.4)" stroke-width="1" stroke-dasharray="6,4"/>
                      <path d="M 0,60 C 70,56 130,48 200,60 C 260,70 310,110 380,100 C 440,92 480,50 550,40 C 610,32 670,30 800,20"
                            stroke="#1f2933" stroke-width="2.5" fill="none"/>
                      <path d="M 0,190 C 60,170 110,150 160,185 C 210,220 250,140 300,120 C 350,100 400,230 450,210 C 500,195 550,150 600,175 C 650,198 700,160 800,150"
                            stroke="#f59e0b" stroke-width="2" fill="none"/>
                      <path d="M 0,330 C 100,326 200,320 300,310 C 400,298 500,270 600,240 C 680,215 740,200 800,190"
                            stroke="#7c3aed" stroke-width="2.5" fill="none"/>
                    </svg>
                  } @else if (chart.chartId === 'exchange-netflow') {
                    <svg viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
                      <rect width="800" height="360" fill="#fff"/>
                      <line x1="0" y1="180" x2="800" y2="180" stroke="rgba(75,85,99,0.4)" stroke-width="1" stroke-dasharray="6,4"/>
                      <rect x="10" y="140" width="34" height="40" fill="rgba(220,38,38,0.75)"/>
                      <rect x="54" y="160" width="34" height="20" fill="rgba(22,163,74,0.75)"/>
                      <rect x="98" y="100" width="34" height="80" fill="rgba(220,38,38,0.75)"/>
                      <rect x="142" y="180" width="34" height="30" fill="rgba(22,163,74,0.75)"/>
                      <rect x="186" y="150" width="34" height="30" fill="rgba(220,38,38,0.75)"/>
                      <rect x="230" y="180" width="34" height="55" fill="rgba(22,163,74,0.75)"/>
                      <rect x="274" y="120" width="34" height="60" fill="rgba(220,38,38,0.75)"/>
                      <rect x="318" y="180" width="34" height="15" fill="rgba(22,163,74,0.75)"/>
                      <rect x="362" y="90" width="34" height="90" fill="rgba(220,38,38,0.75)"/>
                      <rect x="406" y="180" width="34" height="70" fill="rgba(22,163,74,0.75)"/>
                      <rect x="450" y="160" width="34" height="20" fill="rgba(220,38,38,0.75)"/>
                      <rect x="494" y="180" width="34" height="40" fill="rgba(22,163,74,0.75)"/>
                      <rect x="538" y="110" width="34" height="70" fill="rgba(220,38,38,0.75)"/>
                      <rect x="582" y="180" width="34" height="25" fill="rgba(22,163,74,0.75)"/>
                      <rect x="626" y="150" width="34" height="30" fill="rgba(220,38,38,0.75)"/>
                      <rect x="670" y="180" width="34" height="60" fill="rgba(22,163,74,0.75)"/>
                      <rect x="714" y="130" width="34" height="50" fill="rgba(220,38,38,0.75)"/>
                      <rect x="758" y="180" width="34" height="35" fill="rgba(22,163,74,0.75)"/>
                      <path d="M 0,320 C 80,300 150,260 210,220 C 280,175 340,120 410,95 C 470,74 540,80 600,60 C 660,42 730,36 800,28"
                            stroke="#1f2933" stroke-width="2.5" fill="none"/>
                    </svg>
                  }
                </div>
                <span class="recent-chart-title">{{ chart.title }}</span>
                <small class="recent-chart-time">{{ formatRelativeTime(chart.viewedAt) }}</small>
              </a>
            }
          </div>
        }
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
  protected readonly authSession = inject(AuthSessionService);
  protected readonly showOnboarding = signal(false);
  protected readonly widgets = signal<DashboardWidget[]>([]);
  protected readonly isLoadingWidgets = signal(true);
  protected readonly isAddWidgetOpen = signal(false);
  protected readonly livePriceData = signal<{ priceUsd: number; openPriceUsd: number } | null>(null);
  protected readonly widgetTypes = computed(() => this.widgets().map((widget) => widget.type));
  protected readonly draggingId = signal<string | null>(null);
  protected readonly dragOverId = signal<string | null>(null);
  protected readonly recentCharts = signal<RecentChart[]>([]);
  protected readonly isLoadingRecentCharts = signal(true);
  protected readonly favouriteCharts = signal<FavouriteChart[]>([]);
  protected readonly isLoadingFavouriteCharts = signal(true);
  protected readonly chartTab = signal<'favourites' | 'recent'>('favourites');
  protected readonly isRefreshing = signal(false);
  protected readonly isDashboardActionsOpen = signal(false);
  protected readonly refreshMessage = signal('');
  protected readonly refreshError = signal(false);
  protected readonly signals = signal<SignalSummary | null>(null);
  protected readonly isAddSignalOpen = signal(false);
  protected readonly selectedSignalNames = signal<string[]>(this.loadSelectedSignals());

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
    void this.loadFavouriteCharts();
    void this.loadSignals();
    void this.refreshLivePrice();
    interval(60_000).pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      void this.refreshLivePrice();
    });
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
    this.isDashboardActionsOpen.set(false);
    this.isAddWidgetOpen.set(true);
  }

  protected closeAddWidget(): void {
    this.isAddWidgetOpen.set(false);
  }

  protected openAddSignal(): void {
    this.isDashboardActionsOpen.set(false);
    this.isAddSignalOpen.set(true);
  }

  protected closeAddSignal(): void {
    this.isAddSignalOpen.set(false);
  }

  protected toggleDashboardActions(): void {
    this.isDashboardActionsOpen.update((isOpen) => !isOpen);
  }

  protected visibleSignals(summary: SignalSummary): SignalScore[] {
    const selected = this.selectedSignalNames();
    const selectedSet = new Set(selected);
    const visible = summary.signals.filter((sig) => selectedSet.has(sig.name));

    if (visible.length > 0) {
      return visible;
    }

    return summary.signals.slice(0, 1);
  }

  protected signalColumnCount(summary: SignalSummary): number {
    return Math.max(1, Math.ceil(this.visibleSignals(summary).length / 2));
  }

  protected isSignalVisible(name: string): boolean {
    return this.selectedSignalNames().includes(name);
  }

  protected addSignal(name: string): void {
    if (this.isSignalVisible(name)) {
      return;
    }

    this.selectedSignalNames.update((current) => this.persistSelectedSignals([...current, name]));
  }

  protected removeSignal(name: string): void {
    const current = this.selectedSignalNames();

    if (current.length <= 1) {
      return;
    }

    this.selectedSignalNames.update((selected) => this.persistSelectedSignals(selected.filter((item) => item !== name)));
  }

  protected async refreshData(): Promise<void> {
    this.isDashboardActionsOpen.set(false);
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

  private async loadFavouriteCharts(): Promise<void> {
    this.isLoadingFavouriteCharts.set(true);

    try {
      const response = await this.auth.getFavouriteCharts();
      this.favouriteCharts.set(response.favouriteCharts);
    } catch {
      this.favouriteCharts.set([]);
    } finally {
      this.isLoadingFavouriteCharts.set(false);
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

  protected livePriceChangePct(lp: { priceUsd: number; openPriceUsd: number }): number {
    return (lp.priceUsd - lp.openPriceUsd) / lp.openPriceUsd * 100;
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
    if (value <= 25) return $localize`:@@fearGreed.extremeFear:Extreme Fear`;
    if (value <= 46) return $localize`:@@fearGreed.fear:Fear`;
    if (value <= 54) return $localize`:@@fearGreed.neutral:Neutral`;
    if (value <= 75) return $localize`:@@fearGreed.greed:Greed`;
    return $localize`:@@fearGreed.extremeGreed:Extreme Greed`;
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
      if (pct < -20) { zone = 'deep-discount'; label = $localize`:@@ma200.deepDiscount:Deep discount`; }
      else if (pct < 0) { zone = 'discount'; label = $localize`:@@ma200.below:Below 200-day MA`; }
      else if (pct < 50) { zone = 'above-ma'; label = $localize`:@@ma200.above:Above 200-day MA`; }
      else { zone = 'far-above'; label = $localize`:@@ma200.farAbove:Far above MA`; }
      return { pct, position, zone, label };
    }

    // realized_price — Scale: -50% .. +200%
    const position = Math.min(100, Math.max(0, (pct + 50) / 250 * 100));
    let zone: string;
    let label: string;
    if (pct < 0) { zone = 'rp-below'; label = $localize`:@@realizedPrice.atLoss:Investors at loss`; }
    else if (pct < 30) { zone = 'rp-fair'; label = $localize`:@@realizedPrice.nearFair:Near fair value`; }
    else if (pct < 80) { zone = 'rp-premium'; label = $localize`:@@realizedPrice.inProfit:In profit`; }
    else { zone = 'rp-extreme'; label = $localize`:@@realizedPrice.overheated:Overheated`; }
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
    if (value < 0)  return $localize`:@@mvrv.buyZone:Buy Zone`;
    if (value < 2)  return $localize`:@@mvrv.undervalued:Undervalued`;
    if (value < 5)  return $localize`:@@mvrv.fairValue:Fair Value`;
    if (value < 7)  return $localize`:@@mvrv.overvalued:Overvalued`;
    return $localize`:@@mvrv.sellZone:Sell Zone`;
  }

  protected nuplPosition(value: number): number {
    return Math.min(100, Math.max(0, (value + 50) / 150 * 100));
  }

  protected nuplZone(value: number): string {
    if (value < 0) return 'nupl-capitulation';
    if (value < 25) return 'nupl-hope';
    if (value < 50) return 'nupl-optimism';
    if (value < 75) return 'nupl-belief';
    return 'nupl-euphoria';
  }

  protected nuplLabel(value: number): string {
    if (value < 0) return $localize`:NUPL phase capitulation@@charts.nupl.phase.capitulation:Capitulation`;
    if (value < 25) return $localize`:NUPL phase hope@@charts.nupl.phase.hope:Hope / Fear`;
    if (value < 50) return $localize`:NUPL phase optimism@@charts.nupl.phase.optimism:Optimism / Anxiety`;
    if (value < 75) return $localize`:NUPL phase belief@@charts.nupl.phase.belief:Belief / Denial`;
    return $localize`:NUPL phase euphoria@@charts.nupl.phase.euphoria:Euphoria / Greed`;
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
    if (value < 28)  return $localize`:@@s2f.lowScarcity:Low Scarcity`;
    if (value < 56)  return $localize`:@@s2f.moderateScarcity:Moderate Scarcity`;
    if (value < 113) return $localize`:@@s2f.highScarcity:High Scarcity`;
    if (value < 170) return $localize`:@@s2f.veryHighScarcity:Very High Scarcity`;
    return $localize`:@@s2f.extremeScarcity:Extreme Scarcity`;
  }

  protected widgetContext(widget: DashboardWidget): {
    label: string;
    detail: string;
    zone: string;
    position: number | null;
    minLabel: string;
    maxLabel: string;
  } | null {
    if (widget.value === null) return null;

    switch (widget.type) {
      case 'hash_rate':
        return this.rangedWidgetContext(widget.value, 300_000_000, 1_200_000_000, [
          [500_000_000, $localize`:@@widgetContext.hashLow:Below recent network pace`, 'caution'],
          [800_000_000, $localize`:@@widgetContext.hashFirm:Firm security trend`, 'neutral'],
          [Number.POSITIVE_INFINITY, $localize`:@@widgetContext.hashHigh:Very strong network security`, 'good'],
        ], '300M', '1.2B');
      case 'mining_difficulty':
        return this.rangedWidgetContext(widget.value, 50_000_000_000_000, 150_000_000_000_000, [
          [90_000_000_000_000, $localize`:@@widgetContext.diffLow:Lower miner competition`, 'good'],
          [125_000_000_000_000, $localize`:@@widgetContext.diffHigh:High miner competition`, 'neutral'],
          [Number.POSITIVE_INFINITY, $localize`:@@widgetContext.diffExtreme:Extremely competitive mining`, 'caution'],
        ], '50T', '150T');
      case 'circulating_supply': {
        const pct = widget.value / 21_000_000 * 100;
        return {
          label: $localize`:@@widgetContext.supplyIssued:Issued supply`,
          detail: `${pct.toFixed(1)}% of 21M`,
          zone: 'neutral',
          position: Math.min(100, Math.max(0, pct)),
          minLabel: '0%',
          maxLabel: '100%',
        };
      }
      case 'total_supply':
        return {
          label: $localize`:@@widgetContext.fixedCap:Fixed terminal supply`,
          detail: $localize`:@@widgetContext.noRange:No range: protocol cap`,
          zone: 'neutral',
          position: null,
          minLabel: '',
          maxLabel: '',
        };
      case 'market_cap':
        return this.priceRelativeContext(widget.value, [
          [500_000_000_000, $localize`:@@widgetContext.capMid:Mid-cycle scale`, 'neutral'],
          [1_500_000_000_000, $localize`:@@widgetContext.capLarge:Large asset scale`, 'good'],
          [Number.POSITIVE_INFINITY, $localize`:@@widgetContext.capMega:Mega-cap regime`, 'caution'],
        ], 0, 2_500_000_000_000, '$0', '$2.5T');
      case 'global_m2_yoy':
        return this.rangedWidgetContext(widget.value, -10, 20, [
          [0, $localize`:@@widgetContext.m2Contracting:Liquidity contracting`, 'danger'],
          [5, $localize`:@@widgetContext.m2Recovering:Liquidity recovering`, 'neutral'],
          [Number.POSITIVE_INFINITY, $localize`:@@widgetContext.m2Expanding:Liquidity expanding`, 'good'],
        ], '-10%', '+20%');
      case 'btc_rsi_12m':
        return this.rangedWidgetContext(widget.value, 0, 100, [
          [30, $localize`:@@widgetContext.rsiOversold:Long-term oversold`, 'good'],
          [50, $localize`:@@widgetContext.rsiWeak:Weak momentum`, 'neutral'],
          [70, $localize`:@@widgetContext.rsiStrong:Strong momentum`, 'good'],
          [Number.POSITIVE_INFINITY, $localize`:@@widgetContext.rsiHot:Overheated momentum`, 'caution'],
        ], '0', '100');
      case 'realized_price_premium':
        return this.rangedWidgetContext(widget.value, -50, 200, [
          [0, $localize`:@@widgetContext.rpDiscount:Spot below cost basis`, 'good'],
          [30, $localize`:@@widgetContext.rpNearFair:Near aggregate cost basis`, 'neutral'],
          [80, $localize`:@@widgetContext.rpProfit:Market in profit`, 'good'],
          [Number.POSITIVE_INFINITY, $localize`:@@widgetContext.rpStretched:Profit premium stretched`, 'caution'],
        ], '-50%', '+200%');
      case 'market_signal_score':
        return this.rangedWidgetContext(widget.value, 0, 100, [
          [35, $localize`:@@widgetContext.signalBearish:Bearish composite`, 'danger'],
          [60, $localize`:@@widgetContext.signalNeutral:Mixed composite`, 'neutral'],
          [80, $localize`:@@widgetContext.signalBullish:Bullish composite`, 'good'],
          [Number.POSITIVE_INFINITY, $localize`:@@widgetContext.signalVeryBullish:Very bullish composite`, 'caution'],
        ], '0', '100');
      case 's2f_model_price':
      case 'base_case_target':
      case 'bull_case_target':
        return this.targetContext(widget.value);
      default:
        return null;
    }
  }

  private rangedWidgetContext(
    value: number,
    min: number,
    max: number,
    bands: Array<[number, string, string]>,
    minLabel: string,
    maxLabel: string,
  ) {
    const band = bands.find(([limit]) => value < limit) ?? bands[bands.length - 1];
    return {
      label: band[1],
      detail: $localize`:@@widgetContext.rangeLabel:Range ${minLabel}:INTERPOLATION: to ${maxLabel}:INTERPOLATION_1:`,
      zone: band[2],
      position: Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)),
      minLabel,
      maxLabel,
    };
  }

  private priceRelativeContext(
    value: number,
    bands: Array<[number, string, string]>,
    min: number,
    max: number,
    minLabel: string,
    maxLabel: string,
  ) {
    return this.rangedWidgetContext(value, min, max, bands, minLabel, maxLabel);
  }

  private targetContext(target: number) {
    const btc = this.widgets().find((w) => w.type === 'btc_price')?.value ?? null;
    if (btc === null || btc <= 0) {
      return {
        label: $localize`:@@widgetContext.modelTarget:Model target`,
        detail: $localize`:@@widgetContext.needsBtc:Compare after BTC price loads`,
        zone: 'neutral',
        position: null,
        minLabel: '',
        maxLabel: '',
      };
    }

    const upside = ((target - btc) / btc) * 100;
    const ratio = target / btc;
    let label: string;
    let zone: string;
    if (upside < 0) { label = $localize`:@@widgetContext.targetBelow:Below current BTC price`; zone = 'danger'; }
    else if (upside < 50) { label = $localize`:@@widgetContext.targetNear:Near current price`; zone = 'neutral'; }
    else if (upside < 150) { label = $localize`:@@widgetContext.targetUpside:Upside scenario`; zone = 'good'; }
    else { label = $localize`:@@widgetContext.targetAggressive:Aggressive upside scenario`; zone = 'caution'; }

    return {
      label,
      detail: `${upside >= 0 ? '+' : ''}${upside.toFixed(0)}% vs BTC spot`,
      zone,
      position: Math.min(100, Math.max(0, (ratio / 5) * 100)),
      minLabel: '0x',
      maxLabel: '5x',
    };
  }

  protected getZoneLabel(zone: string): string {
    switch (zone) {
      case 'very_bullish': return $localize`:@@zone.veryBullish:Very Bullish`;
      case 'bullish':      return $localize`:@@zone.bullish:Bullish`;
      case 'neutral':      return $localize`:@@zone.neutral:Neutral`;
      case 'bearish':      return $localize`:@@zone.bearish:Bearish`;
      case 'very_bearish': return $localize`:@@zone.veryBearish:Very Bearish`;
      default:             return zone.replace(/_/g, ' ');
    }
  }

  protected getSignalLabel(name: string, fallback: string): string {
    switch (name) {
      case 'mvrv_zscore':            return $localize`:@@signal.mvrvZscore:MVRV Z-Score`;
      case 'vdd_multiple':           return $localize`:@@signal.vddMultiple:VDD Multiple`;
      case 'pi_cycle_top':           return $localize`:@@signal.piCycleTop:Pi Cycle Top`;
      case 'rainbow_band':           return $localize`:@@signal.rainbowBand:Rainbow Band`;
      case 'mayer_multiple':         return $localize`:@@signal.mayerMultiple:Mayer Multiple`;
      case 'realized_price_premium': return $localize`:@@signal.realizedPricePremium:Realized Price Premium`;
      case 'puell_multiple':         return $localize`:@@signal.puellMultiple:Puell Multiple`;
      case 'fear_greed':             return $localize`:@@signal.fearGreed:Fear & Greed`;
      case 'bitcoin_nupl':           return $localize`:@@signal.bitcoinNupl:Bitcoin NUPL`;
      case 'global_m2_yoy':          return $localize`:@@signal.globalM2Yoy:Global M2 YoY`;
      case 'dxy_yoy':                return $localize`:@@signal.dxyYoy:DXY YoY`;
      default:                       return fallback;
    }
  }

  protected getWidgetTitle(widget: DashboardWidget): string {
    switch (widget.type) {
      case 'btc_price':       return $localize`:@@widget.btcPrice:Current BTC Price`;
      case '24h_change':      return $localize`:@@widget.24hChange:24h BTC Price Change`;
      case 'mvrv_zscore':     return $localize`:@@widget.mvrvZscore:MVRV Z-Score`;
      case 'stock_to_flow':   return $localize`:@@widget.stockToFlow:Stock-to-Flow Ratio`;
      case 'fear_greed':      return $localize`:@@widget.fearGreed:Fear & Greed Index`;
      case 'nupl':            return $localize`:@@widget.nupl:Bitcoin NUPL`;
      case 'realized_price':  return $localize`:@@widget.realizedPrice:Realized Price`;
      case 'ma_200_day':      return $localize`:@@widget.ma200:200-Day Moving Average`;
      case 'market_cap':      return $localize`:@@widget.marketCap:Market Cap`;
      case 'halving_progress':return $localize`:@@widget.halvingProgress:BTC Halving Progress`;
      case 'global_m2_yoy':   return $localize`:@@widget.globalM2Yoy:Global M2 YoY`;
      default:                return widget.title;
    }
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
      this.syncSelectedSignals(data.signals);
    } catch { /* banner stays hidden */ }
  }

  private loadSelectedSignals(): string[] {
    try {
      const raw = localStorage.getItem('dashboard.selectedSignals');
      const parsed = raw ? JSON.parse(raw) : null;

      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        return parsed;
      }
    } catch { /* use defaults */ }

    return [
      'mvrv_zscore',
      'fear_greed',
      'rainbow_band',
      'realized_price_premium',
      'bitcoin_nupl',
      'vdd_multiple',
      'pi_cycle_top',
      'mayer_multiple',
      'puell_multiple',
      'global_m2_yoy',
      'dxy_yoy',
    ];
  }

  private syncSelectedSignals(signals: SignalScore[]): void {
    const available = new Set(signals.map((sig) => sig.name));
    const selected = this.selectedSignalNames().filter((name) => available.has(name));

    if (selected.length > 0) {
      this.selectedSignalNames.set(this.persistSelectedSignals(selected));
      return;
    }

    this.selectedSignalNames.set(this.persistSelectedSignals(signals.slice(0, 1).map((sig) => sig.name)));
  }

  private persistSelectedSignals(selected: string[]): string[] {
    try {
      localStorage.setItem('dashboard.selectedSignals', JSON.stringify(selected));
    } catch { /* selection remains in memory */ }

    return selected;
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

  protected formatUsdDetailed(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
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
      this.widgets.set(response.widgets.map((w) =>
        w.type === '24h_change' ? { ...w, trendPercent: null } : w,
      ));
    } catch {
      this.widgets.set([]);
    } finally {
      this.isLoadingWidgets.set(false);
    }
  }

  private async refreshLivePrice(): Promise<void> {
    try {
      const live = await this.auth.getLivePrice();
      if (live.change24hPercent !== null) {
        const openPriceUsd = live.priceUsd / (1 + live.change24hPercent / 100);
        this.livePriceData.set({ priceUsd: live.priceUsd, openPriceUsd });
      }
      this.widgets.update((ws) =>
        ws.map((w) => {
          if (w.type === 'btc_price') {
            const pct = live.change24hPercent;
            return {
              ...w,
              value: live.priceUsd,
              formattedValue: `$${live.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              lastUpdated: live.fetchedAt,
              ...(pct !== null ? {
                trendPercent: pct,
                trend: pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : 'flat' as const,
              } : {}),
            };
          }
          if (w.type === '24h_change' && live.change24hPercent !== null) {
            const pct = live.change24hPercent;
            return {
              ...w,
              value: pct,
              formattedValue: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
              trend: pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : 'flat' as const,
              trendPercent: null,
              lastUpdated: live.fetchedAt,
            };
          }
          return w;
        }),
      );
      // Patch the BTC price shown in the trade planner signal banner
      this.signals.update((s) =>
        s ? { ...s, btcPriceUsd: live.priceUsd } : s,
      );
    } catch { /* silently ignore — stale data is fine */ }
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

      <div class="admin-config-section__divider"></div>

      <div class="section-heading">
        <h3 i18n="Historical data init title@@adminDataConfig.initHistoricalTitle">
          Initialize historical data
        </h3>
        <p i18n="Historical data init description@@adminDataConfig.initHistoricalDesc">
          Automatically backfills all Bitcoin price history from 2013 (earliest exchange data) to today, one year at a time.
        </p>
      </div>

      <div class="admin-backfill-form">
        <div class="year-selection">
          <label class="year-checkbox year-checkbox--all">
            <input
              type="checkbox"
              [checked]="allYearsSelected()"
              [indeterminate]="someYearsSelected()"
              (change)="toggleAllYears()"
              [disabled]="isInitializing()"
            />
            <span i18n="Select all years@@adminDataConfig.allYears">All {{ startYear }}–{{ currentYear }})</span>
          </label>
          <div class="year-grid">
            @for (year of availableYears; track year) {
              <label class="year-checkbox">
                <input
                  type="checkbox"
                  [checked]="selectedYears().has(year)"
                  (change)="toggleYear(year)"
                  [disabled]="isInitializing()"
                />
                <span>{{ year }}</span>
              </label>
            }
          </div>
        </div>

        <div class="admin-actions">
          <button
            type="button"
            class="secondary-button"
            (click)="initHistorical()"
            [disabled]="isInitializing() || selectedYears().size === 0"
          >
            @if (isInitializing()) {
              <ng-container>{{ initProgress() }}</ng-container>
            } @else {
              <ng-container i18n="Initialize selected years button@@adminDataConfig.initButton">
                Initialize Selected {{ selectedYears().size }} year{{ selectedYears().size === 1 ? '' : 's' }})
              </ng-container>
            }
          </button>
        </div>

        @if (initMessage()) {
          <p class="form-message" [class.success]="initSuccess()">{{ initMessage() }}</p>
        }
      </div>
    </section>
  `,
})
export class AdminDataConfigurationPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiClient);
  protected readonly configuration = signal<DataRefreshConfigurationResponse | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly isRefreshing = signal(false);
  protected readonly isInitializing = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly initMessage = signal('');
  protected readonly initSuccess = signal(false);
  protected readonly initProgress = signal('');

  protected readonly startYear = 2010;
  protected readonly currentYear = new Date().getUTCFullYear();
  protected readonly availableYears = Array.from(
    { length: new Date().getUTCFullYear() - 2010 + 1 },
    (_, i) => 2010 + i,
  );
  protected readonly selectedYears = signal(new Set<number>(
    Array.from({ length: new Date().getUTCFullYear() - 2010 + 1 }, (_, i) => 2010 + i),
  ));
  protected readonly allYearsSelected = computed(
    () => this.selectedYears().size === this.availableYears.length,
  );
  protected readonly someYearsSelected = computed(
    () => this.selectedYears().size > 0 && !this.allYearsSelected(),
  );
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

  protected toggleYear(year: number): void {
    const next = new Set(this.selectedYears());
    if (next.has(year)) next.delete(year); else next.add(year);
    this.selectedYears.set(next);
  }

  protected toggleAllYears(): void {
    this.selectedYears.set(
      this.allYearsSelected() ? new Set() : new Set(this.availableYears),
    );
  }

  protected async initHistorical(): Promise<void> {
    if (this.isInitializing() || this.selectedYears().size === 0) return;
    this.isInitializing.set(true);
    this.initMessage.set('');
    this.initSuccess.set(false);

    const yearsToProcess = [...this.selectedYears()].sort((a, b) => a - b);
    const today = new Date().toISOString().slice(0, 10);
    let totalDays = 0;
    let failedRanges = 0;

    const metrics: Array<Parameters<typeof this.auth.backfillMetric>[0]> = [
      'vdd', 'miner-fees', 'price-forecast', 'fear-greed',
      'hash-rate', 'difficulty', 'transaction-volume', 'miners-revenue',
      'global-m2-bitcoin',
      'dxy-bitcoin',
    ];

    try {
      for (const year of yearsToProcess) {
        const startDate = `${year}-01-01`;
        const endDate = year === this.currentYear ? today : `${year}-12-31`;

        this.initProgress.set(`Loading prices: ${year}...`);

        const result = await this.auth.initHistoricalData(startDate, endDate);
        totalDays += result.fetchedDays;
        failedRanges += result.failedRanges.length;
      }

      for (const metric of metrics) {
        this.initProgress.set(`Backfilling ${metric}...`);
        await this.auth.backfillMetric(metric);
      }

      this.initSuccess.set(true);
      this.initMessage.set(
        $localize`:Backfill success@@adminDataConfig.backfillComplete:Initialized ${totalDays}:days: days of price data + all metrics${failedRanges > 0 ? ` (${failedRanges} failed price ranges)` : ''}:failedNote:`,
      );
    } catch (error) {
      this.initMessage.set(`Failed at ${this.initProgress()}: ${getErrorMessage(error)}`);
    } finally {
      this.isInitializing.set(false);
      this.initProgress.set('');
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

const AUTH_STYLES = [`
  .auth-page {
    min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: #f2f4f2; padding: 24px 16px; gap: 20px;
  }
  .auth-footer {
    text-align: center;
  }
  .auth-footer-brand {
    font-size: 0.85rem; font-weight: 800; color: #374151; margin: 0 0 4px; letter-spacing: -0.2px;
  }
  .auth-footer-copy {
    font-size: 0.72rem; color: #9ca3af; margin: 0 0 4px;
  }
  .auth-footer-disclaimer {
    font-size: 0.72rem; color: #9ca3af; margin: 0;
  }
  .auth-card {
    background: #fff; border-radius: 16px; padding: 36px 40px 28px;
    width: 100%; max-width: 400px; box-shadow: 0 2px 16px rgba(0,0,0,0.07);
  }
  .auth-lang {
    display: flex; align-items: center; gap: 6px; margin-bottom: 24px;
  }
  .auth-lang-label {
    font-size: 0.68rem; font-weight: 700; color: #9ca3af;
    letter-spacing: 0.08em; text-transform: uppercase; margin-right: 4px;
  }
  .auth-lang-btn {
    padding: 4px 12px; border-radius: 20px; border: 1.5px solid #e5ebe7;
    background: #fff; font-size: 0.78rem; font-weight: 600; color: #6b7280;
    cursor: pointer; transition: all 0.12s;
  }
  .auth-lang-btn.active {
    background: #1a4731; border-color: #1a4731; color: #fff;
  }
  .auth-lang-btn:hover:not(.active) { border-color: #1a4731; color: #1a4731; }
  .auth-title {
    font-size: 1.75rem; font-weight: 800; color: #111827; margin: 0 0 6px; letter-spacing: -0.5px;
  }
  .auth-sub {
    font-size: 0.9rem; color: #6b7280; margin: 0 0 28px; line-height: 1.5;
  }
  .auth-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .auth-field label {
    font-size: 0.82rem; font-weight: 600; color: #374151;
  }
  .auth-field input {
    padding: 10px 14px; border: 1.5px solid #e5ebe7; border-radius: 10px;
    font-size: 0.9rem; color: #111827; outline: none; transition: border-color 0.15s;
    font-family: inherit; background: #fff;
  }
  .auth-field input:focus { border-color: #1a4731; }
  .auth-field input::placeholder { color: #d1d5db; }
  .auth-forgot {
    font-size: 0.78rem; color: #6b7280; text-decoration: none; align-self: flex-end; margin-top: -2px;
  }
  .auth-forgot:hover { color: #1a4731; }
  .auth-msg { font-size: 0.82rem; padding: 8px 12px; border-radius: 8px; margin: 0 0 14px;
    background: #fee2e2; color: #dc2626; }
  .auth-msg.success { background: #dcfce7; color: #15803d; }
  .auth-btn-primary {
    width: 100%; padding: 12px; border: none; border-radius: 10px;
    background: #6b8f78; color: #fff; font-size: 0.95rem; font-weight: 700;
    cursor: pointer; transition: background 0.12s; margin-bottom: 16px; font-family: inherit;
  }
  .auth-btn-primary:hover:not(:disabled) { background: #1a4731; }
  .auth-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .auth-switch {
    text-align: center; font-size: 0.82rem; color: #6b7280; margin: 0 0 16px;
  }
  .auth-switch a { color: #1a4731; font-weight: 600; text-decoration: none; }
  .auth-switch a:hover { text-decoration: underline; }
  .auth-divider {
    display: flex; align-items: center; gap: 12px; margin: 4px 0 16px; color: #d1d5db;
    font-size: 0.78rem;
  }
  .auth-divider::before, .auth-divider::after {
    content: ''; flex: 1; height: 1px; background: #e5e7eb;
  }
  .auth-btn-google {
    width: 100%; padding: 11px 16px; border: 1.5px solid #e5e7eb; border-radius: 10px;
    background: #fff; font-size: 0.9rem; font-weight: 600; color: #374151;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
    transition: border-color 0.12s, box-shadow 0.12s; margin-bottom: 20px; font-family: inherit;
  }
  .auth-btn-google:hover { border-color: #9ca3af; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .auth-terms {
    display: flex; align-items: center; justify-content: center;
    gap: 6px; flex-wrap: wrap; margin: 0;
  }
  .auth-terms-link {
    background: none; border: 1px solid #e5ebe7; border-radius: 20px;
    padding: 4px 12px; font-family: inherit; font-size: 0.75rem; font-weight: 600;
    color: #6b7280; cursor: pointer; text-decoration: none;
    transition: border-color 0.12s, color 0.12s;
    display: inline-flex; align-items: center;
  }
  .auth-terms-link:hover { border-color: #1a4731; color: #1a4731; }
  .auth-captcha-row {
    display: flex; gap: 8px; align-items: stretch;
  }
  .auth-captcha-question {
    flex: 1; padding: 10px 14px; border: 1.5px solid #e5ebe7; border-radius: 10px;
    font-size: 0.9rem; color: #374151; background: #f8faf8; font-family: ui-monospace, monospace;
  }
  .auth-captcha-new {
    padding: 10px 14px; border: 1.5px solid #e5ebe7; border-radius: 10px;
    background: #fff; font-size: 0.8rem; font-weight: 600; color: #6b7280;
    cursor: pointer; white-space: nowrap; font-family: inherit; transition: border-color 0.12s;
  }
  .auth-captcha-new:hover { border-color: #1a4731; color: #1a4731; }
  .auth-dev-btn {
    width: 100%; padding: 8px; border: 1.5px dashed #d1d5db; border-radius: 8px;
    background: #f9fafb; font-size: 0.78rem; color: #9ca3af; cursor: pointer;
    margin-bottom: 12px; font-family: inherit;
  }
  .auth-dev-btn:hover { border-color: #6b7280; color: #374151; }
  .auth-brand-row {
    display: inline-flex; align-items: center; gap: 10px; margin-bottom: 28px;
    text-decoration: none; cursor: pointer;
  }
  .auth-brand-mark {
    display: grid; place-items: center; width: 36px; height: 36px;
    background: #f7b731; border-radius: 50%; color: #101820;
    font-size: 1rem; font-weight: 900; flex-shrink: 0;
  }
  .auth-brand-name {
    font-size: 1rem; font-weight: 800; color: #111827; letter-spacing: -0.3px;
  }
`];

@Component({
  selector: 'app-login-page',
  styles: AUTH_STYLES,
  template: `
    <div class="auth-page">
      <div class="auth-card">

        <a class="auth-brand-row" routerLink="/">
          <span class="auth-brand-mark" aria-hidden="true">₿</span>
          <span class="auth-brand-name">BitWLab</span>
        </a>

        <div class="auth-lang">
          <span class="auth-lang-label" i18n="Language selector label@@auth.languageLabel">Language</span>
          <button class="auth-lang-btn" [class.active]="lang() === 'en'" (click)="setLang('en')">EN</button>
          <button class="auth-lang-btn" [class.active]="lang() === 'hu'" (click)="setLang('hu')">HU</button>
        </div>

        <h1 class="auth-title" i18n="Login title@@auth.welcomeBack">Welcome back</h1>
        <p class="auth-sub" i18n="Login subtitle@@auth.loginSubtitle">Sign in to your account to continue</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="auth-field">
            <label i18n="Email or username label@@auth.emailOrUsername">Email or Username</label>
            <input type="email" formControlName="email" autocomplete="email"
              placeholder="Enter email or username"
              i18n-placeholder="Email placeholder@@auth.emailPlaceholder" />
          </div>
          <div class="auth-field">
            <label i18n="Password label@@form.password">Password</label>
            <input type="password" formControlName="password" autocomplete="current-password" placeholder="••••••••" />
            <a class="auth-forgot" routerLink="/forgot-password" i18n="Forgot password link@@auth.forgotPassword">Forgot password?</a>
          </div>

          @if (message()) {
            <p class="auth-msg" [class.success]="isSuccess()">{{ message() }}</p>
          }

          <button type="submit" class="auth-btn-primary" [disabled]="form.invalid || isSubmitting()">
            @if (isSubmitting()) {
              <ng-container i18n="Logging in state@@auth.loggingIn">Signing in...</ng-container>
            } @else {
              <ng-container i18n="Login button@@auth.signIn">Sign in</ng-container>
            }
          </button>
        </form>

        <p class="auth-switch">
          <ng-container i18n="No account prompt@@auth.noAccount">Don't have an account?</ng-container>
          <a routerLink="/register" i18n="Create account link@@auth.createAccount"> Create one</a>
        </p>

        <div class="auth-divider"><span>or</span></div>

        <button type="button" class="auth-btn-google" (click)="continueWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.251 17.64 11.942 17.64 9.2z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          <ng-container i18n="Sign in with Google@@auth.signInGoogle">Sign in with Google</ng-container>
        </button>

        <div class="auth-terms">
          <button type="button" class="auth-terms-link" (click)="legal.open('disclaimer')" i18n="Disclaimer link@@nav.disclaimer">Disclaimer</button>
          <button type="button" class="auth-terms-link" (click)="legal.open('terms-of-use')" i18n="Terms of use link@@auth.termsOfUse">Terms of Use</button>
          <button type="button" class="auth-terms-link" (click)="legal.open('privacy-policy')" i18n="Privacy policy link@@auth.privacyPolicy">Privacy Policy</button>
        </div>

      </div>

      <footer class="auth-footer">
        <p class="auth-footer-brand">BitWLab</p>
        <p class="auth-footer-copy" i18n="Footer copyright@@footer.copyright">© 2026 BitWLab. All rights reserved.</p>
        <p class="auth-footer-disclaimer" i18n="Footer disclaimer@@footer.disclaimer">Not financial advice. Cryptocurrency investments carry risk.</p>
      </footer>
    </div>

    @if (showOnboarding()) {
      <div class="onboarding-overlay" role="dialog" aria-modal="true"
        aria-label="Onboarding" i18n-aria-label="Onboarding dialog label@@onboarding.dialog">
        <app-onboarding-carousel
          (skipped)="completeOnboarding()"
          (completed)="completeOnboarding()"
        ></app-onboarding-carousel>
      </div>
    }
  `,
  imports: [ReactiveFormsModule, RouterLink, OnboardingCarouselComponent],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiClient);
  private readonly authSession = inject(AuthSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly langService = inject(LanguageService);
  protected readonly legal = inject(LegalDialogService);
  protected readonly lang = this.langService.current;
  protected readonly isSubmitting = signal(false);
  protected readonly isCompletingOnboarding = signal(false);
  protected readonly showOnboarding = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected setLang(locale: 'en' | 'hu'): void {
    this.langService.switchTo(locale);
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
        this.message.set($localize`:Login onboarding required message@@auth.loginOnboardingRequired:Login successful. Complete the quick orientation to continue.`);
        return;
      }
      this.message.set($localize`:Login success message@@auth.loginSuccess:Login successful. Redirecting to dashboard.`);
      await this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard');
    } catch (error) {
      this.message.set(getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected async completeOnboarding(): Promise<void> {
    if (this.isCompletingOnboarding()) return;
    this.isCompletingOnboarding.set(true);
    this.message.set($localize`:Completing onboarding state@@onboarding.completing:Completing onboarding...`);
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
  styles: AUTH_STYLES,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">

        <a class="auth-brand-row" routerLink="/">
          <span class="auth-brand-mark" aria-hidden="true">₿</span>
          <span class="auth-brand-name">BitWLab</span>
        </a>

        <div class="auth-lang">
          <span class="auth-lang-label" i18n="Language selector label@@auth.languageLabel">Language</span>
          <button class="auth-lang-btn" [class.active]="lang() === 'en'" (click)="setLang('en')">EN</button>
          <button class="auth-lang-btn" [class.active]="lang() === 'hu'" (click)="setLang('hu')">HU</button>
        </div>

        <h1 class="auth-title" i18n="Register title@@auth.createAccount">Create account</h1>
        <p class="auth-sub" i18n="Register subtitle@@auth.registerSubtitle">Fill in your details to get started</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="auth-field">
            <label i18n="Email label@@register.emailLabel">Email</label>
            <input type="email" formControlName="email" autocomplete="email"
              placeholder="you@example.com"
              i18n-placeholder="Email placeholder@@register.emailPlaceholder" />
          </div>
          <div class="auth-field">
            <label i18n="Password label@@form.password">Password</label>
            <input type="password" formControlName="password" autocomplete="new-password"
              placeholder="Password"
              i18n-placeholder="Password placeholder@@register.passwordPlaceholder" />
          </div>
          <div class="auth-field">
            <label i18n="Confirm password label@@register.confirmLabel">Confirm password</label>
            <input type="password" formControlName="confirmPassword" autocomplete="new-password"
              placeholder="Repeat your password"
              i18n-placeholder="Confirm password placeholder@@register.confirmPlaceholder" />
          </div>

          <div class="auth-field">
            <label i18n="Security check label@@register.securityCheck">Security check</label>
            <div class="auth-captcha-row">
              <span class="auth-captcha-question">{{ captchaQuestion() }}</span>
              <button type="button" class="auth-captcha-new" (click)="newChallenge()"
                i18n="New challenge button@@register.newChallenge">New challenge</button>
            </div>
            <input type="text" formControlName="captcha" inputmode="numeric"
              placeholder="Enter result"
              i18n-placeholder="Captcha placeholder@@register.captchaPlaceholder" />
          </div>

          @if (passwordMismatch()) {
            <p class="auth-msg" i18n="Passwords mismatch@@form.passwordMismatch">Passwords do not match.</p>
          }
          @if (message()) {
            <p class="auth-msg" [class.success]="isSuccess()">{{ message() }}</p>
          }
          @if (verificationUrl()) {
            <p class="auth-msg success">
              <a [href]="verificationUrl()" i18n="Open verification link@@register.openVerificationLink">Open verification link</a>
            </p>
          }
          @if (pendingVerificationEmail()) {
            <div class="auth-field">
              <label i18n="Verification code label@@register.verificationCode">Verification code</label>
              <input type="text" formControlName="verificationCode" inputmode="numeric" autocomplete="one-time-code"
                placeholder="123456"
                i18n-placeholder="Verification code placeholder@@register.verificationCodePlaceholder" />
            </div>
            <button type="button" class="auth-captcha-new" (click)="verifyCode()" [disabled]="isSubmitting()">
              <ng-container i18n="Verify code button@@register.verifyCode">Verify code</ng-container>
            </button>
          }
          @if (canResendVerification()) {
            <button type="button" class="auth-captcha-new" (click)="resendVerification()" [disabled]="isSubmitting()">
              <ng-container i18n="Resend verification email@@register.resendVerification">Resend verification email</ng-container>
            </button>
          }

          <button type="submit" class="auth-btn-primary"
            [disabled]="form.invalid || passwordMismatch() || isSubmitting()">
            @if (isSubmitting()) {
              <ng-container i18n="Creating account state@@auth.creatingAccount">Creating account...</ng-container>
            } @else {
              <ng-container i18n="Create account button@@auth.createAccount">Create account</ng-container>
            }
          </button>
        </form>

        <p class="auth-switch">
          <ng-container i18n="Have account prompt@@auth.haveAccount">Already have an account?</ng-container>
          <a routerLink="/login" i18n="Sign in link@@auth.signInLink"> Sign in</a>
        </p>

        <div class="auth-divider"><span>or</span></div>

        <button type="button" class="auth-btn-google" (click)="continueWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.251 17.64 11.942 17.64 9.2z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          <ng-container i18n="Continue with Google@@auth.continueWithGoogle">Continue with Google</ng-container>
        </button>

        <div class="auth-terms">
          <button type="button" class="auth-terms-link" (click)="legal.open('disclaimer')" i18n="Disclaimer link@@nav.disclaimer">Disclaimer</button>
          <button type="button" class="auth-terms-link" (click)="legal.open('terms-of-use')" i18n="Terms of use link@@auth.termsOfUse">Terms of Use</button>
          <button type="button" class="auth-terms-link" (click)="legal.open('privacy-policy')" i18n="Privacy policy link@@auth.privacyPolicy">Privacy Policy</button>
        </div>

      </div>

      <footer class="auth-footer">
        <p class="auth-footer-brand">BitWLab</p>
        <p class="auth-footer-copy" i18n="Footer copyright@@footer.copyright">© 2026 BitWLab. All rights reserved.</p>
        <p class="auth-footer-disclaimer" i18n="Footer disclaimer@@footer.disclaimer">Not financial advice. Cryptocurrency investments carry risk.</p>
      </footer>
    </div>
  `,
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthApiClient);
  private readonly langService = inject(LanguageService);
  protected readonly legal = inject(LegalDialogService);
  protected readonly lang = this.langService.current;
  protected readonly isSubmitting = signal(false);
  protected readonly message = signal('');
  protected readonly isSuccess = signal(false);
  protected readonly canResendVerification = signal(false);
  protected readonly verificationUrl = signal('');
  protected readonly pendingVerificationEmail = signal('');
  protected readonly captchaQuestion = signal('');
  private captchaAnswer = 0;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    confirmPassword: ['', Validators.required],
    captcha: ['', Validators.required],
    verificationCode: [''],
    languagePreference: this.fb.nonNullable.control<'en' | 'hu'>(this.langService.current(), Validators.required),
  });

  protected readonly passwordMismatch = computed(() => {
    const { password, confirmPassword } = this.form.getRawValue();
    return Boolean(password && confirmPassword && password !== confirmPassword);
  });

  constructor() {
    this.newChallenge();
  }

  protected setLang(locale: 'en' | 'hu'): void {
    this.form.patchValue({ languagePreference: locale });
    this.langService.switchTo(locale);
  }

  protected newChallenge(): void {
    const a = Math.floor(Math.random() * 12) + 3;
    const b = Math.floor(Math.random() * (a - 1)) + 1;
    const useAdd = Math.random() > 0.5;
    this.captchaAnswer = useAdd ? a + b : a - b;
    this.captchaQuestion.set(`${a} ${useAdd ? '+' : '-'} ${b} = ?`);
    this.form.patchValue({ captcha: '' });
  }

  protected continueWithGoogle(): void {
    this.auth.startGoogleLogin();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.passwordMismatch() || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const captchaGuess = parseInt(this.form.getRawValue().captcha, 10);
    if (captchaGuess !== this.captchaAnswer) {
      this.message.set($localize`:Captcha wrong@@register.captchaWrong:Incorrect answer. Please try again.`);
      this.newChallenge();
      return;
    }

    this.isSubmitting.set(true);
    this.message.set('');
    this.isSuccess.set(false);
    this.canResendVerification.set(false);
    this.verificationUrl.set('');
    this.pendingVerificationEmail.set('');

    try {
      const { email, password, confirmPassword, languagePreference } = this.form.getRawValue();
      const response = await this.auth.register({ email, password, confirmPassword, languagePreference });
      this.isSuccess.set(true);
      this.message.set(response.message);
      this.pendingVerificationEmail.set(email);
      this.form.reset({
        email,
        password: '',
        confirmPassword: '',
        captcha: '',
        verificationCode: '',
        languagePreference,
      });
      this.newChallenge();
    } catch (error) {
      const message = getErrorMessage(error);
      this.message.set(message);
      this.canResendVerification.set(message === 'Email already registered');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected async resendVerification(): Promise<void> {
    const email = this.form.getRawValue().email;
    if (!email || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    try {
      const response = await this.auth.requestEmailVerification({ email });
      this.isSuccess.set(true);
      this.canResendVerification.set(false);
      this.pendingVerificationEmail.set(email);
      this.message.set(response.message);
      this.verificationUrl.set(response.verificationUrl ?? '');
    } catch (error) {
      this.message.set(getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected async verifyCode(): Promise<void> {
    const { email, verificationCode } = this.form.getRawValue();
    const targetEmail = this.pendingVerificationEmail() || email;
    if (!targetEmail || !verificationCode || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    try {
      const response = await this.auth.verifyEmailCode({ email: targetEmail, code: verificationCode });
      this.isSuccess.set(true);
      this.message.set(response.message);
      this.pendingVerificationEmail.set('');
      this.verificationUrl.set('');
      this.form.patchValue({ verificationCode: '' });
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
  { path: 'disclaimer', component: DisclaimerPage },
  { path: 'privacy-policy', component: PrivacyPolicyPage },
  { path: 'terms-of-use', component: TermsOfUsePage },
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
    path: 'charts/exchange-reserve',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/exchange-reserve-chart-page/exchange-reserve-chart-page.component').then(
        (m) => m.ExchangeReserveChartPageComponent,
      ),
  },
  {
    path: 'charts/funding-rate-oi',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/funding-rate-oi-chart-page/funding-rate-oi-chart-page.component').then(
        (m) => m.FundingRateOpenInterestChartPageComponent,
      ),
  },
  {
    path: 'charts/exchange-netflow',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/exchange-netflow-chart-page/exchange-netflow-chart-page.component').then(
        (m) => m.ExchangeNetflowChartPageComponent,
      ),
  },
  {
    path: 'charts/realized-cap',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/realized-cap-chart-page/realized-cap-chart-page.component').then(
        (m) => m.RealizedCapChartPageComponent,
      ),
  },
  {
    path: 'charts/lth-sth-sopr-split',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/lth-sth-sopr-split-chart-page/lth-sth-sopr-split-chart-page.component').then(
        (m) => m.LthSthSoprSplitChartPageComponent,
      ),
  },
  {
    path: 'charts/google-trends-bitcoin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/google-trends-bitcoin-chart-page/google-trends-bitcoin-chart-page.component').then(
        (m) => m.GoogleTrendsBitcoinChartPageComponent,
      ),
  },
  {
    path: 'charts/realized-volatility',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/realized-volatility-chart-page/realized-volatility-chart-page.component').then(
        (m) => m.RealizedVolatilityChartPageComponent,
      ),
  },
  {
    path: 'charts/active-addresses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/active-addresses-chart-page/active-addresses-chart-page.component').then(
        (m) => m.ActiveAddressesChartPageComponent,
      ),
  },
  {
    path: 'charts/hash-rate',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/hash-rate-chart-page/hash-rate-chart-page.component').then(
        (m) => m.HashRateChartPageComponent,
      ),
  },
  {
    path: 'charts/btc-dvol',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/btc-dvol-chart-page/btc-dvol-chart-page.component').then(
        (m) => m.BtcDvolChartPageComponent,
      ),
  },
  {
    path: 'charts/nupl',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/nupl-chart-page/nupl-chart-page.component').then(
        (m) => m.NuplChartPageComponent,
      ),
  },
  {
    path: 'charts/realized-price',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/realized-price-chart-page/realized-price-chart-page.component').then(
        (m) => m.RealizePriceChartPageComponent,
      ),
  },
  {
    path: 'charts/sopr-ratio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/sopr-ratio-chart-page/sopr-ratio-chart-page.component').then(
        (m) => m.SoprRatioChartPageComponent,
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
    path: 'charts/compare-bull-markets',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/compare-bull-markets-chart-page/compare-bull-markets-chart-page.component').then(
        (m) => m.CompareBullMarketsChartPageComponent,
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
    path: 'charts/excess-liquidity',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/excess-liquidity-chart-page/excess-liquidity-chart-page.component').then(
        (m) => m.ExcessLiquidityChartPageComponent,
      ),
  },
  {
    path: 'charts/spx-liquidity',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/spx-liquidity-chart-page/spx-liquidity-chart-page.component').then(
        (m) => m.SpxLiquidityChartPageComponent,
      ),
  },
  {
    path: 'charts/global-m2-bitcoin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/global-m2-bitcoin-chart-page/global-m2-bitcoin-chart-page.component').then(
        (m) => m.GlobalM2BitcoinChartPageComponent,
      ),
  },
  {
    path: 'charts/dxy-bitcoin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/dxy-bitcoin-chart-page/dxy-bitcoin-chart-page.component').then(
        (m) => m.DxyBitcoinChartPageComponent,
      ),
  },
  {
    path: 'charts/midterm-cycles',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/midterm-cycles-chart-page/midterm-cycles-chart-page.component').then(
        (m) => m.MidtermCyclesChartPageComponent,
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
    path: 'admin/email-settings',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['administrator'] },
    loadComponent: () =>
      import('./components/email-settings-page/email-settings-page.component').then(
        (m) => m.EmailSettingsPageComponent,
      ),
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
    path: 'support',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/support-tickets-page/support-tickets-page.component').then(
        (m) => m.SupportTicketsPageComponent,
      ),
  },
  {
    path: 'trading-plans',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/trading-plans-page/trading-plans-page.component').then(
        (m) => m.TradingPlansPageComponent,
      ),
  },
  {
    path: 'user-guide',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/user-guide-page/user-guide-page.component').then(
        (m) => m.UserGuidePageComponent,
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
