import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ApiClientError,
  AuthApiClient,
  type AlertWithTitle,
  type AlertsListResponse,
} from '@crypto-market-analysis/data-access/api-client';

const CONDITION_LABELS: Record<string, string> = {
  crosses_above: 'crosses above',
  crosses_below: 'crosses below',
  greater_than: 'greater than',
  less_than: 'less than',
  equals: 'equals',
};

const METRIC_LABELS: Record<string, string> = {
  btc_price:               'BTC Price',
  rainbow_band:            'Rainbow Band',
  ma_111_day:              '111-Day MA',
  ma_350_day:              '350-Day MA',
  stock_to_flow_ratio:     'Stock-to-Flow Ratio',
  mvrv_zscore:             'MVRV Z-Score',
  fear_greed_index:        'Fear & Greed Index',
  miners_revenue_usd:      'Miner Revenue (USD)',
  vdd_multiple:            'VDD Multiple',
  realized_price:          'Realized Price',
  cvdd:                    'CVDD',
  balanced_price:          'Balanced Price',
  terminal_price:          'Terminal Price',
  hash_rate:               'Hash Rate',
  mining_difficulty:       'Mining Difficulty',
  transaction_volume_usd:  'Transaction Volume',
  coin_days_destroyed:     'Coin Days Destroyed',
  excess_liquidity_leading:'Excess Liquidity',
  spx_yoy_change:          'S&P 500 YoY Change',
};

const CHART_OPTIONS = [
  { id: 'bitcoin-rainbow',    label: 'Bitcoin Rainbow Price Chart' },
  { id: 'pi-cycle-top',       label: 'Pi Cycle Top Indicator' },
  { id: 'stock-to-flow',      label: 'Stock-to-Flow Model' },
  { id: 'mvrv-z-score',       label: 'MVRV Z-Score' },
  { id: 'fear-greed-index',   label: 'Fear & Greed Index' },
  { id: 'puell-multiple',     label: 'Puell Multiple' },
  { id: 'mayer-multiple',     label: 'Mayer Multiple' },
  { id: 'vdd-multiple',       label: 'VDD Multiple' },
  { id: 'realized-price',     label: 'Realized Price' },
  { id: 'bitcoin-cvdd',       label: 'Bitcoin CVDD' },
  { id: 'bitcoin-power-law',  label: 'Bitcoin Power Law' },
  { id: 'hash-ribbons',       label: 'Hash Ribbons' },
  { id: 'difficulty-ribbon',  label: 'Difficulty Ribbon' },
  { id: 'nvt-ratio',          label: 'NVT Ratio' },
  { id: 'thermocap-multiple', label: 'Thermocap Multiple' },
  { id: '200-week-ma-heatmap',label: '200-Week MA Heatmap' },
  { id: '2yr-ma-multiplier',  label: '2-Year MA Multiplier' },
  { id: 'price-forecast-tools',label: 'Price Forecast Tools' },
  { id: 'stock-to-income',    label: 'Stock-to-Income' },
];

