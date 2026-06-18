import { EmailTemplateRepository } from './email-template.repository';

function createDb(rows: unknown[] = []) {
  return { query: jest.fn().mockResolvedValue({ rows }) };
}

describe('EmailTemplateRepository', () => {
  it('returns null when template is not found', async () => {
    const repo = new EmailTemplateRepository(createDb([]));
    await expect(repo.getTemplate('alert_triggered_html')).resolves.toBeNull();
    expect(createDb().query).not.toHaveBeenCalled();
  });

  it('returns the stored value when template exists', async () => {
    const db = createDb([{ value: '<h1>Hello</h1>' }]);
    const repo = new EmailTemplateRepository(db);
    await expect(repo.getTemplate('alert_triggered_html')).resolves.toBe('<h1>Hello</h1>');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT value'),
      ['email_template_alert_triggered_html'],
    );
  });

  it('upserts and returns the record when setTemplate is called', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ key: 'email_template_alert_triggered_html', value: '<p>custom</p>', updated_at: '2026-06-17T08:00:00.000Z' }],
      }),
    };
    const repo = new EmailTemplateRepository(db);
    const result = await repo.setTemplate('alert_triggered_html', '<p>custom</p>');

    expect(result).toEqual({
      key: 'alert_triggered_html',
      value: '<p>custom</p>',
      updatedAt: '2026-06-17T08:00:00.000Z',
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (key) DO UPDATE'),
      ['email_template_alert_triggered_html', '<p>custom</p>'],
    );
  });

  it('returns true when deleteTemplate removes an existing row', async () => {
    const db = createDb([{ key: 'email_template_alert_triggered_html' }]);
    const repo = new EmailTemplateRepository(db);
    await expect(repo.deleteTemplate('alert_triggered_html')).resolves.toBe(true);
  });

  it('returns false when deleteTemplate finds no matching row', async () => {
    const repo = new EmailTemplateRepository(createDb([]));
    await expect(repo.deleteTemplate('alert_triggered_html')).resolves.toBe(false);
  });

  it('listTemplates returns a map of found records keyed by short key', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { key: 'email_template_alert_triggered_html', value: '<p>html</p>', updated_at: '2026-06-17T08:00:00.000Z' },
        ],
      }),
    };
    const repo = new EmailTemplateRepository(db);
    const result = await repo.listTemplates(['alert_triggered_html', 'alert_triggered_subject']);

    expect(result.size).toBe(1);
    expect(result.get('alert_triggered_html')).toEqual({
      key: 'alert_triggered_html',
      value: '<p>html</p>',
      updatedAt: '2026-06-17T08:00:00.000Z',
    });
    expect(result.get('alert_triggered_subject')).toBeUndefined();
  });
});
