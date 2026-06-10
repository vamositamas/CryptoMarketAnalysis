import { Component } from '@angular/core';
import { Route } from '@angular/router';

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
  selector: 'app-onboarding-page',
  template: `
    <section class="content-section split-section">
      <div>
        <p class="eyebrow">Onboarding</p>
        <h2>Set your analysis profile</h2>
        <p>Choose a trading horizon, preferred language, and alert sensitivity after registration.</p>
      </div>
      <form class="compact-form">
        <label>
          Trading horizon
          <select>
            <option>Cycle investor</option>
            <option>Swing trader</option>
            <option>Research only</option>
          </select>
        </label>
        <label>
          Alert sensitivity
          <input type="range" min="1" max="5" value="3" />
        </label>
        <button type="button">Save preferences</button>
      </form>
    </section>
  `,
})
export class OnboardingPage {}

@Component({
  selector: 'app-login-page',
  template: `
    <section class="content-section auth-section">
      <form class="auth-form">
        <h2>Login</h2>
        <label>Email<input type="email" autocomplete="email" /></label>
        <label>Password<input type="password" autocomplete="current-password" /></label>
        <button type="button">Login</button>
        <button type="button" class="secondary-button">Continue with Google</button>
      </form>
    </section>
  `,
})
export class LoginPage {}

@Component({
  selector: 'app-register-page',
  template: `
    <section class="content-section auth-section">
      <form class="auth-form">
        <h2>Register</h2>
        <label>Full name<input type="text" autocomplete="name" /></label>
        <label>Email<input type="email" autocomplete="email" /></label>
        <label>Password<input type="password" autocomplete="new-password" /></label>
        <label>Confirm password<input type="password" autocomplete="new-password" /></label>
        <button type="button">Create account</button>
      </form>
    </section>
  `,
})
export class RegisterPage {}

export const appRoutes: Route[] = [
  { path: '', component: DashboardPage },
  { path: 'charts', component: ChartsPage },
  { path: 'onboarding', component: OnboardingPage },
  { path: 'login', component: LoginPage },
  { path: 'register', component: RegisterPage },
  { path: '**', redirectTo: '' },
];
