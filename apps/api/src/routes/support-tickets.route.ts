import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/rbac.middleware';
import type { AuthenticatedRequest, TokenInvalidationReader } from '../middleware/rbac.middleware';
import { SupportTicketsError, SupportTicketsService } from '../services/support-tickets.service';

export interface SupportTicketsManager {
  createTicket(userId: string, body: unknown): Promise<unknown>;
  listTickets(userId: string, userRole: string): Promise<unknown>;
  getTicket(ticketId: string, userId: string, userRole: string): Promise<unknown>;
  addReply(ticketId: string, userId: string, userRole: string, body: unknown): Promise<unknown>;
  updateStatus(ticketId: string, userId: string, userRole: string, body: unknown): Promise<unknown>;
  getAttachment(attachmentId: string, userId: string, userRole: string): Promise<{
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }>;
}

interface SupportTicketsRouterOptions {
  supportTicketsService?: SupportTicketsManager;
  tokenInvalidations?: TokenInvalidationReader;
}

export function createSupportTicketsRouter(options: SupportTicketsRouterOptions = {}): Router {
  const router = Router();
  const auth = requireAuth(options.tokenInvalidations);
  const anyRole = requireRole(['free_user', 'premium_user', 'administrator']);

  function service(): SupportTicketsManager {
    return options.supportTicketsService ?? new SupportTicketsService();
  }

  function userFrom(req: AuthenticatedRequest) {
    return { userId: req.user?.userId ?? '', userRole: req.user?.role ?? 'free_user' };
  }

  router.get('/', auth, anyRole, async (req, res, next) => {
    try {
      const { userId, userRole } = userFrom(req as AuthenticatedRequest);
      res.status(200).json(await service().listTickets(userId, userRole));
    } catch (error) {
      handleSupportError(error, res, next);
    }
  });

  router.post('/', auth, anyRole, async (req, res, next) => {
    try {
      const { userId } = userFrom(req as AuthenticatedRequest);
      res.status(201).json(await service().createTicket(userId, req.body));
    } catch (error) {
      handleSupportError(error, res, next);
    }
  });

  router.get('/attachments/:attachmentId/download', auth, anyRole, async (req, res, next) => {
    try {
      const { userId, userRole } = userFrom(req as AuthenticatedRequest);
      const attachment = await service().getAttachment(req.params.attachmentId, userId, userRole);
      res.setHeader('Content-Type', attachment.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName.replace(/"/g, '')}"`);
      res.status(200).send(attachment.buffer);
    } catch (error) {
      handleSupportError(error, res, next);
    }
  });

  router.get('/:ticketId', auth, anyRole, async (req, res, next) => {
    try {
      const { userId, userRole } = userFrom(req as AuthenticatedRequest);
      res.status(200).json(await service().getTicket(req.params.ticketId, userId, userRole));
    } catch (error) {
      handleSupportError(error, res, next);
    }
  });

  router.post('/:ticketId/messages', auth, anyRole, async (req, res, next) => {
    try {
      const { userId, userRole } = userFrom(req as AuthenticatedRequest);
      res.status(201).json(await service().addReply(req.params.ticketId, userId, userRole, req.body));
    } catch (error) {
      handleSupportError(error, res, next);
    }
  });

  router.patch('/:ticketId/status', auth, anyRole, async (req, res, next) => {
    try {
      const { userId, userRole } = userFrom(req as AuthenticatedRequest);
      res.status(200).json(await service().updateStatus(req.params.ticketId, userId, userRole, req.body));
    } catch (error) {
      handleSupportError(error, res, next);
    }
  });

  return router;
}

function handleSupportError(error: unknown, res: { status(code: number): { json(body: unknown): void } }, next: (error: unknown) => void): void {
  if (error instanceof SupportTicketsError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
}
