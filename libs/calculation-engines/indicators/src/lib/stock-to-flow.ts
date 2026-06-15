export interface BitcoinHalvingEpoch {
  startsAt: Date;
  blockSubsidyBtc: number;
}

const BLOCKS_PER_DAY = 144;
const DAYS_PER_YEAR = 365;

export const BITCOIN_HALVING_EPOCHS: BitcoinHalvingEpoch[] = [
  { startsAt: new Date(Date.UTC(2009, 0, 3)), blockSubsidyBtc: 50 },
  { startsAt: new Date(Date.UTC(2012, 10, 28)), blockSubsidyBtc: 25 },
  { startsAt: new Date(Date.UTC(2016, 6, 9)), blockSubsidyBtc: 12.5 },
  { startsAt: new Date(Date.UTC(2020, 4, 11)), blockSubsidyBtc: 6.25 },
  { startsAt: new Date(Date.UTC(2024, 3, 20)), blockSubsidyBtc: 3.125 },
];

export function calculateStockToFlow(
  date: Date,
  circulatingSupply: number,
  annualProduction = getAnnualBitcoinProduction(date),
): number {
  if (circulatingSupply <= 0) {
    throw new Error('Circulating supply must be greater than 0');
  }

  if (annualProduction <= 0) {
    throw new Error('Annual production must be greater than 0');
  }

  return roundToDecimals(circulatingSupply / annualProduction, 2);
}

export function getAnnualBitcoinProduction(date: Date): number {
  return getBlockSubsidyBtc(date) * BLOCKS_PER_DAY * DAYS_PER_YEAR;
}

export function getBlockSubsidyBtc(date: Date): number {
  const timestamp = date.getTime();
  const epoch = [...BITCOIN_HALVING_EPOCHS]
    .reverse()
    .find((halvingEpoch) => timestamp >= halvingEpoch.startsAt.getTime());

  if (!epoch) {
    throw new Error('Date must be on or after Bitcoin genesis');
  }

  return epoch.blockSubsidyBtc;
}

function roundToDecimals(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;

  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}
