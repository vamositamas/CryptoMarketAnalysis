import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import {
  ApiClientError,
  AuthApiClient,
  type SupportAttachmentInput,
  type SupportTicket,
  type SupportTicketDetail,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '@crypto-market-analysis/data-access/api-client';
import { AuthSessionService } from '../../services/auth-session.service';

@Component({
  selector: 'app-support-tickets-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  styles: [`
    .support-shell {
      display: grid;
      grid-template-columns: minmax(280px, 380px) 1fr;
      gap: 18px;
      align-items: start;
    }

    .support-page-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
    }

    .support-panel,
    .ticket-chat,
    .create-ticket-dialog {
      border: 1px solid #dbe5dd;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.76);
      box-shadow: 0 8px 24px rgba(18, 39, 30, 0.06);
    }

    .support-panel {
      overflow: hidden;
    }

    .support-panel__header,
    .ticket-chat__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid #e5eee7;
    }

    .support-panel__header h3,
    .ticket-chat__header h3 {
      margin: 0;
      font-size: 1rem;
    }

    .ticket-filters {
      display: grid;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid #e5eee7;
      background: #fbfdfb;
    }

    .ticket-filters label {
      gap: 4px;
      font-size: 0.78rem;
      text-transform: uppercase;
    }

    .ticket-chat__title {
      min-width: 0;
    }

    .ticket-chat__status {
      display: grid;
      justify-items: end;
      gap: 6px;
    }

    .ticket-chat__status-label {
      color: #66756f;
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .status-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid #e5eee7;
      background: #f8fbf8;
    }

    .status-actions__label {
      color: #31413a;
      font-size: 0.86rem;
      font-weight: 800;
    }

    .status-action-btn {
      min-height: 34px;
      padding: 0 10px;
      border: 1px solid #cad9d1;
      border-radius: 6px;
      background: #ffffff;
      color: #2f3d37;
      cursor: pointer;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 800;
    }

    .status-action-btn.active {
      border-color: #176044;
      background: #e7f4ec;
      color: #176044;
    }

    .status-action-btn.close {
      border-color: #efcaca;
      color: #9b1c1c;
    }

    .status-action-btn.close.active,
    .status-action-btn.close:hover {
      background: #fff1f1;
    }

    .ticket-list {
      display: grid;
      max-height: calc(100vh - 220px);
      overflow: auto;
    }

    .ticket-row {
      display: grid;
      gap: 6px;
      padding: 14px 16px;
      border: 0;
      border-bottom: 1px solid #edf3ee;
      border-radius: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;
    }

    .ticket-row:hover,
    .ticket-row.active {
      background: #f4faf6;
    }

    .ticket-row strong,
    .message-bubble strong {
      color: #17202a;
    }

    .ticket-meta,
    .message-meta,
    .attachment-link {
      color: #66756f;
      font-size: 0.82rem;
    }

    .status-pill,
    .priority-pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      font-size: 0.74rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .status-pill {
      background: #e7f4ec;
      color: #176044;
    }

    .status-pill.closed {
      background: #eef0f2;
      color: #59636b;
    }

    .ticket-row.closed {
      background: #f4f5f5;
    }

    .ticket-row.closed:hover,
    .ticket-row.closed.active {
      background: #ebeeee;
    }

    .priority-pill {
      background: #fff5d6;
      color: #815b00;
    }

    .ticket-chat {
      display: grid;
      grid-template-rows: auto auto minmax(140px, auto) auto;
    }

    .ticket-chat__messages {
      display: grid;
      align-content: start;
      gap: 14px;
      padding: 18px;
      max-height: min(460px, calc(100vh - 360px));
      overflow: auto;
    }

    .message-bubble {
      width: min(680px, 88%);
      padding: 12px 14px;
      border: 1px solid #dce7df;
      border-radius: 8px;
      background: #ffffff;
      white-space: pre-wrap;
    }

    .message-bubble.admin {
      justify-self: end;
      background: #eef8f1;
      border-color: #c9e4d1;
    }

    .message-body {
      margin: 8px 0 0;
      line-height: 1.5;
    }

    .reply-form,
    .create-ticket-form {
      display: grid;
      gap: 12px;
      padding: 16px;
      border-top: 1px solid #e5eee7;
    }

    .create-ticket-form {
      border-top: 0;
    }

    .dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(15, 31, 24, 0.42);
    }

    .create-ticket-dialog {
      width: min(760px, 100%);
      max-height: min(760px, calc(100vh - 48px));
      overflow: auto;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px;
      border-bottom: 1px solid #e5eee7;
    }

    .dialog-header h3 {
      margin: 0;
      font-size: 1.1rem;
    }

    .dialog-close {
      width: 36px;
      min-height: 36px;
      padding: 0;
      border: 1px solid #d6e2db;
      border-radius: 6px;
      background: #f8fbf8;
      cursor: pointer;
    }

    .dialog-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 170px;
      gap: 12px;
    }

    label {
      display: grid;
      gap: 6px;
      font-weight: 700;
      color: #2f3d37;
    }

    input,
    select,
    textarea {
      width: 100%;
      border: 1px solid #ccd9d2;
      border-radius: 6px;
      background: #ffffff;
      color: #17202a;
      font: inherit;
      padding: 10px 12px;
    }

    textarea {
      min-height: 110px;
      resize: vertical;
    }

    .attachment-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .attachment-link {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 0 10px;
      border: 1px solid #dce7df;
      border-radius: 6px;
      background: #f8fbf8;
      text-decoration: none;
    }

    .empty-state {
      display: grid;
      place-items: center;
      min-height: 360px;
      color: #66756f;
      text-align: center;
    }

    .form-message {
      margin: 0 0 16px;
      padding: 10px 12px;
      border: 1px solid #f3c4c4;
      border-radius: 6px;
      background: #fff4f4;
      color: #8a1616;
      font-weight: 700;
    }

    .form-message.success {
      border-color: #bfe3cb;
      background: #edf9f1;
      color: #0f5a37;
    }

    @media (max-width: 920px) {
      .support-shell,
      .form-grid,
      .support-page-heading {
        grid-template-columns: 1fr;
      }

      .support-page-heading {
        align-items: stretch;
      }

      .ticket-list {
        max-height: 360px;
      }
    }
  `],
  template: `
    <section class="content-section--wide">
      <div class="section-heading support-page-heading">
        <div>
          <p class="eyebrow" i18n="Support eyebrow@@support.eyebrow">Support</p>
          <h2 i18n="Support title@@support.title">Support Tickets</h2>
        </div>
        <button type="button" class="primary-link" (click)="openCreateDialog()" i18n="Open create support ticket dialog@@support.openCreate">
          Create incident
        </button>
      </div>

      @if (message()) {
        <p class="form-message" [class.success]="messageIsSuccess()">{{ message() }}</p>
      }

      <div class="support-shell">
        <aside class="support-panel">
          <div class="support-panel__header">
            <h3 i18n="Support incidents heading@@support.incidents">Incidents</h3>
            <span class="status-pill">{{ filteredTickets().length }}</span>
          </div>
          <div class="ticket-filters">
            <label>
              <ng-container i18n="Incident text search label@@support.textSearch">Search</ng-container>
              <input
                type="search"
                [ngModel]="ticketSearch()"
                (ngModelChange)="ticketSearch.set($event)"
                placeholder="Subject, description, ticket number"
                i18n-placeholder="Incident search placeholder@@support.searchPlaceholder"
              />
            </label>
            <label>
              <ng-container i18n="Incident status filter label@@support.statusFilter">Filter</ng-container>
              <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
                <option value="all" i18n="All ticket statuses filter@@support.filter.all">All tickets</option>
                <option value="active" i18n="Active ticket statuses filter@@support.filter.active">Active tickets</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="waiting_for_user">Waiting for user</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>
          <div class="ticket-list">
            @if (isLoading()) {
              <div class="empty-state" i18n="Support loading@@support.loading">Loading tickets...</div>
            } @else {
              @for (ticket of filteredTickets(); track ticket.id) {
                <button type="button" class="ticket-row" [class.active]="selectedTicket()?.id === ticket.id" [class.closed]="ticket.status === 'closed'" (click)="selectTicket(ticket.id)">
                  <strong>{{ ticket.subject }}</strong>
                  <span class="ticket-meta">{{ ticket.ticketNumber }} · {{ formatDate(ticket.updatedAt) }}</span>
                  <span>
                    <span class="status-pill" [class.closed]="ticket.status === 'closed'">{{ statusLabel(ticket.status) }}</span>
                    <span class="priority-pill">{{ ticket.priority }}</span>
                  </span>
                </button>
              } @empty {
                <div class="empty-state" i18n="Support empty tickets@@support.empty">No support tickets yet.</div>
              }
            }
          </div>
        </aside>

        <article class="ticket-chat">
          @if (selectedTicket(); as ticket) {
            <div class="ticket-chat__header">
              <div class="ticket-chat__title">
                <h3>{{ ticket.subject }}</h3>
                <span class="ticket-meta">{{ ticket.ticketNumber }} · {{ ticket.creatorEmail }}</span>
              </div>
              <div class="ticket-chat__status">
                <span class="ticket-chat__status-label" i18n="Ticket status label@@support.ticketStatus">Status</span>
                <span class="status-pill" [class.closed]="ticket.status === 'closed'">{{ statusLabel(ticket.status) }}</span>
              </div>
            </div>
            @if (isAdmin()) {
              <div class="status-actions" aria-label="Ticket status actions">
                <span class="status-actions__label" i18n="Change ticket status label@@support.changeStatus">Change status</span>
                <button type="button" class="status-action-btn" [class.active]="ticket.status === 'open'" [disabled]="isSaving()" (click)="changeStatus('open')">Open</button>
                <button type="button" class="status-action-btn" [class.active]="ticket.status === 'in_progress'" [disabled]="isSaving()" (click)="changeStatus('in_progress')">In progress</button>
                <button type="button" class="status-action-btn" [class.active]="ticket.status === 'waiting_for_user'" [disabled]="isSaving()" (click)="changeStatus('waiting_for_user')">Waiting for user</button>
                <button type="button" class="status-action-btn" [class.active]="ticket.status === 'resolved'" [disabled]="isSaving()" (click)="changeStatus('resolved')">Resolved</button>
                <button type="button" class="status-action-btn close" [class.active]="ticket.status === 'closed'" [disabled]="isSaving()" (click)="changeStatus('closed')" i18n="Close ticket button@@support.closeTicket">Close ticket</button>
              </div>
            }
            <div class="ticket-chat__messages">
              @for (message of ticket.messages; track message.id) {
                <div class="message-bubble" [class.admin]="message.isAdminReply">
                  <div class="message-meta">
                    <strong>{{ message.authorName || message.authorEmail }}</strong>
                    · {{ formatDate(message.createdAt) }}
                  </div>
                  <p class="message-body">{{ message.body }}</p>
                  @if (message.attachments.length) {
                    <div class="attachment-list">
                      @for (attachment of message.attachments; track attachment.id) {
                        <a class="attachment-link" [href]="attachmentUrl(attachment.id)" target="_blank" rel="noopener">
                          {{ attachment.fileName }}
                        </a>
                      }
                    </div>
                  }
                </div>
              }
            </div>
            <form [formGroup]="replyForm" (ngSubmit)="sendReply()" class="reply-form">
              @if (ticket.status === 'closed' && !isAdmin()) {
                <p class="ticket-meta" i18n="Closed ticket reply disabled@@support.closedReplyDisabled">This ticket is closed. An administrator can reopen it if more work is needed.</p>
              }
              <label>
                <ng-container i18n="Support reply label@@support.reply">Answer</ng-container>
                <textarea formControlName="body" maxlength="5000" [disabled]="ticket.status === 'closed' && !isAdmin()"></textarea>
              </label>
              <label>
                <ng-container i18n="Support reply screenshot label@@support.replyScreenshot">Attach screenshot</ng-container>
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple [disabled]="ticket.status === 'closed' && !isAdmin()" (change)="onReplyFilesSelected($event)" />
              </label>
              @if (replyAttachments().length) {
                <div class="attachment-list">
                  @for (file of replyAttachments(); track file.fileName) {
                    <span class="attachment-link">{{ file.fileName }}</span>
                  }
                </div>
              }
              <div>
                <button type="submit" class="primary-link" [disabled]="replyForm.invalid || isSaving() || (ticket.status === 'closed' && !isAdmin())">
                  {{ isSaving() ? sendingLabel() : sendLabel() }}
                </button>
              </div>
            </form>
          } @else {
            <div class="empty-state" i18n="Support select empty@@support.select">Select a ticket to see the conversation.</div>
          }
        </article>
      </div>

      @if (createDialogOpen()) {
        <div class="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-ticket-title" (click)="closeCreateDialog()">
          <div class="create-ticket-dialog" (click)="$event.stopPropagation()">
            <div class="dialog-header">
              <h3 id="create-ticket-title" i18n="Create support ticket dialog title@@support.createDialogTitle">Create incident</h3>
              <button type="button" class="dialog-close" (click)="closeCreateDialog()" aria-label="Close" i18n-aria-label="Close dialog@@common.close">x</button>
            </div>
            <form [formGroup]="createForm" (ngSubmit)="createTicket()" class="create-ticket-form">
              <div class="form-grid">
                <label>
                  <ng-container i18n="Support subject label@@support.subject">Subject</ng-container>
                  <input type="text" formControlName="subject" maxlength="180" />
                </label>
                <label>
                  <ng-container i18n="Support priority label@@support.priority">Priority</ng-container>
                  <select formControlName="priority">
                    <option value="low" i18n="Support priority low@@support.priority.low">Low</option>
                    <option value="normal" i18n="Support priority normal@@support.priority.normal">Normal</option>
                    <option value="high" i18n="Support priority high@@support.priority.high">High</option>
                    <option value="urgent" i18n="Support priority urgent@@support.priority.urgent">Urgent</option>
                  </select>
                </label>
              </div>
              <label>
                <ng-container i18n="Support description label@@support.description">Incident description</ng-container>
                <textarea formControlName="description" maxlength="5000"></textarea>
              </label>
              <label>
                <ng-container i18n="Support screenshot label@@support.screenshot">Screenshot</ng-container>
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple (change)="onFilesSelected($event)" />
              </label>
              @if (pendingAttachments().length) {
                <div class="attachment-list">
                  @for (file of pendingAttachments(); track file.fileName) {
                    <span class="attachment-link">{{ file.fileName }}</span>
                  }
                </div>
              }
              <div class="dialog-actions">
                <button type="submit" class="primary-link" [disabled]="createForm.invalid || isSaving()">
                  {{ isSaving() ? savingLabel() : createLabel() }}
                </button>
                <button type="button" class="ghost-link" (click)="closeCreateDialog()" i18n="Cancel button@@common.cancel">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      }
    </section>
  `,
})
export class SupportTicketsPageComponent implements OnInit {
  private readonly api = inject(AuthApiClient);
  private readonly authSession = inject(AuthSessionService);
  private readonly fb = inject(FormBuilder);

  protected readonly tickets = signal<SupportTicket[]>([]);
  protected readonly selectedTicket = signal<SupportTicketDetail | null>(null);
  protected readonly pendingAttachments = signal<SupportAttachmentInput[]>([]);
  protected readonly replyAttachments = signal<SupportAttachmentInput[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly message = signal('');
  protected readonly messageIsSuccess = signal(false);
  protected readonly createDialogOpen = signal(false);
  protected readonly statusFilter = signal<SupportTicketStatus | 'active' | 'all'>('active');
  protected readonly ticketSearch = signal('');
  protected readonly isAdmin = computed(() => this.authSession.currentUser()?.role === 'administrator');
  protected readonly filteredTickets = computed(() => {
    const filter = this.statusFilter();
    const search = this.ticketSearch().trim().toLowerCase();
    const statusFilteredTickets = filter === 'all'
      ? this.tickets()
      : filter === 'active'
        ? this.tickets().filter((ticket) => ticket.status !== 'closed')
        : this.tickets().filter((ticket) => ticket.status === filter);

    if (!search) return statusFilteredTickets;

    return statusFilteredTickets.filter((ticket) => [
      ticket.ticketNumber,
      ticket.subject,
      ticket.description,
      ticket.creatorEmail,
      ticket.creatorName ?? '',
      ticket.priority,
      this.statusLabel(ticket.status),
    ].some((value) => value.toLowerCase().includes(search)));
  });

  protected readonly createForm = this.fb.nonNullable.group({
    subject: ['', [Validators.required, Validators.maxLength(180)]],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    priority: ['normal' as SupportTicketPriority, Validators.required],
  });

  protected readonly replyForm = this.fb.nonNullable.group({
    body: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  ngOnInit(): void {
    void this.loadTickets();
  }

  protected async loadTickets(): Promise<void> {
    this.isLoading.set(true);
    try {
      const response = await this.api.getSupportTickets();
      this.tickets.set(response.tickets);
      if (!this.selectedTicket()) {
        const firstVisibleTicket = this.filteredTickets()[0] ?? response.tickets[0];
        if (firstVisibleTicket) {
          await this.selectTicket(firstVisibleTicket.id);
        }
      }
    } catch (error) {
      this.showError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async createTicket(): Promise<void> {
    if (this.createForm.invalid || this.isSaving()) return;
    this.isSaving.set(true);
    try {
      const ticket = await this.api.createSupportTicket({
        ...this.createForm.getRawValue(),
        attachments: this.pendingAttachments(),
      });
      this.createForm.reset({ subject: '', description: '', priority: 'normal' });
      this.pendingAttachments.set([]);
      this.selectedTicket.set(ticket);
      await this.loadTickets();
      this.createDialogOpen.set(false);
      this.messageIsSuccess.set(true);
      this.message.set($localize`:Support ticket created@@support.created:Support ticket created.`);
    } catch (error) {
      this.showError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async selectTicket(ticketId: string): Promise<void> {
    try {
      this.selectedTicket.set(await this.api.getSupportTicket(ticketId));
      this.replyForm.reset({ body: '' });
      this.replyAttachments.set([]);
    } catch (error) {
      this.showError(error);
    }
  }

  protected async sendReply(): Promise<void> {
    const ticket = this.selectedTicket();
    if (!ticket || this.replyForm.invalid || this.isSaving()) return;
    this.isSaving.set(true);
    try {
      const updated = await this.api.addSupportTicketReply(ticket.id, {
        body: this.replyForm.getRawValue().body,
        attachments: this.replyAttachments(),
      });
      this.selectedTicket.set(updated);
      this.replyForm.reset({ body: '' });
      this.replyAttachments.set([]);
      await this.loadTickets();
    } catch (error) {
      this.showError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async changeStatus(status: SupportTicketStatus): Promise<void> {
    const ticket = this.selectedTicket();
    if (!ticket || this.isSaving()) return;
    this.isSaving.set(true);
    try {
      this.selectedTicket.set(await this.api.updateSupportTicketStatus(ticket.id, status));
      await this.loadTickets();
    } catch (error) {
      this.showError(error);
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async onFilesSelected(event: Event): Promise<void> {
    this.pendingAttachments.set(await readFiles(event));
  }

  protected openCreateDialog(): void {
    this.message.set('');
    this.messageIsSuccess.set(false);
    this.createDialogOpen.set(true);
  }

  protected closeCreateDialog(): void {
    if (this.isSaving()) return;
    this.createDialogOpen.set(false);
  }

  protected async onReplyFilesSelected(event: Event): Promise<void> {
    this.replyAttachments.set(await readFiles(event));
  }

  protected attachmentUrl(attachmentId: string): string {
    return this.api.supportAttachmentUrl(attachmentId);
  }

  protected statusLabel(status: SupportTicketStatus): string {
    return status.replace(/_/g, ' ');
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  protected createLabel(): string { return $localize`:Create support ticket@@support.create:Create incident`; }
  protected savingLabel(): string { return $localize`:Saving label@@common.saving:Saving...`; }
  protected sendingLabel(): string { return $localize`:Sending label@@common.sending:Sending...`; }
  protected sendLabel(): string { return $localize`:Send answer@@support.send:Send answer`; }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeCreateDialog();
  }

  private showError(error: unknown): void {
    this.messageIsSuccess.set(false);
    this.message.set(error instanceof ApiClientError ? error.message : $localize`:Support generic error@@support.error:Something went wrong. Please try again.`);
  }
}

async function readFiles(event: Event): Promise<SupportAttachmentInput[]> {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []).slice(0, 3);
  const attachments = await Promise.all(files.map(readFile));
  input.value = '';
  return attachments;
}

function readFile(file: File): Promise<SupportAttachmentInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve({
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
        contentBase64: result.includes(',') ? result.split(',')[1] : result,
      });
    };
    reader.readAsDataURL(file);
  });
}
