export interface FredDataPoint {
  date: string;
  value: number;
}

export interface FredClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

export class FredClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: FredClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
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
