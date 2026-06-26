// Power-law model for CVDD, calibrated against Bitcoin Magazine Pro reference chart.
// Formula: CVDD(day) = 10^(INTERCEPT + EXPONENT * log10(days_since_genesis))
const GENESIS_MS = Date.UTC(2009, 0, 3);
const CVDD_EXPONENT = 5.165;
const CVDD_INTERCEPT = -14.955;

export function calculateCvdd(dateStr: string): number {
  const ms = new Date(`${dateStr}T00:00:00Z`).getTime();
  const days = Math.floor((ms - GENESIS_MS) / 86_400_000) + 1;
  return Math.pow(10, CVDD_INTERCEPT + CVDD_EXPONENT * Math.log10(Math.max(1, days)));
}
