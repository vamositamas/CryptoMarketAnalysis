import { Component, LOCALE_ID, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  AuthApiClient,
  ApiClientError,
  type AdminUserRecord,
  type AdminUpdateUserRequest,
} from '@crypto-market-analysis/data-access/api-client';

type ModalMode = 'edit' | 'delete' | 'hard-delete' | 'restore' | 'verify' | 'force-reset' | null;

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <section class="content-section">
      <div class="section-heading">
        <p class="eyebrow" i18n="Admin eyebrow@@admin.common.eyebrow">Admin</p>
        <h2><ng-container i18n="User management title@@adminUsers.title">User Management</ng-container> <span class="badge">{{ total() }}</span></h2>
      </div>

      <div class="admin-toolbar">
        <input
          type="search"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchChange()"
          placeholder="Search by name or email"
          i18n-placeholder="User search placeholder@@adminUsers.searchPlaceholder"
          class="admin-search-input"
        />
        <select [(ngModel)]="roleFilter" (ngModelChange)="loadUsers()" class="admin-filter-select">
          <option value="" i18n="All roles filter@@adminUsers.allRoles">All Roles</option>
          <option value="free_user" i18n="Free user role@@roles.freeUser">Free User</option>
          <option value="premium_user" i18n="Premium user role@@roles.premiumUser">Premium User</option>
          <option value="administrator" i18n="Administrator role@@roles.administrator">Administrator</option>
        </select>
        <label class="admin-checkbox-label">
          <input type="checkbox" [(ngModel)]="showDeleted" (ngModelChange)="loadUsers()" />
          <ng-container i18n="Show deactivated users filter@@adminUsers.showDeleted">Show deactivated</ng-container>
        </label>
      </div>

      @if (message()) {
        <p class="form-message" [class.success]="messageIsSuccess()">{{ message() }}</p>
      }

      @if (isLoading()) {
        <p class="loading-text" i18n="Loading users state@@adminUsers.loading">Loading users...</p>
      } @else {
        <div class="user-card-list">
          <div class="user-card-header">
            <span i18n="User column header@@adminUsers.columns.user">User</span>
            <span i18n="Role column header@@adminUsers.columns.role">Role</span>
            <span i18n="Verified column header@@adminUsers.columns.verified">Verified</span>
            <span i18n="Registered column header@@adminUsers.columns.registered">Registered</span>
            <span i18n="Last login column header@@adminUsers.columns.lastLogin">Last Login</span>
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
                    <ng-container i18n="Verified status@@adminUsers.verified">Verified</ng-container>
                  </span>
                } @else {
                  <span class="verified-icon verified-no">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.5" fill="#fee2e2" stroke="#ef4444"/><path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round"/></svg>
                    <ng-container i18n="Unverified status@@adminUsers.unverified">Unverified</ng-container>
                  </span>
                }
              </div>
              <div class="user-card-date">{{ formatDate(user.createdAt) }}</div>
              <div class="user-card-date">{{ user.lastLoginAt ? formatDate(user.lastLoginAt) : '—' }}</div>
              <div class="user-card-actions">
                @if (user.deletedAt) {
                  <button class="uact-btn uact-restore" (click)="openModal('restore', user)" i18n="Restore user action@@adminUsers.actions.restore">Restore</button>
                  <button class="uact-btn uact-delete" (click)="openModal('hard-delete', user)" i18n="Permanently delete user action@@adminUsers.actions.hardDelete">Delete permanently</button>
                } @else {
                  <button class="uact-btn uact-edit" (click)="openModal('edit', user)" i18n="Edit user action@@adminUsers.actions.edit">Edit</button>
                  @if (!user.emailVerified) {
                    <button class="uact-btn uact-verify" (click)="openModal('verify', user)" i18n="Verify user action@@adminUsers.actions.verify">Verify</button>
                  }
                  <button class="uact-btn uact-reset" (click)="openModal('force-reset', user)" i18n="Reset password action@@adminUsers.actions.resetPassword">Reset PW</button>
                  <button class="uact-btn uact-delete" (click)="openModal('delete', user)" i18n="Deactivate user action@@adminUsers.actions.deactivate">Deactivate</button>
                }
              </div>
            </div>
          } @empty {
            <div class="user-card-empty" i18n="No users found@@adminUsers.empty">No users found.</div>
          }
        </div>

        <div class="pagination">
          <button class="ghost-link" [disabled]="currentPage() <= 1" (click)="goToPage(currentPage() - 1)" i18n="Previous page@@pagination.prev">← Prev</button>
          <span><ng-container i18n="Page label@@pagination.page">Page</ng-container> {{ currentPage() }} <ng-container i18n="Page of label@@pagination.of">of</ng-container> {{ totalPages() }}</span>
          <button class="ghost-link" [disabled]="currentPage() >= totalPages()" (click)="goToPage(currentPage() + 1)" i18n="Next page@@pagination.next">Next →</button>
        </div>
      }
    </section>

    <!-- Edit Modal -->
    @if (modalMode() === 'edit' && selectedUser()) {
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal-panel">
          <button class="modal-close" (click)="closeModal()">✕</button>
          <h3 i18n="Edit user modal title@@adminUsers.edit.title">Edit User</h3>
          <p class="modal-subtitle">{{ selectedUser()!.email }}</p>
          <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="admin-form">
            <label>
              <ng-container i18n="Full name label@@form.fullName">Full Name</ng-container>
              <input type="text" formControlName="fullName" />
            </label>
            <label>
              <ng-container i18n="Role label@@adminUsers.form.role">Role</ng-container>
              <select formControlName="role">
                <option value="free_user" i18n="Free user role@@roles.freeUser">Free User</option>
                <option value="premium_user" i18n="Premium user role@@roles.premiumUser">Premium User</option>
                <option value="administrator" i18n="Administrator role@@roles.administrator">Administrator</option>
              </select>
            </label>
            <label>
              <ng-container i18n="Language form label@@form.language">Language</ng-container>
              <select formControlName="languagePreference">
                <option value="en" i18n="English language option@@language.english">English</option>
                <option value="hu" i18n="Hungarian language option@@language.hungarian">Hungarian</option>
              </select>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" formControlName="emailVerified" /> <ng-container i18n="Email verified label@@adminUsers.form.emailVerified">Email Verified</ng-container>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" formControlName="onboardingCompleted" /> <ng-container i18n="Onboarding completed label@@adminUsers.form.onboardingCompleted">Onboarding Completed</ng-container>
            </label>
            <div class="modal-actions">
              <button type="submit" class="primary-button" [disabled]="isSaving()">
                {{ isSaving() ? savingLabel() : saveChangesLabel() }}
              </button>
              <button type="button" class="ghost-link" (click)="closeModal()" i18n="Cancel button@@common.cancel">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete / Restore / Force Reset Modals -->
    @if ((modalMode() === 'delete' || modalMode() === 'hard-delete' || modalMode() === 'restore' || modalMode() === 'verify' || modalMode() === 'force-reset') && selectedUser()) {
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal-panel modal-panel--confirm">
          <button class="modal-close" (click)="closeModal()">✕</button>
          <h3>{{ confirmTitle() }}</h3>
          <p>{{ confirmMessage() }}</p>
          <div class="modal-actions">
            <button class="primary-button danger" [disabled]="isSaving()" (click)="confirmAction()">
              {{ isSaving() ? processingLabel() : confirmButtonLabel() }}
            </button>
            <button class="ghost-link" (click)="closeModal()" i18n="Cancel button@@common.cancel">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminUsersPageComponent implements OnInit {
  private readonly api = inject(AuthApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly locale = inject(LOCALE_ID);

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
      this.showMessage($localize`:Failed to load users@@adminUsers.messages.loadFailed:Failed to load users.`, false);
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
      this.showMessage($localize`:User updated success@@adminUsers.messages.updated:User updated successfully.`, true);
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : $localize`:Failed to update user@@adminUsers.messages.updateFailed:Failed to update user.`, false);
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
        this.showMessage($localize`:User deactivated success@@adminUsers.messages.deactivated:User deactivated.`, true);
      } else if (mode === 'hard-delete') {
        await this.api.adminHardDeleteUser(user.id);
        this.users.update((list) => list.filter((u) => u.id !== user.id));
        this.total.update((t) => t - 1);
        this.showMessage($localize`:User permanently deleted success@@adminUsers.messages.hardDeleted:User permanently deleted.`, true);
      } else if (mode === 'restore') {
        const restored = await this.api.adminRestoreUser(user.id);
        this.users.update((list) => list.map((u) => (u.id === restored.id ? restored : u)));
        this.showMessage($localize`:User restored success@@adminUsers.messages.restored:User restored.`, true);
      } else if (mode === 'verify') {
        const verified = await this.api.adminVerifyUserEmail(user.id);
        this.users.update((list) => list.map((u) => (u.id === verified.id ? verified : u)));
        this.showMessage($localize`:User verified success@@adminUsers.messages.verified:User verified.`, true);
      } else if (mode === 'force-reset') {
        const result = await this.api.adminForcePasswordReset(user.id);
        this.showMessage(result.message, true);
      }
      this.closeModal();
    } catch (error) {
      this.showMessage(error instanceof ApiClientError ? error.message : $localize`:Admin action failed@@adminUsers.messages.actionFailed:Action failed.`, false);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected confirmTitle(): string {
    const mode = this.modalMode();
    if (mode === 'delete') return $localize`:Deactivate user title@@adminUsers.confirm.deleteTitle:Deactivate User Account?`;
    if (mode === 'hard-delete') return $localize`:Permanently delete user title@@adminUsers.confirm.hardDeleteTitle:Permanently Delete User?`;
    if (mode === 'restore') return $localize`:Restore user title@@adminUsers.confirm.restoreTitle:Restore User Account?`;
    if (mode === 'verify') return $localize`:Verify user title@@adminUsers.confirm.verifyTitle:Verify User Email?`;
    return $localize`:Force password reset title@@adminUsers.confirm.forceResetTitle:Force Password Reset?`;
  }

  protected confirmMessage(): string {
    const user = this.selectedUser();
    const name = user?.fullName ?? user?.email ?? $localize`:This user fallback@@adminUsers.confirm.thisUser:this user`;
    const mode = this.modalMode();
    if (mode === 'delete') return $localize`:Deactivate user message@@adminUsers.confirm.deleteMessage:This will deactivate ${name}'s account and invalidate their sessions. The account can be restored later.`;
    if (mode === 'hard-delete') return $localize`:Permanently delete user message@@adminUsers.confirm.hardDeleteMessage:This will physically delete ${name}'s deactivated account from the database. This cannot be undone.`;
    if (mode === 'restore') return $localize`:Restore user message@@adminUsers.confirm.restoreMessage:This will restore ${name}'s account and allow them to log in again.`;
    if (mode === 'verify') return $localize`:Verify user message@@adminUsers.confirm.verifyMessage:This will manually mark ${name}'s email address as verified and allow them to log in.`;
    return $localize`:Force password reset message@@adminUsers.confirm.forceResetMessage:A password reset email will be sent to ${user?.email}. Their current sessions will be invalidated.`;
  }

  protected confirmButtonLabel(): string {
    const mode = this.modalMode();
    if (mode === 'delete') return $localize`:Deactivate account button@@adminUsers.confirm.deactivateButton:Deactivate Account`;
    if (mode === 'hard-delete') return $localize`:Permanently delete account button@@adminUsers.confirm.hardDeleteButton:Delete Permanently`;
    if (mode === 'restore') return $localize`:Restore account button@@adminUsers.confirm.restoreButton:Restore Account`;
    if (mode === 'verify') return $localize`:Verify email button@@adminUsers.confirm.verifyButton:Verify Email`;
    return $localize`:Send reset email button@@adminUsers.confirm.sendResetButton:Send Reset Email`;
  }

  protected savingLabel(): string {
    return $localize`:Saving state@@common.saving:Saving...`;
  }

  protected saveChangesLabel(): string {
    return $localize`:Save changes button@@common.saveChanges:Save Changes`;
  }

  protected processingLabel(): string {
    return $localize`:Processing state@@common.processing:Processing...`;
  }

  protected avatarInitials(user: AdminUserRecord): string {
    if (user.fullName) {
      return user.fullName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
    }
    return user.email[0].toUpperCase();
  }

  protected roleLabel(role: string): string {
    if (role === 'administrator') return $localize`:Admin role short@@roles.adminShort:Admin`;
    if (role === 'premium_user') return $localize`:Premium role short@@roles.premiumShort:Premium`;
    return $localize`:Free role short@@roles.freeShort:Free`;
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(this.locale, { dateStyle: 'medium', timeZone: 'UTC' });
  }

  private showMessage(msg: string, success: boolean): void {
    this.message.set(msg);
    this.messageIsSuccess.set(success);
  }
}
