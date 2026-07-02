import { Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ApiClientError,
  AuthApiClient,
  type CreateTradingPlanRequest,
  type PriceTarget,
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
    :host { --b: var(--color-border, #e5e7eb); --tm: var(--color-text-muted, #6b7280); --sf: var(--color-surface, #f9fafb); --bg: var(--color-background, #fff); --tx: var(--color-text, #111); --bd: 1px solid var(--b); }
    %bx12 { background: var(--sf); border: var(--bd); border-radius: 12px; }
    %bx10 { border: var(--bd); border-radius: 10px; }
    .tp-page { padding: 0 0 4rem; }
    .tp-header { margin-bottom: 2rem; }
    .tp-header h2 { margin: 0.25rem 0 0.5rem; }
    .tp-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--b); margin-bottom: 2rem; }
    .tp-tab { background: none; border: none; padding: 0.75rem 1.5rem; font-size: 0.875rem; font-weight: 500; color: var(--tm); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 0.15s, border-color 0.15s; }
    .tp-tab:hover { color: var(--tx); }
    .tp-tab.active { color: #111827; border-bottom-color: #111827; font-weight: 600; }
    .tp-loading { padding: 3rem 0; text-align: center; color: var(--tm); }
    .sig-hero { @extend %bx12; display: flex; align-items: center; gap: 2rem; padding: 1.5rem 2rem; margin-bottom: 2rem; }
    .sig-score-ring { position: relative; width: 100px; height: 100px; flex-shrink: 0; }
    .sig-score-ring svg { width: 100%; height: 100%; }
    .sig-score-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .sig-score-num { font-size: 1.5rem; font-weight: 700; line-height: 1; }
    .sig-score-sub { font-size: 0.65rem; color: var(--tm); margin-top: 2px; }
    .sig-hero-text h3 { margin: 0 0 0.25rem; font-size: 1.25rem; }
    .sig-hero-text p { margin: 0; color: var(--tm); font-size: 0.875rem; }
    .sig-price { margin-top: 0.5rem; font-size: 1.1rem; font-weight: 600; }
    .sig-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .sig-card { @extend %bx10; position: relative; background: var(--sf); padding: 1rem 2.75rem 1rem 1.25rem; border-left: 4px solid transparent; }
    .sig-card[data-zone="very_bullish"] { border-left-color: #16a34a; }
    .sig-card[data-zone="bullish"] { border-left-color: #22c55e; }
    .sig-card[data-zone="neutral"] { border-left-color: #9ca3af; }
    .sig-card[data-zone="bearish"] { border-left-color: #f97316; }
    .sig-card[data-zone="very_bearish"] { border-left-color: #ef4444; }
    .sig-card[data-zone="no_data"] { border-left-color: #d1d5db; opacity: 0.6; }
    .sig-card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
    .sig-card-name { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--tm); }
    .sig-card-value, .proj-scenario-label { font-size: 1rem; font-weight: 700; }
    .sig-card-bar { height: 4px; background: var(--b); border-radius: 2px; margin-bottom: 0.5rem; overflow: hidden; }
    .sig-card-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s; }
    .sig-card-interp { font-size: 0.75rem; color: var(--tm); line-height: 1.4; }
    .sig-info-button { position: absolute; right: 0.8rem; bottom: 0.8rem; }
    .sig-zone-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 99px; margin-bottom: 0.4rem; }
    .zone-very_bullish { background: #dcfce7; color: #16a34a; }
    .zone-bullish { background: #d1fae5; color: #059669; }
    .zone-neutral { background: #f3f4f6; color: #6b7280; }
    .zone-bearish { background: #fff7ed; color: #ea580c; }
    .zone-very_bearish { background: #fef2f2; color: #dc2626; }
    .zone-no_data { background: #f3f4f6; color: #9ca3af; }
    .proj-btc { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; }
    .proj-btc span { font-size: 0.875rem; font-weight: 400; color: var(--tm); margin-left: 0.5rem; }
    .proj-scenarios { display: grid; gap: 1rem; }
    .proj-scenario { @extend %bx10; }
    .proj-scenario-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; background: var(--sf); border-bottom: var(--bd); border-radius: 10px 10px 0 0; }
    .proj-scenario-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .proj-targets { padding: 0.75rem 1.25rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
    .proj-target { padding: 0.75rem; background: var(--bg); border: var(--bd); border-radius: 8px; }
    .proj-target-price { font-size: 1.1rem; font-weight: 700; }
    .proj-target-label-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 2px; }
    .proj-target-label { font-size: 0.75rem; font-weight: 600; color: var(--tm); min-width: 0; }
    .proj-target-model, .proj-target-timeframe { font-size: 0.7rem; color: var(--tm); }
    .proj-target-timeframe { margin-top: 2px; font-style: italic; }
    .proj-target-pct { font-size: 0.8rem; font-weight: 600; margin-top: 4px; }
    .proj-target-pct.up { color: #16a34a; }
    .proj-target-pct.down { color: #dc2626; }
    .plans-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    .plans-empty { text-align: center; padding: 3rem 0; color: var(--tm); }
    .plan-card { @extend %bx10; margin-bottom: 1rem; overflow: hidden; }
    .plan-card-header { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; background: var(--sf); border-bottom: var(--bd); flex-wrap: wrap; }
    .plan-dir-badge, .plan-status-badge { font-size: 0.7rem; padding: 3px 10px; border-radius: 99px; }
    .plan-dir-badge { font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .plan-dir-long { background: #dcfce7; color: #16a34a; }
    .plan-dir-short { background: #fef2f2; color: #dc2626; }
    .plan-dir-neutral { background: #f3f4f6; color: #6b7280; }
    .plan-status-badge { font-weight: 600; }
    .status-active { background: #dbeafe; color: #1d4ed8; }
    .status-closed { background: #d1fae5; color: #065f46; }
    .status-cancelled { background: #f3f4f6; color: #6b7280; }
    .plan-title { font-weight: 600; font-size: 0.95rem; flex: 1; min-width: 0; }
    .plan-card-body { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; padding: 1rem 1.25rem; }
    .plan-metric-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--tm); margin-bottom: 2px; }
    .plan-metric-value { font-size: 0.95rem; font-weight: 600; }
    .plan-metric-value.profit { color: #16a34a; }
    .plan-metric-value.loss { color: #dc2626; }
    .plan-card-actions { display: flex; gap: 0.5rem; padding: 0.75rem 1.25rem; border-top: var(--bd); background: var(--sf); flex-wrap: wrap; }
    .plan-notes { padding: 0 1.25rem 0.75rem; font-size: 0.8rem; color: var(--tm); font-style: italic; }
    .create-form-wrap { @extend %bx12; padding: 1.5rem; margin-bottom: 1.5rem; }
    .create-form-wrap h3 { margin: 0 0 1.25rem; font-size: 1rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
    .form-row-3 { grid-template-columns: 1fr 1fr 1fr; }
    .form-row-1 { grid-template-columns: 1fr; }
    .form-group label { display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 4px; color: var(--tm); text-transform: uppercase; letter-spacing: 0.04em; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.5rem 0.75rem; border: var(--bd); border-radius: 6px; font-size: 0.875rem; background: var(--bg); color: var(--tx); box-sizing: border-box; }
    .form-group textarea { resize: vertical; min-height: 60px; }
    .form-actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; }
    .form-msg { font-size: 0.8rem; padding: 0.5rem 0.75rem; border-radius: 6px; margin-top: 0.75rem; }
    .form-msg.error { background: #fef2f2; color: #dc2626; }
    .close-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .close-modal { background: var(--bg); border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .close-modal h3 { margin: 0 0 1rem; }
    .close-modal .form-group { margin-bottom: 1rem; }
    .close-modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
    .sig-settings-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.7rem; border: var(--bd); border-radius: 6px; background: var(--sf); color: var(--tx); font-size: 0.75rem; cursor: pointer; white-space: nowrap; }
    .sig-settings-btn:hover { background: var(--b); }
    .sig-settings-icon { font-size: 1.25rem; line-height: 1; }
    .signal-modal { width: min(900px, 95vw); max-width: none; height: auto; max-height: min(680px, 90vh); display: flex; flex-direction: column; overflow: hidden; }
    .signal-modal h3 { flex: 0 0 auto; }
    .sig-preview-box { flex: 0 0 7rem; margin-bottom: .75rem; padding: .6rem .75rem; background: var(--sf); border: var(--bd); border-radius: 8px; font-size: .8rem; overflow-y: auto; }
    .sig-preference-grid { flex: 0 1 auto; overflow-y: auto; padding-right: .25rem; align-content: flex-start; }
    .signal-modal .close-modal-actions { flex: 0 0 auto; margin-top: .75rem; }
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
        <p style="color: var(--tm); font-size: 0.875rem; margin: 0;" i18n="Trade planner subtitle@@trading.subtitle">
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
        <button class="tp-tab" [class.active]="activeTab() === 'plans'" (click)="setTab('plans')" role="tab" i18n="My plans tab@@trading.tabs.plans">
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
          <div style="display:flex;justify-content:space-between;align-items:center;gap:.75rem;margin-bottom:1rem;border:1px solid var(--color-border,#e5e7eb);border-radius:8px;padding:.5rem .75rem;">
            <span style="font-size:.75rem;color:var(--color-text-muted,#6b7280);">
              <ng-container i18n="Signal selection title@@trading.signals.selectionTitle">Signals used in your score</ng-container>:
              {{ s.selectedSignalNames.length }}/{{ s.availableSignals.length }}
              @if (signalPreferenceSaving()) {
                <ng-container i18n="Signal selection saving@@trading.signals.selectionSaving">saving...</ng-container>
              }
            </span>
            <button type="button" class="sig-settings-btn" (click)="openSignalPreferences()" [attr.aria-label]="signalPreferencesButtonLabel()">
              <span class="sig-settings-icon" aria-hidden="true">&#9881;</span>
              <span i18n="Configure signals button@@trading.signals.configureButton">Configure</span>
            </button>
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
                <button
                  type="button"
                  class="proj-info signal-info sig-info-button"
                  [attr.data-tooltip]="signalInfoText(sig)"
                  [attr.aria-label]="signalInfoLabel(sig)"
                >i</button>
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
                          class="proj-info projection-info"
                          [attr.data-tooltip]="projectionInfoText(target, p.btcPriceUsd, scenario.label)"
                          [attr.aria-label]="projectionInfoLabel(target, p.btcPriceUsd, scenario.label)"
                        >i</button>
                      </div>
                      <div class="proj-target-price" [style.color]="scenario.color">{{ formatUsd(target.priceUsd) }}</div>
                      <div class="proj-target-model">{{ projectionModel(target.model) }}</div>
                      @if (p.btcPriceUsd) {
                        @let pct = ((target.priceUsd - p.btcPriceUsd) / p.btcPriceUsd * 100);
                        <div class="proj-target-pct" [class.up]="pct >= 0" [class.down]="pct < 0">
                          {{ projectionPctText(pct) }}
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

    <!-- Signal preferences modal -->
    @if (signalPreferencesOpen() && signals()) {
      @let ms = signals()!;
      <div class="close-overlay" (click)="closeSignalPreferences()">
        <div class="close-modal signal-modal" (click)="$event.stopPropagation()">
          <h3 i18n="Signal selection title@@trading.signals.selectionTitle">Signals used in your score</h3>
          <p style="flex:0 0 auto;font-size:.75rem;color:var(--color-text-muted,#6b7280);margin:0 0 .75rem;">
            {{ ms.selectedSignalNames.length }}/{{ ms.availableSignals.length }}
            @if (signalPreferenceSaving()) {
              <ng-container i18n="Signal selection saving@@trading.signals.selectionSaving">saving...</ng-container>
            }
          </p>
          <div class="sig-preview-box">
            @if (signalPreviewInfo(); as preview) {
              <strong>{{ preview.label }}</strong>
              <div style="margin-top:.2rem;color:var(--color-text-muted,#6b7280);">{{ preview.text }}</div>
            } @else {
              <span style="color:var(--color-text-muted,#6b7280);" i18n="Signal preview placeholder@@trading.signals.previewPlaceholder">Hover or focus a signal below to see its explanation here.</span>
            }
          </div>
          <div class="sig-preference-grid" style="display:flex;flex-wrap:wrap;gap:.35rem;">
            @for (sig of ms.availableSignals; track sig.name) {
              <label
                style="display:inline-flex;align-items:center;gap:.35rem;padding:.25rem .45rem;border:1px solid var(--color-border,#e5e7eb);border-radius:999px;font-size:.72rem;line-height:1;max-width:210px;"
                (mouseenter)="previewSignal(sig)"
                (mouseleave)="previewSignal(null)"
              >
                <input
                  type="checkbox"
                  style="width:13px;height:13px;accent-color:#16a34a;margin:0;"
                  [checked]="isSignalSelected(sig.name)"
                  [disabled]="signalPreferenceSaving() || (isSignalSelected(sig.name) && ms.selectedSignalNames.length <= 1)"
                  (change)="toggleSignalSelection(sig.name, $any($event.target).checked)"
                  (focus)="previewSignal(sig)"
                  (blur)="previewSignal(null)"
                />
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ compactSignalLabel(sig) }}</span>
              </label>
            }
          </div>
          @if (signalPreferenceError()) {
            <p style="flex:0 0 auto;margin:.5rem 0 0;color:#dc2626;font-size:.72rem;">{{ signalPreferenceError() }}</p>
          }
          <div class="close-modal-actions">
            <button class="secondary-button" (click)="closeSignalPreferences()" i18n="Close dialog button@@common.close">Close</button>
          </div>
        </div>
      </div>
    }

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
  protected readonly signalPreferenceSaving = signal(false);
  protected readonly signalPreferenceError = signal('');
  protected readonly signalPreferencesOpen = signal(false);
  protected readonly signalPreviewTarget = signal<SignalScore | null>(null);
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

  protected isSignalSelected(name: string): boolean {
    return this.signals()?.selectedSignalNames.includes(name) ?? false;
  }

  protected openSignalPreferences(): void {
    this.signalPreferencesOpen.set(true);
  }

  protected closeSignalPreferences(): void {
    this.signalPreferencesOpen.set(false);
    this.signalPreviewTarget.set(null);
  }

  protected signalPreferencesButtonLabel(): string {
    return $localize`:Signal preferences button aria label@@trading.signals.configureAriaLabel:Configure signals used in your score`;
  }

  protected previewSignal(signal: SignalScore | null): void {
    this.signalPreviewTarget.set(signal);
  }

  protected signalPreviewInfo(): { label: string; text: string } | null {
    const target = this.signalPreviewTarget();
    if (!target) {
      return null;
    }
    return { label: this.signalLabel(target), text: this.signalInfoText(target) };
  }

  protected async toggleSignalSelection(name: string, checked: boolean): Promise<void> {
    const summary = this.signals();
    if (!summary || this.signalPreferenceSaving()) {
      return;
    }

    const current = summary.selectedSignalNames;
    const next = checked
      ? [...current, name].filter((item, index, list) => list.indexOf(item) === index)
      : current.filter((item) => item !== name);

    if (next.length === 0 || arraysEqual(current, next)) {
      return;
    }

    this.signalPreferenceSaving.set(true);
    this.signalPreferenceError.set('');

    try {
      this.signals.set(await this.api.updateTradingSignalPreferences(next));
    } catch (error) {
      this.signalPreferenceError.set(toMessage(error));
    } finally {
      this.signalPreferenceSaving.set(false);
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
      mvrv_zscore: $localize`:@@signal.mvrvZscore:MVRV Z-Score`,
      fear_greed: $localize`:Fear greed label@@trading.signal.fearGreed:Fear & Greed Index`,
      rainbow_band: $localize`:Rainbow band label@@trading.signal.rainbowBand:Rainbow Band`,
      realized_price: $localize`:Realized price premium label@@trading.signal.realizedPricePremium:Realized Price Premium`,
      realized_price_premium: $localize`:Realized price premium label@@trading.signal.realizedPricePremium:Realized Price Premium`,
      nupl: $localize`:NUPL signal label@@trading.signal.nupl:Bitcoin NUPL`,
      vdd_multiple: $localize`:@@signal.vddMultiple:VDD Multiple`,
      pi_cycle: $localize`:@@signal.piCycleTop:Pi Cycle Top`,
      pi_cycle_top: $localize`:@@signal.piCycleTop:Pi Cycle Top`,
      mayer_multiple: $localize`:@@signal.mayerMultiple:Mayer Multiple`,
      puell_multiple: $localize`:@@signal.puellMultiple:Puell Multiple`,
      s2f_model_premium: $localize`:S2F model premium label@@trading.signal.s2fModelPremium:S2F Model Premium`,
      projection_range: $localize`:Projection range label@@trading.signal.projectionRange:Projection Range`,
      volatility_position: $localize`:365d volatility position label@@trading.signal.volatilityPosition:365d Volatility Position`,
      global_m2_yoy: $localize`:Global M2 YoY label@@trading.signal.globalM2Yoy:Global M2 YoY`,
      dxy_yoy_change: $localize`:DXY YoY label@@trading.signal.dxyYoy:DXY YoY`,
      exchange_netflow: $localize`:Exchange netflow signal label@@trading.signal.exchangeNetflow:Exchange Netflow`,
      funding_rate_avg: $localize`:Funding rate signal label@@trading.signal.fundingRate:Funding Rate`,
      open_interest_usd: $localize`:Open interest signal label@@trading.signal.openInterest:Open Interest`,
      sopr_split: $localize`:SOPR split signal label@@trading.signal.soprSplit:LTH/STH SOPR`,
      google_trends_bitcoin: $localize`:Google Trends signal label@@trading.signal.googleTrends:Google Trends`,
      active_addresses: $localize`:Active addresses signal label@@trading.signal.activeAddresses:Active Addresses`,
      btc_dvol: $localize`:BTC DVOL signal label@@trading.signal.btcDvol:BTC DVOL`,
      excess_liquidity_leading: $localize`:Excess liquidity signal label@@trading.signal.excessLiquidity:Excess Liquidity`,
    };
    return labels[signal.name] ?? this.translatePhrase(signal.label);
  }

  protected compactSignalLabel(signal: SignalScore): string {
    const labels: Record<string, string> = {
      mvrv_zscore: $localize`:Compact MVRV label@@trading.signalCompact.mvrv:MVRV`,
      fear_greed: $localize`:Compact fear greed label@@trading.signalCompact.fearGreed:Fear & Greed`,
      rainbow_band: $localize`:Compact rainbow band label@@trading.signalCompact.rainbow:Rainbow`,
      realized_price: $localize`:Compact realized price label@@trading.signalCompact.realized:Realized`,
      realized_price_premium: $localize`:Compact realized price label@@trading.signalCompact.realized:Realized`,
      nupl: $localize`:Compact NUPL label@@trading.signalCompact.nupl:NUPL`,
      vdd_multiple: $localize`:Compact VDD label@@trading.signalCompact.vdd:VDD`,
      pi_cycle: $localize`:Compact Pi Cycle label@@trading.signalCompact.piCycle:Pi Cycle`,
      pi_cycle_top: $localize`:Compact Pi Cycle label@@trading.signalCompact.piCycle:Pi Cycle`,
      mayer_multiple: $localize`:Compact Mayer label@@trading.signalCompact.mayer:Mayer`,
      puell_multiple: $localize`:Compact Puell label@@trading.signalCompact.puell:Puell`,
      s2f_model_premium: $localize`:Compact S2F label@@trading.signalCompact.s2f:S2F`,
      projection_range: $localize`:Compact projection label@@trading.signalCompact.projection:Projection`,
      volatility_position: $localize`:Compact 365d volatility label@@trading.signalCompact.volatility365d:365d Vol`,
      global_m2_yoy: $localize`:Compact Global M2 label@@trading.signalCompact.globalM2:Global M2`,
      dxy_yoy_change: $localize`:Compact DXY label@@trading.signalCompact.dxy:DXY`,
      exchange_netflow: $localize`:Exchange netflow signal label@@trading.signal.exchangeNetflow:Exchange Netflow`,
      funding_rate_avg: $localize`:Compact funding label@@trading.signalCompact.funding:Funding`,
      open_interest_usd: $localize`:Compact open interest label@@trading.signalCompact.openInterest:Open Interest`,
      sopr_split: $localize`:SOPR split signal label@@trading.signal.soprSplit:LTH/STH SOPR`,
      google_trends_bitcoin: $localize`:Google Trends signal label@@trading.signal.googleTrends:Google Trends`,
      active_addresses: $localize`:Active addresses signal label@@trading.signal.activeAddresses:Active Addresses`,
      btc_dvol: $localize`:Compact DVOL label@@trading.signalCompact.dvol:DVOL`,
      excess_liquidity_leading: $localize`:Compact excess liquidity label@@trading.signalCompact.excessLiquidity:Excess Liq.`,
    };
    return labels[signal.name] ?? this.signalLabel(signal);
  }

  protected signalValue(signal: SignalScore): string {
    return this.translatePhrase(signal.formattedValue);
  }

  protected signalInterpretation(signal: SignalScore): string {
    return this.translatePhrase(signal.interpretation);
  }

  protected signalInfoLabel(signal: SignalScore): string {
    return `${this.signalLabel(signal)}: ${this.signalInfoText(signal)}`;
  }

  protected signalInfoText(signal: SignalScore): string {
    const current = signal.zone === 'no_data'
      ? $localize`:Signal info no current value@@trading.signalInfo.noCurrent:Current value is unavailable.`
      : $localize`:Signal info current value@@trading.signalInfo.current:Current value is ${this.signalValue(signal)} and it is classified as ${this.zoneLabel(signal.zone)}.`;

    const fallback = $localize`:Signal info fallback@@trading.signalInfo.fallback:This signal contributes to the market score using the current value and its historical bullish or bearish zone.`;
    const info: Record<string, string> = {
      mvrv_zscore: $localize`:MVRV signal info@@trading.signalInfo.mvrv:MVRV compares market value with realized value to show whether BTC is priced above or below aggregate on-chain cost basis. Range guide: below 0 is deep undervaluation, 0-2 is accumulation, 2-4 is fair to warm, 4-7 is elevated, and above 7 is overheated.`,
      fear_greed: $localize`:Fear greed signal info@@trading.signalInfo.fearGreed:The Fear & Greed Index measures market sentiment from 0 to 100. Range guide: 0-20 is extreme fear, 20-40 fear, 40-60 neutral, 60-80 greed, and 80-100 extreme greed. Low readings are often contrarian bullish; very high readings can warn of crowding.`,
      rainbow_band: $localize`:Rainbow band signal info@@trading.signalInfo.rainbowBand:The Rainbow Band places price in long-term logarithmic valuation bands. Range guide: lower bands are cheaper accumulation zones, middle bands are neutral, and upper bands signal overheated or bubble-like conditions.`,
      realized_price: $localize`:Realized price signal info@@trading.signalInfo.realizedPrice:Realized Price Premium shows BTC price versus realized price, the aggregate on-chain cost basis. Range guide: below 0% means price is below cost basis, 0-30% is a healthy premium, 30-100% is moderate, 100-250% is high, and above 250% is extreme.`,
      realized_price_premium: $localize`:Realized price premium signal info@@trading.signalInfo.realizedPricePremium:Realized Price Premium shows BTC price versus realized price, the aggregate on-chain cost basis. Range guide: below 0% means price is below cost basis, 0-30% is a healthy premium, 30-100% is moderate, 100-250% is high, and above 250% is extreme.`,
      nupl: $localize`:NUPL signal info@@trading.signalInfo.nupl:NUPL estimates market-wide unrealized profit or loss. Range guide: below 0 is capitulation, 0-25% is hope or fear, 25-50% optimism, 50-75% belief, and above 75% euphoria.`,
      vdd_multiple: $localize`:VDD signal info@@trading.signalInfo.vdd:VDD Multiple tracks value-days destroyed against its normal level, highlighting older coins moving on-chain. Range guide: below 0.5 is quiet accumulation, 0.5-1 bullish, 1-3 normal, 3-6 caution, and above 6 distribution risk.`,
      pi_cycle: $localize`:Pi cycle signal info@@trading.signalInfo.piCycle:Pi Cycle Top measures the gap between the 111-day moving average and twice the 350-day moving average. Range guide: a large positive gap means the market is far from the historical top crossover, near 0 means top risk is rising, and below 0 means the crossover has occurred.`,
      pi_cycle_top: $localize`:Pi cycle top signal info@@trading.signalInfo.piCycleTop:Pi Cycle Top measures the gap between the 111-day moving average and twice the 350-day moving average. Range guide: a large positive gap means the market is far from the historical top crossover, near 0 means top risk is rising, and below 0 means the crossover has occurred.`,
      mayer_multiple: $localize`:Mayer signal info@@trading.signalInfo.mayer:Mayer Multiple is BTC price divided by the 200-day moving average. Range guide: below 0.8 is deep accumulation, 0.8-1 is accumulation, 1-1.5 is healthy trend, 1.5-2.4 is extended, and above 2.4 is overheated.`,
      puell_multiple: $localize`:Puell signal info@@trading.signalInfo.puell:Puell Multiple compares miner revenue with its 365-day average. Range guide: below 0.5 is a rare buy zone, 0.5-1 accumulation, 1-4 normal, 4-8 late-cycle caution, and above 8 overheated miner-revenue conditions.`,
      s2f_model_premium: $localize`:S2F signal info@@trading.signalInfo.s2f:S2F Model Premium compares spot price with the Stock-to-Flow model price. Positive values mean spot is below the model price, while negative values mean spot is above it. Large positive discounts are bullish; large negative premiums are riskier.`,
      projection_range: $localize`:Projection range signal info@@trading.signalInfo.projectionRange:Projection Range shows where BTC sits between modeled downside floors and upper terminal-style targets. Range guide: near 0% is close to modeled floor, 25-60% is mid-range, 60-90% is upper range, and above 90% is near or beyond modeled terminal levels.`,
      volatility_position: $localize`:Volatility position signal info@@trading.signalInfo.volatilityPosition:365d Volatility Position shows price relative to its 365-day trend band as a z-score. Range guide: below -1.5 is deep discount, -1.5 to -0.5 accumulation, -0.5 to 0.75 normal, 0.75 to 1.5 extended, and above 1.5 overheated.`,
      global_m2_yoy: $localize`:Global M2 signal info@@trading.signalInfo.globalM2:Global M2 YoY tracks broad liquidity growth. Range guide: negative growth is a macro headwind, 0-5% is mild, 5-10% is supportive, and above 10% is a strong liquidity tailwind for risk assets.`,
      dxy_yoy_change: $localize`:DXY signal info@@trading.signalInfo.dxy:DXY YoY tracks the yearly change in the US Dollar Index. Falling DXY is usually a tailwind for BTC, stable DXY is neutral, and rising DXY is a headwind. Rough guide: below -3% supports risk assets, -3% to 3% is neutral, and above 3% is a headwind.`,
      exchange_netflow: $localize`:Exchange netflow info@@trading.signalInfo.exchangeNetflow:Exchange Netflow measures BTC moving into or out of exchanges. Negative values mean net outflows and often lower sell-side supply; positive values mean inflows and possible sell pressure. Large outflows are bullish, large inflows are bearish.`,
      funding_rate_avg: $localize`:Funding rate info@@trading.signalInfo.fundingRate:Funding Rate shows the average perpetual-swap payment between longs and shorts. Negative funding often means shorts are crowded and can be contrarian bullish, near zero is neutral, and high positive funding means crowded longs and higher liquidation risk.`,
      open_interest_usd: $localize`:Open interest info@@trading.signalInfo.openInterest:Open Interest measures the size of outstanding derivatives positions. Lower leverage load is healthier and less fragile; very high open interest can make price more sensitive to liquidations and sharp reversals.`,
      sopr_split: $localize`:SOPR split info@@trading.signalInfo.soprSplit:LTH/STH SOPR compares whether long-term and short-term holders are spending coins in profit or loss. Around 1 is breakeven, below 1 suggests loss realization and reset, and high values suggest profit-taking or distribution.`,
      google_trends_bitcoin: $localize`:Google Trends info@@trading.signalInfo.googleTrends:Google Trends measures public search interest for Bitcoin on a 0-100 scale. Low attention can support accumulation, rising moderate attention can confirm demand, and extreme attention can mark overheated retail interest.`,
      active_addresses: $localize`:Active addresses info@@trading.signalInfo.activeAddresses:Active Addresses counts daily unique addresses active on the Bitcoin network. Higher usage helps confirm organic demand; weak activity means price strength has less network-use confirmation.`,
      btc_dvol: $localize`:BTC DVOL info@@trading.signalInfo.btcDvol:BTC DVOL is implied volatility from options markets. Range guide: below 45 is calm, 45-70 normal, 70-95 elevated, and above 95 stress or very high expected movement.`,
      excess_liquidity_leading: $localize`:Excess liquidity info@@trading.signalInfo.excessLiquidity:Excess Liquidity estimates the leading macro liquidity impulse after accounting for dollar pressure. Positive values are a tailwind for BTC, near zero is neutral, and negative values are a drag on risk appetite.`,
    };

    return `${info[signal.name] ?? fallback} ${current} ${this.signalInterpretation(signal)}`;
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

  protected projectionPctText(pct: number): string {
    const value = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    return this.isHungarian()
      ? `${value} mostantól`
      : $localize`:Projection percent from now@@trading.projection.percentFromNow:${value} from now`;
  }

  protected projectionInfoLabel(target: PriceTarget, btcPriceUsd: number | null, scenarioLabel: string): string {
    return `${this.projectionLabel(target.label)}: ${this.projectionInfoText(target, btcPriceUsd, scenarioLabel)}`;
  }

  protected projectionInfoText(target: PriceTarget, btcPriceUsd: number | null, scenarioLabel: string): string {
    const translatedDescription = this.translatePhrase(target.description);
    const model = this.projectionModel(target.model);
    const targetPrice = this.formatUsd(target.priceUsd);
    const timeframe = this.projectionTimeframe(target.timeframe);
    const scenario = this.scenarioLabel(scenarioLabel);
    const moveText = btcPriceUsd
      ? this.projectionMoveText(target.priceUsd, btcPriceUsd)
      : $localize`:Projection info no spot price@@trading.projectionInfo.noSpot:Current BTC spot price is unavailable, so the percentage distance cannot be calculated.`;
    const modelGuide = this.projectionModelGuide(target);

    if (this.isHungarian()) {
      return `${scenario}. Célár: ${targetPrice}, időtáv: ${timeframe}. Modell: ${model}. ${modelGuide} Jelenlegi jelentés: ${moveText} Forráslogika: ${translatedDescription} Ezek modellalapú forgatókönyvek, nem garanciák és nem pénzügyi tanácsok.`;
    }

    return `${scenario}. Target: ${targetPrice}, timeframe: ${timeframe}. Model: ${model}. ${modelGuide} Current meaning: ${moveText} Source logic: ${translatedDescription} These are model-based scenarios, not guarantees or financial advice.`;
  }

  private projectionMoveText(targetPriceUsd: number, btcPriceUsd: number): string {
    const pct = ((targetPriceUsd - btcPriceUsd) / btcPriceUsd) * 100;
    if (this.isHungarian()) {
      const direction = pct >= 0 ? 'felette van' : 'alatta van';
      return `Ez a célár ${Math.abs(pct).toFixed(1)}%-kal ${direction} az aktuális ${this.formatUsd(btcPriceUsd)} BTC árnak.`;
    }

    const direction = pct >= 0
      ? $localize`:Projection move above spot@@trading.projectionInfo.aboveSpot:above`
      : $localize`:Projection move below spot@@trading.projectionInfo.belowSpot:below`;
    return $localize`:Projection move text@@trading.projectionInfo.moveText:This target is ${Math.abs(pct).toFixed(1)}% ${direction} the current BTC price of ${this.formatUsd(btcPriceUsd)}.`;
  }

  private projectionModelGuide(target: PriceTarget): string {
    if (this.isHungarian()) {
      const huLabelGuides: Record<string, string> = {
        'Neutral liquidity path': 'Ez azt jelenti, hogy a makrolikviditás nem ad erős hátszelet vagy ellenszelet, ezért a célár közel marad a spot árhoz, csak mérsékelt trendprémiummal.',
        'Stable dollar path': 'A stabil DXY azt jelzi, hogy a dollárnyomás nem segíti és nem is rontja erősen a BTC-t, ezért ez mérsékelt folytatódást feltételez.',
        'Neutral funding path': 'A semleges funding azt jelenti, hogy a perpetual piac nincs túlzsúfolva long vagy short irányba, így rendezettebb alapforgatókönyv lehetséges.',
        'Attention recovery path': 'Ez a célár a keresési érdeklődés visszatérését használja keresleti jelként, de még nem eufórikus szinten.',
        'Funding reset advance': 'Ez a célár azt feltételezi, hogy az emelkedés folytatódhat, mert a funding lenyugodott és a derivatív piac még nem túlhevült.',
        'Low-leverage advance': 'Az alacsony open interest kisebb tőkeáttételes terhelést jelent, ezért az emelkedés kevésbé törékeny lehet.',
        'Exchange outflow target': 'A tőzsdei kiáramlás azt jelzi, hogy coinok kerülnek ki a likvid kereskedési helyekről, ami csökkentheti az eladói kínálatot.',
        'Network growth target': 'A hálózati növekedés azt mutatja, hogy az aktív címek száma javul, ami on-chain keresleti megerősítést ad.',
        'Network activity target': 'Az erős aktív cím használat szélesebb hálózati keresletet jelez, ezért nagyobb bikás célárat is indokolhat.',
        'Retail euphoria extension': 'A szélsőséges keresési érdeklődés végső kitörést is kísérhet, de magasabb fordulós kockázatot is jelent.',
      };

      const huModelGuides: Record<string, string> = {
        CVDD: 'A CVDD történelmi padlómodell, amely value-days destroyed adatokra épül. Mély medvepiaci támaszzónaként érdemes olvasni.',
        'Balanced Price': 'A kiegyensúlyozott ár on-chain padlómodell. A hosszú távú kapitulációs támasz becslésére szolgál.',
        'Realized Price': 'A realizált ár az összes coin becsült átlagos on-chain bekerülési ára. Ide visszatérve a piac az aggregált költségbázist teszteli.',
        'Volatility Band': 'A volatilitási sávok a 365 napos átlag köré rajzolt szórásos célzónák. Az alsó sáv stresszt, a felső sáv trendkiterjesztést jelez.',
        'Mayer Multiple': 'A Mayer Multiple a 200 napos mozgóátlaghoz viszonyítja az árat. Alacsonyabb szorzó fair trendérték, magasabb szorzó bikapiaci kiterjesztés.',
        'Market Structure': 'A piaci struktúra célok korábbi csúcsokat és visszateszteket használnak, ahol gyakran erős piaci reakció jelenik meg.',
        'Stock-to-Flow': 'A Stock-to-Flow a szűkösségből becsül értéket. Nagy célárakat adhat, ezért hosszú ciklusú forgatókönyvként érdemes kezelni.',
        'Terminal Price': 'A terminál ár felső on-chain értékelési modell. Inkább ciklustető jellegű cél, nem garantált célállomás.',
        'Fib Extension': 'A Fibonacci kiterjesztések lehetséges kitörési szinteket vetítenek a korábbi ATH fölé.',
        'Cycle Extension': 'A cikluskiterjesztés eufórikus, magas bizonytalanságú emelkedési pályát ír le.',
        'RSI + Rainbow': 'Az RSI + Rainbow lendületet és hosszú távú értékelési sávot kombinál a ciklushő becsléséhez.',
        'Global M2': 'A Global M2 a széles pénzmennyiség növekedését használja likviditási hátszélként vagy ellenszélként.',
        'Excess Liquidity': 'Az excess liquidity a makrolikviditást dollárnyomással korrigálja. Pozitív érték támogató, semleges érték mérsékelt, negatív érték óvatosságot jelez.',
        DXY: 'A DXY a dollár erejét méri. Gyengébb dollár általában segíti, erősebb dollár nyomás alá helyezheti a BTC-t.',
        'Funding Rate': 'A funding rate a derivatív piaci zsúfoltságot mutatja. Semleges funding rendezett folytatódást, nagyon pozitív funding likvidációs kockázatot jelez.',
        'Open Interest': 'Az open interest a tőkeáttételes pozíciók méretét jelzi. Alacsony érték tisztább emelkedést, magas érték nagyobb flush kockázatot jelent.',
        'Exchange Netflow': 'Az exchange netflow a likvid kínálatot mutatja. Kiáramlás kínálatszűkülést, beáramlás eladói nyomást jelezhet.',
        'Active Addresses': 'Az aktív címek a hálózati keresletet mérik. Több aktív használó erősebb fundamentális megerősítést ad.',
        'Google Trends': 'A Google Trends a nyilvános érdeklődést méri. Mérsékelt emelkedés keresletet, szélsőség eufóriát és fordulós kockázatot jelezhet.',
        'BTC DVOL': 'A BTC DVOL az opciós piac implikált volatilitása. Nagyon magas érték nagyobb várható mozgásokat és szélesebb stresszsávokat jelent.',
      };

      return huLabelGuides[target.label] ?? huModelGuides[target.model] ?? 'Ez a célár a kiválasztott modell alapján egy lehetséges forgatókönyvet becsül, nem egyetlen biztos előrejelzést.';
    }

    const labelGuides: Record<string, string> = {
      'Neutral liquidity path': $localize`:Projection neutral liquidity guide@@trading.projectionInfo.neutralLiquidity:This path means macro liquidity is not giving a strong push or drag, so the target stays close to spot with only a modest trend premium.`,
      'Stable dollar path': $localize`:Projection stable dollar guide@@trading.projectionInfo.stableDollar:A stable DXY means dollar pressure is not strongly helping or hurting BTC, so the target assumes moderate continuation rather than a macro breakout.`,
      'Neutral funding path': $localize`:Projection neutral funding guide@@trading.projectionInfo.neutralFunding:Neutral funding means perpetual futures are not heavily crowded long or short, which supports a cleaner base-case move without immediate leverage stress.`,
      'Attention recovery path': $localize`:Projection attention recovery guide@@trading.projectionInfo.attentionRecovery:This target uses recovering search interest as a demand signal, but it is below euphoria levels, so it is treated as base-case demand rather than a blow-off signal.`,
      'Funding reset advance': $localize`:Projection funding reset guide@@trading.projectionInfo.fundingReset:This target assumes upside can continue because funding is reset and derivatives are not yet overheated.`,
      'Low-leverage advance': $localize`:Projection low leverage guide@@trading.projectionInfo.lowLeverage:Low open interest means less leverage is stacked in the market, so an upside move may be less fragile than a heavily leveraged rally.`,
      'Exchange outflow target': $localize`:Projection exchange outflow guide@@trading.projectionInfo.exchangeOutflow:Exchange outflows suggest coins are leaving liquid trading venues, which can reduce sell-side supply and support a supply-tightening target.`,
      'Network growth target': $localize`:Projection network growth guide@@trading.projectionInfo.networkGrowth:Network growth means active address usage is improving, giving the price target demand confirmation from on-chain activity.`,
      'Network activity target': $localize`:Projection network activity guide@@trading.projectionInfo.networkActivity:Strong active address usage suggests broad network demand and can justify a larger bull-case target.`,
      'Retail euphoria extension': $localize`:Projection retail euphoria guide@@trading.projectionInfo.retailEuphoria:Extreme search interest can push price into a final extension, but it also means reversal risk is high because retail attention is crowded.`,
    };

    const modelGuides: Record<string, string> = {
      CVDD: $localize`:Projection CVDD guide@@trading.projectionInfo.cvdd:CVDD is a historical floor model based on value-days destroyed. It is usually read as a deep bear-market downside area, not a normal fair-value target.`,
      'Balanced Price': $localize`:Projection balanced price guide@@trading.projectionInfo.balancedPrice:Balanced Price is an on-chain floor model using realized and transferred value concepts. It helps estimate where long-term capitulation support could appear.`,
      'Realized Price': $localize`:Projection realized price guide@@trading.projectionInfo.realizedPrice:Realized Price is the aggregate on-chain cost basis. A return to this level means spot is revisiting the average acquisition price of all coins.`,
      'Volatility Band': $localize`:Projection volatility band guide@@trading.projectionInfo.volatilityBand:Volatility bands project price around the 365-day mean using standard deviations. Lower bands are downside stress zones; upper bands are trend-extension zones.`,
      'Mayer Multiple': $localize`:Projection Mayer guide@@trading.projectionInfo.mayer:Mayer Multiple targets are based on price versus the 200-day moving average. Lower multiples imply fair trend value; higher multiples imply bull-market extension.`,
      'Market Structure': $localize`:Projection market structure guide@@trading.projectionInfo.marketStructure:Market structure targets use prior major highs or retests. They are psychological and liquidity levels where traders often react.`,
      'Stock-to-Flow': $localize`:Projection S2F guide@@trading.projectionInfo.s2f:Stock-to-Flow estimates value from scarcity. It can create very large upside targets, so it should be treated as a long-cycle scenario rather than a precise forecast.`,
      'Terminal Price': $localize`:Projection terminal price guide@@trading.projectionInfo.terminalPrice:Terminal Price is an upper valuation model derived from on-chain value. It is used as a cycle-top style target, not a guaranteed destination.`,
      'Fib Extension': $localize`:Projection fib guide@@trading.projectionInfo.fib:Fibonacci extensions project possible breakout levels above the prior all-time high. They are momentum targets used after price clears major resistance.`,
      'Cycle Extension': $localize`:Projection cycle extension guide@@trading.projectionInfo.cycleExtension:Cycle extension targets describe euphoric upside beyond prior highs. They are high-uncertainty and usually require strong momentum and liquidity.`,
      'RSI + Rainbow': $localize`:Projection rsi rainbow guide@@trading.projectionInfo.rsiRainbow:RSI plus Rainbow combines momentum and long-term valuation bands. It estimates how far price might extend if cycle heat continues.`,
      'Global M2': $localize`:Projection global M2 guide@@trading.projectionInfo.globalM2:Global M2 targets use broad money growth as a liquidity tailwind or headwind. Strong liquidity can support higher risk-asset prices; weak liquidity can cap upside.`,
      'Excess Liquidity': $localize`:Projection excess liquidity guide@@trading.projectionInfo.excessLiquidity:Excess Liquidity adjusts macro liquidity for dollar pressure. Positive readings support risk assets, neutral readings imply modest continuation, and negative readings imply caution.`,
      DXY: $localize`:Projection DXY guide@@trading.projectionInfo.dxy:DXY targets use dollar strength or weakness. A weaker dollar often supports BTC liquidity conditions; a stronger dollar can pressure risk assets.`,
      'Funding Rate': $localize`:Projection funding guide@@trading.projectionInfo.funding:Funding Rate targets read derivatives crowding. Neutral funding can support orderly continuation, while very positive funding can warn of long-liquidation risk.`,
      'Open Interest': $localize`:Projection open interest guide@@trading.projectionInfo.openInterest:Open Interest targets read leverage load. Low leverage can support cleaner upside; high leverage can create downside flush risk.`,
      'Exchange Netflow': $localize`:Projection netflow guide@@trading.projectionInfo.netflow:Exchange Netflow targets read liquid supply. Outflows can support upside through supply tightening; inflows can warn of sell pressure.`,
      'Active Addresses': $localize`:Projection active addresses guide@@trading.projectionInfo.activeAddresses:Active Addresses targets use network demand. More active users strengthen confirmation that price movement has real usage behind it.`,
      'Google Trends': $localize`:Projection trends guide@@trading.projectionInfo.trends:Google Trends targets use public attention. Moderate rising interest can support demand, while extreme interest can mark euphoria and higher reversal risk.`,
      'BTC DVOL': $localize`:Projection dvol guide@@trading.projectionInfo.dvol:BTC DVOL targets use options-implied volatility. Very high DVOL means the market expects larger moves and downside stress ranges should widen.`,
    };

    return labelGuides[target.label] ?? modelGuides[target.model] ?? $localize`:Projection generic guide@@trading.projectionInfo.generic:This target uses the selected model to estimate a plausible scenario price. Read it as one possible path within the scenario, not as a single prediction.`;
  }

  protected formatUsd(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(this.locale, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private isHungarian(): boolean {
    return this.locale.toLowerCase().startsWith('hu');
  }

  private translatePhrase(value: string): string {
    if (this.isHungarian()) {
      const hu: Record<string, string> = {
        'Neutral liquidity path': 'Semleges likviditási pálya',
        'Stable dollar path': 'Stabil dollár pálya',
        'Neutral funding path': 'Semleges funding pálya',
        'Attention recovery path': 'Érdeklődés-visszatérési pálya',
        'Funding reset advance': 'Funding reset emelkedés',
        'Low-leverage advance': 'Alacsony tőkeáttételű emelkedés',
        'Exchange outflow target': 'Tőzsdei kiáramlási cél',
        'Network growth target': 'Hálózati növekedési cél',
        'Network activity target': 'Hálózati aktivitási cél',
        'Liquidity expansion target': 'Likviditásbővülési cél',
        'Excess liquidity target': 'Többletlikviditási cél',
        'Dollar-weakness target': 'Gyenge dollár cél',
        'Crowded longs flush': 'Túlzsúfolt long flush',
        'Open-interest deleveraging': 'Open interest leépülés',
        'Exchange inflow stress': 'Tőzsdei beáramlási stressz',
        'High-volatility stress': 'Magas volatilitási stressz',
        'Liquidity-adjusted base': 'Likviditással igazított alap',
        'Excess-liquidity haircut': 'Többletlikviditási levágás',
        'Dollar-strength base': 'Erős dollár alap',
        'Retail euphoria extension': 'Lakossági eufória kiterjesztés',
        'Excess Liquidity': 'Többletlikviditás',
        'Funding Rate': 'Funding ráta',
        'Open Interest': 'Open interest',
        'Exchange Netflow': 'Tőzsdei nettó áramlás',
        'Active Addresses': 'Aktív címek',
        'Flat leading liquidity keeps the base case close to spot with a modest trend premium': 'A lapos vezető likviditás az alapforgatókönyvet a spot ár közelében tartja, mérsékelt trendprémiummal.',
        'Broadly stable dollar conditions support a moderate trend-following base case': 'A nagyjából stabil dollárkörnyezet mérsékelt trendkövető alapforgatókönyvet támogat.',
        'Near-neutral perpetual funding suggests leverage is not crowded and can support orderly continuation': 'A közel semleges perpetual funding azt jelzi, hogy a tőkeáttétel nem zsúfolt, és rendezett folytatódást támogathat.',
        'Search interest is recovering from quiet levels without reaching euphoric retail demand': 'A keresési érdeklődés csendes szintekről tér vissza, de még nem ér el eufórikus lakossági keresletet.',
        'Neutral funding leaves room for spot-led upside before derivatives become crowded': 'A semleges funding teret hagy spot-vezérelt emelkedésnek, mielőtt a derivatív piac túlzsúfolttá válna.',
        'Low open interest relative to spot price suggests leverage is light and upside can be less fragile': 'A spot árhoz képest alacsony open interest könnyű tőkeáttételt jelez, így az emelkedés kevésbé lehet törékeny.',
        'Net BTC outflows from exchanges reduce liquid supply and support an upside supply-squeeze scenario': 'A nettó BTC tőzsdei kiáramlás csökkenti a likvid kínálatot, és támogathat egy kínálatszűkös emelkedési forgatókönyvet.',
        'Healthy active-address growth confirms improving network demand before the strongest usage regime': 'Az egészséges aktív cím növekedés javuló hálózati keresletet erősít meg, még a legerősebb használati rezsim előtt.',
        'Strong active-address demand adds a network-usage expansion scenario': 'Az erős aktív cím kereslet hálózathasználati bővülési forgatókönyvet ad hozzá.',
        'Macro-liquidity expansion premium based on Global M2 YoY growth': 'Makrolikviditási bővülési prémium a Global M2 éves növekedése alapján.',
        'Leading liquidity expansion supports a higher risk-asset target': 'A vezető likviditási bővülés magasabb kockázati eszköz célárat támogat.',
        'Dollar weakness adds a macro-liquidity tailwind for Bitcoin': 'A dollár gyengülése makrolikviditási hátszelet ad a Bitcoinnak.',
        'Very positive funding implies crowded long leverage and liquidation risk': 'A nagyon pozitív funding túlzsúfolt long tőkeáttételt és likvidációs kockázatot jelez.',
        'Very high open interest relative to spot price increases downside flush risk': 'A spot árhoz képest nagyon magas open interest növeli a lefelé tartó flush kockázatát.',
        'Large net exchange inflows may add sell-side supply': 'A nagy nettó tőzsdei beáramlás eladói kínálatot adhat a piacra.',
        'Very high implied volatility creates a wider downside stress scenario': 'A nagyon magas implikált volatilitás szélesebb lefelé mutató stresszforgatókönyvet hoz létre.',
        'Negative Global M2 growth applies a defensive macro-liquidity haircut': 'A negatív Global M2 növekedés defenzív makrolikviditási levágást alkalmaz.',
        'Negative leading liquidity impulse tempers the base case': 'A negatív vezető likviditási impulzus visszafogja az alapforgatókönyvet.',
        'Rising dollar pressure applies a defensive macro haircut to Bitcoin': 'Az erősödő dollárnyomás defenzív makro levágást alkalmaz a Bitcoinra.',
        'Extreme search interest can accompany blow-off extensions, but also raises reversal risk': 'A szélsőséges keresési érdeklődés blow-off kiterjesztést kísérhet, de növeli a fordulós kockázatot is.',
      };
      if (hu[value]) return hu[value];
    }

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
      'Flat leading liquidity keeps the base case close to spot with a modest trend premium': $localize`:Neutral liquidity path description@@trading.projection.description.neutralLiquidityPath:Flat leading liquidity keeps the base case close to spot with a modest trend premium`,
      'Broadly stable dollar conditions support a moderate trend-following base case': $localize`:Stable dollar path description@@trading.projection.description.stableDollarPath:Broadly stable dollar conditions support a moderate trend-following base case`,
      'Near-neutral perpetual funding suggests leverage is not crowded and can support orderly continuation': $localize`:Neutral funding path description@@trading.projection.description.neutralFundingPath:Near-neutral perpetual funding suggests leverage is not crowded and can support orderly continuation`,
      'Search interest is recovering from quiet levels without reaching euphoric retail demand': $localize`:Attention recovery path description@@trading.projection.description.attentionRecoveryPath:Search interest is recovering from quiet levels without reaching euphoric retail demand`,
      'Neutral funding leaves room for spot-led upside before derivatives become crowded': $localize`:Funding reset advance description@@trading.projection.description.fundingResetAdvance:Neutral funding leaves room for spot-led upside before derivatives become crowded`,
      'Low open interest relative to spot price suggests leverage is light and upside can be less fragile': $localize`:Low leverage advance description@@trading.projection.description.lowLeverageAdvance:Low open interest relative to spot price suggests leverage is light and upside can be less fragile`,
      'Net BTC outflows from exchanges reduce liquid supply and support an upside supply-squeeze scenario': $localize`:Exchange outflow target description@@trading.projection.description.exchangeOutflowTarget:Net BTC outflows from exchanges reduce liquid supply and support an upside supply-squeeze scenario`,
      'Healthy active-address growth confirms improving network demand before the strongest usage regime': $localize`:Network growth target description@@trading.projection.description.networkGrowthTarget:Healthy active-address growth confirms improving network demand before the strongest usage regime`,
      'Strong active-address demand adds a network-usage expansion scenario': $localize`:Network activity target description@@trading.projection.description.networkActivityTarget:Strong active-address demand adds a network-usage expansion scenario`,
      'Macro-liquidity expansion premium based on Global M2 YoY growth': $localize`:Liquidity expansion target description@@trading.projection.description.liquidityExpansionTarget:Macro-liquidity expansion premium based on Global M2 YoY growth`,
      'Leading liquidity expansion supports a higher risk-asset target': $localize`:Excess liquidity target description@@trading.projection.description.excessLiquidityTarget:Leading liquidity expansion supports a higher risk-asset target`,
      'Dollar weakness adds a macro-liquidity tailwind for Bitcoin': $localize`:Dollar weakness target description@@trading.projection.description.dollarWeaknessTarget:Dollar weakness adds a macro-liquidity tailwind for Bitcoin`,
      'Very positive funding implies crowded long leverage and liquidation risk': $localize`:Crowded longs flush description@@trading.projection.description.crowdedLongsFlush:Very positive funding implies crowded long leverage and liquidation risk`,
      'Very high open interest relative to spot price increases downside flush risk': $localize`:Open interest deleveraging description@@trading.projection.description.openInterestDeleveraging:Very high open interest relative to spot price increases downside flush risk`,
      'Large net exchange inflows may add sell-side supply': $localize`:Exchange inflow stress description@@trading.projection.description.exchangeInflowStress:Large net exchange inflows may add sell-side supply`,
      'Very high implied volatility creates a wider downside stress scenario': $localize`:High volatility stress description@@trading.projection.description.highVolatilityStress:Very high implied volatility creates a wider downside stress scenario`,
      'Negative Global M2 growth applies a defensive macro-liquidity haircut': $localize`:Liquidity adjusted base description@@trading.projection.description.liquidityAdjustedBase:Negative Global M2 growth applies a defensive macro-liquidity haircut`,
      'Negative leading liquidity impulse tempers the base case': $localize`:Excess liquidity haircut description@@trading.projection.description.excessLiquidityHaircut:Negative leading liquidity impulse tempers the base case`,
      'Rising dollar pressure applies a defensive macro haircut to Bitcoin': $localize`:Dollar strength base description@@trading.projection.description.dollarStrengthBase:Rising dollar pressure applies a defensive macro haircut to Bitcoin`,
      'Extreme search interest can accompany blow-off extensions, but also raises reversal risk': $localize`:Retail euphoria extension description@@trading.projection.description.retailEuphoriaExtension:Extreme search interest can accompany blow-off extensions, but also raises reversal risk`,
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
      'Neutral liquidity path': $localize`:Neutral liquidity path projection@@trading.projection.neutralLiquidityPath:Neutral liquidity path`,
      'Stable dollar path': $localize`:Stable dollar path projection@@trading.projection.stableDollarPath:Stable dollar path`,
      'Neutral funding path': $localize`:Neutral funding path projection@@trading.projection.neutralFundingPath:Neutral funding path`,
      'Attention recovery path': $localize`:Attention recovery path projection@@trading.projection.attentionRecoveryPath:Attention recovery path`,
      'Funding reset advance': $localize`:Funding reset advance projection@@trading.projection.fundingResetAdvance:Funding reset advance`,
      'Low-leverage advance': $localize`:Low leverage advance projection@@trading.projection.lowLeverageAdvance:Low-leverage advance`,
      'Exchange outflow target': $localize`:Exchange outflow target projection@@trading.projection.exchangeOutflowTarget:Exchange outflow target`,
      'Network growth target': $localize`:Network growth target projection@@trading.projection.networkGrowthTarget:Network growth target`,
      'Network activity target': $localize`:Network activity target projection@@trading.projection.networkActivityTarget:Network activity target`,
      'Liquidity expansion target': $localize`:Liquidity expansion target projection@@trading.projection.liquidityExpansionTarget:Liquidity expansion target`,
      'Excess liquidity target': $localize`:Excess liquidity target projection@@trading.projection.excessLiquidityTarget:Excess liquidity target`,
      'Dollar-weakness target': $localize`:Dollar weakness target projection@@trading.projection.dollarWeaknessTarget:Dollar-weakness target`,
      'Crowded longs flush': $localize`:Crowded longs flush projection@@trading.projection.crowdedLongsFlush:Crowded longs flush`,
      'Open-interest deleveraging': $localize`:Open interest deleveraging projection@@trading.projection.openInterestDeleveraging:Open-interest deleveraging`,
      'Exchange inflow stress': $localize`:Exchange inflow stress projection@@trading.projection.exchangeInflowStress:Exchange inflow stress`,
      'High-volatility stress': $localize`:High volatility stress projection@@trading.projection.highVolatilityStress:High-volatility stress`,
      'Liquidity-adjusted base': $localize`:Liquidity adjusted base projection@@trading.projection.liquidityAdjustedBase:Liquidity-adjusted base`,
      'Excess-liquidity haircut': $localize`:Excess liquidity haircut projection@@trading.projection.excessLiquidityHaircut:Excess-liquidity haircut`,
      'Dollar-strength base': $localize`:Dollar strength base projection@@trading.projection.dollarStrengthBase:Dollar-strength base`,
      'Retail euphoria extension': $localize`:Retail euphoria extension projection@@trading.projection.retailEuphoriaExtension:Retail euphoria extension`,
      'S2F model price': $localize`:S2F model price projection@@trading.projection.s2fModel:S2F model price`,
      'S2F ×1.5': $localize`:S2F x1.5 projection@@trading.projection.s2f15:S2F ×1.5`,
      'S2F ×3': $localize`:S2F x3 projection@@trading.projection.s2f3:S2F ×3`,
      'Terminal Price': $localize`:Terminal price projection@@trading.projection.terminalPrice:Terminal Price`,
      'Terminal ×1.5': $localize`:Terminal x1.5 projection@@trading.projection.terminal15:Terminal ×1.5`,
      // MVRV Z-Score interpretations
      'Deep buy zone — historically rare undervaluation': $localize`:MVRV deep buy zone@@trading.interpretation.mvrvDeepBuy:Deep buy zone — historically rare undervaluation`,
      'Fair value range': $localize`:MVRV fair value@@trading.interpretation.mvrvFairValue:Fair value range`,
      'Elevated — market heating up': $localize`:MVRV elevated@@trading.interpretation.mvrvElevated:Elevated — market heating up`,
      'Extreme overvaluation — historical sell zone': $localize`:MVRV extreme overvaluation@@trading.interpretation.mvrvExtremeOvervaluation:Extreme overvaluation — historical sell zone`,
      // VDD Multiple interpretations
      'Below average — mild bullish': $localize`:VDD below average@@trading.interpretation.vddBelowAverage:Below average — mild bullish`,
      'Average range': $localize`:VDD average range@@trading.interpretation.vddAverageRange:Average range`,
      'Elevated — caution': $localize`:VDD elevated caution@@trading.interpretation.vddElevated:Elevated — caution`,
      'Extreme — distribution zone': $localize`:VDD extreme distribution@@trading.interpretation.vddExtreme:Extreme — distribution zone`,
      // Realized Price Premium interpretations
      'Below realized price — market at loss, strong accumulation signal': $localize`:Realized below price@@trading.interpretation.realizedBelowPrice:Below realized price — market at loss, strong accumulation signal`,
      'Moderate premium above realized price': $localize`:Realized moderate premium@@trading.interpretation.realizedModerate:Moderate premium above realized price`,
      'High premium — market overextended': $localize`:Realized high premium@@trading.interpretation.realizedHighPremium:High premium — market overextended`,
      'Extreme premium — historical sell zone': $localize`:Realized extreme premium@@trading.interpretation.realizedExtremePremium:Extreme premium — historical sell zone`,
      'Mayer Multiple': 'Mayer Multiple',
      'Stock-to-Flow': 'Stock-to-Flow',
      'CVDD': 'CVDD',
      'Global M2': 'Global M2',
      'Excess Liquidity': $localize`:Excess liquidity model@@trading.model.excessLiquidity:Excess Liquidity`,
      'DXY': 'DXY',
      'Funding Rate': $localize`:Funding rate model@@trading.model.fundingRate:Funding Rate`,
      'Open Interest': $localize`:Open interest model@@trading.model.openInterest:Open Interest`,
      'Exchange Netflow': $localize`:Exchange netflow model@@trading.model.exchangeNetflow:Exchange Netflow`,
      'Active Addresses': $localize`:Active addresses model@@trading.model.activeAddresses:Active Addresses`,
      'Google Trends': 'Google Trends',
      'BTC DVOL': 'BTC DVOL',
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
      const updatedAvailableSignals = data.availableSignals.map((s) =>
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
        availableSignals: updatedAvailableSignals,
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

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
