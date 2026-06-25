export interface FredDataPoint {
  date: string;
  value: number;
}

export interface FredClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
const FRED_API_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

export class FredClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(options: FredClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async fetchSeries(seriesId: string): Promise<FredDataPoint[]> {
    const url = `${this.baseUrl}?id=${seriesId}`;
    const response = await this.fetchFn(url);

    if (!response.ok) {
      throw new FredClientError(`FRED request for ${seriesId} failed with status ${response.status}`, response.status);
    }

    const text = await response.text();
    return parseFredCsv(text);
  }

  // Uses the FRED JSON API — requires a free API key from https://fred.stlouisfed.org/docs/api/api_key.html
  async fetchSeriesWithApiKey(seriesId: string): Promise<FredDataPoint[]> {
    if (!this.apiKey) {
      throw new FredClientError(`FRED API key required for series ${seriesId}. Set FRED_API_KEY in environment.`);
    }
    const url = `${FRED_API_BASE_URL}?series_id=${seriesId}&api_key=${this.apiKey}&file_type=json`;
    const response = await this.fetchFn(url);

    if (!response.ok) {
      throw new FredClientError(`FRED API request for ${seriesId} failed with status ${response.status}`, response.status);
    }

    const json = await response.json() as { observations: Array<{ date: string; value: string }> };
    return json.observations
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
      .filter((p) => Number.isFinite(p.value));
  }

  async fetchT10Y3M(): Promise<FredDataPoint[]> {
    return this.fetchSeries('T10Y3M');
  }

  async fetchM2SL(): Promise<FredDataPoint[]> {
    return this.fetchSeries('M2SL');
  }

  async fetchGDP(): Promise<FredDataPoint[]> {
    return this.fetchSeries('GDP');
  }

  async fetchSP500(): Promise<FredDataPoint[]> {
    return this.fetchSeries('SP500');
  }

  // NAPM (ISM Manufacturing PMI) requires the FRED API key
  async fetchNAPM(): Promise<FredDataPoint[]> {
    return this.fetchSeriesWithApiKey('NAPM');
  }
}

export class FredClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function parseFredCsv(csv: string): FredDataPoint[] {
  const lines = csv.trim().split('\n');
  const points: FredDataPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const comma = line.indexOf(',');
    if (comma === -1) continue;

    const date = line.slice(0, comma).trim();
    const rawValue = line.slice(comma + 1).trim();

    if (rawValue === '.' || rawValue === '') continue;

    const value = parseFloat(rawValue);
    if (!Number.isFinite(value)) continue;

    points.push({ date, value });
  }

  return points;
}
