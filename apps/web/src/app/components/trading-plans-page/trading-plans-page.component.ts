import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ApiClientError,
  AuthApiClient,
  type CreateTradingPlanRequest,
  type PriceProjectionsResponse,
  type SignalScore,
  type SignalSummary,
  type SignalZone,
  type TradingPlanRecord,
} from '@crypto-market-analysis/data-access/api-client';

type Tab = 'signals' | 'projections' | 'plans';

@Component({
  selector: 'app-trading-plans-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  styles: [`
    .tp-page { padding: 0 0 4rem; }
    .tp-header { margin-bottom: 2rem; }
    .tp-header h2 { margin: 0.25rem 0 0.5rem; }
    .tp-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--color-border, #e5e7eb); margin-bottom: 2rem; }
    .tp-tab { background: none; border: none; padding: 0.75rem 1.5rem; font-size: 0.875rem; font-weight: 500; color: var(--color-text-muted, #6b7280); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 0.15s, border-color 0.15s; }
    .tp-tab:hover { color: var(--color-text, #111); }
    .tp-tab.active { color: var(--color-accent, #f59e0b); border-bottom-color: var(--color-accent, #f59e0b); }
    .tp-loading { padding: 3rem 0; text-align: center; color: var(--color-text-muted, #6b7280); }
    /* Signal dashboard */
    .sig-hero { display: flex; align-items: center; gap: 2rem; background: var(--color-surface, #f9fafb); border: 1px solid var(--color-border, #e5e7eb); border-radius: 12px; padding: 1.5rem 2rem; margin-bottom: 2rem; }
    .sig-score-ring { position: relative; width: 100px; height: 100px; flex-shrink: 0; }
    .sig-score-ring svg { width: 100%; height: 100%; }
    .sig-score-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .sig-score-num { font-size: 1.5rem; font-weight: 700; line-height: 1; }
    .sig-score-sub { font-size: 0.65rem; color: var(--color-text-muted, #6b7280); margin-top: 2px; }
    .sig-hero-text h3 { margin: 0 0 0.25rem; font-size: 1.25rem; }
    .sig-hero-text p { margin: 0; color: var(--color-text-muted, #6b7280); font-size: 0.875rem; }
    .sig-price { margin-top: 0.5rem; font-size: 1.1rem; font-weight: 600; }
    .sig-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .sig-card { background: var(--color-surface, #f9fafb); border: 1px solid var(--color-border, #e5e7eb); border-radius: 10px; padding: 1rem 1.25rem; border-left: 4px solid transparent; }
    .sig-card[data-zone="very_bullish"] { border-left-color: #16a34a; }
    .sig-card[data-zone="bullish"]      { border-left-color: #22c55e; }
    .sig-card[data-zone="neutral"]      { border-left-color: #9ca3af; }
    .sig-card[data-zone="bearish"]      { border-left-color: #f97316; }
    .sig-card[data-zone="very_bearish"] { border-left-color: #ef4444; }
    .sig-card[data-zone="no_data"]      { border-left-color: #d1d5db; opacity: 0.6; }
    .sig-card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
    .sig-card-name { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted, #6b7280); }
    .sig-card-value { font-size: 1rem; font-weight: 700; }
    .sig-card-bar { height: 4px; background: var(--color-border, #e5e7eb); border-radius: 2px; margin-bottom: 0.5rem; overflow: hidden; }
    .sig-card-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s; }
    .sig-card-interp { font-size: 0.75rem; color: var(--color-text-muted, #6b7280); line-height: 1.4; }
    .sig-zone-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; margin-bottom: 0.4rem; }
    .zone-very_bullish { background: #dcfce7; color: #16a34a; }
    .zone-bullish      { background: #d1fae5; color: #059669; }
    .zone-neutral      { background: #f3f4f6; color: #6b7280; }
    .zone-bearish      { background: #fff7ed; color: #ea580c; }
    .zone-very_bearish { background: #fef2f2; color: #dc2626; }
    .zone-no_data      { background: #f3f4f6; color: #9ca3af; }
    /* Projections */
    .proj-btc { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; }
    .proj-btc span { font-size: 0.875rem; font-weight: 400; color: var(--color-text-muted, #6b7280); margin-left: 0.5rem; }
    .proj-scenarios { display: grid; gap: 1rem; }
    .proj-scenario { border: 1px solid var(--color-border, #e5e7eb); border-radius: 10px; overflow: hidden; }
    .proj-scenario-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; background: var(--color-surface, #f9fafb); border-bottom: 1px solid var(--color-border, #e5e7eb); }
    .proj-scenario-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .proj-scenario-label { font-weight: 700; font-size: 1rem; }
    .proj-targets { padding: 0.75rem 1.25rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
    .proj-target { padding: 0.75rem; background: var(--color-background, #fff); border: 1px solid var(--color-border, #e5e7eb); border-radius: 8px; }
    .proj-target-price { font-size: 1.1rem; font-weight: 700; }
    .proj-target-label { font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted, #6b7280); margin-bottom: 2px; }
    .proj-target-model { font-size: 0.7rem; color: var(--color-text-muted, #6b7280); }
    .proj-target-timeframe { font-size: 0.7rem; color: var(--color-text-muted, #6b7280); margin-top: 2px; font-style: italic; }
    .proj-target-pct { font-size: 0.8rem; font-weight: 600; margin-top: 4px; }
    .proj-target-pct.up { color: #16a34a; }
    .proj-target-pct.down { color: #dc2626; }
    /* Plans list */
    .plans-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    .plans-empty { text-align: center; padding: 3rem 0; color: var(--color-text-muted, #6b7280); }
    .plan-card { border: 1px solid var(--color-border, #e5e7eb); border-radius: 10px; margin-bottom: 1rem; overflow: hidden; }
    .plan-card-header { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; background: var(--color-surface, #f9fafb); border-bottom: 1px solid var(--color-border, #e5e7eb); flex-wrap: wrap; }
    .plan-dir-badge { font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.06em; }
    .plan-dir-long    { background: #dcfce7; color: #16a34a; }
    .plan-dir-short   { background: #fef2f2; color: #dc2626; }
    .plan-dir-neutral { background: #f3f4f6; color: #6b7280; }
    .plan-status-badge { font-size: 0.7rem; font-weight: 600; padding: 3px 10px; border-radius: 99px; }
    .status-active    { background: #dbeafe; color: #1d4ed8; }
    .status-closed    { background: #d1fae5; color: #065f46; }
    .status-cancelled { background: #f3f4f6; color: #6b7280; }
    .plan-title { font-weight: 600; font-size: 0.95rem; flex: 1; min-width: 0; }
    .plan-card-body { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; padding: 1rem 1.25rem; }
    .plan-metric { }
    .plan-metric-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted, #6b7280); margin-bottom: 2px; }
    .plan-metric-value { font-size: 0.95rem; font-weight: 600; }
    .plan-metric-value.profit { color: #16a34a; }
    .plan-metric-value.loss   { color: #dc2626; }
    .plan-card-actions { display: flex; gap: 0.5rem; padding: 0.75rem 1.25rem; border-top: 1px solid var(--color-border, #e5e7eb); background: var(--color-surface, #f9fafb); flex-wrap: wrap; }
    .plan-notes { padding: 0 1.25rem 0.75rem; font-size: 0.8rem; color: var(--color-text-muted, #6b7280); font-style: italic; }
    /* Create form */
    .create-form-wrap { background: var(--color-surface, #f9fafb); border: 1px solid var(--color-border, #e5e7eb); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .create-form-wrap h3 { margin: 0 0 1.25rem; font-size: 1rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
    .form-row-3 { grid-template-columns: 1fr 1fr 1fr; }
    .form-row-1 { grid-template-columns: 1fr; }
    .form-group label { display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 4px; color: var(--color-text-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.04em; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border, #e5e7eb); border-radius: 6px; font-size: 0.875rem; background: var(--color-background, #fff); color: var(--color-text, #111); box-sizing: border-box; }
    .form-group textarea { resize: vertical; min-height: 60px; }
    .form-actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; }
    .form-msg { font-size: 0.8rem; padding: 0.5rem 0.75rem; border-radius: 6px; margin-top: 0.75rem; }
    .form-msg.error { background: #fef2f2; color: #dc2626; }
    /* Close modal */
    .close-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .close-modal { background: var(--color-background, #fff); border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .close-modal h3 { margin: 0 0 1rem; }
    .close-modal .form-group { margin-bottom: 1rem; }
    .close-modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
    @media (max-width: 900px) {
      .sig-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 600px) {
      .form-row, .form-row-3 { grid-template-columns: 1fr; }
      .sig-hero { flex-direction: column; gap: 1rem; }
      .sig-grid { grid-template-columns: 1fr; }
    }
  `],
  template: `
    <section class="content-section tp-page">
      <div class="tp-header">
        <p class="eyebrow">Trade Planner</p>
        <h2>Trading Plans & Market Signals</h2>
        <p style="color: var(--color-text-muted, #6b7280); font-size: 0.875rem; margin: 0;">
          Signal aggregation from all chart indicators, model-based price targets, and your personal trade plans.
        </p>
      </div>

      <div class="tp-tabs" role="tablist">
        <button class="tp-tab" [class.active]="activeTab() === 'signals'" (click)="setTab('signals')" role="tab">
          Market Signals
        </button>
        <button class="tp-tab" [class.active]="activeTab() === 'projections'" (click)="setTab('projections')" role="tab">
          Price Projections
        </button>
        <button class="tp-tab" [class.active]="activeTab() === 'plans'" (click)="setTab('plans')" role="tab">
          My Plans @if (activePlansCount() > 0) { <span style="margin-left:4px;background:#dbeafe;color:#1d4ed8;border-radius:99px;padding:1px 7px;font-size:0.7rem;">{{ activePlansCount() }}</span> }
        </button>
      </div>

      <!-- SIGNALS TAB -->
      @if (activeTab() === 'signals') {
        @if (signalsLoading()) {
          <div class="tp-loading">Loading signals...</div>
        } @else if (signals()) {
          @let s = signals()!;
          <div class="sig-hero">
            <div class="sig-score-ring">
              <svg viewBox="0 0 80 80" aria-hidden="true">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="8"/>
                <circle cx="40" cy="40" r="34" fill="none"
                  [attr.stroke]="scoreColor(s.normalizedScore)"
                  stroke-width="8" stroke-linecap="round"
                  transform="rotate(-90 40 40)"
                  [attr.stroke-dasharray]="213.6"
                  [attr.stroke-dashoffset]="scoreOffset(s.normalizedScore)"/>
              </svg>
              <div class="sig-score-center">
                <span class="sig-score-num" [style.color]="scoreColor(s.normalizedScore)">{{ s.normalizedScore }}</span>
                <span class="sig-score-sub">/ 100</span>
              </div>
            </div>
            <div class="sig-hero-text">
              <span class="sig-zone-badge" [class]="'zone-' + s.overallZone">{{ s.overallLabel }}</span>
              <h3>{{ signalHeadline(s.normalizedScore) }}</h3>
              <p>{{ signalSubtext(s.normalizedScore) }}</p>
              @if (s.btcPriceUsd) {
                <div class="sig-price">BTC: {{ formatUsd(s.btcPriceUsd) }}</div>
              }
            </div>
          </div>
          <div class="sig-grid">
            @for (sig of s.signals; track sig.name) {
              <div class="sig-card" [attr.data-zone]="sig.zone">
                <div class="sig-card-header">
                  <span class="sig-card-name">{{ sig.label }}</span>
                  <span class="sig-card-value">{{ sig.formattedValue }}</span>
                </div>
                <div class="sig-card-bar">
                  <div class="sig-card-bar-fill"
                    [style.width.%]="barWidth(sig.score, sig.maxScore)"
                    [style.background]="barColor(sig.score, sig.maxScore)">
                  </div>
                </div>
                <span class="sig-zone-badge" [class]="'zone-' + sig.zone">{{ zoneLabel(sig.zone) }}</span>
                <div class="sig-card-interp">{{ sig.interpretation }}</div>
              </div>
            }
          </div>
          @if (s.lastUpdated) {
            <p style="font-size:0.75rem;color:var(--color-text-muted,#6b7280);margin-top:1.5rem;">
              Last updated: {{ formatDate(s.lastUpdated) }}
            </p>
          }
        } @else if (signalsError()) {
          <p class="form-msg error">{{ signalsError() }}</p>
        }
      }

      <!-- PROJECTIONS TAB -->
      @if (activeTab() === 'projections') {
        @if (projectionsLoading()) {
          <div class="tp-loading">Loading projections...</div>
        } @else if (projections()) {
          @let p = projections()!;
          @if (p.btcPriceUsd) {
            <div class="proj-btc">{{ formatUsd(p.btcPriceUsd) }} <span>current BTC price</span></div>
          }
          <div class="proj-scenarios">
            @for (scenario of p.scenarios; track scenario.scenario) {
              <div class="proj-scenario">
                <div class="proj-scenario-header">
                  <div class="proj-scenario-dot" [style.background]="scenario.color"></div>
                  <span class="proj-scenario-label">{{ scenario.label }}</span>
                </div>
                <div class="proj-targets">
                  @for (target of scenario.targets; track target.label) {
                    <div class="proj-target">
                      <div class="proj-target-label">{{ target.label }}</div>
                      <div class="proj-target-price" [style.color]="scenario.color">{{ formatUsd(target.priceUsd) }}</div>
                      <div class="proj-target-model">{{ target.model }}</div>
                      @if (p.btcPriceUsd) {
                        @let pct = ((target.priceUsd - p.btcPriceUsd) / p.btcPriceUsd * 100);
                        <div class="proj-target-pct" [class.up]="pct >= 0" [class.down]="pct < 0">
                          {{ pct >= 0 ? '+' : '' }}{{ pct.toFixed(1) }}% from now
                        </div>
                      }
                      <div class="proj-target-timeframe">{{ target.timeframe }}</div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
          <div style="margin-top:1.5rem;padding:1rem;background:var(--color-surface,#f9fafb);border-radius:8px;border:1px solid var(--color-border,#e5e7eb);">
            <p style="font-size:0.75rem;color:var(--color-text-muted,#6b7280);margin:0;line-height:1.6;">
              <strong>Disclaimer:</strong> These projections are based on on-chain and mathematical models (Stock-to-Flow, Mayer Multiple, Rainbow bands, Terminal Price, CVDD).
              They reflect historical model behaviour — not financial advice. Always conduct your own research.
            </p>
          </div>
        } @else if (projectionsError()) {
          <p class="form-msg error">{{ projectionsError() }}</p>
        }
      }

      <!-- MY PLANS TAB -->
      @if (activeTab() === 'plans') {
        <div class="plans-header">
          <div>
            <strong>{{ plans().length }} plan{{ plans().length === 1 ? '' : 's' }}</strong>
            @if (activePlansCount() > 0) {
              <span style="color:var(--color-text-muted,#6b7280);font-size:0.875rem;"> &mdash; {{ activePlansCount() }} active</span>
            }
          </div>
          <button class="primary-button" (click)="toggleCreateForm()">
            {{ showCreateForm() ? 'Cancel' : 'New Plan' }}
          </button>
        </div>

        @if (showCreateForm()) {
          <div class="create-form-wrap">
            <h3>Create Trading Plan</h3>
            <form [formGroup]="createForm" (ngSubmit)="submitCreate()">
              <div class="form-row form-row-1">
                <div class="form-group">
                  <label for="plan-title">Plan title</label>
                  <input id="plan-title" type="text" formControlName="title" placeholder="e.g. BTC Long — Mid-cycle entry" />
                </div>
              </div>
              <div class="form-row form-row-3">
                <div class="form-group">
                  <label for="plan-direction">Direction</label>
                  <select id="plan-direction" formControlName="direction">
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                    <option value="neutral">Neutral / DCA</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="plan-entry">Entry price (USD)</label>
                  <input id="plan-entry" type="number" formControlName="entryPrice" placeholder="e.g. 95000" min="0" />
                </div>
                <div class="form-group">
                  <label for="plan-expiry">Expiry date (optional)</label>
                  <input id="plan-expiry" type="date" formControlName="expiryDate" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="plan-target">Target price (USD)</label>
                  <input id="plan-target" type="number" formControlName="targetPrice" placeholder="e.g. 140000" min="0" />
                </div>
                <div class="form-group">
                  <label for="plan-stop">Stop loss (USD)</label>
                  <input id="plan-stop" type="number" formControlName="stopLoss" placeholder="e.g. 82000" min="0" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="plan-size">Position size (USD)</label>
                  <input id="plan-size" type="number" formControlName="positionSizeUsd" placeholder="e.g. 5000" min="0" />
                </div>
                <div class="form-group">
                  <label for="plan-risk">Risk % of portfolio</label>
                  <input id="plan-risk" type="number" formControlName="riskPercent" placeholder="e.g. 2" min="0" max="100" step="0.1" />
                </div>
              </div>
              <div class="form-row form-row-1">
                <div class="form-group">
                  <label for="plan-notes">Notes / thesis</label>
                  <textarea id="plan-notes" formControlName="notes" rows="3" placeholder="Why this trade, what signals support it..."></textarea>
                </div>
              </div>
              @if (createError()) { <div class="form-msg error">{{ createError() }}</div> }
              <div class="form-actions">
                <button type="submit" [disabled]="createForm.invalid || isCreating()">
                  {{ isCreating() ? 'Creating...' : 'Create Plan' }}
                </button>
                <button type="button" class="secondary-button" (click)="toggleCreateForm()">Cancel</button>
              </div>
            </form>
          </div>
        }

        @if (plansLoading()) {
          <div class="tp-loading">Loading plans...</div>
        } @else if (plans().length === 0 && !showCreateForm()) {
          <div class="plans-empty">
            <p>No trading plans yet.</p>
            <button class="secondary-button" (click)="toggleCreateForm()">Create your first plan</button>
          </div>
        } @else {
          @for (plan of plans(); track plan.id) {
            <div class="plan-card">
              <div class="plan-card-header">
                <span class="plan-dir-badge" [class]="'plan-dir-' + plan.direction">{{ plan.direction }}</span>
                <span class="plan-status-badge" [class]="'status-' + plan.status">{{ plan.status }}</span>
                <span class="plan-title">{{ plan.title }}</span>
                <span style="font-size:0.75rem;color:var(--color-text-muted,#6b7280);">{{ formatDate(plan.createdAt) }}</span>
              </div>
              <div class="plan-card-body">
                <div class="plan-metric">
                  <div class="plan-metric-label">Entry</div>
                  <div class="plan-metric-value">{{ formatUsd(plan.entryPrice) }}</div>
                </div>
                @if (plan.targetPrice) {
                  <div class="plan-metric">
                    <div class="plan-metric-label">Target</div>
                    <div class="plan-metric-value">{{ formatUsd(plan.targetPrice) }}</div>
                  </div>
                }
                @if (plan.stopLoss) {
                  <div class="plan-metric">
                    <div class="plan-metric-label">Stop Loss</div>
                    <div class="plan-metric-value">{{ formatUsd(plan.stopLoss) }}</div>
                  </div>
                }
                @if (plan.status === 'active' && currentBtcPrice()) {
                  <div class="plan-metric">
                    <div class="plan-metric-label">Current BTC</div>
                    <div class="plan-metric-value">{{ formatUsd(currentBtcPrice()!) }}</div>
                  </div>
                  <div class="plan-metric">
                    <div class="plan-metric-label">Unrealised P&amp;L</div>
                    @let pnl = calcPnl(plan);
                    <div class="plan-metric-value" [class.profit]="pnl >= 0" [class.loss]="pnl < 0">
                      {{ pnl >= 0 ? '+' : '' }}{{ pnl.toFixed(2) }}%
                    </div>
                  </div>
                  @if (plan.targetPrice) {
                    <div class="plan-metric">
                      <div class="plan-metric-label">To Target</div>
                      <div class="plan-metric-value profit">{{ toTargetPct(plan) }}</div>
                    </div>
                  }
                }
                @if (plan.status === 'closed' && plan.closePrice) {
                  <div class="plan-metric">
                    <div class="plan-metric-label">Close Price</div>
                    <div class="plan-metric-value">{{ formatUsd(plan.closePrice) }}</div>
                  </div>
                  <div class="plan-metric">
                    <div class="plan-metric-label">Realised P&amp;L</div>
                    @let rpnl = realisedPnl(plan);
                    <div class="plan-metric-value" [class.profit]="rpnl >= 0" [class.loss]="rpnl < 0">
                      {{ rpnl >= 0 ? '+' : '' }}{{ rpnl.toFixed(2) }}%
                    </div>
                  </div>
                }
                @if (plan.positionSizeUsd) {
                  <div class="plan-metric">
                    <div class="plan-metric-label">Position</div>
                    <div class="plan-metric-value">{{ formatUsd(plan.positionSizeUsd) }}</div>
                  </div>
                }
                @if (plan.riskPercent) {
                  <div class="plan-metric">
                    <div class="plan-metric-label">Risk</div>
                    <div class="plan-metric-value">{{ plan.riskPercent }}%</div>
                  </div>
                }
                @if (plan.expiryDate) {
                  <div class="plan-metric">
                    <div class="plan-metric-label">Expires</div>
                    <div class="plan-metric-value">{{ plan.expiryDate }}</div>
                  </div>
                }
              </div>
              @if (plan.notes) {
                <div class="plan-notes">"{{ plan.notes }}"</div>
              }
              @if (plan.status === 'active') {
                <div class="plan-card-actions">
                  <button class="secondary-button" (click)="openClose(plan.id)">Close Position</button>
                  <button class="secondary-button" (click)="cancelPlan(plan.id)" [disabled]="actionPlanId() === plan.id">Cancel Plan</button>
                  <button style="margin-left:auto;background:none;border:none;color:var(--color-text-muted,#9ca3af);cursor:pointer;font-size:0.8rem;" (click)="deletePlan(plan.id)" [disabled]="actionPlanId() === plan.id">Delete</button>
                </div>
              } @else {
                <div class="plan-card-actions">
                  <button style="background:none;border:none;color:var(--color-text-muted,#9ca3af);cursor:pointer;font-size:0.8rem;" (click)="deletePlan(plan.id)" [disabled]="actionPlanId() === plan.id">Delete</button>
                </div>
              }
            </div>
          }
        }
      }
    </section>

    <!-- Close position modal -->
    @if (closingPlanId()) {
      <div class="close-overlay" (click)="closeModal()">
        <div class="close-modal" (click)="$event.stopPropagation()">
          <h3>Close Position</h3>
          <p style="font-size:0.875rem;color:var(--color-text-muted,#6b7280);margin-bottom:1rem;">
            Enter the price at which you closed this position.
          </p>
          <div class="form-group">
            <label for="close-price">Close price (USD)</label>
            <input id="close-price" type="number" [value]="closePriceInput()" (input)="closePriceInput.set($any($event.target).value)" placeholder="e.g. 125000" min="0" />
          </div>
          @if (closeError()) { <div class="form-msg error">{{ closeError() }}</div> }
          <div class="close-modal-actions">
            <button class="secondary-button" (click)="closeModal()">Cancel</button>
            <button (click)="confirmClose()" [disabled]="!closePriceInput() || isClosing()">
              {{ isClosing() ? 'Closing...' : 'Confirm Close' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TradingPlansPageComponent {
  private readonly api = inject(AuthApiClient);
  private readonly fb = inject(FormBuilder);

  protected readonly activeTab = signal<Tab>('signals');
  protected readonly signals = signal<SignalSummary | null>(null);
  protected readonly signalsLoading = signal(false);
  protected readonly signalsError = signal('');
  protected readonly projections = signal<PriceProjectionsResponse | null>(null);
  protected readonly projectionsLoading = signal(false);
  protected readonly projectionsError = signal('');
  protected readonly plans = signal<TradingPlanRecord[]>([]);
  protected readonly plansLoading = signal(false);
  protected readonly showCreateForm = signal(false);
  protected readonly isCreating = signal(false);
  protected readonly createError = signal('');
  protected readonly actionPlanId = signal<string | null>(null);
  protected readonly closingPlanId = signal<string | null>(null);
  protected readonly closePriceInput = signal('');
  protected readonly isClosing = signal(false);
  protected readonly closeError = signal('');

  protected readonly activePlansCount = computed(() => this.plans().filter((p) => p.status === 'active').length);
  protected readonly currentBtcPrice = computed(() => this.signals()?.btcPriceUsd ?? this.projections()?.btcPriceUsd ?? null);

  protected readonly createForm = this.fb.nonNullable.group({
    title: [''],
    direction: this.fb.nonNullable.control<'long' | 'short' | 'neutral'>('long', Validators.required),
    entryPrice: [null as number | null, [Validators.required, Validators.min(1)]],
    targetPrice: [null as number | null],
    stopLoss: [null as number | null],
    positionSizeUsd: [null as number | null],
    riskPercent: [null as number | null],
    expiryDate: [null as string | null],
    notes: [''],
  });

  constructor() {
    void this.loadSignals();
    void this.loadPlans();
  }

  protected setTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'projections' && !this.projections()) {
      void this.loadProjections();
    }
  }

  protected toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
    if (!this.showCreateForm()) {
      this.createForm.reset({ direction: 'long' });
      this.createError.set('');
    }
  }

  protected openClose(planId: string): void {
    this.closingPlanId.set(planId);
    this.closePriceInput.set('');
    this.closeError.set('');
  }

  protected closeModal(): void {
    this.closingPlanId.set(null);
    this.closeError.set('');
  }

  protected async confirmClose(): Promise<void> {
    const planId = this.closingPlanId();
    const price = parseFloat(this.closePriceInput());

    if (!planId || isNaN(price) || price <= 0) {
      this.closeError.set('Please enter a valid price');
      return;
    }

    this.isClosing.set(true);
    this.closeError.set('');

    try {
      const updated = await this.api.closeTradingPlan(planId, price);
      this.plans.update((list) => list.map((p) => (p.id === planId ? updated : p)));
      this.closingPlanId.set(null);
    } catch (error) {
      this.closeError.set(toMessage(error));
    } finally {
      this.isClosing.set(false);
    }
  }

  protected async cancelPlan(planId: string): Promise<void> {
    this.actionPlanId.set(planId);
    try {
      const updated = await this.api.cancelTradingPlan(planId);
      this.plans.update((list) => list.map((p) => (p.id === planId ? updated : p)));
    } catch {
      // ignore
    } finally {
      this.actionPlanId.set(null);
    }
  }

  protected async deletePlan(planId: string): Promise<void> {
    this.actionPlanId.set(planId);
    try {
      await this.api.deleteTradingPlan(planId);
      this.plans.update((list) => list.filter((p) => p.id !== planId));
    } catch {
      // ignore
    } finally {
      this.actionPlanId.set(null);
    }
  }

  protected async submitCreate(): Promise<void> {
    if (this.createForm.invalid || this.isCreating()) return;

    this.isCreating.set(true);
    this.createError.set('');

    try {
      const raw = this.createForm.getRawValue();
      const input: CreateTradingPlanRequest = {
        title: raw.title || 'Untitled Plan',
        direction: raw.direction,
        entryPrice: raw.entryPrice!,
        targetPrice: raw.targetPrice ?? null,
        stopLoss: raw.stopLoss ?? null,
        positionSizeUsd: raw.positionSizeUsd ?? null,
        riskPercent: raw.riskPercent ?? null,
        expiryDate: raw.expiryDate ?? null,
        notes: raw.notes || null,
      };
      const plan = await this.api.createTradingPlan(input);
      this.plans.update((list) => [plan, ...list]);
      this.showCreateForm.set(false);
      this.createForm.reset({ direction: 'long' });
    } catch (error) {
      this.createError.set(toMessage(error));
    } finally {
      this.isCreating.set(false);
    }
  }

  protected calcPnl(plan: TradingPlanRecord): number {
    const btc = this.currentBtcPrice();
    if (!btc) return 0;
    const diff = plan.direction === 'short'
      ? (plan.entryPrice - btc) / plan.entryPrice * 100
      : (btc - plan.entryPrice) / plan.entryPrice * 100;
    return diff;
  }

  protected realisedPnl(plan: TradingPlanRecord): number {
    if (!plan.closePrice) return 0;
    return plan.direction === 'short'
      ? (plan.entryPrice - plan.closePrice) / plan.entryPrice * 100
      : (plan.closePrice - plan.entryPrice) / plan.entryPrice * 100;
  }

  protected toTargetPct(plan: TradingPlanRecord): string {
    const btc = this.currentBtcPrice();
    if (!btc || !plan.targetPrice) return 'N/A';
    const pct = ((plan.targetPrice - btc) / btc) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }

  protected scoreColor(score: number): string {
    if (score >= 60) return '#16a34a';
    if (score >= 20) return '#22c55e';
    if (score >= -20) return '#9ca3af';
    if (score >= -60) return '#f97316';
    return '#ef4444';
  }

  protected scoreOffset(score: number): number {
    const circumference = 2 * Math.PI * 34;
    const clamped = Math.min(100, Math.max(0, score));
    return circumference * (1 - clamped / 100);
  }

  protected barWidth(score: number, max: number): number {
    if (max === 0) return 0;
    return Math.max(0, Math.min(100, ((score + max) / (max * 2)) * 100));
  }

  protected barColor(score: number, max: number): string {
    const pct = max > 0 ? score / max : 0;
    if (pct >= 0.6)  return '#16a34a';
    if (pct >= 0.2)  return '#22c55e';
    if (pct >= -0.2) return '#9ca3af';
    if (pct >= -0.6) return '#f97316';
    return '#ef4444';
  }

  protected zoneLabel(zone: string): string {
    const labels: Record<string, string> = {
      very_bullish: 'Very Bullish',
      bullish: 'Bullish',
      neutral: 'Neutral',
      bearish: 'Bearish',
      very_bearish: 'Very Bearish',
      no_data: 'No Data',
    };
    return labels[zone] ?? zone;
  }

  protected signalHeadline(score: number): string {
    if (score >= 60) return 'Strong accumulation conditions';
    if (score >= 20) return 'Favourable market conditions';
    if (score >= -20) return 'Mixed signals — proceed with caution';
    if (score >= -60) return 'Elevated risk — market overheating';
    return 'Extreme caution — distribution zone';
  }

  protected signalSubtext(score: number): string {
    if (score >= 60) return 'Multiple indicators align for a long-term buy opportunity.';
    if (score >= 20) return 'Most indicators lean bullish. Gradual accumulation appropriate.';
    if (score >= -20) return 'Signals are conflicting. High conviction positions carry more risk.';
    if (score >= -60) return 'Several indicators show overvaluation. Consider reducing exposure.';
    return 'Most indicators signal overvaluation or a cycle top. Avoid new longs.';
  }

  protected formatUsd(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private async loadSignals(): Promise<void> {
    this.signalsLoading.set(true);
    try {
      const data = await this.api.getTradingSignals();
      const fearGreedMissing = data.signals.find((s) => s.name === 'fear_greed')?.zone === 'no_data';

      if (fearGreedMissing) {
        const patched = await this.injectLiveFearGreed(data);
        this.signals.set(patched);
      } else {
        this.signals.set(data);
      }
    } catch (error) {
      this.signalsError.set(toMessage(error));
    } finally {
      this.signalsLoading.set(false);
    }
  }

  private async injectLiveFearGreed(data: SignalSummary): Promise<SignalSummary> {
    try {
      const resp = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
      if (!resp.ok) return data;
      const json = await resp.json() as { data?: Array<{ value?: string }> };
      const raw = json?.data?.[0]?.value;
      if (raw === undefined) return data;
      const fgValue = parseInt(raw, 10);
      if (isNaN(fgValue)) return data;

      const scored = this.scoreFearGreedBrowser(fgValue);
      const updatedSignals = data.signals.map((s) =>
        s.name === 'fear_greed' ? scored : s,
      );

      const scoringSignals = updatedSignals.filter((s) => s.zone !== 'no_data');
      const totalScore = scoringSignals.reduce((sum, s) => sum + s.score, 0);
      const maxScore = scoringSignals.reduce((sum, s) => sum + s.maxScore, 0);
      const normalized = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      return {
        ...data,
        totalScore,
        maxPossibleScore: maxScore,
        normalizedScore: normalized,
        overallZone: this.toOverallZone(normalized),
        overallLabel: this.toOverallLabel(normalized),
        signals: updatedSignals,
        fearGreedMissing: false,
      };
    } catch {
      return data;
    }
  }

  private scoreFearGreedBrowser(fg: number): SignalScore {
    let score: number;
    let interpretation: string;
    const maxScore = 15;

    if (fg <= 20)      { score = 15; interpretation = 'Extreme fear — historically strong buy signal'; }
    else if (fg <= 40) { score = 8;  interpretation = 'Fear — accumulation favoured'; }
    else if (fg <= 60) { score = 0;  interpretation = 'Neutral sentiment'; }
    else if (fg <= 80) { score = -8; interpretation = 'Greed — caution advised'; }
    else               { score = -15; interpretation = 'Extreme greed — distribution zone'; }

    const pct = score / maxScore;
    const zone: SignalZone =
      pct >= 0.6 ? 'very_bullish' : pct >= 0.2 ? 'bullish' : pct >= -0.2 ? 'neutral' : pct >= -0.6 ? 'bearish' : 'very_bearish';

    return { name: 'fear_greed', label: 'Fear & Greed Index', value: fg, formattedValue: `${fg}/100`, score, maxScore, interpretation, zone };
  }

  private toOverallZone(n: number): SignalSummary['overallZone'] {
    if (n >= 60) return 'very_bullish';
    if (n >= 20) return 'bullish';
    if (n >= -20) return 'neutral';
    if (n >= -60) return 'bearish';
    return 'very_bearish';
  }

  private toOverallLabel(n: number): string {
    if (n >= 60) return 'Strong Buy';
    if (n >= 20) return 'Bullish';
    if (n >= -20) return 'Neutral';
    if (n >= -60) return 'Bearish';
    return 'Strong Sell';
  }

  private async loadProjections(): Promise<void> {
    this.projectionsLoading.set(true);
    try {
      const data = await this.api.getPriceProjections();
      this.projections.set(data);
    } catch (error) {
      this.projectionsError.set(toMessage(error));
    } finally {
      this.projectionsLoading.set(false);
    }
  }

  private async loadPlans(): Promise<void> {
    this.plansLoading.set(true);
    try {
      const { plans } = await this.api.listTradingPlans();
      this.plans.set(plans);
    } catch {
      // ignore - plans tab will be empty
    } finally {
      this.plansLoading.set(false);
    }
  }
}

function toMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : 'Something went wrong. Please try again.';
}
