interface Queryable {
  query<Row = unknown>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportTicketRecord {
  id: string;
  ticketNumber: string;
  creatorUserId: string;
  creatorEmail: string;
  creatorName: string | null;
  creatorLanguagePreference: 'en' | 'hu';
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface SupportTicketMessageRecord {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorEmail: string;
  authorName: string | null;
  body: string;
  isAdminReply: boolean;
  createdAt: string;
  attachments: SupportTicketAttachmentRecord[];
}

export interface SupportTicketAttachmentRecord {
  id: string;
  ticketId: string;
  messageId: string | null;
  uploadedByUserId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface SupportTicketDetail extends SupportTicketRecord {
  messages: SupportTicketMessageRecord[];
  attachments: SupportTicketAttachmentRecord[];
}

interface TicketRow {
  id: string;
  ticket_number: string;
  creator_user_id: string;
  creator_email: string;
  creator_name: string | null;
  creator_language_preference: 'en' | 'hu';
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  created_at: string | Date;
  updated_at: string | Date;
  closed_at: string | Date | null;
}

interface MessageRow {
  id: string;
  ticket_id: string;
  author_user_id: string;
  author_email: string;
  author_name: string | null;
  body: string;
  is_admin_reply: boolean;
  created_at: string | Date;
}

interface AttachmentRow {
  id: string;
  ticket_id: string;
  message_id: string | null;
  uploaded_by_user_id: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  created_at: string | Date;
}

export interface CreateSupportTicketInput {
  creatorUserId: string;
  subject: string;
  description: string;
  priority: SupportTicketPriority;
}

export interface CreateSupportMessageInput {
  ticketId: string;
  authorUserId: string;
  body: string;
  isAdminReply: boolean;
}

export interface CreateSupportAttachmentInput {
  ticketId: string;
  messageId: string | null;
  uploadedByUserId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  contentBase64: string;
}

export class SupportTicketsRepository {
  constructor(private readonly database: Queryable | undefined) {}

  async createTicket(input: CreateSupportTicketInput): Promise<SupportTicketRecord> {
    const ticketNumber = await this.nextTicketNumber();
    await this.requireDatabase().query(
      `INSERT INTO support_tickets (ticket_number, creator_user_id, subject, description, priority)
       VALUES ($1, $2, $3, $4, $5)`,
      [ticketNumber, input.creatorUserId, input.subject, input.description, input.priority],
    );
    const created = await this.findByTicketNumber(ticketNumber);
    if (!created) throw new Error('Created support ticket could not be loaded');
    return created;
  }

  async createMessage(input: CreateSupportMessageInput): Promise<SupportTicketMessageRecord> {
    const insert = await this.requireDatabase().query<{ id: string }>(
      `INSERT INTO support_ticket_messages (ticket_id, author_user_id, body, is_admin_reply)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.ticketId, input.authorUserId, input.body, input.isAdminReply],
    );
    await this.touchTicket(input.ticketId);
    const message = await this.findMessageById(insert.rows[0].id);
    if (!message) throw new Error('Created support ticket message could not be loaded');
    return message;
  }

  async createAttachment(input: CreateSupportAttachmentInput): Promise<SupportTicketAttachmentRecord> {
    const result = await this.requireDatabase().query<AttachmentRow>(
      `INSERT INTO support_ticket_attachments (
        ticket_id, message_id, uploaded_by_user_id, file_name, content_type, file_size_bytes, content_base64
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, ticket_id, message_id, uploaded_by_user_id, file_name, content_type, file_size_bytes, created_at`,
      [
        input.ticketId,
        input.messageId,
        input.uploadedByUserId,
        input.fileName,
        input.contentType,
        input.fileSizeBytes,
        input.contentBase64,
      ],
    );
    return toAttachmentRecord(result.rows[0]);
  }

  async listTickets(userId: string, isAdmin: boolean): Promise<SupportTicketRecord[]> {
    const where = isAdmin ? '' : 'WHERE t.creator_user_id = $1';
    const values = isAdmin ? [] : [userId];
    const result = await this.requireDatabase().query<TicketRow>(
      `SELECT ${ticketSelectColumns()}
       FROM support_tickets t
       JOIN users u ON u.id = t.creator_user_id
       ${where}
       ORDER BY t.updated_at DESC`,
      values,
    );
    return result.rows.map(toTicketRecord);
  }

  async getTicket(ticketId: string, userId: string, isAdmin: boolean): Promise<SupportTicketDetail | null> {
    const result = await this.requireDatabase().query<TicketRow>(
      `SELECT ${ticketSelectColumns()}
       FROM support_tickets t
       JOIN users u ON u.id = t.creator_user_id
       WHERE t.id = $1 ${isAdmin ? '' : 'AND t.creator_user_id = $2'}
       LIMIT 1`,
      isAdmin ? [ticketId] : [ticketId, userId],
    );
    if (!result.rows[0]) return null;
    const [messages, attachments] = await Promise.all([
      this.listMessages(ticketId),
      this.listAttachments(ticketId),
    ]);
    const attachmentsByMessage = new Map<string, SupportTicketAttachmentRecord[]>();
    for (const attachment of attachments) {
      if (!attachment.messageId) continue;
      attachmentsByMessage.set(attachment.messageId, [
        ...(attachmentsByMessage.get(attachment.messageId) ?? []),
        attachment,
      ]);
    }
    return {
      ...toTicketRecord(result.rows[0]),
      messages: messages.map((message) => ({
        ...message,
        attachments: attachmentsByMessage.get(message.id) ?? [],
      })),
      attachments: attachments.filter((attachment) => !attachment.messageId),
    };
  }

  async updateStatus(ticketId: string, status: SupportTicketStatus): Promise<SupportTicketRecord | null> {
    await this.requireDatabase().query(
      `UPDATE support_tickets
       SET status = $2::text,
           updated_at = NOW(),
           closed_at = CASE WHEN $2::text IN ('resolved', 'closed') THEN NOW() ELSE NULL END
       WHERE id = $1`,
      [ticketId, status],
    );
    return this.findById(ticketId);
  }

  async listAdministrators(): Promise<{ email: string; fullName: string | null; languagePreference: 'en' | 'hu' }[]> {
    const result = await this.requireDatabase().query<{ email: string; full_name: string | null; language_preference: 'en' | 'hu' }>(
      `SELECT email, full_name, language_preference FROM users WHERE role = 'administrator' AND deleted_at IS NULL`,
    );
    return result.rows.map((row) => ({
      email: row.email,
      fullName: row.full_name,
      languagePreference: row.language_preference ?? 'en',
    }));
  }

  async getAttachment(
    attachmentId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<(SupportTicketAttachmentRecord & { contentBase64: string }) | null> {
    const result = await this.requireDatabase().query<AttachmentRow & { content_base64: string }>(
      `SELECT a.id, a.ticket_id, a.message_id, a.uploaded_by_user_id, a.file_name, a.content_type,
              a.file_size_bytes, a.content_base64, a.created_at
       FROM support_ticket_attachments a
       JOIN support_tickets t ON t.id = a.ticket_id
       WHERE a.id = $1 ${isAdmin ? '' : 'AND t.creator_user_id = $2'}
       LIMIT 1`,
      isAdmin ? [attachmentId] : [attachmentId, userId],
    );
    return result.rows[0]
      ? { ...toAttachmentRecord(result.rows[0]), contentBase64: result.rows[0].content_base64 }
      : null;
  }

  private async listMessages(ticketId: string): Promise<SupportTicketMessageRecord[]> {
    const result = await this.requireDatabase().query<MessageRow>(
      `SELECT ${messageSelectColumns()}
       FROM support_ticket_messages m
       JOIN users u ON u.id = m.author_user_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC`,
      [ticketId],
    );
    return result.rows.map((row) => ({ ...toMessageRecord(row), attachments: [] }));
  }

  private async listAttachments(ticketId: string): Promise<SupportTicketAttachmentRecord[]> {
    const result = await this.requireDatabase().query<AttachmentRow>(
      `SELECT id, ticket_id, message_id, uploaded_by_user_id, file_name, content_type, file_size_bytes, created_at
       FROM support_ticket_attachments
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [ticketId],
    );
    return result.rows.map(toAttachmentRecord);
  }

  private async findMessageById(messageId: string): Promise<SupportTicketMessageRecord | null> {
    const result = await this.requireDatabase().query<MessageRow>(
      `SELECT ${messageSelectColumns()}
       FROM support_ticket_messages m
       JOIN users u ON u.id = m.author_user_id
       WHERE m.id = $1
       LIMIT 1`,
      [messageId],
    );
    return result.rows[0] ? { ...toMessageRecord(result.rows[0]), attachments: [] } : null;
  }

  private async touchTicket(ticketId: string): Promise<void> {
    await this.requireDatabase().query(`UPDATE support_tickets SET updated_at = NOW() WHERE id = $1`, [ticketId]);
  }

  private async nextTicketNumber(): Promise<string> {
    const result = await this.requireDatabase().query<{ value: string }>(
      `SELECT 'TCK-' || to_char(NOW(), 'YYYY') || '-' ||
              lpad((COUNT(*) + 1)::text, 5, '0') AS value
       FROM support_tickets
       WHERE created_at >= date_trunc('year', NOW())`,
    );
    return result.rows[0]?.value ?? `TCK-${new Date().getUTCFullYear()}-00001`;
  }

  private async findByTicketNumber(ticketNumber: string): Promise<SupportTicketRecord | null> {
    const result = await this.requireDatabase().query<TicketRow>(
      `SELECT ${ticketSelectColumns()}
       FROM support_tickets t
       JOIN users u ON u.id = t.creator_user_id
       WHERE t.ticket_number = $1
       LIMIT 1`,
      [ticketNumber],
    );
    return result.rows[0] ? toTicketRecord(result.rows[0]) : null;
  }

  private async findById(ticketId: string): Promise<SupportTicketRecord | null> {
    const result = await this.requireDatabase().query<TicketRow>(
      `SELECT ${ticketSelectColumns()}
       FROM support_tickets t
       JOIN users u ON u.id = t.creator_user_id
       WHERE t.id = $1
       LIMIT 1`,
      [ticketId],
    );
    return result.rows[0] ? toTicketRecord(result.rows[0]) : null;
  }

  private requireDatabase(): Queryable {
    if (!this.database) throw new Error('Database is not configured');
    return this.database;
  }
}

function ticketSelectColumns(): string {
  return `t.id, t.ticket_number, t.creator_user_id, u.email AS creator_email, u.full_name AS creator_name,
          u.language_preference AS creator_language_preference, t.subject, t.description, t.status, t.priority,
          t.created_at, t.updated_at, t.closed_at`;
}

function messageSelectColumns(): string {
  return `m.id, m.ticket_id, m.author_user_id, u.email AS author_email, u.full_name AS author_name,
          m.body, m.is_admin_reply, m.created_at`;
}

function toIso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toTicketRecord(row: TicketRow): SupportTicketRecord {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    creatorUserId: row.creator_user_id,
    creatorEmail: row.creator_email,
    creatorName: row.creator_name,
    creatorLanguagePreference: row.creator_language_preference ?? 'en',
    subject: row.subject,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
    closedAt: toIso(row.closed_at),
  };
}

function toMessageRecord(row: MessageRow): Omit<SupportTicketMessageRecord, 'attachments'> {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorUserId: row.author_user_id,
    authorEmail: row.author_email,
    authorName: row.author_name,
    body: row.body,
    isAdminReply: row.is_admin_reply,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

function toAttachmentRecord(row: AttachmentRow): SupportTicketAttachmentRecord {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    messageId: row.message_id,
    uploadedByUserId: row.uploaded_by_user_id,
    fileName: row.file_name,
    contentType: row.content_type,
    fileSizeBytes: row.file_size_bytes,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}
