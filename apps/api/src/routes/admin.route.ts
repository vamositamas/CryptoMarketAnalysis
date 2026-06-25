import type { Request } from 'express';
import { Router } from 'express';
import { BitcoinDataClient, BlockchainInfoClient, CoinGeckoClient, FearGreedClient } from '@crypto-market-analysis/calculation-engines/data-sources';
import { getDatabasePool } from '../config/database.config';
import { DailyDataRefreshService, insertBitcoinMetricsDaily } from '../jobs/daily-data-refresh.controller';
import { runHistoricalDataInitialization } from '../jobs/init-historical-data';
import { requireAuth, requireRole } from '../middleware/rbac.middleware';
import type { TokenInvalidationReader, AuthenticatedRequest } from '../middleware/rbac.middleware';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { ChartConfigRepository } from '../repositories/chart-config.repository';
import { DonationsRepository } from '../repositories/donations.repository';
import { EmailTemplateRepository } from '../repositories/email-template.repository';
import { SystemConfigurationRepository } from '../repositories/system-configuration.repository';
import { UserManagementRepository } from '../repositories/user-management.repository';
import {
  DataRefreshConfigurationError,
  DataRefreshConfigurationService,
} from '../services/data-refresh-configuration.service';
import { DonationsService } from '../services/donations.service';
import { ResendEmailService, sendRawEmail, substituteTemplateVars } from '../services/email.service';
import { UserManagementError, UserManagementService } from '../services/user-management.service';

/** Adds one day to a YYYY-MM-DD string */
function addOneDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetches all historical points via fetchAll, then fills any gap between the
 * last returned date and today using the ranged fetcher. Blockchain.info's
 * timespan=all endpoint has a lag of several months, causing a visible gap in
 * charts when a ranged daily-refresh already has today's value.
 */
async function fetchAllWithGapFill(
  fetchAll: () => Promise<{ date: string; value: number }[]>,
  fetchRange: (start: string, end: string) => Promise<{ date: string; value: number }[]>,
): Promise<{ date: string; value: number }[]> {
  const historical = await fetchAll();
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = [...historical].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date;
  if (!lastDate || lastDate >= today) return historical;
  const gap = await fetchRange(addOneDay(lastDate), today).catch(() => []);
  return [...historical, ...gap];
}

type DataRefreshConfigurationServiceContract = Pick<
  DataRefreshConfigurationService,
  'getConfiguration' | 'updateConfiguration'
>;

type EmailTemplateRepositoryContract = Pick<
  EmailTemplateRepository,
  'getTemplate' | 'setTemplate' | 'deleteTemplate' | 'listTemplates'
>;

type DonationsServiceContract = Pick<
  DonationsService,
  'listDonations' | 'exportDonations'
>;

type UserManagementServiceContract = Pick<
  UserManagementService,
  'listUsers' | 'getUser' | 'updateUser' | 'deleteUser' | 'restoreUser' | 'forcePasswordReset'
>;

type AuditLogRepositoryContract = Pick<AuditLogRepository, 'create' | 'list'>;
type ChartConfigRepositoryContract = Pick<ChartConfigRepository, 'list' | 'getById' | 'create' | 'update' | 'delete'>;

interface AdminRouterOptions {
  dataRefreshConfigurationService?: DataRefreshConfigurationServiceContract;
  dailyDataRefreshService?: Pick<DailyDataRefreshService, 'run'>;
  emailTemplateRepository?: EmailTemplateRepositoryContract;
  donationsService?: DonationsServiceContract;
  userManagementService?: UserManagementServiceContract;
  auditLogRepository?: AuditLogRepositoryContract;
  chartConfigRepository?: ChartConfigRepositoryContract;
  tokenInvalidations?: TokenInvalidationReader;
}