const CHART_METRICS: Record<string, { key: string; label: string }[]> = {
  'bitcoin-rainbow':    [{ key: 'btc_price', label: 'BTC Price' }, { key: 'rainbow_band', label: 'Rainbow Band' }],
  'pi-cycle-top':       [{ key: 'ma_111_day', label: '111-Day MA' }, { key: 'ma_350_day', label: '350-Day MA' }],
  'stock-to-flow':      [{ key: 'stock_to_flow_ratio', label: 'Stock-to-Flow Ratio' }],
  'mvrv-z-score':       [{ key: 'mvrv_zscore', label: 'MVRV Z-Score' }],
  'fear-greed-index':   [{ key: 'fear_greed_index', label: 'Fear & Greed Index' }],
  'puell-multiple':     [{ key: 'miners_revenue_usd', label: 'Miner Revenue (USD)' }],
  'mayer-multiple':     [{ key: 'btc_price', label: 'BTC Price' }],
  'vdd-multiple':       [{ key: 'vdd_multiple', label: 'VDD Multiple' }, { key: 'coin_days_destroyed', label: 'Coin Days Destroyed' }],
  'realized-price':     [{ key: 'realized_price', label: 'Realized Price' }, { key: 'btc_price', label: 'BTC Price' }],
  'bitcoin-cvdd':       [{ key: 'cvdd', label: 'CVDD' }, { key: 'balanced_price', label: 'Balanced Price' }, { key: 'terminal_price', label: 'Terminal Price' }],
  'bitcoin-power-law':  [{ key: 'btc_price', label: 'BTC Price' }],
  'hash-ribbons':       [{ key: 'hash_rate', label: 'Hash Rate' }],
  'difficulty-ribbon':  [{ key: 'mining_difficulty', label: 'Mining Difficulty' }],
  'nvt-ratio':          [{ key: 'transaction_volume_usd', label: 'Transaction Volume (USD)' }],
  'thermocap-multiple': [{ key: 'miners_revenue_usd', label: 'Miner Revenue (USD)' }],
  '200-week-ma-heatmap':[{ key: 'btc_price', label: 'BTC Price' }],
  '2yr-ma-multiplier':  [{ key: 'btc_price', label: 'BTC Price' }],
  'price-forecast-tools':[{ key: 'balanced_price', label: 'Balanced Price' }, { key: 'terminal_price', label: 'Terminal Price' }, { key: 'cvdd', label: 'CVDD' }],
  'stock-to-income':    [{ key: 'stock_to_flow_ratio', label: 'Stock-to-Flow Ratio' }],
};

const CHART_URLS: Record<string, string> = {
  'bitcoin-rainbow':    '/charts/bitcoin-rainbow',
  'pi-cycle-top':       '/charts/pi-cycle-top',
  'stock-to-flow':      '/charts/stock-to-flow',
  'mvrv-z-score':       '/charts/mvrv-z-score',
  'fear-greed-index':   '/charts/fear-greed-index',
  'puell-multiple':     '/charts/puell-multiple',
  'mayer-multiple':     '/charts/mayer-multiple',
  'vdd-multiple':       '/charts/vdd-multiple',
  'realized-price':     '/charts/realized-price',
  'bitcoin-cvdd':       '/charts/bitcoin-cvdd',
  'bitcoin-power-law':  '/charts/bitcoin-power-law',
  'hash-ribbons':       '/charts/hash-ribbons',
  'difficulty-ribbon':  '/charts/difficulty-ribbon',
  'nvt-ratio':          '/charts/nvt-ratio',
  'thermocap-multiple': '/charts/thermocap-multiple',
  '200-week-ma-heatmap':'/charts/200-week-ma-heatmap',
  '2yr-ma-multiplier':  '/charts/2yr-ma-multiplier',
  'price-forecast-tools':'/charts/price-forecast-tools',
  'stock-to-income':    '/charts/stock-to-income',
};

