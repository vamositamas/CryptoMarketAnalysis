import { Component, OnInit, inject, signal } from '@angular/core';
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
  rainbow_band: 'Rainbow Band',
  btc_price: 'BTC Price',
  ma_111_day: '111-Day MA',
  ma_350x2_day: '350-Day MA × 2',
  stock_to_flow_ratio: 'Stock-to-Flow Ratio',
  mvrv_zscore: 'MVRV Z-Score',
  fear_greed_index: 'Fear & Greed Index',
};

const CHART_URLS: Record<string, string> = {
  'bitcoin-rainbow': '/charts/bitcoin-rainbow',
  'pi-cycle-top': '/charts/pi-cycle-top',
  'stock-to-flow': '/charts/stock-to-flow',
};

@Component({
  selector: 'app-alerts-page',
  imports: [RouterLink],
  template: `
    <section class="content-section alerts-page">
      <div class="alerts-page-header">
        <div>
          <p class="eyebrow">Alerts</p>
          <h2>My Alerts</h2>
          @if (alertsData()) {
            <p class="alerts-count-label">
              @if (alertsData()!.alertLimit.unlimited) {
                {{ alertsData()!.alertLimit.used }} alert{{ alertsData()!.alertLimit.used === 1 ? '' : 's' }}
              } @else {
                {{ alertsData()!.alertLimit.used }} of {{ alertsData()!.alertLimit.max }} alerts used
              }
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

      @if (isLoading()) {
        <p class="alerts-loading">Loading alerts...</p>
      } @else if (alertsData()?.alerts?.length === 0) {
        <div class="alerts-empty">
          <p>You have no alerts yet.</p>
          <p>Click <strong>Create New Alert</strong> to open any chart and set up your first alert.</p>
        </div>
      } @else {
        <div class="alerts-table-wrapper">
          <table class="alerts-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Chart</th>
                <th>Condition</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (alert of alertsData()?.alerts ?? []; track alert.id) {
                <tr [class.alert-row-triggered]="alert.status === 'triggered'">
                  <td class="alert-name-cell"><strong>{{ alert.alertName }}</strong></td>
                  <td>
                    <a class="form-link" [routerLink]="chartUrl(alert.chartId)">{{ alert.chartTitle }}</a>
                  </td>
                  <td class="alert-condition-cell">{{ conditionSummary(alert) }}</td>
                  <td>
                    <span class="alert-status-badge" [class]="'alert-status-' + alert.status">
                      {{ titlecase(alert.status) }}
                    </span>
                  </td>
                  <td class="alert-date-cell">{{ formatRelativeTime(alert.createdAt) }}</td>
                  <td class="alert-actions-cell">
                    @if (deleteTargetId() === alert.id) {
                      <span class="alert-confirm-delete">
                        Delete?
                        <button type="button" class="alert-action-btn alert-action-danger" [disabled]="isDeleting()" (click)="confirmDelete(alert.id)">
                          {{ isDeleting() ? 'Deleting…' : 'Confirm' }}
                        </button>
                        <button type="button" class="alert-action-btn" (click)="cancelDelete()">Cancel</button>
                      </span>
                    } @else {
                      <button type="button" class="alert-action-btn" (click)="requestDelete(alert.id)">Delete</button>
                      @if (alert.status === 'triggered') {
                        <button type="button" class="alert-action-btn" [disabled]="isResetting() === alert.id" (click)="resetAlert(alert)">
                          {{ isResetting() === alert.id ? 'Resetting…' : 'Reset' }}
                        </button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
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
