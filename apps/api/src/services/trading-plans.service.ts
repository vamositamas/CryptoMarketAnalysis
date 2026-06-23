import { getDatabasePool } from '../config/database.config';
import {
  TradingPlansRepository,
  type CreateTradingPlanInput,
  type TradingPlanRecord,
} from '../repositories/trading-plans.repository';

export class TradingPlansError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

const VALID_DIRECTIONS = ['long', 'short', 'neutral'] as const;

export class TradingPlansService {
  constructor(
    private readonly repository: TradingPlansRepository = new TradingPlansRepository(getDatabasePool()),
  ) {}

  async list(userId: string): Promise<{ plans: TradingPlanRecord[] }> {
    const plans = await this.repository.listForUser(userId);
    return { plans };
  }

  async create(userId: string, body: unknown): Promise<TradingPlanRecord> {
    const input = validateCreateInput(body);
    return this.repository.create(userId, input);
  }

  async close(userId: string, planId: string, body: unknown): Promise<TradingPlanRecord> {
    const { closePrice } = validateCloseInput(body);
    const plan = await this.repository.close(userId, planId, closePrice);

    if (!plan) {
      throw new TradingPlansError('Plan not found or already closed', 404);
    }

    return plan;
  }

  async cancel(userId: string, planId: string): Promise<TradingPlanRecord> {
    const plan = await this.repository.cancel(userId, planId);

    if (!plan) {
      throw new TradingPlansError('Plan not found or already closed', 404);
    }

    return plan;
  }

  async delete(userId: string, planId: string): Promise<void> {
    const deleted = await this.repository.delete(userId, planId);

    if (!deleted) {
      throw new TradingPlansError('Plan not found', 404);
    }
  }
}

function validateCreateInput(body: unknown): CreateTradingPlanInput {
  if (typeof body !== 'object' || body === null) {
    throw new TradingPlansError('Invalid request body', 400);
  }

  const b = body as Record<string, unknown>;

  if (typeof b['direction'] !== 'string' || !VALID_DIRECTIONS.includes(b['direction'] as never)) {
    throw new TradingPlansError('direction must be long, short, or neutral', 400);
  }

  const entryPrice = parseFloat(String(b['entryPrice'] ?? ''));

  if (isNaN(entryPrice) || entryPrice <= 0) {
    throw new TradingPlansError('entryPrice must be a positive number', 400);
  }

  const title = typeof b['title'] === 'string' && b['title'].trim()
    ? b['title'].trim()
    : 'Untitled Plan';

  return {
    title: title.slice(0, 200),
    direction: b['direction'] as 'long' | 'short' | 'neutral',
    entryPrice,
    targetPrice: parseOptionalFloat(b['targetPrice']),
    stopLoss: parseOptionalFloat(b['stopLoss']),
    positionSizeUsd: parseOptionalFloat(b['positionSizeUsd']),
    riskPercent: parseOptionalFloat(b['riskPercent']),
    expiryDate: typeof b['expiryDate'] === 'string' ? b['expiryDate'] : null,
    notes: typeof b['notes'] === 'string' ? b['notes'].slice(0, 2000) : null,
  };
}

function validateCloseInput(body: unknown): { closePrice: number } {
  if (typeof body !== 'object' || body === null) {
    throw new TradingPlansError('Invalid request body', 400);
  }

  const b = body as Record<string, unknown>;
  const closePrice = parseFloat(String(b['closePrice'] ?? ''));

  if (isNaN(closePrice) || closePrice <= 0) {
    throw new TradingPlansError('closePrice must be a positive number', 400);
  }

  return { closePrice };
}

function parseOptionalFloat(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}