const DEFAULT_ALERT_TRIGGERED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>&#x26A1; Alert Triggered — {{alertName}}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f2d1e 0%,#1a4731 60%,#22613f 100%);border-radius:16px 16px 0 0;padding:36px 48px 32px;text-align:center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:center;padding-bottom:16px;">
                  <span style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:50px;padding:6px 18px;font-size:12px;font-weight:600;color:#a8d5b5;letter-spacing:0.08em;text-transform:uppercase;">Price Alert</span>
                </td>
              </tr>
              <tr>
                <td style="text-align:center;">
                  <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BitWLab</p>
                  <p style="margin:0;font-size:13px;color:#7ab594;letter-spacing:0.03em;">Bitcoin Blockchain Analysis</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Alert badge strip -->
        <tr>
          <td style="background:#1e5c38;padding:0 48px;border-left:1px solid #1a4731;border-right:1px solid #1a4731;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
                  <p style="margin:0;font-size:13px;color:#a8d5b5;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Alert triggered</p>
                  <p style="margin:4px 0 0;font-size:19px;font-weight:700;color:#ffffff;">{{alertName}}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body card -->
        <tr>
          <td style="background:#ffffff;padding:36px 48px 32px;border-left:1px solid #dce8dd;border-right:1px solid #dce8dd;">

            <p style="margin:0 0 6px;font-size:15px;color:#374151;line-height:1.6;">Hello,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
              Your alert on the <strong style="color:#111827;">{{chartTitle}}</strong> chart just fired. Here's what happened:
            </p>

            <!-- 3-column stat cards -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <!-- Condition -->
                <td width="32%" style="background:#f8faf8;border:1px solid #e3ede5;border-radius:10px;padding:16px 14px;vertical-align:top;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;">Condition</p>
                  <p style="margin:0;font-size:13px;font-weight:600;color:#1a4731;line-height:1.4;">{{metricLabel}}<br/>{{conditionLabel}}<br/>{{thresholdValue}}</p>
                </td>
                <td width="4%" style="font-size:0;">&nbsp;</td>
                <!-- Current value -->
                <td width="32%" style="background:#f0faf4;border:2px solid #22c55e;border-radius:10px;padding:16px 14px;vertical-align:top;text-align:center;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.07em;">Current Value</p>
                  <p style="margin:0;font-size:28px;font-weight:800;color:#1a4731;line-height:1;">{{currentValue}}</p>
                </td>
                <td width="4%" style="font-size:0;">&nbsp;</td>
                <!-- Triggered at -->
                <td width="28%" style="background:#f8faf8;border:1px solid #e3ede5;border-radius:10px;padding:16px 14px;vertical-align:top;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;">Triggered</p>
                  <p style="margin:0;font-size:13px;font-weight:600;color:#374151;line-height:1.4;">{{triggeredAt}}<br/><span style="font-size:11px;color:#9ca3af;font-weight:400;">UTC</span></p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;border-left:3px solid #d1e7d4;padding-left:14px;">
              Log in to your BitWLab account to review this alert, check the latest chart data, and update your notification settings.
            </p>

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a4731;border-radius:10px;box-shadow:0 2px 8px rgba(26,71,49,0.25);">
                  <a href="{{appUrl}}/alerts" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">View My Alerts &#x2192;</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8faf8;border-radius:0 0 16px 16px;padding:20px 48px;text-align:center;border:1px solid #dce8dd;border-top:1px solid #e8f0e9;">
            <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">This is an automated alert notification. Please do not reply to this email.</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              <a href="{{appUrl}}" style="color:#1a4731;text-decoration:none;font-weight:600;">BitWLab</a>
              &nbsp;&middot;&nbsp; Bitcoin Blockchain Analysis
              &nbsp;&middot;&nbsp; <a href="{{appUrl}}/alerts" style="color:#6b7280;text-decoration:none;">Manage Alerts</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const DEFAULT_ALERT_TRIGGERED_HU_HTML = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>&#x26A1; Riasztás aktiválódott — {{alertName}}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f2d1e 0%,#1a4731 60%,#22613f 100%);border-radius:16px 16px 0 0;padding:36px 48px 32px;text-align:center;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:center;padding-bottom:16px;">
                  <span style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:50px;padding:6px 18px;font-size:12px;font-weight:600;color:#a8d5b5;letter-spacing:0.08em;text-transform:uppercase;">Áriasztás</span>
                </td>
              </tr>
              <tr>
                <td style="text-align:center;">
                  <p style="margin:0 0 4px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BitWLab</p>
                  <p style="margin:0;font-size:13px;color:#7ab594;letter-spacing:0.03em;">Bitcoin blokklánc elemzés</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Alert name strip -->
        <tr>
          <td style="background:#1e5c38;padding:0 48px;border-left:1px solid #1a4731;border-right:1px solid #1a4731;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
                  <p style="margin:0;font-size:13px;color:#a8d5b5;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Riasztás aktiválódott</p>
                  <p style="margin:4px 0 0;font-size:19px;font-weight:700;color:#ffffff;">{{alertName}}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body card -->
        <tr>
          <td style="background:#ffffff;padding:36px 48px 32px;border-left:1px solid #dce8dd;border-right:1px solid #dce8dd;">
            <p style="margin:0 0 6px;font-size:15px;color:#374151;line-height:1.6;">Szia,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
              A(z) <strong style="color:#111827;">{{chartTitle}}</strong> grafikonon figyelt riasztásod élesedett. Íme a részletek:
            </p>

            <!-- 3-column stat cards -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td width="32%" style="background:#f8faf8;border:1px solid #e3ede5;border-radius:10px;padding:16px 14px;vertical-align:top;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;">Feltétel</p>
                  <p style="margin:0;font-size:13px;font-weight:600;color:#1a4731;line-height:1.4;">{{metricLabel}}<br/>{{conditionLabel}}<br/>{{thresholdValue}}</p>
                </td>
                <td width="4%" style="font-size:0;">&nbsp;</td>
                <td width="32%" style="background:#f0faf4;border:2px solid #22c55e;border-radius:10px;padding:16px 14px;vertical-align:top;text-align:center;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.07em;">Aktuális érték</p>
                  <p style="margin:0;font-size:28px;font-weight:800;color:#1a4731;line-height:1;">{{currentValue}}</p>
                </td>
                <td width="4%" style="font-size:0;">&nbsp;</td>
                <td width="28%" style="background:#f8faf8;border:1px solid #e3ede5;border-radius:10px;padding:16px 14px;vertical-align:top;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;">Aktiválódott</p>
                  <p style="margin:0;font-size:13px;font-weight:600;color:#374151;line-height:1.4;">{{triggeredAt}}<br/><span style="font-size:11px;color:#9ca3af;font-weight:400;">UTC</span></p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;border-left:3px solid #d1e7d4;padding-left:14px;">
              Jelentkezz be a BitWLab fiókodba a riasztás áttekintéséhez, az aktuális grafikonadatok megtekintéséhez és az értesítési beállítások módosításához.
            </p>

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a4731;border-radius:10px;box-shadow:0 2px 8px rgba(26,71,49,0.25);">
                  <a href="{{appUrl}}/alerts" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">Riasztásaim megtekintése &#x2192;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8faf8;border-radius:0 0 16px 16px;padding:20px 48px;text-align:center;border:1px solid #dce8dd;border-top:1px solid #e8f0e9;">
            <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">Ez egy automatikus értesítés. Kérjük, ne válaszolj erre az e-mailre.</p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              <a href="{{appUrl}}" style="color:#1a4731;text-decoration:none;font-weight:600;">BitWLab</a>
              &nbsp;&middot;&nbsp; Bitcoin blokklánc elemzés
              &nbsp;&middot;&nbsp; <a href="{{appUrl}}/alerts" style="color:#6b7280;text-decoration:none;">Riasztások kezelése</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const TEMPLATE_DEFINITIONS = [
  {
    key: 'alert_triggered_en_html',
    label: 'Alert Triggered — English HTML Body',
    defaultValue: DEFAULT_ALERT_TRIGGERED_HTML,
    variables: ['alertName', 'chartTitle', 'metricLabel', 'conditionLabel', 'thresholdValue', 'currentValue', 'triggeredAt', 'appUrl'],
    language: 'en',
    kind: 'html',
  },
  {
    key: 'alert_triggered_en_subject',
    label: 'Alert Triggered — English Subject Line',
    defaultValue: '⚡ Alert Triggered: {{alertName}} — {{metricLabel}} {{conditionLabel}} {{thresholdValue}}',
    variables: ['alertName'],
    language: 'en',
    kind: 'subject',
  },
  {
    key: 'alert_triggered_hu_html',
    label: 'Riasztás aktiválódott — Magyar HTML törzs',
    defaultValue: DEFAULT_ALERT_TRIGGERED_HU_HTML,
    variables: ['alertName', 'chartTitle', 'metricLabel', 'conditionLabel', 'thresholdValue', 'currentValue', 'triggeredAt', 'appUrl'],
    language: 'hu',
    kind: 'html',
  },
  {
    key: 'alert_triggered_hu_subject',
    label: 'Riasztás aktiválódott — Magyar tárgy',
    defaultValue: '⚡ Riasztás aktiválódott: {{alertName}} — {{metricLabel}} {{conditionLabel}} {{thresholdValue}}',
    variables: ['alertName'],
    language: 'hu',
    kind: 'subject',
  },
] as const;

