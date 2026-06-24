import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
  rainbow_band: 'Szivárványsáv',
  btc_price: 'BTC ár',
  ma_111_day: '111-Day MA',
  ma_350x2_day: '350-Day MA × 2',
  stock_to_flow_ratio: 'Stock-to-Flow Ratio',
  mvrv_zscore: 'MVRV Z-Score',
  fear_greed_index: 'Félelem és kapzsiság index',
};

const CHART_URLS: Record<string, string> = {
  'bitcoin-rainbow': '/charts/bitcoin-rainbow',
  'pi-cycle-top': '/charts/pi-cycle-top',
  'stock-to-flow': '/charts/stock-to-flow',
};

@Component({
  selector: 'app-alerts-page',
  imports: [RouterLink, FormsModule],
  template: `
    <section class="content-section alerts-page">
      <div class="alerts-page-header">
        <div>
          <p class="eyebrow">Alerts</p>
          <h2>My Alerts</h2>
          @if (alertsData()) {
            <p class="alerts-count-label">
              {{ alertsData()!.alertLimit.used }} alert{{ alertsData()!.alertLimit.used === 1 ? '' : 's' }}
            </p>
          }
        </div>
        <a class="primary-link" routerLink="/charts">Create New Alert</a>
      </div>

      @if (successMessage()) {
        <p class="form-message success">{{ successMessage() }}</p>
      }
      @if (errorMessage()) {
        <p class="form-message">{{ errorMessage() }}</p>
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
        <p class="alerts-loading">Loading alerts...</p>
      } @else if (alertsData()?.alerts?.length === 0) {
        <div class="alerts-empty">
          <p>You have no alerts yet.</p>
          <p>Click <strong>Create New Alert</strong> to open any chart and set up your first alert.</p>
        </div>
      } @else {
        @if (filteredAlerts().length === 0) {
          <p class="alerts-no-results">No alerts match your filter.</p>
        }
        <div class="alerts-card-list">
          @for (alert of filteredAlerts(); track alert.id) {
            <div class="alert-card" [attr.data-status]="editTargetId() === alert.id ? 'editing' : alert.status">
              <div class="alert-card-accent"></div>
              <div class="alert-card-body">
                @if (editTargetId() === alert.id) {
                  <div class="alert-edit-panel">
                    <label class="alert-edit-label">Alert name
                      <input class="alert-edit-input" type="text" [(ngModel)]="editDraft.alertName" />
                    </label>
                    <div class="alert-edit-row">
                      <label class="alert-edit-label">Condition
                        <select class="alert-edit-input" [(ngModel)]="editDraft.condition">
                          <option value="crosses_above">Crosses above</option>
                          <option value="crosses_below">Crosses below</option>
                          <option value="greater_than">Greater than</option>
                          <option value="less_than">Less than</option>
                          <option value="equals">Equals</option>
                        </select>
                      </label>
                      <label class="alert-edit-label">Threshold
                        <input class="alert-edit-input" type="number" [(ngModel)]="editDraft.thresholdValue" />
                      </label>
                      <label class="alert-edit-label">Status
                        <select class="alert-edit-input" [(ngModel)]="editDraft.status">
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                        </select>
                      </label>
                    </div>
                    <div class="alert-edit-actions">
                      <button type="button" class="alert-action-btn alert-action-primary" [disabled]="isSaving()" (click)="saveEdit(alert.id)">
                        {{ isSaving() ? 'Saving…' : 'Save changes' }}
                      </button>
                      <button type="button" class="alert-action-btn" (click)="cancelEdit()">Cancel</button>
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
                          Sure?
                          <button type="button" class="alert-action-btn alert-action-danger" [disabled]="isDeleting()" (click)="confirmDelete(alert.id)">
                            {{ isDeleting() ? 'Deleting…' : 'Yes, delete' }}
                          </button>
                          <button type="button" class="alert-action-btn" (click)="cancelDelete()">Cancel</button>
                        </span>
                      } @else {
                        @if (alert.status === 'triggered') {
                          <button type="button" class="alert-action-btn" [disabled]="isResetting() === alert.id" (click)="resetAlert(alert)">
                            {{ isResetting() === alert.id ? 'Resetting…' : 'Reset' }}
                          </button>
                        }
                        <button type="button" class="alert-action-btn" (click)="openEdit(alert)">Edit</button>
                        <button type="button" class="alert-action-btn alert-action-danger" (click)="requestDelete(alert.id)">Delete</button>
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
  protected editDraft: { alertName: string; condition: string; thresholdValue: number; status: string } = { alertName: '', condition: '', thresholdValue: 0, status: 'active' };

  protected searchQuery = '';
  protected readonly statusFilter = signal<'all' | 'active' | 'triggered' | 'paused'>('all');
  protected readonly statusOptions = [
    { label: 'Mind', value: 'all' as const },
    { label: 'Active', value: 'active' as const },
    { label: 'Triggered', value: 'triggered' as const },
    { label: 'Paused', value: 'paused' as const },
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
  private readonly router = inject(Router);

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation();
    const message = nav?.extras?.state?.['successMessage'];
    if (typeof message === 'string') {
      this.successMessage.set(message);
    }

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
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
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
      this.successMessage.set('Alert updated.');
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiClientError ? error.message : 'Could not save alert. Please try again.',
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
        error instanceof ApiClientError ? error.message : 'Could not delete alert. Please try again.',
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
        error instanceof ApiClientError ? error.message : 'Could not reset alert. Please try again.',
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
        error instanceof ApiClientError ? error.message : 'Could not load alerts. Please try again.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
