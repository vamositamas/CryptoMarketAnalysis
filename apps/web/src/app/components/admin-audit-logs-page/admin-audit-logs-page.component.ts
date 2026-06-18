import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AuthApiClient,
  type AuditLogRecord,
} from '@crypto-market-analysis/data-access/api-client';

@Component({
  selector: 'app-admin-audit-logs-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="content-section">
      <div class="section-heading">
        <p class="eyebrow">Admin</p>
        <h2>Audit Log <span class="badge">{{ total() }}</span></h2>
      </div>

      <div class="admin-toolbar">
        <select [(ngModel)]="actionTypeFilter" (ngModelChange)="loadLogs()" class="admin-filter-select">
          <option value="">All Actions</option>
          <option value="user_edit">User Edit</option>
          <option value="user_delete">User Delete</option>
          <option value="user_restore">User Restore</option>
          <option value="user_force_password_reset">Force Password Reset</option>
          <option value="chart_create">Chart Create</option>
          <option value="chart_edit">Chart Edit</option>
          <option value="chart_delete">Chart Delete</option>
        </select>
        <select [(ngModel)]="targetTypeFilter" (ngModelChange)="loadLogs()" class="admin-filter-select">
          <option value="">All Targets</option>
          <option value="user">User</option>
          <option value="chart">Chart</option>
        </select>
      </div>

      @if (isLoading()) {
        <p class="loading-text">Loading audit logs…</p>
      } @else {
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Admin ID</th>
                <th>Action</th>
                <th>Target</th>
                <th>Target ID</th>
                <th>Changes</th>
              </tr>
            </thead>
            <tbody>
              @for (log of logs(); track log.id) {
                <tr>
                  <td class="nowrap">{{ formatDate(log.createdAt) }}</td>
                  <td class="mono truncate" title="{{ log.adminUserId }}">{{ log.adminUserId.slice(0, 8) }}…</td>
                  <td><span class="action-badge">{{ log.actionType }}</span></td>
                  <td>{{ log.targetType }}</td>
                  <td class="mono truncate" title="{{ log.targetId ?? '' }}">{{ log.targetId ? log.targetId.slice(0, 8) + '…' : '—' }}</td>
                  <td>
                    @if (log.changes) {
                      <button class="ghost-link small" (click)="toggleChanges(log.id)">
                        {{ expandedId() === log.id ? 'Hide' : 'Show' }}
                      </button>
                      @if (expandedId() === log.id) {
                        <pre class="changes-json">{{ formatChanges(log.changes) }}</pre>
                      }
                    } @else {
                      <span>—</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty-cell">No audit log entries found.</td></tr>
              }
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <button class="ghost-link" [disabled]="currentPage() <= 1" (click)="goToPage(currentPage() - 1)">← Prev</button>
          <span>Page {{ currentPage() }} of {{ totalPages() }}</span>
          <button class="ghost-link" [disabled]="currentPage() >= totalPages()" (click)="goToPage(currentPage() + 1)">Next →</button>
        </div>
      }
    </section>
  `,
})
export class AdminAuditLogsPageComponent implements OnInit {
  private readonly api = inject(AuthApiClient);

  protected readonly logs = signal<AuditLogRecord[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly expandedId = signal<string | null>(null);

  protected actionTypeFilter = '';
  protected targetTypeFilter = '';

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / 50)));

  ngOnInit(): void {
    void this.loadLogs();
  }

  protected async loadLogs(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await this.api.adminListAuditLogs({
        page: this.currentPage(),
        limit: 50,
        actionType: this.actionTypeFilter || undefined,
        targetType: this.targetTypeFilter || undefined,
      });
      this.logs.set(result.logs);
      this.total.set(result.total);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected goToPage(page: number): void {
    this.currentPage.set(page);
    void this.loadLogs();
  }

  protected toggleChanges(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' });
  }

  protected formatChanges(changes: Record<string, unknown>): string {
    return JSON.stringify(changes, null, 2);
  }
}
