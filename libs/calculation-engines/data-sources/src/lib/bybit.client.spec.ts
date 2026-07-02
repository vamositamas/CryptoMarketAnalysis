import { BybitClient, BybitClientError } from './bybit.client';

describe('BybitClient', () => {
  it('fetches and normalizes a single page of open interest history', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({
        retCode: 0,
        retMsg: 'OK',
        result: {
          list: [
            { openInterest: '62705.606', timestamp: '1782864000000' },
            { openInterest: '57312.363', timestamp: '1782777600000' },
          ],
        },
      }),
    );
    const client = new BybitClient({ baseUrl: 'https://api.bybit.com', fetchFn: fetchFn as never });

    await expect(client.fetchOpenInterestHistory()).resolves.toEqual([
      { date: '2026-06-30', openInterestBtc: 57312.363 },
      { date: '2026-07-01', openInterestBtc: 62705.606 },
    ]);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1d&limit=200',
    );
  });

  it('follows nextPageCursor to collect multiple pages of history', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          retCode: 0,
          retMsg: 'OK',
          result: {
            list: [{ openInterest: '100', timestamp: '1782864000000' }],
            nextPageCursor: 'cursor-1',
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          retCode: 0,
          retMsg: 'OK',
          result: {
            list: [{ openInterest: '90', timestamp: '1782777600000' }],
          },
        }),
      );
    const client = new BybitClient({ baseUrl: 'https://api.bybit.com', fetchFn: fetchFn as never });

    await expect(client.fetchOpenInterestHistory()).resolves.toEqual([
      { date: '2026-06-30', openInterestBtc: 90 },
      { date: '2026-07-01', openInterestBtc: 100 },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      'https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1d&limit=200&cursor=cursor-1',
    );
  });

  it('converts the latest open interest to USD using the current ticker price', async () => {
    const fetchFn = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/tickers')) {
        return Promise.resolve(
          createJsonResponse({
            retCode: 0,
            retMsg: 'OK',
            result: { list: [{ lastPrice: '60000', openInterest: '57528.01' }] },
          }),
        );
      }
      return Promise.resolve(
        createJsonResponse({
          retCode: 0,
          retMsg: 'OK',
          result: { list: [{ openInterest: '100', timestamp: '1782864000000' }] },
        }),
      );
    });
    const client = new BybitClient({ baseUrl: 'https://api.bybit.com', fetchFn: fetchFn as never });

    await expect(client.fetchOpenInterestLatest()).resolves.toEqual({
      date: '2026-06-17',
      value: 6_000_000,
    });
  });

  it('throws when the Bybit API returns a non-zero retCode', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({ retCode: 10001, retMsg: 'params error' }),
    );
    const client = new BybitClient({
      fetchFn: fetchFn as never,
      logger: { error: jest.fn() },
      retryAttempts: 0,
    });

    await expect(client.fetchOpenInterestHistory()).rejects.toBeInstanceOf(BybitClientError);
  });

  it('throws when the latest open interest response has no data', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({ retCode: 0, retMsg: 'OK', result: { list: [] } }),
    );
    const client = new BybitClient({
      fetchFn: fetchFn as never,
      logger: { error: jest.fn() },
      retryAttempts: 0,
    });

    await expect(client.fetchOpenInterestLatest()).rejects.toThrow(
      'Open interest response contained no valid data',
    );
  });
});

function createJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}
