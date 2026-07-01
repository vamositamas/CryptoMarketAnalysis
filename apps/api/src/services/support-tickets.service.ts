import { getDatabasePool } from '../config/database.config';
import {
  SupportTicketsRepository,
  type CreateSupportAttachmentInput,
  type SupportTicketDetail,
  type SupportTicketPriority,
  type SupportTicketRecord,
  type SupportTicketStatus,
} from '../repositories/support-tickets.repository';
import { sendRawEmail } from './email.service';

export class SupportTicketsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

const VALID_STATUSES: SupportTicketStatus[] = ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'];
const VALID_PRIORITIES: SupportTicketPriority[] = ['low', 'normal', 'high', 'urgent'];
const VALID_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export interface SupportAttachmentInput {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  contentBase64: string;
}

interface SupportTicketsStore {
  createTicket(input: {
    creatorUserId: string;
    subject: string;
    description: string;
    priority: SupportTicketPriority;
  }): Promise<SupportTicketRecord>;
  createMessage(input: {
    ticketId: string;
    authorUserId: string;
    body: string;
    isAdminReply: boolean;
  }): Promise<{ id: string }>;
  createAttachment(input: CreateSupportAttachmentInput): Promise<unknown>;
  listTickets(userId: string, isAdmin: boolean): Promise<SupportTicketRecord[]>;
  getTicket(ticketId: string, userId: string, isAdmin: boolean): Promise<SupportTicketDetail | null>;
  updateStatus(ticketId: string, status: SupportTicketStatus): Promise<SupportTicketRecord | null>;
  listAdministrators(): Promise<{ email: string; fullName: string | null; languagePreference: 'en' | 'hu' }[]>;
  getAttachment(attachmentId: string, userId: string, isAdmin: boolean): Promise<{
    fileName: string;
    contentType: string;
    contentBase64: string;
  } | null>;
}

export class SupportTicketsService {
  constructor(
    private readonly repository: SupportTicketsStore = new SupportTicketsRepository(getDatabasePool()),
  ) {}

  async createTicket(userId: string, body: unknown): Promise<SupportTicketDetail> {
    const input = parseTicketBody(body);
    const ticket = await this.repository.createTicket({
      creatorUserId: userId,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
    });
    const message = await this.repository.createMessage({
      ticketId: ticket.id,
      authorUserId: userId,
      body: input.description,
      isAdminReply: false,
    });

    await this.saveAttachments(ticket.id, message.id, userId, input.attachments);
    const detail = await this.requireTicket(ticket.id, userId, false);
    await this.notifyTicketCreated(detail);
    return detail;
  }

  async listTickets(userId: string, userRole: string): Promise<{ tickets: SupportTicketRecord[] }> {
    return { tickets: await this.repository.listTickets(userId, userRole === 'administrator') };
  }

  async getTicket(ticketId: string, userId: string, userRole: string): Promise<SupportTicketDetail> {
    return this.requireTicket(ticketId, userId, userRole === 'administrator');
  }

  async addReply(ticketId: string, userId: string, userRole: string, body: unknown): Promise<SupportTicketDetail> {
    const ticket = await this.requireTicket(ticketId, userId, userRole === 'administrator');
    if (ticket.status === 'closed' && userRole !== 'administrator') {
      throw new SupportTicketsError('This ticket is closed. Only an administrator can reopen it.', 403);
    }
    const reply = parseReplyBody(body);
    const isAdminReply = userRole === 'administrator';
    const message = await this.repository.createMessage({
      ticketId: ticket.id,
      authorUserId: userId,
      body: reply.body,
      isAdminReply,
    });
    await this.saveAttachments(ticket.id, message.id, userId, reply.attachments);
    const updated = await this.requireTicket(ticketId, userId, userRole === 'administrator');
    await this.notifyReply(updated, isAdminReply);
    return updated;
  }