const ALLOWED_TEMPLATE_KEYS = new Set(TEMPLATE_DEFINITIONS.map((t) => t.key));

const TEMPLATE_SAMPLE_DATA: Record<string, string> = {
  alertName: 'MVRV Overbought',
  chartTitle: 'Bitcoin Rainbow Price Chart',
  metricLabel: 'MVRV Z-Score',
  conditionLabel: 'crosses above',
  thresholdValue: '7.0',
  currentValue: '7.23',
  triggeredAt: new Date().toUTCString(),
  appUrl: process.env['APP_URL'] ?? 'https://bitwlab.com',
  userName: 'John Doe',
  userEmail: 'john@example.com',
  donationAmount: '$10.00',
  currency: 'USD',
  transactionId: 'TXN-ABC123',
  donationDate: new Date().toLocaleDateString('en-US', { dateStyle: 'long' }),
};

const VALID_CHART_STATUSES = new Set(['draft', 'active', 'inactive'] as const);
const VALID_ACCESS_TIERS = new Set(['free', 'premium'] as const);

function getIpAddress(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? null;
  return (req.socket?.remoteAddress as string | undefined) ?? null;
}

export function createAdminRouter(
  optionsOrTokenInvalidations: AdminRouterOptions | TokenInvalidationReader = {},
): Router {
  const router = Router();
  const options = normalizeOptions(optionsOrTokenInvalidations);
  let dataRefreshConfigurationService = options.dataRefreshConfigurationService;
  let emailTemplateRepository = options.emailTemplateRepository;
  let donationsService = options.donationsService;
  let userManagementService = options.userManagementService;
  let auditLogRepository = options.auditLogRepository;
  let chartConfigRepository = options.chartConfigRepository;
  const dailyDataRefreshService =
    options.dailyDataRefreshService ?? new DailyDataRefreshService();
  const adminOnly = [
    requireAuth(options.tokenInvalidations),
    requireRole(['administrator']),
  ] as const;

  // ── User Management (Stories 9.1–9.4) ──────────────────────────────────────

  router.get('/users', ...adminOnly, async (req: AuthenticatedRequest, res, next) => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50));
      const search = typeof req.query['search'] === 'string' && req.query['search'] ? req.query['search'] : undefined;
      const role = typeof req.query['role'] === 'string' && req.query['role'] !== 'all' ? req.query['role'] : undefined;
      const showDeleted = req.query['show'] === 'deleted';

      const result = await getUserManagementService().listUsers({ page, limit, search, role, showDeleted });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/users/:userId', ...adminOnly, async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = await getUserManagementService().getUser(req.params['userId']!);
      res.json(user);
    } catch (error) {
      if (error instanceof UserManagementError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.patch('/users/:userId', ...adminOnly, async (req: AuthenticatedRequest, res, next) => {
    try {
      const adminUserId = req.user!.userId;
      const targetUserId = req.params['userId']!;
      const { fullName, role, emailVerified, onboardingCompleted, languagePreference } = req.body as Record<string, unknown>;

      const validRoles = new Set(['administrator', 'premium_user', 'free_user']);
      if (role !== undefined && !validRoles.has(role as string)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }
      const validLangs = new Set(['en', 'hu']);
      if (languagePreference !== undefined && !validLangs.has(languagePreference as string)) {
        res.status(400).json({ error: 'Invalid languagePreference' });
        return;
      }

      const params = {
        ...(fullName !== undefined && { fullName: fullName as string | null }),
        ...(role !== undefined && { role: role as 'administrator' | 'premium_user' | 'free_user' }),
        ...(emailVerified !== undefined && { emailVerified: Boolean(emailVerified) }),
        ...(onboardingCompleted !== undefined && { onboardingCompleted: Boolean(onboardingCompleted) }),
        ...(languagePreference !== undefined && { languagePreference: languagePreference as 'en' | 'hu' }),
      };

      const updated = await getUserManagementService().updateUser(targetUserId, params, adminUserId);

      await getAuditLogRepository().create({
        adminUserId,
        actionType: 'user_edit',
        targetType: 'user',
        targetId: targetUserId,
        changes: params as Record<string, unknown>,
        ipAddress: getIpAddress(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof UserManagementError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.delete('/users/:userId', ...adminOnly, async (req: AuthenticatedRequest, res, next) => {
    try {
      const adminUserId = req.user!.userId;
      const targetUserId = req.params['userId']!;

      await getUserManagementService().deleteUser(targetUserId, adminUserId);

      await getAuditLogRepository().create({
        adminUserId,
        actionType: 'user_delete',
        targetType: 'user',
        targetId: targetUserId,
        ipAddress: getIpAddress(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
      if (error instanceof UserManagementError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.patch('/users/:userId/restore', ...adminOnly, async (req: AuthenticatedRequest, res, next) => {
    try {
      const adminUserId = req.user!.userId;
      const targetUserId = req.params['userId']!;

      const user = await getUserManagementService().restoreUser(targetUserId);

      await getAuditLogRepository().create({
        adminUserId,
        actionType: 'user_restore',
        targetType: 'user',
        targetId: targetUserId,
        ipAddress: getIpAddress(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      res.json(user);
    } catch (error) {
      if (error instanceof UserManagementError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.post('/users/:userId/force-password-reset', ...adminOnly, async (req: AuthenticatedRequest, res, next) => {
    try {
      const adminUserId = req.user!.userId;
      const targetUserId = req.params['userId']!;

      const { email } = await getUserManagementService().forcePasswordReset(targetUserId);

      await getAuditLogRepository().create({
        adminUserId,
        actionType: 'user_force_password_reset',
        targetType: 'user',
        targetId: targetUserId,
        ipAddress: getIpAddress(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      res.json({ success: true, message: `Password reset email sent to ${email}` });
    } catch (error) {
      if (error instanceof UserManagementError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // ── Data Configuration ──────────────────────────────────────────────────────

  router.get('/data-configuration', ...adminOnly, async (_req, res, next) => {
    try {
      res.status(200).json(await getConfigurationService().getConfiguration());
    } catch (error) {
      next(error);
    }
  });

  router.patch('/data-configuration', ...adminOnly, async (req, res, next) => {
    try {
      const configuration = await getConfigurationService().updateConfiguration(req.body);
      res.status(200).json(configuration);
    } catch (error) {
      if (error instanceof DataRefreshConfigurationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.post('/data-configuration/refresh-now', ...adminOnly, async (_req, res, next) => {
    try {
      res.status(200).json(await dailyDataRefreshService.run());
    } catch (error) {
      next(error);
    }
  });

  router.post('/data-configuration/init-historical', ...adminOnly, async (req, res, next) => {
    try {
      const database = getDatabasePool();
      if (!database) {
        res.status(503).json({ error: 'Database unavailable' });
        return;
      }
      const { startDate, endDate } = req.body as { startDate?: string; endDate?: string };
      // No CoinGecko retries: a 429 rate-limit would otherwise cause 7s of backoff per
      // chunk, pushing a single-year init past Render's 30s gateway timeout.
      // Any CoinGecko failure falls through immediately to the Blockchain.info fallback.
      const summary = await runHistoricalDataInitialization({
        database,
        startDate,
        endDate,
        retryAttempts: 1,
        retryDelayMs: 0,
        coinGeckoClient: new CoinGeckoClient({ retryAttempts: 0 }),
      });
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  });

  router.post('/data-configuration/backfill-vdd', ...adminOnly, async (_req, res, next) => {
    try {
      const database = getDatabasePool();
      if (!database) {
        res.status(503).json({ error: 'Database unavailable' });
        return;
      }
      const client = new BitcoinDataClient();
      const points = await client.fetchVddMultipleHistory();
      const records = points.map((p) => ({ date: p.date, metricName: 'vdd_multiple', metricValue: p.value }));
      await insertBitcoinMetricsDaily(database, records);
      res.status(200).json({ inserted: records.length, firstDate: records[0]?.date, lastDate: records[records.length - 1]?.date });
    } catch (error) {
      next(error);
    }
  });

  router.post('/data-configuration/backfill-miner-fees', ...adminOnly, async (_req, res, next) => {
    try {
      const database = getDatabasePool();
      if (!database) { res.status(503).json({ error: 'Database unavailable' }); return; }
      const client = new BlockchainInfoClient();
      const points = await fetchAllWithGapFill(
        () => client.fetchTransactionFeesAll(),
        (s, e) => client.fetchTransactionFees(s, e),
      );
      const records = points.map((p) => ({ date: p.date, metricName: 'miner_fees', metricValue: p.value }));
      await insertBitcoinMetricsDaily(database, records);
      res.status(200).json({ inserted: records.length, firstDate: records[0]?.date, lastDate: records[records.length - 1]?.date });
    } catch (error) { next(error); }
  });

  router.post('/data-configuration/backfill-price-forecast', ...adminOnly, async (_req, res, next) => {
    try {
      const database = getDatabasePool();
      if (!database) { res.status(503).json({ error: 'Database unavailable' }); return; }
      const client = new BitcoinDataClient();
      const [cvddPoints, balancedPoints, terminalPoints] = await Promise.all([
        client.fetchCvddHistory(),
        client.fetchBalancedPriceHistory(),
        client.fetchTerminalPriceHistory(),
      ]);
      const records = [
        ...cvddPoints.map((p) => ({ date: p.date, metricName: 'cvdd', metricValue: p.value })),
        ...balancedPoints.map((p) => ({ date: p.date, metricName: 'balanced_price', metricValue: p.value })),
        ...terminalPoints.map((p) => ({ date: p.date, metricName: 'terminal_price', metricValue: p.value })),
      ];
      await insertBitcoinMetricsDaily(database, records);
      const allDates = [...cvddPoints, ...balancedPoints, ...terminalPoints].map((p) => p.date).sort();
      res.status(200).json({ inserted: records.length, firstDate: allDates[0] ?? null, lastDate: allDates[allDates.length - 1] ?? null });
    } catch (error) { next(error); }
  });

  router.post('/data-configuration/backfill-fear-greed', ...adminOnly, async (_req, res, next) => {
    try {
      const database = getDatabasePool();
      if (!database) { res.status(503).json({ error: 'Database unavailable' }); return; }
      const points = await new FearGreedClient().fetchHistory();
      const records = points.map((p) => ({ date: p.date, metricName: 'fear_greed_index', metricValue: p.value }));
      await insertBitcoinMetricsDaily(database, records);
      res.status(200).json({ inserted: records.length, firstDate: records[records.length - 1]?.date, lastDate: records[0]?.date });
    } catch (error) { next(error); }
  });

  router.post('/data-configuration/backfill-hash-rate', ...adminOnly, async (_req, res, next) => {
    try {
      const database = getDatabasePool();
      if (!database) { res.status(503).json({ error: 'Database unavailable' }); return; }
      const client = new BlockchainInfoClient();
      const points = await fetchAllWithGapFill(
        () => client.fetchHashRateAll(),
        (s, e) => client.fetchHashRate(s, e),
      );
      const records = points.map((p) => ({ date: p.date, metricName: 'hash_rate', metricValue: p.value }));
      await insertBitcoinMetricsDaily(database, records);
      res.status(200).json({ inserted: records.length, firstDate: records[0]?.date, lastDate: records[records.length - 1]?.date });
    } catch (error) { next(error); }
  });

  router.post('/data-configuration/backfill-difficulty', ...adminOnly, async (_req, res, next) => {
    try {
      const database = getDatabasePool();
      if (!database) { res.status(503).json({ error: 'Database unavailable' }); return; }
      const client = new BlockchainInfoClient();
      const points = await fetchAllWithGapFill(
        () => client.fetchDifficultyAll(),
        (s, e) => client.fetchDifficulty(s, e),
      );
      const records = points.map((p) => ({ date: p.date, metricName: 'mining_difficulty', metricValue: p.value }));
      await insertBitcoinMetricsDaily(database, records);
      res.status(200).json({ inserted: records.length, firstDate: records[0]?.date, lastDate: records[records.length - 1]?.date });
    } catch (error) { next(error); }
  });

  router.post('/data-configuration/backfill-transaction-volume', ...adminOnly, async (_req, res, next) => {
    try {
      const database = getDatabasePool();
      if (!database) { res.status(503).json({ error: 'Database unavailable' }); return; }
      const client = new BlockchainInfoClient();
      const points = await fetchAllWithGapFill(
        () => client.fetchTransactionVolumeUsdAll(),
        (s, e) => client.fetchTransactionVolumeUsd(s, e),
      );
      const records = points.map((p) => ({ date: p.date, metricName: 'transaction_volume_usd', metricValue: p.value }));
      await insertBitcoinMetricsDaily(database, records);
      res.status(200).json({ inserted: records.length, firstDate: records[0]?.date, lastDate: records[records.length - 1]?.date });
    } catch (error) { next(error); }
  });

  router.post('/data-configuration/backfill-miners-revenue', ...adminOnly, async (_req, res, next) => {
    try {
      const database = getDatabasePool();
      if (!database) { res.status(503).json({ error: 'Database unavailable' }); return; }
      const client = new BlockchainInfoClient();
      const points = await fetchAllWithGapFill(
        () => client.fetchMinersRevenueUsdAll(),
        (s, e) => client.fetchMinersRevenueUsd(s, e),
      );
      const records = points.map((p) => ({ date: p.date, metricName: 'miners_revenue_usd', metricValue: p.value }));
      await insertBitcoinMetricsDaily(database, records);
      res.status(200).json({ inserted: records.length, firstDate: records[0]?.date, lastDate: records[records.length - 1]?.date });
    } catch (error) { next(error); }
  });

  // ── Email Config (summary for UI) ────────────────────────────────────────────

  router.get('/email-config', ...adminOnly, async (_req, res, next) => {
    try {
      const db = getDatabasePool();
      const result = await db?.query<{ key: string; value: string }>(
        `SELECT key, value FROM system_configuration WHERE key IN ('email_from_address', 'email_app_url', 'smtp_host', 'smtp_password')`,
      );
      const map = new Map((result?.rows ?? []).map((r) => [r.key, r.value]));
      const hasSmtp = map.has('smtp_host') && (map.has('smtp_password') || !!process.env['SMTP_PASSWORD']);
      const hasResend = !!process.env['RESEND_API_KEY'];
      const provider = hasSmtp ? 'SMTP' : hasResend ? 'Resend' : 'None';
      const fromEmail = map.get('email_from_address') ?? process.env['RESEND_FROM_EMAIL'] ?? null;
      const appUrl = map.get('email_app_url') ?? process.env['APP_URL'] ?? 'https://bitwlab.com';
      res.json({ provider, apiKeyConfigured: hasSmtp || hasResend, fromEmail, appUrl });
    } catch (error) { next(error); }
  });

  // ── Email Settings ───────────────────────────────────────────────────────────

  router.get('/email-settings', ...adminOnly, async (_req, res, next) => {
    try {
      const db = getDatabasePool();
      const KEYS = ['email_from_address', 'email_app_url', 'email_admin_email',
        'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password'];
      const result = await db?.query<{ key: string; value: string }>(
        `SELECT key, value FROM system_configuration WHERE key = ANY($1)`,
        [KEYS],
      );
      const map = new Map((result?.rows ?? []).map((r) => [r.key, r.value]));
      res.json({
        fromAddress: map.get('email_from_address') ?? process.env['RESEND_FROM_EMAIL'] ?? '',
        appUrl: map.get('email_app_url') ?? process.env['APP_URL'] ?? '',
        adminEmail: map.get('email_admin_email') ?? process.env['ADMIN_ALERT_EMAIL'] ?? '',
        smtpHost: map.get('smtp_host') ?? process.env['SMTP_HOST'] ?? '',
        smtpPort: map.get('smtp_port') ?? process.env['SMTP_PORT'] ?? '587',
        smtpUser: map.get('smtp_user') ?? process.env['SMTP_USER'] ?? '',
        smtpPasswordConfigured: map.has('smtp_password') || !!process.env['SMTP_PASSWORD'],
      });
    } catch (error) { next(error); }
  });

  router.put('/email-settings', ...adminOnly, async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const db = getDatabasePool();
      const upsert = async (key: string, raw: unknown) => {
        const value = String(raw ?? '').trim();
        if (!value) return;
        await db?.query(
          `INSERT INTO system_configuration (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [key, value],
        );
      };
      if (body['email_from_address'] !== undefined || body['fromAddress'] !== undefined)
        await upsert('email_from_address', body['fromAddress'] ?? body['email_from_address']);
      if (body['appUrl'] !== undefined) await upsert('email_app_url', body['appUrl']);
      if (body['adminEmail'] !== undefined) await upsert('email_admin_email', body['adminEmail']);
      if (body['smtpHost'] !== undefined) await upsert('smtp_host', body['smtpHost']);
      if (body['smtpPort'] !== undefined) await upsert('smtp_port', body['smtpPort']);
      if (body['smtpUser'] !== undefined) await upsert('smtp_user', body['smtpUser']);
      if (body['smtpPassword'] !== undefined) await upsert('smtp_password', body['smtpPassword']);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  // ── Email Templates ─────────────────────────────────────────────────────────

  router.get('/email-templates', ...adminOnly, async (_req, res, next) => {
    try {
      let stored = new Map<string, { key: string; value: string; updatedAt: string }>();
      try {
        const repo = getEmailTemplateRepository();
        const keys = TEMPLATE_DEFINITIONS.map((t) => t.key);
        stored = await repo.listTemplates([...keys]);
      } catch { /* DB unavailable — fall back to built-in defaults */ }

      const templates = TEMPLATE_DEFINITIONS.map((def) => {
        const record = stored.get(def.key);
        return {
          key: def.key,
          label: def.label,
          value: record?.value ?? def.defaultValue,
          isCustom: record !== undefined,
          updatedAt: record?.updatedAt ?? null,
          variables: [...def.variables],
          language: def.language,
          kind: def.kind,
        };
      });

      res.status(200).json({ templates });
    } catch (error) {
      next(error);
    }
  });

  router.put('/email-templates/:key', ...adminOnly, async (req, res, next) => {
    try {
      const { key } = req.params;
      if (!ALLOWED_TEMPLATE_KEYS.has(key as (typeof TEMPLATE_DEFINITIONS)[number]['key'])) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      const value = req.body?.value;
      if (typeof value !== 'string' || value.trim().length === 0) {
        res.status(400).json({ error: 'value must be a non-empty string' });
        return;
      }

      const record = await getEmailTemplateRepository().setTemplate(key, value);
      const def = TEMPLATE_DEFINITIONS.find((t) => t.key === key)!;
      res.status(200).json({ key, label: def.label, value: record.value, isCustom: true, updatedAt: record.updatedAt, variables: [...def.variables], language: def.language, kind: def.kind });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/email-templates/:key', ...adminOnly, async (req, res, next) => {
    try {
      const { key } = req.params;
      if (!ALLOWED_TEMPLATE_KEYS.has(key as (typeof TEMPLATE_DEFINITIONS)[number]['key'])) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      await getEmailTemplateRepository().deleteTemplate(key);
      const def = TEMPLATE_DEFINITIONS.find((t) => t.key === key)!;
      res.status(200).json({ key, label: def.label, value: def.defaultValue, isCustom: false, updatedAt: null, variables: [...def.variables], language: def.language, kind: def.kind });
    } catch (error) {
      next(error);
    }
  });

  // Story 9.6: Template preview with sample data
  router.post('/email-templates/:key/preview', ...adminOnly, async (req, res, next) => {
    try {
      const { key } = req.params;
      if (!ALLOWED_TEMPLATE_KEYS.has(key as (typeof TEMPLATE_DEFINITIONS)[number]['key'])) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      const repo = getEmailTemplateRepository();
      const storedValue = await repo.getTemplate(key);
      const def = TEMPLATE_DEFINITIONS.find((t) => t.key === key)!;
      const template = storedValue ?? def.defaultValue;

      const customData = (req.body?.sampleData ?? {}) as Record<string, string>;
      const vars = { ...TEMPLATE_SAMPLE_DATA, ...customData };
      const rendered = substituteTemplateVars(template, vars);

      res.json({ html: rendered });
    } catch (error) {
      next(error);
    }
  });

  // Story 9.7: Test email send
  router.post('/email-templates/:key/send-test', ...adminOnly, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { key } = req.params;
      if (!ALLOWED_TEMPLATE_KEYS.has(key as (typeof TEMPLATE_DEFINITIONS)[number]['key'])) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      const recipientEmail = req.body?.recipientEmail;
      if (typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
        res.status(400).json({ error: 'recipientEmail must be a valid email address' });
        return;
      }

      const repo = getEmailTemplateRepository();
      const storedValue = await repo.getTemplate(key);
      const def = TEMPLATE_DEFINITIONS.find((t) => t.key === key)!;
      const template = storedValue ?? def.defaultValue;

      const customData = (req.body?.sampleData ?? {}) as Record<string, string>;
      const vars = { ...TEMPLATE_SAMPLE_DATA, ...customData };
      const rendered = substituteTemplateVars(template, vars);
      const isHungarian = def.language === 'hu';
      const testBannerText = isHungarian
        ? 'Ez egy teszt email, amelyet a BitWLab admin felület küldött'
        : 'This is a test email sent from BitWLab admin panel';
      const testBanner = `<div style="background:#fff3cd;border:1px solid #ffc107;padding:8px 16px;margin-bottom:16px;font-size:13px">⚠️ ${testBannerText}</div>`;
      const html = testBanner + rendered;
      const subjectPrefix = isHungarian ? '[TESZT]' : '[TEST]';

      await sendRawEmail({ to: recipientEmail, subject: `${subjectPrefix} ${def.label}`, html });

      res.json({
        success: true,
        message: isHungarian ? `Teszt email elküldve ide: ${recipientEmail}` : `Test email sent to ${recipientEmail}`,
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Donations ───────────────────────────────────────────────────────────────

  router.get('/donations', ...adminOnly, async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50));
      const status = typeof req.query['status'] === 'string' && req.query['status'] !== 'all'
        ? req.query['status']
        : undefined;

      const result = await getDonationsService().listDonations({ page, limit, status });
      res.json({ ...result, page, limit });
    } catch (error) {
      next(error);
    }
  });

  router.get('/donations/export', ...adminOnly, async (_req, res, next) => {
    try {
      const rows = await getDonationsService().exportDonations();
      const header = 'id,user_id,amount,currency,status,transaction_id,user_upgraded,created_at,completed_at,user_email\n';
      const csv = rows.map((r) =>
        [
          r.id, r.userId ?? '', r.amount, r.currency, r.status,
          r.paypalTransactionId ?? '', r.userUpgraded, r.createdAt,
          r.completedAt ?? '', (r as typeof r & { userEmail?: string }).userEmail ?? '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
      const today = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="donations_${today}.csv"`);
      res.send(header + csv.join('\n'));
    } catch (error) {
      next(error);
    }
  });

  // ── Chart Config Management (Story 9.8) ─────────────────────────────────────

  router.get('/charts', ...adminOnly, async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50));
      const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;

      const result = await getChartConfigRepository().list({ page, limit, status });
      res.json({ ...result, page, limit });
    } catch (error) {
      next(error);
    }
  });

  router.post('/charts', ...adminOnly, async (req: AuthenticatedRequest, res, next) => {
    try {
      const adminUserId = req.user!.userId;
      const body = req.body as Record<string, unknown>;
      const { chartId, title, category, accessTier, description, methodology, status } = body;

      if (!chartId || typeof chartId !== 'string') { res.status(400).json({ error: 'chartId is required' }); return; }
      if (!title || typeof title !== 'string') { res.status(400).json({ error: 'title is required' }); return; }
      if (!category || typeof category !== 'string') { res.status(400).json({ error: 'category is required' }); return; }
      if (accessTier && !VALID_ACCESS_TIERS.has(accessTier as 'free' | 'premium')) { res.status(400).json({ error: 'accessTier must be free or premium' }); return; }
      if (status && !VALID_CHART_STATUSES.has(status as 'draft' | 'active' | 'inactive')) { res.status(400).json({ error: 'status must be draft, active, or inactive' }); return; }

      const chart = await getChartConfigRepository().create({
        chartId: chartId as string,
        title: title as string,
        category: category as string,
        accessTier: (accessTier as 'free' | 'premium') ?? 'free',
        description: typeof description === 'string' ? description : null,
        methodology: typeof methodology === 'string' ? methodology : null,
        status: (status as 'draft' | 'active' | 'inactive') ?? 'draft',
        createdBy: adminUserId,
      });

      await getAuditLogRepository().create({
        adminUserId,
        actionType: 'chart_create',
        targetType: 'chart',
        targetId: chart.id,
        changes: { chartId: chart.chartId, title: chart.title, status: chart.status },
        ipAddress: getIpAddress(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      res.status(201).json(chart);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === '23505') {
        res.status(409).json({ error: 'A chart with this ID already exists' });
        return;
      }
      next(error);
    }
  });

  router.patch('/charts/:chartId', ...adminOnly, async (req: AuthenticatedRequest, res, next) => {
    try {
      const adminUserId = req.user!.userId;
      const { chartId } = req.params;
      const body = req.body as Record<string, unknown>;

      if (body['accessTier'] && !VALID_ACCESS_TIERS.has(body['accessTier'] as 'free' | 'premium')) {
        res.status(400).json({ error: 'accessTier must be free or premium' }); return;
      }
      if (body['status'] && !VALID_CHART_STATUSES.has(body['status'] as 'draft' | 'active' | 'inactive')) {
        res.status(400).json({ error: 'status must be draft, active, or inactive' }); return;
      }

      const chart = await getChartConfigRepository().update(chartId!, {
        title: typeof body['title'] === 'string' ? body['title'] : undefined,
        category: typeof body['category'] === 'string' ? body['category'] : undefined,
        accessTier: body['accessTier'] as 'free' | 'premium' | undefined,
        description: body['description'] !== undefined ? (body['description'] as string | null) : undefined,
        methodology: body['methodology'] !== undefined ? (body['methodology'] as string | null) : undefined,
        status: body['status'] as 'draft' | 'active' | 'inactive' | undefined,
      });

      if (!chart) { res.status(404).json({ error: 'Chart not found' }); return; }

      await getAuditLogRepository().create({
        adminUserId,
        actionType: 'chart_edit',
        targetType: 'chart',
        targetId: chartId,
        changes: body as Record<string, unknown>,
        ipAddress: getIpAddress(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      res.json(chart);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/charts/:chartId', ...adminOnly, async (req: AuthenticatedRequest, res, next) => {
    try {
      const adminUserId = req.user!.userId;
      const { chartId } = req.params;

      const deleted = await getChartConfigRepository().delete(chartId!);
      if (!deleted) { res.status(404).json({ error: 'Chart not found' }); return; }

      await getAuditLogRepository().create({
        adminUserId,
        actionType: 'chart_delete',
        targetType: 'chart',
        targetId: chartId,
        ipAddress: getIpAddress(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ── Audit Logs (Story 9.9) ──────────────────────────────────────────────────

  router.get('/audit-logs', ...adminOnly, async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50));
      const actionType = typeof req.query['actionType'] === 'string' ? req.query['actionType'] : undefined;
      const targetType = typeof req.query['targetType'] === 'string' ? req.query['targetType'] : undefined;
      const adminUserId = typeof req.query['adminUserId'] === 'string' ? req.query['adminUserId'] : undefined;

      const result = await getAuditLogRepository().list({ page, limit, actionType, targetType, adminUserId });
      res.json({ ...result, page, limit });
    } catch (error) {
      next(error);
    }
  });

  return router;

  // ── Internal factory helpers ─────────────────────────────────────────────────

  function getConfigurationService(): DataRefreshConfigurationServiceContract {
    dataRefreshConfigurationService ??= createDefaultConfigurationService();
    return dataRefreshConfigurationService;
  }

  function getEmailTemplateRepository(): EmailTemplateRepositoryContract {
    emailTemplateRepository ??= createDefaultEmailTemplateRepository();
    return emailTemplateRepository;
  }

  function getDonationsService(): DonationsServiceContract {
    donationsService ??= createDefaultDonationsService();
    return donationsService;
  }

  function getUserManagementService(): UserManagementServiceContract {
    userManagementService ??= createDefaultUserManagementService();
    return userManagementService;
  }

  function getAuditLogRepository(): AuditLogRepositoryContract {
    auditLogRepository ??= createDefaultAuditLogRepository();
    return auditLogRepository;
  }

  function getChartConfigRepository(): ChartConfigRepositoryContract {
    chartConfigRepository ??= createDefaultChartConfigRepository();
    return chartConfigRepository;
  }
}

function normalizeOptions(
  optionsOrTokenInvalidations: AdminRouterOptions | TokenInvalidationReader,
): AdminRouterOptions {
  if ('findLatestInvalidationForUser' in optionsOrTokenInvalidations) {
    return { tokenInvalidations: optionsOrTokenInvalidations };
  }
  return optionsOrTokenInvalidations;
}

function requireDb(context: string): NonNullable<ReturnType<typeof getDatabasePool>> {
  const db = getDatabasePool();
  if (!db) throw new Error(`SUPABASE_DATABASE_URL is required for ${context}`);
  return db;
}

function createDefaultConfigurationService(): DataRefreshConfigurationService {
  const db = requireDb('admin data configuration');
  return new DataRefreshConfigurationService(new SystemConfigurationRepository(db));
}

function createDefaultEmailTemplateRepository(): EmailTemplateRepository {
  return new EmailTemplateRepository(requireDb('email template management'));
}

function createDefaultDonationsService(): DonationsService {
  const db = requireDb('donations management');
  return new DonationsService(db, { donationsRepository: new DonationsRepository(db) });
}

function createDefaultUserManagementService(): UserManagementService {
  const db = requireDb('user management');
  return new UserManagementService(db, { userRepo: new UserManagementRepository(db) });
}

function createDefaultAuditLogRepository(): AuditLogRepository {
  return new AuditLogRepository(requireDb('audit logging'));
}

function createDefaultChartConfigRepository(): ChartConfigRepository {
  return new ChartConfigRepository(requireDb('chart config management'));
}
