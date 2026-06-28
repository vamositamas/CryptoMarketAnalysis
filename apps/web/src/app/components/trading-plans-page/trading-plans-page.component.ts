import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
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
    .tp-tab.active { color: #111827; border-bottom-color: #111827; font-weight: 600; }
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
    .proj-target-label-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 2px; }
    .proj-target-label { font-size: 0.75rem; font-weight: 600; color: var(--color-text-muted, #6b7280); min-width: 0; }
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
        <p class="eyebrow" i18n="Trade planner eyebrow@@trading.eyebrow">Trade Planner</p>
        <h2 i18n="Trade planner title@@trading.title">Trading Plans & Market Signals</h2>
        <p style="color: var(--color-text-muted, #6b7280); font-size: 0.875rem; margin: 0;" i18n="Trade planner subtitle@@trading.subtitle">
          Signal aggregation from all chart indicators, model-based price targets, and your personal trade plans.
        </p>
      </div>

      <div class="tp-tabs" role="tablist">
        <button class="tp-tab" [class.active]="activeTab() === 'signals'" (click)="setTab('signals')" role="tab" i18n="Market signals tab@@trading.tabs.signals">
          Market Signals
        </button>
        <button class="tp-tab" [class.active]="activeTab() === 'projections'" (click)="setTab('projections')" role="tab" i18n="Price projections tab@@trading.tabs.projections">
          Price Projections
        </button>
        <button class="tp-tab" [class.active]="activeTab() === 'plans'" (click)="setTab('plans')" role="tab">
          My Plans @if (activePlansCount() > 0) { <span style="margin-left:4px;background:#dbeafe;color:#1d4ed8;border-radius:99px;padding:1px 7px;font-size:0.7rem;">{{ activePlansCount() }}</span> }
        </button>
      </div>

      <!-- SIGNALS TAB -->
      @if (activeTab() === 'signals') {
        @if (signalsLoading()) {
          <div class="tp-loading" i18n="Signals loading@@trading.signals.loading">Loading signals...</div>
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
              <span class="sig-zone-badge" [class]="'zone-' + s.overallZone">{{ overallLabel(s.normalizedScore) }}</span>
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
                  <span class="sig-card-name">{{ signalLabel(sig) }}</span>
                  <span class="sig-card-value">{{ signalValue(sig) }}</span>
                </div>
                <div class="sig-card-bar">
                  <div class="sig-card-bar-fill"
                    [style.width.%]="barWidth(sig.score, sig.maxScore)"
                    [style.background]="barColor(sig.score, sig.maxScore)">
                  </div>
                </div>
                <span class="sig-zone-badge" [class]="'zone-' + sig.zone">{{ zoneLabel(sig.zone) }}</span>
                <div class="sig-card-interp">{{ signalInterpretation(sig) }}</div>
              </div>
            }
          </div>
          @if (s.lastUpdated) {
            <p style="font-size:0.75rem;color:var(--color-text-muted,#6b7280);margin-top:1.5rem;">
              <ng-container i18n="Last updated label@@trading.lastUpdated">Last updated:</ng-container> {{ formatDate(s.lastUpdated) }}
            </p>
          }
        } @else if (signalsError()) {
          <p class="form-msg error">{{ signalsError() }}</p>
        }
      }

      <!-- PROJECTIONS TAB -->
      @if (activeTab() === 'projections') {
        @if (projectionsLoading()) {
          <div class="tp-loading" i18n="Projections loading@@trading.projections.loading">Loading price projections...</div>
        } @else if (projections()) {
          @let p = projections()!;
          @if (p.btcPriceUsd) {
            <div class="proj-btc">{{ formatUsd(p.btcPriceUsd) }} <span i18n="Current BTC price label@@trading.currentBtcPrice">current BTC price</span></div>
          }
          <div class="proj-scenarios">
            @for (scenario of p.scenarios; track scenario.scenario) {
              <div class="proj-scenario">
                <div class="proj-scenario-header">
                  <div class="proj-scenario-dot" [style.background]="scenario.color"></div>
                  <span class="proj-scenario-label">{{ scenarioLabel(scenario.label) }}</span>
                </div>
                <div class="proj-targets">
                  @for (target of scenario.targets; track target.label) {
                    <div class="proj-target">
                      <div class="proj-target-label-row">
                        <div class="proj-target-label">{{ projectionLabel(target.label) }}</div>
                        <button
                          type="button"
                          class="proj-info"
                          [attr.data-tooltip]="projectionDescription(target.description)"
                          [attr.aria-label]="projectionInfoLabel(target)"
                        >i</button>
                      </div>
                      <div class="proj-target-price" [style.color]="scenario.color">{{ formatUsd(target.priceUsd) }}</div>
                      <div class="proj-target-model">{{ projectionModel(target.model) }}</div>
                      @if (p.btcPriceUsd) {
                        @let pct = ((target.priceUsd - p.btcPriceUsd) / p.btcPriceUsd * 100);
                        <div class="proj-target-pct" [class.up]="pct >= 0" [class.down]="pct < 0">
                          {{ pct >= 0 ? '+' : '' }}{{ pct.toFixed(1) }}% from now
                        </div>
                      }
                      <div class="proj-target-timeframe">{{ projectionTimeframe(target.timeframe) }}</div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
          <div style="margin-top:1.5rem;padding:1rem;background:var(--color-surface,#f9fafb);border-radius:8px;border:1px solid var(--color-border,#e5e7eb);">
            <p style="font-size:0.75rem;color:var(--color-text-muted,#6b7280);margin:0;line-height:1.6;">
              <strong i18n="Projection disclaimer label@@trading.projections.disclaimerLabel">Disclaimer:</strong> <ng-container i18n="Projection disclaimer text@@trading.projections.disclaimerText">These projections are based on on-chain and mathematical models (Stock-to-Flow, Mayer Multiple, Rainbow bands, Terminal Price, CVDD). They reflect historical model behaviour and are not financial advice. Always conduct your own research.</ng-container>
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
            <strong>{{ plans().length }} <ng-container i18n="Plans count label@@trading.plans.countLabel">plans</ng-container></strong>
            @if (activePlansCount() > 0) {
              <span style="color:var(--color-text-muted,#6b7280);font-size:0.875rem;"> &mdash; {{ activePlansCount() }} <ng-container i18n="Active plans count label@@trading.plans.activeLabel">active</ng-container></span>
            }
          </div>
          <button class="primary-button" (click)="toggleCreateForm()">
            {{ showCreateForm() ? cancelLabel() : newPlanLabel() }}
          </button>
        </div>

        @if (showCreateForm()) {
          <div class="create-form-wrap">
            <h3 i18n="Create plan title@@trading.create.title">Create Trading Plan</h3>
            <form [formGroup]="createForm" (ngSubmit)="submitCreate()">
              <div class="form-row form-row-1">
                <div class="form-group">
                  <label for="plan-title" i18n="Plan title label@@trading.form.title">Plan title</label>
                  <input id="plan-title" type="text" formControlName="title" placeholder="e.g. BTC Long - Mid-cycle entry" i18n-placeholder="Plan title placeholder@@trading.form.titlePlaceholder" />
                </div>
              </div>
              <div class="form-row form-row-3">
                <div class="form-group">
                  <label for="plan-direction" i18n="Direction label@@trading.form.direction">Direction</label>
                  <select id="plan-direction" formControlName="direction">
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                    <option value="neutral" i18n="Neutral DCA option@@trading.form.neutralDca">Neutral / DCA</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="plan-entry" i18n="Entry price label@@trading.form.entryPrice">Entry price (USD)</label>
                  <input id="plan-entry" type="number" formControlName="entryPrice" placeholder="e.g. 95000" i18n-placeholder="Entry price placeholder@@trading.form.entryPlaceholder" min="0" />
                </div>
                <div class="form-group">
                  <label for="plan-expiry" i18n="Expiry date label@@trading.form.expiryDate">Expiry date (optional)</label>
                  <input id="plan-expiry" type="date" formControlName="expiryDate" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="plan-target" i18n="Target price label@@trading.form.targetPrice">Target price (USD)</label>
                  <input id="plan-target" type="number" formControlName="targetPrice" placeholder="e.g. 140000" i18n-placeholder="Target price placeholder@@trading.form.targetPlaceholder" min="0" />
                </div>
                <div class="form-group">
                  <label for="plan-stop" i18n="Stop loss label@@trading.form.stopLoss">Stop loss (USD)</label>
                  <input id="plan-stop" type="number" formControlName="stopLoss" placeholder="e.g. 82000" i18n-placeholder="Stop loss placeholder@@trading.form.stopPlaceholder" min="0" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="plan-size" i18n="Position size label@@trading.form.positionSize">Position size (USD)</label>
                  <input id="plan-size" type="number" formControlName="positionSizeUsd" placeholder="e.g. 5000" i18n-placeholder="Position size placeholder@@trading.form.sizePlaceholder" min="0" />
                </div>
                <div class="form-group">
                  <label for="plan-risk" i18n="Risk percent label@@trading.form.riskPercent">Risk % of portfolio</label>
                  <input id="plan-risk" type="number" formControlName="riskPercent" placeholder="e.g. 2" i18n-placeholder="Risk percent placeholder@@trading.form.riskPlaceholder" min="0" max="100" step="0.1" />
                </div>
              </div>
              <div class="form-row form-row-1">
                <div class="form-group">
                  <label for="plan-notes" i18n="Notes thesis label@@trading.form.notes">Notes / thesis</label>
                  <textarea id="plan-notes" formControlName="notes" rows="3" placeholder="Why this trade, what signals support it..." i18n-placeholder="Notes placeholder@@trading.form.notesPlaceholder"></textarea>
                </div>
              </div>
              @if (createError()) { <div class="form-msg error">{{ createError() }}</div> }
              <div class="form-actions">
                <button type="submit" [disabled]="createForm.invalid || isCreating()">
                  {{ isCreating() ? creatingLabel() : createPlanLabel() }}
                </button>
                <button type="button" class="secondary-button" (click)="toggleCreateForm()" i18n="Cancel button@@common.cancel">Cancel</button>
              </div>
            </form>
          </div>
        }

        @if (plansLoading()) {
          <div class="tp-loading" i18n="Plans loading@@trading.plans.loading">Loading plans...</div>
        } @else if (plans().length === 0 && !showCreateForm()) {
          <div class="plans-empty">
            <p i18n="No plans yet@@trading.plans.empty">No trading plans yet.</p>
            <button class="secondary-button" (click)="toggleCreateForm()" i18n="Create first plan button@@trading.plans.createFirst">Create your first plan</button>
          </div>
        } @else {
          @for (plan of plans(); track plan.id) {
            <div class="plan-card">
              <div class="plan-card-header">
                <span class="plan-dir-badge" [class]="'plan-dir-' + plan.direction">{{ directionLabel(plan.direction) }}</span>
                <span class="plan-status-badge" [class]="'status-' + plan.status">{{ statusLabel(plan.status) }}</span>
                <span class="plan-title">{{ plan.title }}</span>
                <span style="font-size:0.75rem;color:var(--color-text-muted,#6b7280);">{{ formatDate(plan.createdAt) }}</span>
              </div>
              <div class="plan-card-body">
                <div class="plan-metric">
                  <div class="plan-metric-label" i18n="Entry metric label@@trading.metrics.entry">Entry</div>
                  <div class="plan-metric-value">{{ formatUsd(plan.entryPrice) }}</div>
                </div>
                @if (plan.targetPrice) {
                  <div class="plan-metric">
                    <div class="plan-metric-label" i18n="Target metric label@@trading.metrics.target">Target</div>
                    <div class="plan-metric-value">{{ formatUsd(plan.targetPrice) }}</div>
                  </div>
                }
                @if (plan.stopLoss) {
                  <div class="plan-metric">
                    <div class="plan-metric-label">Stop loss</div>
                    <div class="plan-metric-value">{{ formatUsd(plan.stopLoss) }}</div>
                  </div>
                }
                @if (plan.status === 'active' && currentBtcPrice()) {
                  <div class="plan-metric">
                    <div class="plan-metric-label" i18n="Current BTC metric label@@trading.metrics.currentBtc">Current BTC</div>
                    <div class="plan-metric-value">{{ formatUsd(currentBtcPrice()!) }}</div>
                  </div>
                  <div class="plan-metric">
                    <div class="plan-metric-label" i18n="Unrealized PnL label@@trading.metrics.unrealizedPnl">Unrealized P&amp;L</div>
                    @let pnl = calcPnl(plan);
                    <div class="plan-metric-value" [class.profit]="pnl >= 0" [class.loss]="pnl < 0">
                      {{ pnl >= 0 ? '+' : '' }}{{ pnl.toFixed(2) }}%
                    </div>
                  </div>
                  @if (plan.targetPrice) {
                    <div class="plan-metric">
                      <div class="plan-metric-label" i18n="To target metric label@@trading.metrics.toTarget">To target</div>
                      <div class="plan-metric-value profit">{{ toTargetPct(plan) }}</div>
                    </div>
                  }
                }
                @if (plan.status === 'closed' && plan.closePrice) {
                  <div class="plan-metric">
                    <div class="plan-metric-label" i18n="Close price metric label@@trading.metrics.closePrice">Close price</div>
                    <div class="plan-metric-value">{{ formatUsd(plan.closePrice) }}</div>
                  </div>
                  <div class="plan-metric">
                    <div class="plan-metric-label" i18n="Realized PnL label@@trading.metrics.realizedPnl">Realized P&amp;L</div>
                    @let rpnl = realisedPnl(plan);
                    <div class="plan-metric-value" [class.profit]="rpnl >= 0" [class.loss]="rpnl < 0">
                      {{ rpnl >= 0 ? '+' : '' }}{{ rpnl.toFixed(2) }}%
                    </div>
                  </div>
                }
                @if (plan.positionSizeUsd) {
                  <div class="plan-metric">
                    <div class="plan-metric-label" i18n="Position metric label@@trading.metrics.position">Position</div>
                    <div class="plan-metric-value">{{ formatUsd(plan.positionSizeUsd) }}</div>
                  </div>
                }
                @if (plan.riskPercent) {
                  <div class="plan-metric">
                    <div class="plan-metric-label" i18n="Risk metric label@@trading.metrics.risk">Risk</div>
                    <div class="plan-metric-value">{{ plan.riskPercent }}%</div>
                  </div>
                }
                @if (plan.expiryDate) {
                  <div class="plan-metric">
                    <div class="plan-metric-label" i18n="Expiry metric label@@trading.metrics.expiry">Expiry</div>
                    <div class="plan-metric-value">{{ plan.expiryDate }}</div>
                  </div>
                }
              </div>
              @if (plan.notes) {
                <div class="plan-notes">"{{ plan.notes }}"</div>
              }
              @if (plan.status === 'active') {
                <div class="plan-card-actions">
                  <button class="secondary-button" (click)="openClose(plan.id)" i18n="Close position button@@trading.actions.closePosition">Close position</button>
                  <button class="secondary-button" (click)="cancelPlan(plan.id)" [disabled]="actionPlanId() === plan.id" i18n="Cancel plan button@@trading.actions.cancelPlan">Cancel plan</button>
                  <button style="margin-left:auto;background:none;border:none;color:var(--color-text-muted,#9ca3af);cursor:pointer;font-size:0.8rem;" (click)="deletePlan(plan.id)" [disabled]="actionPlanId() === plan.id" i18n="Delete button@@common.delete">Delete</button>
                </div>
              } @else {
                <div class="plan-card-actions">
                  <button style="background:none;border:none;color:var(--color-text-muted,#9ca3af);cursor:pointer;font-size:0.8rem;" (click)="deletePlan(plan.id)" [disabled]="actionPlanId() === plan.id" i18n="Delete button@@common.delete">Delete</button>
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
          <h3 i18n="Close position title@@trading.close.title">Close position</h3>
          <p style="font-size:0.875rem;color:var(--color-text-muted,#6b7280);margin-bottom:1rem;" i18n="Close position description@@trading.close.description">
            Enter the price where you closed this position.
          </p>
          <div class="form-group">
            <label for="close-price" i18n="Close price label@@trading.close.price">Close price (USD)</label>
            <input id="close-price" type="number" [value]="closePriceInput()" (input)="closePriceInput.set($any($event.target).value)" placeholder="e.g. 125000" i18n-placeholder="Close price placeholder@@trading.close.pricePlaceholder" min="0" />
          </div>
          @if (closeError()) { <div class="form-msg error">{{ closeError() }}</div> }
          <div class="close-modal-actions">
            <button class="secondary-button" (click)="closeModal()" i18n="Cancel button@@common.cancel">Cancel</button>
            <button (click)="confirmClose()" [disabled]="!closePriceInput() || isClosing()">
              {{ isClosing() ? closingLabel() : confirmCloseLabel() }}
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
  private readonly locale = inject(LOCALE_ID);

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
      this.closeError.set($localize`:Invalid close price error@@trading.close.invalidPrice:Enter a valid price`);
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
    if (!btc || !plan.targetPrice) return $localize`:No data value@@common.noData:No data`;
    const pct = ((plan.targetPrice - btc) / btc) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }

  protected cancelLabel(): string {
    return $localize`:Cancel button@@common.cancel:Cancel`;
  }

  protected newPlanLabel(): string {
    return $localize`:New plan button@@trading.actions.newPlan:New Plan`;
  }

  protected creatingLabel(): string {
    return $localize`:Creating plan state@@trading.actions.creating:Creating...`;
  }

  protected createPlanLabel(): string {
    return $localize`:Create plan button@@trading.actions.createPlan:Create Plan`;
  }

  protected closingLabel(): string {
    return $localize`:Closing position state@@trading.actions.closing:Closing...`;
  }

  protected confirmCloseLabel(): string {
    return $localize`:Confirm close button@@trading.actions.confirmClose:Confirm close`;
  }

  protected directionLabel(direction: TradingPlanRecord['direction']): string {
    const labels: Record<TradingPlanRecord['direction'], string> = {
      long: 'Long',
      short: 'Short',
      neutral: $localize`:Neutral direction@@trading.direction.neutral:Neutral`,
    };
    return labels[direction] ?? direction;
  }

  protected statusLabel(status: TradingPlanRecord['status']): string {
    const labels: Record<TradingPlanRecord['status'], string> = {
      active: $localize`:Active status@@trading.status.active:Active`,
      closed: $localize`:Closed status@@trading.status.closed:Closed`,
      cancelled: $localize`:Cancelled status@@trading.status.cancelled:Cancelled`,
    };
    return labels[status] ?? status;
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
      very_bullish: $localize`:Very bullish zone@@trading.zone.veryBullish:Very Bullish`,
      bullish: $localize`:Bullish zone@@trading.zone.bullish:Bullish`,
      neutral: $localize`:Neutral zone@@trading.zone.neutral:Neutral`,
      bearish: $localize`:Bearish zone@@trading.zone.bearish:Bearish`,
      very_bearish: $localize`:Very bearish zone@@trading.zone.veryBearish:Very Bearish`,
      no_data: $localize`:No data zone@@trading.zone.noData:No Data`,
    };
    return labels[zone] ?? zone;
  }

  protected signalHeadline(score: number): string {
    if (score >= 60) return $localize`:Strong accumulation headline@@trading.signals.headline.strongAccumulation:Strong accumulation conditions`;
    if (score >= 20) return $localize`:Favourable market headline@@trading.signals.headline.favourable:Favourable market conditions`;
    if (score >= -20) return $localize`:Mixed signals headline@@trading.signals.headline.mixed:Mixed signals - proceed carefully`;
    if (score >= -60) return $localize`:Elevated risk headline@@trading.signals.headline.elevatedRisk:Elevated risk - overheated market`;
    return $localize`:Extreme caution headline@@trading.signals.headline.extremeCaution:Extreme caution - distribution zone`;
  }

  protected signalSubtext(score: number): string {
    if (score >= 60) return $localize`:Strong accumulation subtext@@trading.signals.subtext.strongAccumulation:Multiple indicators align for a long-term buy opportunity.`;
    if (score >= 20) return $localize`:Favourable market subtext@@trading.signals.subtext.favourable:Most indicators are bullish. Gradual accumulation may be justified.`;
    if (score >= -20) return $localize`:Mixed signals subtext@@trading.signals.subtext.mixed:Signals are conflicting. High-conviction positions carry more risk.`;
    if (score >= -60) return $localize`:Elevated risk subtext@@trading.signals.subtext.elevatedRisk:Several indicators show overvaluation. Reducing exposure may be prudent.`;
    return $localize`:Extreme caution subtext@@trading.signals.subtext.extremeCaution:Most indicators signal overvaluation or cycle-top risk. Avoid new longs.`;
  }

  protected overallLabel(score: number): string {
    if (score >= 60) return $localize`:Strong buy label@@trading.overall.strongBuy:Strong Buy`;
    if (score >= 20) return $localize`:Bullish label@@trading.overall.bullish:Bullish`;
    if (score >= -20) return $localize`:Neutral label@@trading.overall.neutral:Neutral`;
    if (score >= -60) return $localize`:Bearish label@@trading.overall.bearish:Bearish`;
    return $localize`:Strong sell label@@trading.overall.strongSell:Strong Sell`;
  }

  protected signalLabel(signal: SignalScore): string {
    const labels: Record<string, string> = {
      mvrv_zscore: 'MVRV Z-Score',
      fear_greed: $localize`:Fear greed label@@trading.signal.fearGreed:Fear & Greed Index`,
      rainbow_band: $localize`:Rainbow band label@@trading.signal.rainbowBand:Rainbow Band`,
      realized_price_premium: $localize`:Realized price premium label@@trading.signal.realizedPricePremium:Realized Price Premium`,
      nupl: $localize`:NUPL signal label@@trading.signal.nupl:Bitcoin NUPL`,
      vdd_multiple: 'VDD Multiple',
      pi_cycle_top: 'Pi Cycle Top',
      mayer_multiple: 'Mayer Multiple',
      puell_multiple: 'Puell Multiple',
      s2f_model_premium: $localize`:S2F model premium label@@trading.signal.s2fModelPremium:S2F Model Premium`,
      projection_range: $localize`:Projection range label@@trading.signal.projectionRange:Projection Range`,
      volatility_position: $localize`:365d volatility position label@@trading.signal.volatilityPosition:365d Volatility Position`,
      global_m2_yoy: $localize`:Global M2 YoY label@@trading.signal.globalM2Yoy:Global M2 YoY`,
      dxy_yoy_change: $localize`:DXY YoY label@@trading.signal.dxyYoy:DXY YoY`,
    };
    return labels[signal.name] ?? this.translatePhrase(signal.label);
  }

  protected signalValue(signal: SignalScore): string {
    return this.translatePhrase(signal.formattedValue);
  }

  protected signalInterpretation(signal: SignalScore): string {
    return this.translatePhrase(signal.interpretation);
  }

  protected scenarioLabel(label: string): string {
    return this.translatePhrase(label);
  }

  protected projectionLabel(label: string): string {
    return this.translatePhrase(label);
  }

  protected projectionModel(model: string): string {
    return this.translatePhrase(model);
  }

  protected projectionTimeframe(timeframe: string): string {
    return this.translatePhrase(timeframe);
  }

  protected projectionDescription(description: string): string {
    return this.translatePhrase(description);
  }

  protected projectionInfoLabel(target: { label: string; description: string }): string {
    return `${this.projectionLabel(target.label)}: ${this.projectionDescription(target.description)}`;
  }

  protected formatUsd(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(this.locale, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private translatePhrase(value: string): string {
    const exact: Record<string, string> = {
      'Strong Buy': $localize`:Strong buy phrase@@trading.phrase.strongBuy:Strong Buy`,
      'Bullish': $localize`:Bullish phrase@@trading.phrase.bullish:Bullish`,
      'Very Bullish': $localize`:Very bullish phrase@@trading.phrase.veryBullish:Very Bullish`,
      'Neutral': $localize`:Neutral phrase@@trading.phrase.neutral:Neutral`,
      'Bearish': $localize`:Bearish phrase@@trading.phrase.bearish:Bearish`,
      'Very Bearish': $localize`:Very bearish phrase@@trading.phrase.veryBearish:Very Bearish`,
      'Strong Sell': $localize`:Strong sell phrase@@trading.phrase.strongSell:Strong Sell`,
      'No Data': $localize`:No data phrase@@common.noData:No Data`,
      'Fear & Greed Index': $localize`:Fear greed label@@trading.signal.fearGreed:Fear & Greed Index`,
      'Rainbow Band': $localize`:Rainbow band label@@trading.signal.rainbowBand:Rainbow Band`,
      'Realized Price Premium': $localize`:Realized price premium label@@trading.signal.realizedPricePremium:Realized Price Premium`,
      'Bitcoin NUPL': $localize`:NUPL signal label@@trading.signal.nupl:Bitcoin NUPL`,
      'Strong accumulation conditions': $localize`:Strong accumulation headline@@trading.signals.headline.strongAccumulation:Strong accumulation conditions`,
      'Multiple indicators align for a long-term buy opportunity.': $localize`:Strong accumulation subtext@@trading.signals.subtext.strongAccumulation:Multiple indicators align for a long-term buy opportunity.`,
      'Undervalued — accumulation zone': $localize`:Undervalued accumulation interpretation@@trading.interpretation.undervaluedAccumulation:Undervalued - accumulation zone`,
      'Extreme fear — historically strong buy signal': $localize`:Extreme fear interpretation@@trading.interpretation.extremeFear:Extreme fear - historically strong buy signal`,
      'Fear — accumulation favoured': $localize`:Fear accumulation interpretation@@trading.interpretation.fearAccumulation:Fear - accumulation favoured`,
      'Neutral sentiment': $localize`:Neutral sentiment interpretation@@trading.interpretation.neutralSentiment:Neutral sentiment`,
      'Greed — caution advised': $localize`:Greed caution interpretation@@trading.interpretation.greedCaution:Greed - caution advised`,
      'Extreme greed — distribution zone': $localize`:Extreme greed interpretation@@trading.interpretation.extremeGreed:Extreme greed - distribution zone`,
      'Band 2: Buy': $localize`:Band two buy interpretation@@trading.interpretation.band2Buy:Band 2: Buy`,
      'Near realized price — healthy premium': $localize`:Realized price healthy premium@@trading.interpretation.realizedHealthy:Near realized price - healthy premium`,
      'Capitulation — market in aggregate loss, historically strong accumulation zone': $localize`:NUPL capitulation interpretation@@trading.interpretation.nupl.capitulation:Capitulation - market in aggregate loss, historically strong accumulation zone`,
      'Hope / Fear — near aggregate cost basis, early recovery conditions': $localize`:NUPL hope interpretation@@trading.interpretation.nupl.hope:Hope / Fear - near aggregate cost basis, early recovery conditions`,
      'Optimism / Anxiety — profitable but not euphoric': $localize`:NUPL optimism interpretation@@trading.interpretation.nupl.optimism:Optimism / Anxiety - profitable but not euphoric`,
      'Belief / Denial — mature bull-market profit zone': $localize`:NUPL belief interpretation@@trading.interpretation.nupl.belief:Belief / Denial - mature bull-market profit zone`,
      'Euphoria / Greed — overheated profit zone, cycle-top risk': $localize`:NUPL euphoria interpretation@@trading.interpretation.nupl.euphoria:Euphoria / Greed - overheated profit zone, cycle-top risk`,
      'Very low — accumulation zone': $localize`:Very low accumulation interpretation@@trading.interpretation.veryLowAccumulation:Very low - accumulation zone`,
      'Far from crossover — early/mid cycle': $localize`:Far crossover interpretation@@trading.interpretation.farCrossover:Far from crossover - early/mid cycle`,
      'Below 200-day MA — accumulation zone': $localize`:Below 200 day MA interpretation@@trading.interpretation.below200Day:Below 200-day MA - accumulation zone`,
      'Below average miner revenue — accumulation zone': $localize`:Below average miner revenue interpretation@@trading.interpretation.belowMinerRevenue:Below average miner revenue - accumulation zone`,
      // Mayer Multiple
      'Well below 200-day MA — deep accumulation zone': $localize`:Mayer well below 200d MA@@trading.interpretation.mayerWellBelow:Well below 200-day MA — deep accumulation zone`,
      'Slightly above 200-day MA — healthy': $localize`:Mayer slightly above 200d MA@@trading.interpretation.mayerSlightlyAbove:Slightly above 200-day MA — healthy`,
      'Extended above 200-day MA': $localize`:Mayer extended above 200d MA@@trading.interpretation.mayerExtended:Extended above 200-day MA`,
      'Extreme extension — historical sell signal': $localize`:Mayer extreme extension@@trading.interpretation.mayerExtremeExtension:Extreme extension — historical sell signal`,
      // Pi Cycle Top
      'Moving toward crossover — watch for top': $localize`:Pi cycle moving toward crossover@@trading.interpretation.piMovingToCrossover:Moving toward crossover — watch for top`,
      'Approaching crossover — caution': $localize`:Pi cycle approaching crossover@@trading.interpretation.piApproachingCrossover:Approaching crossover — caution`,
      'Very close to crossover — high risk': $localize`:Pi cycle very close crossover@@trading.interpretation.piCloseCrossover:Very close to crossover — high risk`,
      'Crossover occurred — historical cycle top signal': $localize`:Pi cycle crossover occurred@@trading.interpretation.piCrossoverOccurred:Crossover occurred — historical cycle top signal`,
      // Puell Multiple
      'Miners stressed — historically rare buy zone': $localize`:Puell miners stressed@@trading.interpretation.puellMinerStressed:Miners stressed — historically rare buy zone`,
      'Average miner revenue — neutral': $localize`:Puell average miner revenue@@trading.interpretation.puellAverageMiner:Average miner revenue — neutral`,
      'Elevated miner revenue — late cycle signal': $localize`:Puell elevated miner revenue@@trading.interpretation.puellElevatedMiner:Elevated miner revenue — late cycle signal`,
      'Extreme miner revenue — distribution zone': $localize`:Puell extreme miner revenue@@trading.interpretation.puellExtremeMiner:Extreme miner revenue — distribution zone`,
      // S2F Model Premium
      'Deep discount to Stock-to-Flow model price': $localize`:S2F deep discount@@trading.interpretation.s2fDeepDiscount:Deep discount to Stock-to-Flow model price`,
      'Meaningful discount to Stock-to-Flow model price': $localize`:S2F meaningful discount@@trading.interpretation.s2fMeaningfulDiscount:Meaningful discount to Stock-to-Flow model price`,
      'Near Stock-to-Flow model fair value': $localize`:S2F near fair value@@trading.interpretation.s2fNearFairValue:Near Stock-to-Flow model fair value`,
      'Premium to Stock-to-Flow model price': $localize`:S2F premium@@trading.interpretation.s2fPremiumToModel:Premium to Stock-to-Flow model price`,
      'Large premium to Stock-to-Flow model price': $localize`:S2F large premium@@trading.interpretation.s2fLargePremium:Large premium to Stock-to-Flow model price`,
      // Projection Range
      'Below modeled floor range — historically stressed valuation': $localize`:Projection below floor@@trading.interpretation.projBelowFloor:Below modeled floor range — historically stressed valuation`,
      'Near projection floor range': $localize`:Projection near floor@@trading.interpretation.projNearFloor:Near projection floor range`,
      'Mid-range between modeled floor and terminal price': $localize`:Projection mid range@@trading.interpretation.projMidRange:Mid-range between modeled floor and terminal price`,
      'Upper projection range — reward/risk cooling': $localize`:Projection upper range@@trading.interpretation.projUpperRange:Upper projection range — reward/risk cooling`,
      'Near or above terminal price range': $localize`:Projection near terminal@@trading.interpretation.projNearTerminal:Near or above terminal price range`,
      // 365d Volatility Position
      'Deeply below 365-day trend band — capitulation-style discount': $localize`:Volatility deeply below band@@trading.interpretation.volDeeplyBelow:Deeply below 365-day trend band — capitulation-style discount`,
      'Below 365-day trend band — accumulation conditions': $localize`:Volatility below band@@trading.interpretation.volBelowBand:Below 365-day trend band — accumulation conditions`,
      'Inside normal 365-day volatility range': $localize`:Volatility inside normal range@@trading.interpretation.volNormalRange:Inside normal 365-day volatility range`,
      'Above 365-day trend band — extended conditions': $localize`:Volatility above band@@trading.interpretation.volAboveBand:Above 365-day trend band — extended conditions`,
      'Far above 365-day trend band — overheated volatility extension': $localize`:Volatility far above band@@trading.interpretation.volFarAbove:Far above 365-day trend band — overheated volatility extension`,
      // Global M2 YoY
      'Strong liquidity expansion — supportive macro backdrop for Bitcoin': $localize`:M2 strong expansion@@trading.interpretation.m2StrongExpansion:Strong liquidity expansion — supportive macro backdrop for Bitcoin`,
      'Positive liquidity growth — risk-on conditions improving': $localize`:M2 positive growth@@trading.interpretation.m2PositiveGrowth:Positive liquidity growth — risk-on conditions improving`,
      'Mild liquidity expansion — modest macro support': $localize`:M2 mild expansion@@trading.interpretation.m2MildExpansion:Mild liquidity expansion — modest macro support`,
      'Liquidity contraction — macro headwind': $localize`:M2 contraction@@trading.interpretation.m2Contraction:Liquidity contraction — macro headwind`,
      'Severe liquidity contraction — strong macro headwind': $localize`:M2 severe contraction@@trading.interpretation.m2SevereContraction:Severe liquidity contraction — strong macro headwind`,
      // DXY YoY
      'Dollar weakening sharply - strong macro tailwind for Bitcoin': $localize`:DXY weakening sharply@@trading.interpretation.dxyWeakeningSharp:Dollar weakening sharply - strong macro tailwind for Bitcoin`,
      'Dollar weakening - supportive liquidity backdrop': $localize`:DXY weakening@@trading.interpretation.dxyWeakening:Dollar weakening - supportive liquidity backdrop`,
      'Dollar broadly stable - neutral macro impulse': $localize`:DXY stable@@trading.interpretation.dxyStable:Dollar broadly stable - neutral macro impulse`,
      'Dollar strengthening - macro headwind for Bitcoin': $localize`:DXY strengthening@@trading.interpretation.dxyStrengthening:Dollar strengthening - macro headwind for Bitcoin`,
      'Dollar strengthening sharply - strong risk-asset headwind': $localize`:DXY strengthening sharply@@trading.interpretation.dxyStrengtheningSharp:Dollar strengthening sharply - strong risk-asset headwind`,
      'Cumulative value days destroyed floor': $localize`:CVDD floor description@@trading.projection.description.cvddFloor:Cumulative value days destroyed floor`,
      'Delta Cap / Realized Cap model floor': $localize`:Balanced price description@@trading.projection.description.balancedPrice:Delta Cap / Realized Cap model floor`,
      'Average cost basis of all coins': $localize`:Realized price description@@trading.projection.description.realizedPrice:Average cost basis of all coins`,
      'One standard deviation below the 365-day mean': $localize`:Volatility lower band description@@trading.projection.description.volatilityLower:One standard deviation below the 365-day mean`,
      'Mayer Multiple 1.5 — historically fair value': $localize`:Mayer fair value description@@trading.projection.description.mayer15:Mayer Multiple 1.5 - historically fair value`,
      'One standard deviation above the 365-day mean': $localize`:Volatility upper one band description@@trading.projection.description.volatilityUpperOne:One standard deviation above the 365-day mean`,
      'Retest of the highest stored daily close': $localize`:ATH retest description@@trading.projection.description.athRetest:Retest of the highest stored daily close`,
      'Stock-to-Flow scarcity model fair value': $localize`:S2F fair value description@@trading.projection.description.s2fFairValue:Stock-to-Flow scarcity model fair value`,
      'S2F model with euphoria premium': $localize`:S2F euphoria premium description@@trading.projection.description.s2fPremium:S2F model with euphoria premium`,
      'Upper bound fair value from realized cap': $localize`:Terminal price description@@trading.projection.description.terminalPrice:Upper bound fair value from realized cap`,
      'Mayer Multiple 2.4 — historical bull top': $localize`:Mayer bull top description@@trading.projection.description.mayer24:Mayer Multiple 2.4 - historical bull top`,
      'First breakout extension above prior all-time high': $localize`:ATH first extension description@@trading.projection.description.ath1272:First breakout extension above prior all-time high`,
      'Two standard deviations above the 365-day mean': $localize`:Volatility upper two band description@@trading.projection.description.volatilityUpperTwo:Two standard deviations above the 365-day mean`,
      'Parabolic extension beyond terminal price': $localize`:Terminal extension description@@trading.projection.description.terminal15:Parabolic extension beyond terminal price`,
      'Cycle euphoria peak — historical pattern': $localize`:S2F euphoria peak description@@trading.projection.description.s2f3:Cycle euphoria peak - historical pattern`,
      'Golden-ratio extension above prior all-time high': $localize`:ATH golden extension description@@trading.projection.description.ath1618:Golden-ratio extension above prior all-time high`,
      'Prior high doubling scenario for euphoric cycles': $localize`:ATH double description@@trading.projection.description.ath2:Prior high doubling scenario for euphoric cycles`,
      'Current price extended by cycle heat from 12m RSI and Rainbow band': $localize`:Cycle heat description@@trading.projection.description.cycleHeat:Current price extended by cycle heat from 12m RSI and Rainbow band`,
      'Bear Case': $localize`:Bear case scenario@@trading.scenario.bear:Bear Case`,
      'Base Case': $localize`:Base case scenario@@trading.scenario.base:Base Case`,
      'Bull Case': $localize`:Bull case scenario@@trading.scenario.bull:Bull Case`,
      'Ultra Bull': $localize`:Ultra bull scenario@@trading.scenario.ultraBull:Ultra Bull`,
      'CVDD floor': $localize`:CVDD floor projection@@trading.projection.cvddFloor:CVDD floor`,
      'Balanced Price': $localize`:Balanced price projection@@trading.projection.balancedPrice:Balanced Price`,
      'Realized Price': $localize`:Realized price projection@@trading.projection.realizedPrice:Realized Price`,
      '200-day MA ×1.5': $localize`:200 day MA x1.5 projection@@trading.projection.200day15:200-day MA ×1.5`,
      '200-day MA ×2.4': $localize`:200 day MA x2.4 projection@@trading.projection.200day24:200-day MA ×2.4`,
      '365d mean -1σ': $localize`:365 day mean minus one sigma projection@@trading.projection.365meanMinus1:365d mean -1σ`,
      '365d mean +1σ': $localize`:365 day mean plus one sigma projection@@trading.projection.365meanPlus1:365d mean +1σ`,
      '365d mean +2σ': $localize`:365 day mean plus two sigma projection@@trading.projection.365meanPlus2:365d mean +2σ`,
      'ATH retest': $localize`:ATH retest projection@@trading.projection.athRetest:ATH retest`,
      'ATH ×1.272': $localize`:ATH x1.272 projection@@trading.projection.ath1272:ATH ×1.272`,
      'ATH ×1.618': $localize`:ATH x1.618 projection@@trading.projection.ath1618:ATH ×1.618`,
      'ATH ×2': $localize`:ATH x2 projection@@trading.projection.ath2:ATH ×2`,
      'Cycle heat extension': $localize`:Cycle heat extension projection@@trading.projection.cycleHeatExtension:Cycle heat extension`,
      'S2F model price': $localize`:S2F model price projection@@trading.projection.s2fModel:S2F model price`,
      'S2F ×1.5': $localize`:S2F x1.5 projection@@trading.projection.s2f15:S2F ×1.5`,
      'S2F ×3': $localize`:S2F x3 projection@@trading.projection.s2f3:S2F ×3`,
      'Terminal Price': $localize`:Terminal price projection@@trading.projection.terminalPrice:Terminal Price`,
      'Terminal ×1.5': $localize`:Terminal x1.5 projection@@trading.projection.terminal15:Terminal ×1.5`,
      'Mayer Multiple': 'Mayer Multiple',
      'Stock-to-Flow': 'Stock-to-Flow',
      'CVDD': 'CVDD',
      'Volatility Band': $localize`:Volatility band model@@trading.model.volatilityBand:Volatility Band`,
      'Market Structure': $localize`:Market structure model@@trading.model.marketStructure:Market Structure`,
      'Fib Extension': $localize`:Fib extension model@@trading.model.fibExtension:Fib Extension`,
      'Cycle Extension': $localize`:Cycle extension model@@trading.model.cycleExtension:Cycle Extension`,
      'RSI + Rainbow': 'RSI + Rainbow',
      '1–6 months': $localize`:1 to 6 months timeframe@@trading.timeframe.1to6:1-6 months`,
      '3–9 months': $localize`:3 to 9 months timeframe@@trading.timeframe.3to9:3-9 months`,
      '3–12 months': $localize`:3 to 12 months timeframe@@trading.timeframe.3to12:3-12 months`,
      '6–12 months': $localize`:6 to 12 months timeframe@@trading.timeframe.6to12:6-12 months`,
      '6–18 months': $localize`:6 to 18 months timeframe@@trading.timeframe.6to18:6-18 months`,
      '9–24 months': $localize`:9 to 24 months timeframe@@trading.timeframe.9to24:9-24 months`,
      '12–24 months': $localize`:12 to 24 months timeframe@@trading.timeframe.12to24:12-24 months`,
      '12–30 months': $localize`:12 to 30 months timeframe@@trading.timeframe.12to30:12-30 months`,
      '18–36 months': $localize`:18 to 36 months timeframe@@trading.timeframe.18to36:18-36 months`,
      '24–48 months': $localize`:24 to 48 months timeframe@@trading.timeframe.24to48:24-48 months`,
    };

    if (exact[value]) return exact[value];

    return value
      ;
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

    if (fg <= 20)      { score = 15; interpretation = $localize`:Extreme fear interpretation@@trading.interpretation.extremeFear:Extreme fear - historically strong buy signal`; }
    else if (fg <= 40) { score = 8;  interpretation = $localize`:Fear accumulation interpretation@@trading.interpretation.fearAccumulation:Fear - accumulation favoured`; }
    else if (fg <= 60) { score = 0;  interpretation = $localize`:Neutral sentiment interpretation@@trading.interpretation.neutralSentiment:Neutral sentiment`; }
    else if (fg <= 80) { score = -8; interpretation = $localize`:Greed caution interpretation@@trading.interpretation.greedCaution:Greed - caution advised`; }
    else               { score = -15; interpretation = $localize`:Extreme greed interpretation@@trading.interpretation.extremeGreed:Extreme greed - distribution zone`; }

    const pct = score / maxScore;
    const zone: SignalZone =
      pct >= 0.6 ? 'very_bullish' : pct >= 0.2 ? 'bullish' : pct >= -0.2 ? 'neutral' : pct >= -0.6 ? 'bearish' : 'very_bearish';

    return { name: 'fear_greed', label: $localize`:Fear greed label@@trading.signal.fearGreed:Fear & Greed Index`, value: fg, formattedValue: `${fg}/100`, score, maxScore, interpretation, zone };
  }

  private toOverallZone(n: number): SignalSummary['overallZone'] {
    if (n >= 60) return 'very_bullish';
    if (n >= 20) return 'bullish';
    if (n >= -20) return 'neutral';
    if (n >= -60) return 'bearish';
    return 'very_bearish';
  }

  private toOverallLabel(n: number): string {
    return this.overallLabel(n);
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
    : $localize`:Generic error@@common.genericError:Something went wrong. Please try again.`;
}