@Component({
  selector: 'app-alerts-page',
  imports: [RouterLink, FormsModule],
  template: `
    <section class="content-section alerts-page">
      <div class="alerts-page-header">
        <div>
          <p class="eyebrow" i18n="Alerts eyebrow@@alerts.eyebrow">Alerts</p>
          <h2 i18n="My alerts title@@alerts.title">My Alerts</h2>
          @if (alertsData()) {
            <p class="alerts-count-label">
              {{ alertsData()!.alertLimit.used }}
              <ng-container i18n="Alert count label@@alerts.count"> alerts</ng-container>
            </p>
          }
        </div>
        <button type="button" class="primary-link" (click)="openCreateForm()"
          i18n="Create new alert button@@alerts.createNew">Create New Alert</button>
      </div>

      @if (successMessage()) {
        <p class="form-message success">{{ successMessage() }}</p>
      }
      @if (errorMessage()) {
        <p class="form-message">{{ errorMessage() }}</p>
      }

      @if (showCreateForm()) {
        <div class="alert-create-panel">
          <h3 class="alert-create-title" i18n="Create alert panel title@@alerts.createTitle">New Alert</h3>
          <div class="alert-create-grid">
            <label class="alert-edit-label">
              <span i18n="Alert name label@@alerts.alertName">Alert name</span>
              <input class="alert-edit-input" type="text" [(ngModel)]="createDraft.alertName"
                placeholder="My alert" i18n-placeholder="Alert name placeholder@@alerts.alertNamePlaceholder" />
            </label>
            <label class="alert-edit-label">
              <span i18n="Chart label@@alerts.chart">Chart</span>
              <select class="alert-edit-input" [ngModel]="createChartId()" (ngModelChange)="onChartChange($event)">
                <option value="" i18n="Select chart option@@alerts.selectChart">Select chart…</option>
                @for (c of chartOptions; track c.id) {
                  <option [value]="c.id">{{ c.label }}</option>
                }
              </select>
            </label>
            <label class="alert-edit-label">
              <span i18n="Metric label@@alerts.metric">Metric</span>
              <select class="alert-edit-input" [(ngModel)]="createDraft.metricName" [disabled]="!createChartId()">
                <option value="" i18n="Select metric option@@alerts.selectMetric">Select metric…</option>
                @for (m of availableMetrics(); track m.key) {
                  <option [value]="m.key">{{ m.label }}</option>
                }
              </select>
            </label>
            <label class="alert-edit-label">
              <span i18n="Condition label@@alerts.condition">Condition</span>
              <select class="alert-edit-input" [(ngModel)]="createDraft.condition">
                <option value="crosses_above" i18n="Crosses above option@@alerts.crossesAbove">Crosses above</option>
                <option value="crosses_below" i18n="Crosses below option@@alerts.crossesBelow">Crosses below</option>
                <option value="greater_than" i18n="Greater than option@@alerts.greaterThan">Greater than</option>
                <option value="less_than" i18n="Less than option@@alerts.lessThan">Less than</option>
                <option value="equals" i18n="Equals option@@alerts.equals">Equals</option>
              </select>
            </label>
            <label class="alert-edit-label">
              <span i18n="Threshold label@@alerts.threshold">Threshold value</span>
              <input class="alert-edit-input" type="number" [(ngModel)]="createDraft.thresholdValue" />
            </label>
          </div>
          <div class="alert-edit-actions">
            <button type="button" class="alert-action-btn alert-action-primary"
              [disabled]="isCreating() || !createChartId() || !createDraft.metricName || !createDraft.alertName"
              (click)="submitCreate()">
              @if (isCreating()) {
                <ng-container i18n="Creating state@@alerts.creating">Creating…</ng-container>
              } @else {
                <ng-container i18n="Create alert action@@alerts.create">Create alert</ng-container>
              }
            </button>
            <button type="button" class="alert-action-btn" (click)="cancelCreate()"
              i18n="Cancel button@@common.cancel">Cancel</button>
          </div>
        </div>
      }

      @if (!isLoading() && (alertsData()?.alerts?.length ?? 0) > 0) {
        <div class="alerts-filter-bar">
          <div class="alerts-search-wrap">
            <svg class="alerts-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="4.5" stroke="#9ca3af" stroke-width="1.5"/>
              <path d="M9.5 9.5L12 12" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <input
              class="alerts-search-input"
              type="text"
              placeholder="Search alerts…"
              i18n-placeholder="Search alerts placeholder@@alerts.search"
              [(ngModel)]="searchQuery"
            />
          </div>
          <div class="alerts-status-filters">
            @for (s of statusOptions; track s.value) {
              <button
                type="button"
                class="alerts-filter-btn"
                [class.active]="statusFilter() === s.value"
                (click)="statusFilter.set(s.value)"
              >{{ s.label }}</button>
            }
          </div>
        </div>
      }

      @if (isLoading()) {
        <p class="alerts-loading" i18n="Loading alerts@@alerts.loading">Loading alerts…</p>
      } @else if (alertsData()?.alerts?.length === 0) {
        <div class="alerts-empty">
          <p i18n="No alerts message@@alerts.empty">You have no alerts yet.</p>
          <p i18n="No alerts hint@@alerts.emptyHint">Click <strong>Create New Alert</strong> above to set up your first alert.</p>
        </div>
      } @else {
        @if (filteredAlerts().length === 0) {
          <p class="alerts-no-results" i18n="No results@@alerts.noResults">No alerts match your filter.</p>
        }
        <div class="alerts-card-list">
          @for (alert of filteredAlerts(); track alert.id) {
            <div class="alert-card" [attr.data-status]="editTargetId() === alert.id ? 'editing' : alert.status">
              <div class="alert-card-accent"></div>
              <div class="alert-card-body">
                @if (editTargetId() === alert.id) {
                  <div class="alert-edit-panel">
                    <label class="alert-edit-label">
                      <span i18n="Alert name label@@alerts.alertName">Alert name</span>
                      <input class="alert-edit-input" type="text" [(ngModel)]="editDraft.alertName" />
                    </label>
                    <div class="alert-edit-row">
                      <label class="alert-edit-label">
                        <span i18n="Condition label@@alerts.condition">Condition</span>
                        <select class="alert-edit-input" [(ngModel)]="editDraft.condition">
                          <option value="crosses_above" i18n="Crosses above option@@alerts.crossesAbove">Crosses above</option>
                          <option value="crosses_below" i18n="Crosses below option@@alerts.crossesBelow">Crosses below</option>
                          <option value="greater_than" i18n="Greater than option@@alerts.greaterThan">Greater than</option>
                          <option value="less_than" i18n="Less than option@@alerts.lessThan">Less than</option>
                          <option value="equals" i18n="Equals option@@alerts.equals">Equals</option>
                        </select>
                      </label>
                      <label class="alert-edit-label">
                        <span i18n="Threshold label@@alerts.threshold">Threshold</span>
                        <input class="alert-edit-input" type="number" [(ngModel)]="editDraft.thresholdValue" />
                      </label>
                      <label class="alert-edit-label">
                        <span i18n="Status label@@alerts.status">Status</span>
                        <select class="alert-edit-input" [(ngModel)]="editDraft.status">
                          <option value="active" i18n="Active option@@alerts.statusActive">Active</option>
                          <option value="paused" i18n="Paused option@@alerts.statusPaused">Paused</option>
                        </select>
                      </label>
                    </div>
                    <div class="alert-edit-actions">
                      <button type="button" class="alert-action-btn alert-action-primary" [disabled]="isSaving()" (click)="saveEdit(alert.id)">
                        @if (isSaving()) {
                          <ng-container i18n="Saving state@@common.saving">Saving…</ng-container>
                        } @else {
                          <ng-container i18n="Save changes@@common.saveChanges">Save changes</ng-container>
                        }
                      </button>
                      <button type="button" class="alert-action-btn" (click)="cancelEdit()"
                        i18n="Cancel button@@common.cancel">Cancel</button>
                    </div>
                  </div>
                } @else {
                  <div class="alert-card-top">
                    <div class="alert-card-title-row">
                      <strong class="alert-card-name">{{ alert.alertName }}</strong>
                      <span class="alert-status-badge" [class]="'alert-status-' + alert.status">
                        {{ titlecase(alert.status) }}
                      </span>
                    </div>
                    <p class="alert-card-condition">{{ conditionSummary(alert) }}</p>
                  </div>
                  <div class="alert-card-bottom">
                    <div class="alert-card-meta">
                      <a class="alert-card-chart-link" [routerLink]="chartUrl(alert.chartId)">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 9L5 5.5L7.5 7.5L10 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        {{ alert.chartTitle }}
                      </a>
                      <span class="alert-card-time">{{ formatRelativeTime(alert.createdAt) }}</span>
                    </div>
                    <div class="alert-card-actions">
                      @if (deleteTargetId() === alert.id) {
                        <span class="alert-confirm-delete">
                          <ng-container i18n="Confirm delete prompt@@alerts.confirmDelete">Sure?</ng-container>
                          <button type="button" class="alert-action-btn alert-action-danger" [disabled]="isDeleting()" (click)="confirmDelete(alert.id)">
                            @if (isDeleting()) {
                              <ng-container i18n="Deleting state@@alerts.deleting">Deleting…</ng-container>
                            } @else {
                              <ng-container i18n="Yes delete@@alerts.yesDelete">Yes, delete</ng-container>
                            }
                          </button>
                          <button type="button" class="alert-action-btn" (click)="cancelDelete()"
                            i18n="Cancel button@@common.cancel">Cancel</button>
                        </span>
                      } @else {
                        @if (alert.status === 'triggered') {
                          <button type="button" class="alert-action-btn" [disabled]="isResetting() === alert.id" (click)="resetAlert(alert)">
                            @if (isResetting() === alert.id) {
                              <ng-container i18n="Resetting state@@alerts.resetting">Resetting…</ng-container>
                            } @else {
                              <ng-container i18n="Reset button@@alerts.reset">Reset</ng-container>
                            }
                          </button>
                        }
                        <button type="button" class="alert-action-btn" (click)="openEdit(alert)"
                          i18n="Edit button@@common.edit">Edit</button>
                        <button type="button" class="alert-action-btn alert-action-danger" (click)="requestDelete(alert.id)"
                          i18n="Delete button@@common.delete">Delete</button>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class AlertsPageComponent implements OnInit {
  protected readonly alertsData = signal<AlertsListResponse | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly deleteTargetId = signal<string | null>(null);
  protected readonly isDeleting = signal(false);
  protected readonly isResetting = signal<string | null>(null);
  protected readonly editTargetId = signal<string | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly showCreateForm = signal(false);
  protected readonly isCreating = signal(false);

  protected editDraft: { alertName: string; condition: string; thresholdValue: number; status: string } =
    { alertName: '', condition: '', thresholdValue: 0, status: 'active' };

  protected createDraft: { alertName: string; metricName: string; condition: string; thresholdValue: number } =
    { alertName: '', metricName: '', condition: 'crosses_above', thresholdValue: 0 };

  protected readonly createChartId = signal('');

  protected readonly chartOptions = CHART_OPTIONS;

  protected readonly availableMetrics = computed(() =>
    CHART_METRICS[this.createChartId()] ?? [],
  );

  protected searchQuery = '';
  protected readonly statusFilter = signal<'all' | 'active' | 'triggered' | 'paused'>('all');
  protected readonly statusOptions = [
    { label: $localize`:All filter@@alerts.filterAll:All`, value: 'all' as const },
    { label: $localize`:Active filter@@alerts.filterActive:Active`, value: 'active' as const },
    { label: $localize`:Triggered filter@@alerts.filterTriggered:Triggered`, value: 'triggered' as const },
    { label: $localize`:Paused filter@@alerts.filterPaused:Paused`, value: 'paused' as const },
  ];

  protected readonly filteredAlerts = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    const status = this.statusFilter();
    return (this.alertsData()?.alerts ?? []).filter((a) => {
      if (status !== 'all' && a.status !== status) return false;
      if (q && !a.alertName.toLowerCase().includes(q) && !a.chartTitle.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  private readonly api = inject(AuthApiClient);

  ngOnInit(): void {
    void this.loadAlerts();
  }

  protected titlecase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  protected chartUrl(chartId: string): string {
    return CHART_URLS[chartId] ?? '/charts';
  }

  protected conditionSummary(alert: AlertWithTitle): string {
    const metric = METRIC_LABELS[alert.metricName] ?? alert.metricName.replace(/_/g, ' ');
    const cond = CONDITION_LABELS[alert.condition] ?? alert.condition;
    return `${metric} ${cond} ${alert.thresholdValue}`;
  }

  protected formatRelativeTime(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return $localize`:Just now@@time.justNow:Just now`;
    if (diffMins < 60) return $localize`:Minutes ago@@time.minutesAgo:${diffMins}:count: minute${diffMins === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return $localize`:Hours ago@@time.hoursAgo:${diffHours}:count: hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return $localize`:Days ago@@time.daysAgo:${diffDays}:count: day${diffDays === 1 ? '' : 's'} ago`;
  }

  protected openCreateForm(): void {
    this.createDraft = { alertName: '', metricName: '', condition: 'crosses_above', thresholdValue: 0 };
    this.createChartId.set('');
    this.showCreateForm.set(true);
    this.errorMessage.set('');
  }

  protected cancelCreate(): void {
    this.showCreateForm.set(false);
  }

  protected onChartChange(chartId: string): void {
    this.createChartId.set(chartId);
    this.createDraft.metricName = '';
  }

  protected async submitCreate(): Promise<void> {
    if (!this.createChartId() || !this.createDraft.metricName || !this.createDraft.alertName) return;
    this.isCreating.set(true);
    this.errorMessage.set('');
    try {
      const created = await this.api.createAlert({
        chartId: this.createChartId(),
        metricName: this.createDraft.metricName,
        condition: this.createDraft.condition as never,
        thresholdValue: this.createDraft.thresholdValue,
        alertName: this.createDraft.alertName,
      });
      const current = this.alertsData();
      if (current) {
        this.alertsData.set({
          alerts: [{ ...created, chartTitle: CHART_OPTIONS.find((c) => c.id === created.chartId)?.label ?? created.chartId, triggeredAt: null, lastEvaluatedAt: null }, ...current.alerts],
          alertLimit: { ...current.alertLimit, used: current.alertLimit.used + 1 },
        });
      }
      this.showCreateForm.set(false);
      this.successMessage.set($localize`:Alert created@@alerts.created:Alert created successfully.`);
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError ? error.message : $localize`:Create alert error@@alerts.createError:Could not create alert. Please try again.`,
      );
    } finally {
      this.isCreating.set(false);
    }
  }

  protected openEdit(alert: AlertWithTitle): void {
    this.editDraft = {
      alertName: alert.alertName,
      condition: alert.condition,
      thresholdValue: alert.thresholdValue,
      status: alert.status,
    };
    this.editTargetId.set(alert.id);
    this.deleteTargetId.set(null);
  }

  protected cancelEdit(): void {
    this.editTargetId.set(null);
  }

  protected async saveEdit(alertId: string): Promise<void> {
    this.isSaving.set(true);
    this.errorMessage.set('');
    try {
      const updated = await this.api.updateAlert(alertId, {
        alertName: this.editDraft.alertName,
        condition: this.editDraft.condition,
        thresholdValue: this.editDraft.thresholdValue,
        status: this.editDraft.status,
      });
      const current = this.alertsData();
      if (current) {
        this.alertsData.set({
          ...current,
          alerts: current.alerts.map((a) => (a.id === alertId ? { ...a, ...updated } : a)),
        });
      }
      this.editTargetId.set(null);
      this.successMessage.set($localize`:Alert updated@@alerts.updated:Alert updated.`);
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError ? error.message : $localize`:Save alert error@@alerts.saveError:Could not save alert. Please try again.`,
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  protected requestDelete(alertId: string): void {
    this.deleteTargetId.set(alertId);
  }

  protected cancelDelete(): void {
    this.deleteTargetId.set(null);
  }

  protected async confirmDelete(alertId: string): Promise<void> {
    this.isDeleting.set(true);
    this.errorMessage.set('');
    try {
      await this.api.deleteAlert(alertId);
      const current = this.alertsData();
      if (current) {
        const alerts = current.alerts.filter((a) => a.id !== alertId);
        this.alertsData.set({
          alerts,
          alertLimit: { ...current.alertLimit, used: current.alertLimit.used - 1 },
        });
      }
      this.deleteTargetId.set(null);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError ? error.message : $localize`:Delete alert error@@alerts.deleteError:Could not delete alert. Please try again.`,
      );
    } finally {
      this.isDeleting.set(false);
    }
  }

  protected async resetAlert(alert: AlertWithTitle): Promise<void> {
    this.isResetting.set(alert.id);
    this.errorMessage.set('');
    try {
      const updated = await this.api.resetAlert(alert.id);
      const current = this.alertsData();
      if (current) {
        this.alertsData.set({
          ...current,
          alerts: current.alerts.map((a) =>
            a.id === alert.id ? { ...a, status: updated.status, triggeredAt: null } : a,
          ),
        });
      }
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError ? error.message : $localize`:Reset alert error@@alerts.resetError:Could not reset alert. Please try again.`,
      );
    } finally {
      this.isResetting.set(null);
    }
  }

  private async loadAlerts(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.alertsData.set(await this.api.getAlerts());
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError ? error.message : $localize`:Load alerts error@@alerts.loadError:Could not load alerts. Please try again.`,
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
