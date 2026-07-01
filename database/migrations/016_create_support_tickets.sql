CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(24) NOT NULL UNIQUE,
  creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  priority VARCHAR(32) NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMPTZ,
  CONSTRAINT support_tickets_subject_not_blank CHECK (length(trim(subject)) > 0),
  CONSTRAINT support_tickets_description_not_blank CHECK (length(trim(description)) > 0),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed')),
  CONSTRAINT support_tickets_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_creator
  ON support_tickets(creator_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_admin_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT support_ticket_messages_body_not_blank CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket
  ON support_ticket_messages(ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES support_ticket_messages(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(80) NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  content_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT support_ticket_attachments_file_name_not_blank CHECK (length(trim(file_name)) > 0),
  CONSTRAINT support_ticket_attachments_content_type_check CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  CONSTRAINT support_ticket_attachments_file_size_check CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880)
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_ticket
  ON support_ticket_attachments(ticket_id, created_at ASC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_attachments ENABLE ROW LEVEL SECURITY;
