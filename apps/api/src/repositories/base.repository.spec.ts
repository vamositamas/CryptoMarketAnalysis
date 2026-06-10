import { BaseRepository } from './base.repository';

class TestRepository extends BaseRepository {
  public camel<T>(value: Parameters<BaseRepository['toCamelCase']>[0]): T {
    return this.toCamelCase<T>(value);
  }

  public snake<T>(value: Parameters<BaseRepository['toSnakeCase']>[0]): T {
    return this.toSnakeCase<T>(value);
  }
}

describe('BaseRepository', () => {
  const repository = new TestRepository();

  it('converts snake_case database rows to camelCase entities', () => {
    const entity = repository.camel<{
      id: string;
      emailVerified: boolean;
      createdAt: Date;
      profile: { fullName: string };
    }>({
      id: 'user-id',
      email_verified: true,
      created_at: '2026-06-10T12:30:00.000Z',
      profile: {
        full_name: 'Satoshi Analyst',
      },
    });

    expect(entity).toEqual({
      id: 'user-id',
      emailVerified: true,
      createdAt: new Date('2026-06-10T12:30:00.000Z'),
      profile: {
        fullName: 'Satoshi Analyst',
      },
    });
    expect(entity.createdAt).toBeInstanceOf(Date);
  });

  it('converts camelCase entities to snake_case database rows', () => {
    const row = repository.snake({
      emailVerified: false,
      oauthProviderId: 'google-id',
      alertRules: [{ createdAt: new Date('2026-06-10T12:30:00.000Z') }],
    });

    expect(row).toEqual({
      email_verified: false,
      oauth_provider_id: 'google-id',
      alert_rules: [{ created_at: new Date('2026-06-10T12:30:00.000Z') }],
    });
  });

  it('handles arrays, nulls, and non-date strings without mutation', () => {
    const row = {
      users: [
        { full_name: 'Ada', updated_at: null },
        { full_name: 'Grace', updated_at: 'not-a-date' },
      ],
    };

    const entity = repository.camel<{
      users: Array<{ fullName: string; updatedAt: string | null }>;
    }>(row);

    expect(entity).toEqual({
      users: [
        { fullName: 'Ada', updatedAt: null },
        { fullName: 'Grace', updatedAt: 'not-a-date' },
      ],
    });
    expect(row.users[0]).toHaveProperty('full_name');
  });
});
