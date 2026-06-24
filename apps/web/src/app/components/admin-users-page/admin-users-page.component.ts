import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  AuthApiClient,
  ApiClientError,
  type AdminUserRecord,
  type AdminUpdateUserRequest,
} from '@crypto-market-analysis/data-access/api-client';

type ModalMode = 'edit' | 'delete' | 'restore' | 'force-reset' | null;

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <section class="content-section">
      <div class="section-heading">
        <p class="eyebrow">Admin</p>
        <h2>User Management <span class="badge">{{ total() }}</span></h2>
      </div>

      <div class="admin-toolbar">
        <input
          type="search"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchChange()"
          placeholder="Search by name or email"
          class="admin-search-input"
        />
        <select [(ngModel)]="roleFilter" (ngModelChange)="loadUsers()" class="admin-filter-select">
          <option value="">All Roles</option>
          <option value="free_user">Free User</option>
          <option value="premium_user">Premium User</option>
          <option value="administrator">Administrator</option>
        </select>
        <label class="admin-checkbox-label">
          <input type="checkbox" [(ngModel)]="showDeleted" (ngModelChange)="loadUsers()" />
          Show deleted
        </label>
      </div>

      @if (message()) {
        <p class="form-message" [class.success]="messageIsSuccess()">{{ message() }}</p>
      }

      @if (isLoading()) {
        <p class="loading-text">Loading users…</p>
      } @else {
        <div class="user-card-list">
          <div class="user-card-header">
            <span>User</span>
            <span>Role</span>
            <span>Verified</span>
            <span>Registered</span>
            <span>Last Login</span>
            <span></span>
          </div>

          @for (user of users(); track user.id) {
            <div class="user-card" [class.user-card--deleted]="user.deletedAt">
              <div class="user-card-identity">
                <div class="user-avatar" [attr.data-role]="user.role">{{ avatarInitials(user) }}</div>
                <div class="user-card-info">
                  <span class="user-card-name">{{ user.fullName ?? '—' }}</span>
                  <span class="user-card-email">{{ user.email }}</span>
                </div>
              </div>
              <div class="user-card-role">
                <span class="role-badge role-{{ user.role }}">{{ roleLabel(user.role) }}</span>
              </div>
              <div class="user-card-verified">
                @if (user.emailVerified) {
                  <span class="verified-icon verified-yes">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" fill="#dcfce7" stroke="#22c55e"/><path d="M4 7l2 2 4-4" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Verified
                  </span>
                } @else {
                  <span class="verified-icon verified-no">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" fill="#fee2e2" stroke="#ef4444"/><path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round"/></svg>
                    Unverified
                  </span>
                }
              </div>
              <div class="user-card-date">{{ formatDate(user.createdAt) }}</div>
              <div class="user-card-date">{{ user.lastLoginAt ? formatDate(user.lastLoginAt) : '—' }}</div>
              <div class="user-card-actions">
                @if (user.deletedAt) {
                  <button class="uact-btn uact-restore" (click)="openModal('restore', user)">Restore</button>
                } @else {
                  <button class="uact-btn uact-edit" (click)="openModal('edit', user)">Edit</button>
                  <button class="uact-btn uact-reset" (click)="openModal('force-reset', user)">Reset PW</button>
                  <button class="uact-btn uact-delete" (click)="openModal('delete', user)">Delete</button>
                }
              </div>
            </div>
          } @empty {
            <div class="user-card-empty">No users found.</div>
          }
        </div>

        <div class="pagination">
          <button class="ghost-link" [disabled]="currentPage() <= 1" (click)="goToPage(currentPage() - 1)">← Prev</button>
          <span>Page {{ currentPage() }} of {{ totalPages() }}</span>
          <button class="ghost-link" [disabled]="currentPage() >= totalPages()" (click)="goToPage(currentPage() + 1)">Next →</button>
        </div>
      }
    </section>

    <!-- Edit Modal -->
    @if (modalMode() === 'edit' && selectedUser()) {
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal-panel">
          <button class="modal-close" (click)="closeModal()">✕</button>
          <h3>Edit User</h3>
          <p class="modal-subtitle">{{ selectedUser()!.email }}</p>
          <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="admin-form">
            <label>
              Full Name
              <input type="text" formControlName="fullName" />
            </label>
            <label>
              Role
              <select formControlName="role">
                <option value="free_user">Free User</option>
                <option value="premium_user">Premium User</option>
                <option value="administrator">Administrator</option>
              </select>
            </label>
            <label>
              Language
              <select formControlName="languagePreference">
                <option value="en">English</option>
                <option value="hu">Hungarian</option>
              </select>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" formControlName="emailVerified" /> Email Verified
            </label>
            <label class="checkbox-label">
              <input type="checkbox" formControlName="onboardingCompleted" /> Onboarding Completed
            </label>
            <div class="modal-actions">
              <button type="submit" class="primary-button" [disabled]="isSaving()">
                {{ isSaving() ? 'Saving…' : 'Save Changes' }}
              </button>
              <button type="button" class="ghost-link" (click)="closeModal()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete / Restore / Force Reset Modals -->
    @if ((modalMode() === 'delete' || modalMode() === 'restore' || modalMode() === 'force-reset') && selectedUser()) {
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal-panel modal-panel--confirm">
          <button class="modal-close" (click)="closeModal()">✕</button>
          <h3>{{ confirmTitle() }}</h3>
          <p>{{ confirmMessage() }}</p>
          <div class="modal-actions">
            <button class="primary-button danger" [disabled]="isSaving()" (click)="confirmAction()">
              {{ isSaving() ? 'Processing…' : confirmButtonLabel() }}
            </button>
            <button class="ghost-link" (click)="closeModal()">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminUsersPageComponent implements OnInit {
  private readonly api = inject(AuthApiClient);
  private readonly fb = inject(FormBuilder);

  protected readonly users = signal<AdminUserRecord[]>([]);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly message = signal('');
  protected readonly messageIsSuccess = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalMode = signal<ModalMode>(null);
  protected readonly selectedUser = signal<AdminUserRecord | null>(null);

  protected searchQuery = '';
  protected roleFilter = '';
  protected showDeleted = false;

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / 50)));

  protected readonly editForm = this.fb.nonNullable.group({
    fullName: [''],
    role: ['free_user' as 'administrator' | 'premium_user' | 'free_user', Validators.required],
    languagePreference: ['en' as 'en' | 'hu', Validators.required],
    emailVerified: [false],
    onboardingCompleted: [false],
  });

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.loadUsers();
  }

  protected async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await this.api.adminListUsers({
        page: this.currentPage(),
        limit: 50,
        search: this.searchQuery || undefined,
        role: this.roleFilter || undefined,
        show: this.showDeleted ? 'deleted' : undefined,
      });
      this.users.set(result.users);
      this.total.set(result.total);
    } catch {
      this.showMessage('Failed to load users.', false);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected onSearchChange(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => { void this.loadUsers(); }, 300);
  }

  protected goToPage(page: number): void {
    this.currentPage.set(page);
    void this.loadUsers();
  }

  protected openModal(mode: ModalMode, user: AdminUserRecord): void {
    this.selectedUser.set(user);
    this.modalMode.set(mode);
    this.message.set('');

    if (mode === 'edit') {
      this.editForm.setValue({
        fullName: user.fullName ?? '',
        role: user.role,
        languagePreference: user.languagePreference,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
      });
    }
  }

  protected closeModal(): void {
    this.modalMode.set(null);
    this.selectedUser.set(null);
  }

  protected async saveEdit(): Promise<void> {
    const user = this.selectedUser();
    if (!user || this.editForm.invalid) return;

    this.isSaving.set(true);
    const v = this.editForm.getRawValue();
    const params: AdminUpdateUserRequest = {
      fullName: v.fullName || null,
      role: v.role,
      languagePreference: v.languagePreference,
      emailVerified: v.emailVerified,
      onboardingCompleted: v.onboardingCompleted,
    };

    try {
      const updated = await this.api.adminUpdateUser(user.id, params);
      this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      this.closeModal();
      this.showMessage('User updated successfully.', true);
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : 'Failed to update user.', false);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async confirmAction(): Promise<void> {
    const user = this.selectedUser();
    const mode = this.modalMode();
    if (!user || !mode) return;

    this.isSaving.set(true);
    try {
      if (mode === 'delete') {
        await this.api.adminDeleteUser(user.id);
        this.users.update((list) => list.filter((u) => u.id !== user.id));
        this.total.update((t) => t - 1);
        this.showMessage('User deactivated.', true);
      } else if (mode === 'restore') {
        const restored = await this.api.adminRestoreUser(user.id);
        this.users.update((list) => list.map((u) => (u.id === restored.id ? restored : u)));
        this.showMessage('User restored.', true);
      } else if (mode === 'force-reset') {
        const result = await this.api.adminForcePasswordReset(user.id);
        this.showMessage(result.message, true);
      }
      this.closeModal();
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : 'Action failed.', false);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected confirmTitle(): string {
    const mode = this.modalMode();
    if (mode === 'delete') return 'Deactivate User Account?';
    if (mode === 'restore') return 'Restore User Account?';
    return 'Force Password Reset?';
  }

  protected confirmMessage(): string {
    const user = this.selectedUser();
    const name = user?.fullName ?? user?.email ?? 'this user';
    const mode = this.modalMode();
    if (mode === 'delete') return `This will deactivate ${name}'s account and invalidate their sessions. The account can be restored later.`;
    if (mode === 'restore') return `This will restore ${name}'s account and allow them to log in again.`;
    return `A password reset email will be sent to ${user?.email}. Their current sessions will be invalidated.`;
  }

  protected confirmButtonLabel(): string {
    const mode = this.modalMode();
    if (mode === 'delete') return 'Deactivate Account';
    if (mode === 'restore') return 'Restore Account';
    return 'Send Reset Email';
  }

  protected avatarInitials(user: AdminUserRecord): string {
    if (user.fullName) {
      return user.fullName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
    }
    return user.email[0].toUpperCase();
  }

  protected roleLabel(role: string): string {
    if (role === 'administrator') return 'Admin';
    if (role === 'premium_user') return 'Premium';
    return 'Free';
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
  }

  private showMessage(msg: string, success: boolean): void {
    this.message.set(msg);
    this.messageIsSuccess.set(success);
  }
}
