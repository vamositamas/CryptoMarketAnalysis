import { retryWithBackoff, type RetryWithBackoffOptions } from './retry.util';

export interface GoogleTrendsPoint {
  date: string;
  value: number;
}

export interface GoogleTrendsClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, 'error'>;
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: RetryWithBackoffOptions['sleep'];
  now?: () => Date;
}

interface ExploreWidget {
  id: string;
  token: string;
  request: unknown;
}

interface ExploreResponse {
  widgets: ExploreWidget[];
}

interface MultilineTimelinePoint {
  time: string;
  value: number[];
}

interface MultilineResponse {
  default: {
    timelineData: MultilineTimelinePoint[];
  };
}

const DEFAULT_BASE_URL = 'https://trends.google.com/trends/api';
const EXPLORE_REFERER = 'https://trends.google.com/trends/explore?geo=&q=bitcoin&hl=en-US';
const JSON_SAFETY_PREFIX = ")]}'";
// Google Trends began serving reliable worldwide "interest over time" data around this date.
const HISTORY_START_DATE = '2010-01-01';
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class GoogleTrendsClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger: Pick<Console, 'error'>;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly sleep: RetryWithBackoffOptions['sleep'];
  private readonly now: () => Date;
  // Google Trends' unofficial API rejects "cold" requests with no prior browsing session —
  // the very first request (even when it 429s) sets a session cookie (NID) that subsequent
  // requests must present to be treated as coming from a real session. Cached per client
  // instance and reused/refreshed across calls so we don't warm up a new session every time.
  private readonly cookieJar = new Map<string, string>();

  constructor(options: GoogleTrendsClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger ?? console;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.sleep = options.sleep;
    this.now = options.now ?? (() => new Date());
  }

  // Fetches the full "bitcoin" worldwide search-interest history in a single request so
  // every point is normalized (0-100) against the same date range. Google Trends re-scales
  // values relative to whatever range is requested, so mixing a short "latest" window with
  // a long historical one would produce inconsistent, non-comparable values.
  async fetchBitcoinSearchInterestHistory(): Promise<GoogleTrendsPoint[]> {
    return retryWithBackoff(
      () => this.fetchHistoryNow(),
      this.retryAttempts,
      this.retryBaseDelayMs,
      { sleep: this.sleep, shouldRetry: isRetryableGoogleTrendsError },
    );
  }

  async fetchBitcoinSearchInterestLatest(): Promise<GoogleTrendsPoint> {
    const history = await this.fetchBitcoinSearchInterestHistory();
    const latest = history[history.length - 1];

    if (!latest) {
      throw new GoogleTrendsClientError('Google Trends response contained no data points');
    }

    return latest;
  }

  private async fetchHistoryNow(): Promise<GoogleTrendsPoint[]> {
    try {
      const endDate = this.now().toISOString().slice(0, 10);
      const exploreRequest = {
        comparisonItem: [{ keyword: 'bitcoin', geo: '', time: `${HISTORY_START_DATE} ${endDate}` }],
        category: 0,
        property: '',
      };

      const exploreUrl = `${this.baseUrl}/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(exploreRequest))}`;
      const exploreResponse = await this.fetchFn(exploreUrl, { headers: this.buildHeaders() });
      this.captureCookies(exploreResponse);

      if (!exploreResponse.ok) {
        throw new GoogleTrendsClientError(`Explore request failed with status ${exploreResponse.status}`, exploreResponse.status);
      }

      const explore = parseGoogleTrendsJson<ExploreResponse>(await exploreResponse.text());
      const widget = explore.widgets.find((w) => w.id === 'TIMESERIES');

      if (!widget) {
        throw new GoogleTrendsClientError('Explore response did not include a TIMESERIES widget');
      }

      const multilineUrl = `${this.baseUrl}/widgetdata/multiline?hl=en-US&tz=0&req=${encodeURIComponent(
        JSON.stringify(widget.request),
      )}&token=${encodeURIComponent(widget.token)}`;
      const multilineResponse = await this.fetchFn(multilineUrl, { headers: this.buildHeaders() });
      this.captureCookies(multilineResponse);

      if (!multilineResponse.ok) {
        throw new GoogleTrendsClientError(`Widget data request failed with status ${multilineResponse.status}`, multilineResponse.status);
      }

      const multiline = parseGoogleTrendsJson<MultilineResponse>(await multilineResponse.text());

      return multiline.default.timelineData
        .filter((point) => Number.isFinite(point.value?.[0]))
        .map((point) => ({
          date: new Date(Number(point.time) * 1000).toISOString().slice(0, 10),
          value: point.value[0]!,
        }));
    } catch (error) {
      this.logger.error('Google Trends bitcoin search interest request failed', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': BROWSER_USER_AGENT,
      Referer: EXPLORE_REFERER,
    };
    const cookieHeader = this.serializeCookies();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }
    return headers;
  }

  // Google Trends' unofficial endpoints reject requests with no session cookie, but the
  // very first request — even one that gets rejected — still returns a Set-Cookie header.
  // Capturing it here means the retry loop's next attempt (via retryWithBackoff) carries a
  // valid session and succeeds, without needing a separate "warm up" request.
  private captureCookies(response: Response): void {
    const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
    for (const setCookie of setCookieHeaders) {
      const pair = setCookie.split(';', 1)[0];
      const separatorIndex = pair?.indexOf('=') ?? -1;
      if (!pair || separatorIndex <= 0) continue;
      this.cookieJar.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
    }
  }

  private serializeCookies(): string {
    return [...this.cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

export class GoogleTrendsClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function isRetryableGoogleTrendsError(error: unknown): boolean {
  if (!(error instanceof GoogleTrendsClientError)) {
    return true;
  }

  return error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500;
}

// Google Trends prefixes its JSON responses with a fixed anti-hijacking string. Some
// endpoints (multiline) follow it with a stray comma before the actual JSON body while
// others (explore) don't, so strip the prefix and any leading ",\s*" left behind.
function parseGoogleTrendsJson<T>(text: string): T {
  const withoutPrefix = text.startsWith(JSON_SAFETY_PREFIX) ? text.slice(JSON_SAFETY_PREFIX.length) : text;
  const body = withoutPrefix.replace(/^\s*,\s*/, '');
  return JSON.parse(body) as T;
}
