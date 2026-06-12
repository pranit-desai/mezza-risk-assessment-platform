import seed from '@/app/_data/seasonality-library-v1.7.json';
import {
  MONTH_KEYS,
  MONTH_LABELS,
  SEASONALITY_REGIONS,
  currencyForRegion,
  defaultPatternIdForRegion,
  normalizeSeasonalityRegion,
} from './seasonalityConstants';

export const SEASONALITY_SOURCE_VERSION = seed.version || 'v1.7';
export const SEASONALITY_SETUP_SQL_FILE = 'supabase/migrations/20260612123000_seasonality_library.sql';
export {
  MONTH_KEYS,
  MONTH_LABELS,
  SEASONALITY_REGIONS,
  currencyForRegion,
  defaultPatternIdForRegion,
  normalizeSeasonalityRegion,
};

const EVEN_MONTH_WEIGHT = Number((100 / 12).toFixed(2));

export const USA_DEFAULT_PATTERN = {
  region: 'USA',
  pattern_id: 'USA_F&B_BASELINE',
  format: 'US F&B baseline',
  location: 'USA',
  n_venues: 0,
  confidence: 'STARTER',
  month_weights: Object.fromEntries(MONTH_KEYS.map((month) => [month, EVEN_MONTH_WEIGHT])),
  source_venues: null,
  notes: 'Starter baseline until US monthly case data is added to the data bank.',
  status: 'DEFAULT / BASELINE',
  pattern_use_status: 'DEFAULT / BASELINE',
  is_default: true,
};

export const SEASONALITY_SEED = {
  ...seed,
  patterns: [...seed.patterns, USA_DEFAULT_PATTERN],
  venue_reference: seed.venue_reference || [],
  venue_months: seed.venue_months || [],
};

export function defaultPatternForRegion(region, patterns = SEASONALITY_SEED.patterns) {
  const normalizedRegion = normalizeSeasonalityRegion(region);
  const defaultId = defaultPatternIdForRegion(normalizedRegion);
  return (
    patterns.find((pattern) => pattern.region === normalizedRegion && pattern.pattern_id === defaultId) ||
    patterns.find((pattern) => pattern.region === normalizedRegion && pattern.is_default) ||
    patterns.find((pattern) => pattern.region === normalizedRegion) ||
    USA_DEFAULT_PATTERN
  );
}

export function normalizePatternRow(row) {
  if (!row) return null;
  return {
    region: normalizeSeasonalityRegion(row.region),
    pattern_id: row.pattern_id,
    format: row.format || null,
    location: row.location || null,
    n_venues: Number(row.n_venues || 0),
    confidence: row.confidence || null,
    month_weights: normalizeMonthWeights(row.month_weights),
    source_venues: row.source_venues || null,
    notes: row.notes || null,
    status: row.status || row.pattern_use_status || null,
    pattern_use_status: row.pattern_use_status || row.status || null,
    is_default: Boolean(row.is_default),
    source_version: row.source_version || SEASONALITY_SOURCE_VERSION,
  };
}

export function normalizeMonthWeights(weights) {
  const source = weights && typeof weights === 'object' ? weights : {};
  return Object.fromEntries(MONTH_KEYS.map((month) => [month, cleanNumber(source[month])]));
}

export function normalizeMonthlyIntakeRows(rows, region) {
  const normalizedRegion = normalizeSeasonalityRegion(region);
  const currency = currencyForRegion(normalizedRegion);
  const cleaned = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const monthStart = normalizeMonthStart(row?.month_start || row?.month);
      const revenue = cleanNumber(row?.reported_revenue ?? row?.net_revenue ?? row?.net_aed ?? row?.gross_aed);
      if (!monthStart || revenue == null || revenue <= 0) return null;
      const transactions = cleanInteger(row?.transactions);
      const avgSales = transactions && transactions > 0 ? roundMoney(revenue / transactions) : cleanNumber(row?.avg_sales_per_transaction);
      return {
        month_start: monthStart,
        month: formatMonthLabel(monthStart),
        gross_aed: cleanNumber(row?.gross_aed) ?? revenue,
        net_aed: revenue,
        tax_aed: cleanNumber(row?.tax_aed),
        card_aed: cleanNumber(row?.card_aed),
        cash_aed: cleanNumber(row?.cash_aed),
        reported_revenue: revenue,
        transactions,
        avg_sales_per_transaction: avgSales,
        currency,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.month_start.localeCompare(b.month_start));

  const total = cleaned.reduce((sum, row) => sum + (row.reported_revenue || 0), 0);
  return cleaned.map((row) => ({
    ...row,
    seasonality_pct: total > 0 ? Number(((row.reported_revenue / total) * 100).toFixed(2)) : null,
  }));
}

