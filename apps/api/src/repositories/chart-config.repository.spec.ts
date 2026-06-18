import { ChartConfigRepository } from './chart-config.repository';

const mockDate = new Date('2024-01-01T00:00:00.000Z');

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chart-id-1',
    chart_id: 'mvrv-z-score',
    title: 'MVRV Z-Score',
    category: 'Valuation Models',
    access_tier: 'free',
    description: 'A valuation model',
    methodology: 'Calculated using on-chain data',
    status: 'active',
    created_by: 'admin-1',
    created_at: mockDate,
    updated_at: mockDate,
    ...overrides,
  };
}

describe('ChartConfigRepository', () => {
  let db: { query: jest.Mock };
  let repo: ChartConfigRepository;

  beforeEach(() => {
    db = { query: jest.fn() };
    repo = new ChartConfigRepository(db as never);
  });

  describe('list', () => {
    it('returns charts and total without status filter', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [makeRow()] });

      const result = await repo.list({ page: 1, limit: 50 });

      expect(result.total).toBe(3);
      expect(result.charts).toHaveLength(1);
      expect(result.charts[0]).toEqual({
        id: 'chart-id-1',
        chartId: 'mvrv-z-score',
        title: 'MVRV Z-Score',
        category: 'Valuation Models',
        accessTier: 'free',
        description: 'A valuation model',
        methodology: 'Calculated using on-chain data',
        status: 'active',
        createdBy: 'admin-1',
        createdAt: mockDate.toISOString(),
        updatedAt: mockDate.toISOString(),
      });
    });

    it('applies status filter when provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.list({ page: 1, limit: 50, status: 'active' });

      const countCall = db.query.mock.calls[0];
      expect(countCall[0]).toContain('WHERE');
      expect(countCall[1]).toContain('active');
    });

    it('handles null optional fields', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeRow({ description: null, methodology: null, created_by: null })] });

      const result = await repo.list({ page: 1, limit: 50 });
      expect(result.charts[0].description).toBeNull();
      expect(result.charts[0].methodology).toBeNull();
      expect(result.charts[0].createdBy).toBeNull();
    });
  });

  describe('getById', () => {
    it('returns a chart when found', async () => {
      db.query.mockResolvedValue({ rows: [makeRow()] });
      const result = await repo.getById('chart-id-1');
      expect(result?.id).toBe('chart-id-1');
    });

    it('returns null when not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await repo.getById('missing');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts and returns the new chart', async () => {
      db.query.mockResolvedValue({ rows: [makeRow()] });

      const result = await repo.create({
        chartId: 'mvrv-z-score',
        title: 'MVRV Z-Score',
        category: 'Valuation Models',
        accessTier: 'free',
        status: 'active',
        createdBy: 'admin-1',
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chart_configs'),
        expect.arrayContaining(['mvrv-z-score', 'MVRV Z-Score', 'Valuation Models', 'free']),
      );
      expect(result.chartId).toBe('mvrv-z-score');
    });
  });

  describe('update', () => {
    it('returns updated chart when fields change', async () => {
      const updated = makeRow({ title: 'New Title', status: 'inactive' });
      db.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.update('chart-id-1', { title: 'New Title', status: 'inactive' });

      const call = db.query.mock.calls[0];
      expect(call[0]).toContain('UPDATE chart_configs');
      expect(call[1]).toContain('New Title');
      expect(result?.title).toBe('New Title');
    });

    it('falls back to getById when no fields provided', async () => {
      db.query.mockResolvedValue({ rows: [makeRow()] });
      const result = await repo.update('chart-id-1', {});
      expect(result?.id).toBe('chart-id-1');
    });

    it('returns null when chart not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = await repo.update('missing', { title: 'X' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('returns true when a row is deleted', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'chart-id-1' }], rowCount: 1 });
      const result = await repo.delete('chart-id-1');
      expect(result).toBe(true);
    });

    it('returns false when no row deleted', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.delete('missing');
      expect(result).toBe(false);
    });
  });
});
