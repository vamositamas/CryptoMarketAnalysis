export interface RainbowBand {
  band: number;
  color: string;
  label: string;
}

interface RainbowBandDefinition {
  band: number;
  color: string;
  label: string;
  upperMultiplier: number;
}

const BITCOIN_GENESIS_DATE = new Date(Date.UTC(2009, 0, 3));
const DAYS_OFFSET = 1;
const POWER_LAW_EXPONENT = 5.84509376;
const POWER_LAW_INTERCEPT = -17.01593313;

const RAINBOW_BANDS: RainbowBandDefinition[] = [
  { band: 1, color: '#1e3a8a', label: 'Fire Sale', upperMultiplier: 0.25 },
  { band: 2, color: '#2563eb', label: 'Buy', upperMultiplier: 0.4 },
  { band: 3, color: '#06b6d4', label: 'Accumulate', upperMultiplier: 0.65 },
  { band: 4, color: '#22c55e', label: 'Still Cheap', upperMultiplier: 1 },
  { band: 5, color: '#84cc16', label: 'HODL', upperMultiplier: 1.6 },
  { band: 6, color: '#eab308', label: 'Is This A Bubble?', upperMultiplier: 2.5 },
  { band: 7, color: '#f97316', label: 'FOMO Intensifies', upperMultiplier: 4 },
  { band: 8, color: '#ef4444', label: 'Sell Seriously', upperMultiplier: 6.5 },
  { band: 9, color: '#7f1d1d', label: 'Maximum Bubble Territory', upperMultiplier: Number.POSITIVE_INFINITY },
];

export function calculateRainbowBands(date: Date, priceUsd: number): RainbowBand {
  if (date.getTime() < BITCOIN_GENESIS_DATE.getTime()) {
    throw new Error('Rainbow band date must be on or after Bitcoin genesis');
  }

  if (priceUsd < 0) {
    throw new Error('Price must be non-negative');
  }

  const fairValue = calculateRainbowFairValue(date);
  const matchingBand = RAINBOW_BANDS.find((band) => priceUsd <= fairValue * band.upperMultiplier);

  return toPublicRainbowBand(matchingBand ?? RAINBOW_BANDS[RAINBOW_BANDS.length - 1]);
}

export function calculateRainbowFairValue(date: Date): number {
  const daysSinceGenesis = daysBetweenUtc(BITCOIN_GENESIS_DATE, date) + DAYS_OFFSET;

  return Math.exp(POWER_LAW_INTERCEPT + POWER_LAW_EXPONENT * Math.log(daysSinceGenesis));
}

function daysBetweenUtc(start: Date, end: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / millisecondsPerDay);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toPublicRainbowBand(definition: RainbowBandDefinition): RainbowBand {
  return {
    band: definition.band,
    color: definition.color,
    label: definition.label,
  };
}