export function buildSeasonalityExtractionMeta({ region, posExportsAreMonthly, monthlyRows, pattern }) {
  const normalizedRegion = normalizeSeasonalityRegion(region);
  const rows = normalizeMonthlyIntakeRows(monthlyRows, normalizedRegion);
  const selectedPattern = pattern || defaultPatternForRegion(normalizedRegion);
  const source = posExportsAreMonthly && rows.length > 0 ? 'monthly_pos_case_intake' : 'seasonality_library_reference';

  return {
    pos_monthly: rows.map((row) => ({
      month: row.month,
      gross_aed: row.gross_aed,
      net_aed: row.net_aed,
      tax_aed: row.tax_aed,
      card_aed: row.card_aed,
      cash_aed: row.cash_aed,
      seasonality_pct: row.seasonality_pct,
    })),
    extraction_meta: {
      pos_exports_are_monthly: Boolean(posExportsAreMonthly),
      seasonality_source: source,
      seasonality_region: normalizedRegion,
      seasonality_pattern: selectedPattern?.pattern_id || defaultPatternIdForRegion(normalizedRegion),
      seasonality_data_bank_version: SEASONALITY_SOURCE_VERSION,
      seasonality_monthly_rows: rows.length,
    },
  };
}

export function summarizeSeasonality({ patterns = [], venueReference = [], venueMonths = [] }) {
  const summary = {};
  for (const region of SEASONALITY_REGIONS) {
    const regionPatterns = patterns.filter((row) => normalizeSeasonalityRegion(row.region) === region);
    const regionVenues = venueReference.filter((row) => normalizeSeasonalityRegion(row.region) === region);
    const regionMonths = venueMonths.filter((row) => normalizeSeasonalityRegion(row.region) === region);
    const latestMonth = regionMonths
      .map((row) => row.month_start)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
    summary[region] = {
      region,
      patterns: regionPatterns.length,
      venues: regionVenues.length,
      monthlyRows: regionMonths.length,
      latestMonth,
      totalRevenue: roundMoney(regionMonths.reduce((sum, row) => sum + Number(row.reported_revenue || 0), 0)),
      defaultPatternId: defaultPatternForRegion(region, patterns)?.pattern_id || defaultPatternIdForRegion(region),
    };
  }
  return summary;
}

export function fallbackSeasonalityBundle(setupRequired = false, errors = []) {
  const patterns = SEASONALITY_SEED.patterns.map(normalizePatternRow).filter(Boolean);
  const venueReference = SEASONALITY_SEED.venue_reference;
  const venueMonths = SEASONALITY_SEED.venue_months;
  return {
    source: 'seed',
    sourceVersion: SEASONALITY_SOURCE_VERSION,
    setupRequired,
    setupSqlFile: SEASONALITY_SETUP_SQL_FILE,
    errors,
    patterns,
    venueReference,
    venueMonths,
    summary: summarizeSeasonality({ patterns, venueReference, venueMonths }),
  };
}

function normalizeMonthStart(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-01`;
}

function formatMonthLabel(monthStart) {
  const [year, month] = monthStart.split('-');
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return monthStart;
  return `${MONTH_LABELS[monthIndex]}-${String(year).slice(-2)}`;
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanInteger(value) {
  const number = cleanNumber(value);
  return number == null ? null : Math.round(number);
}

function roundMoney(value) {
  const number = cleanNumber(value);
  return number == null ? null : Number(number.toFixed(2));
}
