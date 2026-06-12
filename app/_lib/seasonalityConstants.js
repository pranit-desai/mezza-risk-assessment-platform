export const SEASONALITY_REGIONS = ['UAE', 'USA'];
export const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function normalizeSeasonalityRegion(region) {
  return String(region || '').toUpperCase() === 'USA' ? 'USA' : 'UAE';
}

export function currencyForRegion(region) {
  return normalizeSeasonalityRegion(region) === 'USA' ? 'USD' : 'AED';
}

export function defaultPatternIdForRegion(region) {
  return normalizeSeasonalityRegion(region) === 'USA' ? 'USA_F&B_BASELINE' : 'UAE_F&B_PREMIUM_AGG';
}
