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
      const exploreResponse = await this.fetchFn(exploreUrl, { headers: { 'User-Agent': BROWSER_USER_AGENT } });

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
      const multilineResponse = await this.fetchFn(multilineUrl, { headers: { 'User-Agent': BROWSER_USER_AGENT } });

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

// Google Trends prefixes its JSON responses with a fixed anti-hijacking string.
function parseGoogleTrendsJson<T>(text: string): T {
  const body = text.startsWith(JSON_SAFETY_PREFIX) ? text.slice(JSON_SAFETY_PREFIX.length) : text;
  return JSON.parse(body) as T;
}
