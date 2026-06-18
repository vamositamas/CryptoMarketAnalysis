import { Router } from 'express';
import { getDatabasePool } from '../config/database.config';
import { AlertEvaluationService } from '../services/alert-evaluation.service';
import { ResendEmailService } from '../services/email.service';
import { EmailTemplateRepository } from '../repositories/email-template.repository';
import { createQStashSignatureMiddleware } from './daily-data-refresh.controller';

interface AlertEvaluationOptions {
  alertEvaluationService?: Pick<AlertEvaluationService, 'evaluateAlerts'>;
  qstash?: {
    currentSigningKey?: string;
    nextSigningKey?: string;
    expectedUrl?: string;
  };
}

export function createAlertEvaluationRouter(options: AlertEvaluationOptions = {}): Router {
  const router = Router();
  const service =
    options.alertEvaluationService ??
    buildDefaultAlertEvaluationService();

  router.post(
    '/evaluate-alerts',
    createQStashSignatureMiddleware(options.qstash),
    async (req, res, next) => {
      try {
        const summary = await service.evaluateAlerts();
        res.status(200).json(summary);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

function buildDefaultAlertEvaluationService(): AlertEvaluationService {
  const database = getDatabasePool();
  return new AlertEvaluationService(database, {
    emailService: new ResendEmailService(),
    templateLoader: database ? new EmailTemplateRepository(database) : undefined,
  });
}