  async updateStatus(ticketId: string, userId: string, userRole: string, body: unknown): Promise<SupportTicketDetail> {
    if (userRole !== 'administrator') throw new SupportTicketsError('Only administrators can change ticket status', 403);
    if (typeof body !== 'object' || body === null) throw new SupportTicketsError('Request body is required', 400);
    const status = (body as Record<string, unknown>)['status'];
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status as SupportTicketStatus)) {
      throw new SupportTicketsError(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }
    const ticket = await this.repository.updateStatus(ticketId, status as SupportTicketStatus);
    if (!ticket) throw new SupportTicketsError('Ticket not found', 404);
    const detail = await this.requireTicket(ticketId, userId, true);
    await this.notifyStatusChanged(detail);
    return detail;
  }

  async getAttachment(attachmentId: string, userId: string, userRole: string): Promise<{
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }> {
    const attachment = await this.repository.getAttachment(attachmentId, userId, userRole === 'administrator');
    if (!attachment) throw new SupportTicketsError('Attachment not found', 404);
    return {
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      buffer: Buffer.from(attachment.contentBase64, 'base64'),
    };
  }

  private async requireTicket(ticketId: string, userId: string, isAdmin: boolean): Promise<SupportTicketDetail> {
    if (!ticketId?.trim()) throw new SupportTicketsError('ticketId is required', 400);
    const ticket = await this.repository.getTicket(ticketId, userId, isAdmin);
    if (!ticket) throw new SupportTicketsError('Ticket not found', 404);
    return ticket;
  }

  private async saveAttachments(
    ticketId: string,
    messageId: string,
    userId: string,
    attachments: SupportAttachmentInput[],
  ): Promise<void> {
    for (const attachment of attachments) {
      await this.repository.createAttachment({
        ticketId,
        messageId,
        uploadedByUserId: userId,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        fileSizeBytes: attachment.fileSizeBytes,
        contentBase64: attachment.contentBase64,
      });
    }
  }

  private async notifyTicketCreated(ticket: SupportTicketDetail): Promise<void> {
    const admins = await this.repository.listAdministrators();
    const recipients = uniqueEmails([ticket.creatorEmail, ...admins.map((admin) => admin.email)]);
    await this.sendTicketEmail(
      recipients,
      `[${ticket.ticketNumber}] New support incident: ${ticket.subject}`,
      `A new support incident was created.\n\nTicket: ${ticket.ticketNumber}\nSubject: ${ticket.subject}\nStatus: ${labelStatus(ticket.status)}\nPriority: ${ticket.priority}\nCreator: ${ticket.creatorName ?? ticket.creatorEmail}\n\n${ticket.description}`,
    );
  }

  private async notifyReply(ticket: SupportTicketDetail, isAdminReply: boolean): Promise<void> {
    const admins = await this.repository.listAdministrators();
    const recipients = uniqueEmails([ticket.creatorEmail, ...admins.map((admin) => admin.email)]);
    const latest = ticket.messages.at(-1);
    await this.sendTicketEmail(
      recipients,
      `[${ticket.ticketNumber}] ${isAdminReply ? 'Administrator answer' : 'New user reply'}: ${ticket.subject}`,
      `A new answer was added to ticket ${ticket.ticketNumber}.\n\nSubject: ${ticket.subject}\nStatus: ${labelStatus(ticket.status)}\nFrom: ${latest?.authorName ?? latest?.authorEmail ?? 'BitWLab user'}\n\n${latest?.body ?? ''}`,
    );
  }

  private async notifyStatusChanged(ticket: SupportTicketDetail): Promise<void> {
    await this.sendTicketEmail(
      [ticket.creatorEmail],
      `[${ticket.ticketNumber}] Ticket status changed to ${labelStatus(ticket.status)}`,
      `The status of your support ticket changed.\n\nTicket: ${ticket.ticketNumber}\nSubject: ${ticket.subject}\nNew status: ${labelStatus(ticket.status)}`,
    );
  }

  private async sendTicketEmail(to: string[], subject: string, text: string): Promise<void> {
    for (const recipient of to) {
      try {
        await sendRawEmail({ to: recipient, subject, text });
      } catch (error) {
        console.warn(JSON.stringify({ event: 'support.email_failed', to: recipient, subject, error: error instanceof Error ? error.message : String(error) }));
      }
    }
  }
}

function parseTicketBody(body: unknown): {
  subject: string;
  description: string;
  priority: SupportTicketPriority;
  attachments: SupportAttachmentInput[];
} {
  if (typeof body !== 'object' || body === null) throw new SupportTicketsError('Request body is required', 400);
  const record = body as Record<string, unknown>;
  const subject = cleanRequiredText(record['subject'], 'subject', 180);
  const description = cleanRequiredText(record['description'], 'description', 5000);
  const priority = typeof record['priority'] === 'string' && VALID_PRIORITIES.includes(record['priority'] as SupportTicketPriority)
    ? record['priority'] as SupportTicketPriority
    : 'normal';
  return { subject, description, priority, attachments: parseAttachments(record['attachments']) };
}

function parseReplyBody(body: unknown): { body: string; attachments: SupportAttachmentInput[] } {
  if (typeof body !== 'object' || body === null) throw new SupportTicketsError('Request body is required', 400);
  const record = body as Record<string, unknown>;
  return {
    body: cleanRequiredText(record['body'], 'body', 5000),
    attachments: parseAttachments(record['attachments']),
  };
}

function cleanRequiredText(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new SupportTicketsError(`${name} is required`, 400);
  const cleaned = value.trim();
  if (cleaned.length > maxLength) throw new SupportTicketsError(`${name} must not exceed ${maxLength} characters`, 400);
  return cleaned;
}

function parseAttachments(value: unknown): SupportAttachmentInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new SupportTicketsError('attachments must be an array', 400);
  if (value.length > 3) throw new SupportTicketsError('A maximum of 3 screenshots can be attached', 400);
  return value.map((raw) => {
    if (typeof raw !== 'object' || raw === null) throw new SupportTicketsError('attachment must be an object', 400);
    const item = raw as Record<string, unknown>;
    const fileName = cleanRequiredText(item['fileName'], 'fileName', 255);
    const contentType = cleanRequiredText(item['contentType'], 'contentType', 80);
    const contentBase64 = cleanRequiredText(item['contentBase64'], 'contentBase64', MAX_SCREENSHOT_BYTES * 2);
    const fileSizeBytes = item['fileSizeBytes'];
    if (!VALID_CONTENT_TYPES.includes(contentType)) throw new SupportTicketsError('Only PNG, JPG, and WebP screenshots are supported', 400);
    if (typeof fileSizeBytes !== 'number' || fileSizeBytes <= 0 || fileSizeBytes > MAX_SCREENSHOT_BYTES) {
      throw new SupportTicketsError('Screenshot must be 5 MB or smaller', 400);
    }
    return { fileName, contentType, fileSizeBytes, contentBase64 };
  });
}

function uniqueEmails(emails: string[]): string[] {
  return [...new Set(emails.map((email) => email.trim()).filter(Boolean))];
}

function labelStatus(status: SupportTicketStatus): string {
  return status.replace(/_/g, ' ');
}
