import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  AuthApiClient,
  ApiClientError,
  type ChartConfigRecord,
  type AdminCreateChartRequest,
} from '@crypto-market-analysis/data-access/api-client';

type ModalMode = 'create' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-admin-charts-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <section class="content-section">
      <div class="section-heading">
        <p class="eyebrow">Admin</p>
        <h2>Chart Management <span class="badge">{{ total() }}</span></h2>
        <button class="primary-button" (click)="openCreate()">+ New Chart</button>
      </div>

      <div class="admin-toolbar">
        <select [(ngModel)]="statusFilter" (ngModelChange)="loadCharts()" class="admin-filter-select">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      @if (message()) {
        <p class="form-message" [class.success]="messageIsSuccess()">{{ message() }}</p>
      }

      @if (isLoading()) {
        <p class="loading-text">Loading charts…</p>
      } @else {
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Chart ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Access</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (chart of charts(); track chart.id) {
                <tr>
                  <td class="mono">{{ chart.chartId }}</td>
                  <td>{{ chart.title }}</td>
                  <td>{{ chart.category }}</td>
                  <td><span class="tier-badge tier-{{ chart.accessTier }}">{{ chart.accessTier }}</span></td>
                  <td><span class="status-badge status-{{ chart.status }}">{{ chart.status }}</span></td>
                  <td>{{ formatDate(chart.createdAt) }}</td>
                  <td class="action-cell">
                    <button class="action-btn edit" (click)="openEdit(chart)">Edit</button>
                    <button class="action-btn delete" (click)="openDelete(chart)">Delete</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="empty-cell">No charts configured yet.</td></tr>
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

    <!-- Create / Edit Modal -->
    @if (modalMode() === 'create' || modalMode() === 'edit') {
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal-panel modal-panel--wide">
          <button class="modal-close" (click)="closeModal()">✕</button>
          <h3>{{ modalMode() === 'create' ? 'New Chart' : 'Edit Chart' }}</h3>
          <form [formGroup]="chartForm" (ngSubmit)="saveChart()" class="admin-form">
            <label>
              Chart ID <small>(slug, e.g. mvrv-z-score)</small>
              <input type="text" formControlName="chartId" [readonly]="modalMode() === 'edit'" />
            </label>
            <label>
              Title
              <input type="text" formControlName="title" />
            </label>
            <label>
              Category
              <input type="text" formControlName="category" placeholder="e.g. Valuation Models" />
            </label>
            <label>
              Access Tier
              <select formControlName="accessTier">
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </label>
            <label>
              Status
              <select formControlName="status">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>
              Description
              <textarea formControlName="description" rows="3" placeholder="Brief description shown in the chart library"></textarea>
            </label>
            <label>
              Methodology
              <textarea formControlName="methodology" rows="5" placeholder="Full methodology explanation"></textarea>
            </label>
            <div class="modal-actions">
              <button type="submit" class="primary-button" [disabled]="isSaving() || chartForm.invalid">
                {{ isSaving() ? 'Saving…' : modalMode() === 'create' ? 'Create Chart' : 'Save Changes' }}
              </button>
              <button type="button" class="ghost-link" (click)="closeModal()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (modalMode() === 'delete' && selectedChart()) {
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal-panel modal-panel--confirm">
          <button class="modal-close" (click)="closeModal()">✕</button>
          <h3>Delete Chart?</h3>
          <p>Delete "<strong>{{ selectedChart()!.title }}</strong>" ({{ selectedChart()!.chartId }})? This action cannot be undone.</p>
          <div class="modal-actions">
            <button class="primary-button danger" [disabled]="isSaving()" (click)="confirmDelete()">
              {{ isSaving() ? 'Deleting…' : 'Delete Chart' }}
            </button>
            <button class="ghost-link" (click)="closeModal()">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminChartsPageComponent implements OnInit {
  private readonly api = inject(AuthApiClient);
  private readonly fb = inject(FormBuilder);

  protected readonly charts = signal<ChartConfigRecord[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly message = signal('');
  protected readonly messageIsSuccess = signal(false);
  protected readonly modalMode = signal<ModalMode>(null);
  protected readonly selectedChart = signal<ChartConfigRecord | null>(null);

  protected statusFilter = '';

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / 50)));

  protected readonly chartForm = this.fb.nonNullable.group({
    chartId: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    title: ['', Validators.required],
    category: ['', Validators.required],
    accessTier: ['free' as 'free' | 'premium', Validators.required],
    status: ['draft' as 'draft' | 'active' | 'inactive', Validators.required],
    description: [''],
    methodology: [''],
  });

  ngOnInit(): void {
    void this.loadCharts();
  }

  protected async loadCharts(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await this.api.adminListCharts({
        page: this.currentPage(),
        limit: 50,
        status: this.statusFilter || undefined,
      });
      this.charts.set(result.charts);
      this.total.set(result.total);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected goToPage(page: number): void {
    this.currentPage.set(page);
    void this.loadCharts();
  }

  protected openCreate(): void {
    this.chartForm.reset({ chartId: '', title: '', category: '', accessTier: 'free', status: 'draft', description: '', methodology: '' });
    this.chartForm.get('chartId')?.enable();
    this.selectedChart.set(null);
    this.modalMode.set('create');
    this.message.set('');
  }

  protected openEdit(chart: ChartConfigRecord): void {
    this.selectedChart.set(chart);
    this.chartForm.setValue({
      chartId: chart.chartId,
      title: chart.title,
      category: chart.category,
      accessTier: chart.accessTier,
      status: chart.status,
      description: chart.description ?? '',
      methodology: chart.methodology ?? '',
    });
    this.chartForm.get('chartId')?.disable();
    this.modalMode.set('edit');
    this.message.set('');
  }

  protected openDelete(chart: ChartConfigRecord): void {
    this.selectedChart.set(chart);
    this.modalMode.set('delete');
    this.message.set('');
  }

  protected closeModal(): void {
    this.modalMode.set(null);
    this.selectedChart.set(null);
  }

  protected async saveChart(): Promise<void> {
    if (this.chartForm.invalid) return;
    this.isSaving.set(true);

    const v = this.chartForm.getRawValue();
    const data: AdminCreateChartRequest = {
      chartId: v.chartId,
      title: v.title,
      category: v.category,
      accessTier: v.accessTier,
      status: v.status,
      description: v.description || null,
      methodology: v.methodology || null,
    };

    try {
      if (this.modalMode() === 'create') {
        const created = await this.api.adminCreateChart(data);
        this.charts.update((list) => [created, ...list]);
        this.total.update((t) => t + 1);
        this.showMessage('Chart created successfully.', true);
      } else {
        const chart = this.selectedChart()!;
        const updated = await this.api.adminUpdateChart(chart.id, data);
        this.charts.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
        this.showMessage('Chart updated successfully.', true);
      }
      this.closeModal();
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : 'Save failed.', false);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const chart = this.selectedChart();
    if (!chart) return;
    this.isSaving.set(true);
    try {
      await this.api.adminDeleteChart(chart.id);
      this.charts.update((list) => list.filter((c) => c.id !== chart.id));
      this.total.update((t) => t - 1);
      this.closeModal();
      this.showMessage('Chart deleted.', true);
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : 'Delete failed.', false);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
  }

  private showMessage(msg: string, success: boolean): void {
    this.message.set(msg);
    this.messageIsSuccess.set(success);
  }
}
