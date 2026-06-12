import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';
import {
  SEASONALITY_SEED,
  SEASONALITY_SETUP_SQL_FILE,
  SEASONALITY_SOURCE_VERSION,
  buildSeasonalityExtractionMeta,
  currencyForRegion,
  defaultPatternForRegion,
  defaultPatternIdForRegion,
  fallbackSeasonalityBundle,
  normalizeMonthlyIntakeRows,
  normalizePatternRow,
  normalizeSeasonalityRegion,
  summarizeSeasonality,
} from '@/app/_lib/seasonalityLibrary';

export const SEASONALITY_PATTERN_TABLE = 'seasonality_patterns';
export const SEASONALITY_VENUE_TABLE = 'seasonality_venues';
export const SEASONALITY_MONTH_TABLE = 'seasonality_venue_months';

export function isSeasonalitySetupError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST204' ||
    message.includes('seasonality_') ||
    message.includes('schema cache')
  );
}

export async function loadSeasonalityBundle() {
  const seedResult = await ensureSeasonalitySeeded();
  if (seedResult.setupRequired) {
    return fallbackSeasonalityBundle(true, [seedResult.error || 'Seasonality tables are not available.']);
  }
  if (seedResult.error) {
    return fallbackSeasonalityBundle(false, [seedResult.error]);
  }

  const [patternsResult, venuesResult, monthsResult] = await Promise.all([
    supabaseAdmin
      .from(SEASONALITY_PATTERN_TABLE)
      .select('*')
      .order('region', { ascending: true })
      .order('is_default', { ascending: false })
      .order('pattern_id', { ascending: true }),
    supabaseAdmin
      .from(SEASONALITY_VENUE_TABLE)
      .select('*')
      .order('region', { ascending: true })
      .order('source_group', { ascending: true })
      .order('venue_name', { ascending: true }),
    supabaseAdmin
      .from(SEASONALITY_MONTH_TABLE)
      .select('*')
      .order('region', { ascending: true })
      .order('month_start', { ascending: false }),
  ]);

  const error = patternsResult.error || venuesResult.error || monthsResult.error;
  if (error) {
    if (isSeasonalitySetupError(error)) {
      return fallbackSeasonalityBundle(true, [error.message]);
    }
    logSupabaseError('Seasonality library lookup failed', error);
    return fallbackSeasonalityBundle(false, [error.message || 'Failed to load seasonality library.']);
  }

  const patterns = (patternsResult.data || []).map(normalizePatternRow).filter(Boolean);
  const venueReference = venuesResult.data || [];
  const venueMonths = monthsResult.data || [];

  return {
    source: 'database',
    sourceVersion: SEASONALITY_SOURCE_VERSION,
    setupRequired: false,
    setupSqlFile: SEASONALITY_SETUP_SQL_FILE,
    errors: [],
    patterns,
    venueReference,
    venueMonths,
    summary: summarizeSeasonality({ patterns, venueReference, venueMonths }),
  };
}

export async function seasonalitySnapshotForCase({ region, posExportsAreMonthly, monthlyRows, patterns }) {
  const normalizedRegion = normalizeSeasonalityRegion(region);
  const pattern = defaultPatternForRegion(normalizedRegion, patterns || SEASONALITY_SEED.patterns);
  return buildSeasonalityExtractionMeta({
    region: normalizedRegion,
    posExportsAreMonthly,
    monthlyRows,
    pattern,
  });
}

export async function saveSeasonalityMonthlyRows({
  region,
  group,
  venue,
  caseRow,
  rows,
  publicUser,
}) {
  const normalizedRegion = normalizeSeasonalityRegion(region);
  const monthlyRows = normalizeMonthlyIntakeRows(rows, normalizedRegion);
  if (!monthlyRows.length) {
    return { saved: 0, rows: [], setupRequired: false, error: null };
  }

  const defaultPatternId = defaultPatternIdForRegion(normalizedRegion);
  const sourceReference = caseRow?.case_ref ? `case:${caseRow.case_ref}` : `case:${caseRow?.id || 'new-case'}`;
  const currency = currencyForRegion(normalizedRegion);
  const createdBy = publicUser?.id || null;

  const venueRef = {
    region: normalizedRegion,
    venue_name: venue?.venue_name || caseRow?.venue_name || 'Unknown venue',
    legal_entity: venue?.venue_name || caseRow?.venue_name || 'Unknown venue',
    source_group: group?.group_name || caseRow?.group_name || null,
    city: venue?.location || null,
    location: venue?.location || null,
    venue_format: venue?.concept || null,
    location_type: null,
    data_coverage: `${monthlyRows.length} monthly row${monthlyRows.length === 1 ? '' : 's'}`,
    months_loaded: monthlyRows.length,
    pattern_status: 'case_intake_monthly',
    revenue_basis: 'POS monthly export',
    primary_source: 'New Case intake',
    secondary_source: null,
    notes: `Added from ${sourceReference}`,
    concept_type: venue?.concept || null,
    closest_pattern_id: defaultPatternId,
    concept_match_confidence: 'Case intake',
    concept_match_notes: 'Captured during new-case upload flow.',
    source_version: SEASONALITY_SOURCE_VERSION,
    created_by: createdBy,
    updated_by: createdBy,
  };

  const { error: venueError } = await supabaseAdmin
    .from(SEASONALITY_VENUE_TABLE)
    .upsert(venueRef, { onConflict: 'region,venue_name,legal_entity' });

  if (venueError) {
    if (isSeasonalitySetupError(venueError)) {
      return { saved: 0, rows: [], setupRequired: true, error: venueError.message };
    }
    logSupabaseError('Seasonality venue reference save failed', venueError, {
      region: normalizedRegion,
      caseId: caseRow?.id,
      venueId: venue?.id,
    });
    return { saved: 0, rows: [], setupRequired: false, error: 'Failed to save seasonality venue reference' };
  }

  const dbRows = monthlyRows.map((row) => ({
    region: normalizedRegion,
    group_id: group?.id || caseRow?.group_id || null,
    venue_id: venue?.id || caseRow?.venue_id || null,
    case_id: caseRow?.id || null,
    venue_name: venue?.venue_name || caseRow?.venue_name || 'Unknown venue',
    legal_entity: venue?.venue_name || caseRow?.venue_name || 'Unknown venue',
    source_group: group?.group_name || caseRow?.group_name || null,
    city: venue?.location || null,
    location: venue?.location || null,
    venue_format: venue?.concept || null,
    location_type: null,
    month_start: row.month_start,
    month_label: row.month,
    reported_revenue: row.reported_revenue,
    transactions: row.transactions,
    avg_sales_per_transaction: row.avg_sales_per_transaction,
    currency,
    revenue_basis: 'POS monthly export',
    source_type: 'case intake',
    source_reference: sourceReference,
    notes: 'Added from New Case monthly POS intake',
    pattern_eligibility: 'Candidate',
    concept_type: venue?.concept || null,
    closest_pattern_id: defaultPatternId,
    concept_match_confidence: 'Case intake',
    concept_match_notes: 'Captured during new-case upload flow.',
    include_in_aggregate: true,
    source_version: SEASONALITY_SOURCE_VERSION,
    created_by: createdBy,
    updated_by: createdBy,
  }));

  const { data, error } = await supabaseAdmin
    .from(SEASONALITY_MONTH_TABLE)
    .upsert(dbRows, { onConflict: 'region,venue_name,month_start,source_reference' })
    .select('*');

  if (error) {
    if (isSeasonalitySetupError(error)) {
      return { saved: 0, rows: [], setupRequired: true, error: error.message };
    }
    logSupabaseError('Seasonality monthly rows save failed', error, {
      region: normalizedRegion,
      caseId: caseRow?.id,
      venueId: venue?.id,
    });
    return { saved: 0, rows: [], setupRequired: false, error: 'Failed to save seasonality monthly rows' };
  }

  await auditSeasonalitySave({ caseRow, publicUser, saved: data?.length || 0, sourceReference });
  return { saved: data?.length || 0, rows: data || [], setupRequired: false, error: null };
}

async function ensureSeasonalitySeeded() {
  const patternCount = await tableCount(SEASONALITY_PATTERN_TABLE);
  if (patternCount.error) return setupResult(patternCount.error);

  const venueCount = await tableCount(SEASONALITY_VENUE_TABLE);
  if (venueCount.error) return setupResult(venueCount.error);

  const monthCount = await tableCount(SEASONALITY_MONTH_TABLE);
  if (monthCount.error) return setupResult(monthCount.error);

  if (patternCount.count === 0) {
    const rows = SEASONALITY_SEED.patterns.map((row) => {
      const normalized = normalizePatternRow(row);
      return {
        region: normalized.region,
        pattern_id: normalized.pattern_id,
        format: normalized.format,
        location: normalized.location,
        n_venues: normalized.n_venues,
        confidence: normalized.confidence,
        month_weights: normalized.month_weights,
        source_venues: normalized.source_venues,
        notes: normalized.notes,
        pattern_use_status: normalized.pattern_use_status,
        is_default: normalized.is_default,
        source_version: SEASONALITY_SOURCE_VERSION,
      };
    });
    const seeded = await upsertChunks(SEASONALITY_PATTERN_TABLE, rows, 'region,pattern_id');
    if (seeded.error) return setupResult(seeded.error);
  }

  if (venueCount.count === 0) {
    const rows = (SEASONALITY_SEED.venue_reference || []).map((row) => ({
      ...row,
      region: normalizeSeasonalityRegion(row.region),
      legal_entity: row.legal_entity || row.venue_name,
      source_version: SEASONALITY_SOURCE_VERSION,
    }));
    const seeded = await upsertChunks(SEASONALITY_VENUE_TABLE, rows, 'region,venue_name,legal_entity');
    if (seeded.error) return setupResult(seeded.error);
  }

  if (monthCount.count === 0) {
    const rows = (SEASONALITY_SEED.venue_months || []).map((row) => ({
      ...row,
      region: normalizeSeasonalityRegion(row.region),
      legal_entity: row.legal_entity || row.venue_name,
      source_reference: row.source_reference || 'Mezza_Seasonality_Library_v1.7.xlsx',
      source_version: SEASONALITY_SOURCE_VERSION,
    }));
    const seeded = await upsertChunks(SEASONALITY_MONTH_TABLE, rows, 'region,venue_name,month_start,source_reference');
    if (seeded.error) return setupResult(seeded.error);
  }

  return { setupRequired: false, error: null };
}

async function tableCount(table) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('id', { count: 'exact', head: true });
  return { count: count || 0, error };
}

async function upsertChunks(table, rows, onConflict) {
  const size = 100;
  for (let index = 0; index < rows.length; index += size) {
    const chunk = rows.slice(index, index + size);
    const { error } = await supabaseAdmin
      .from(table)
      .upsert(chunk, { onConflict });
    if (error) return { error };
  }
  return { error: null };
}

function setupResult(error) {
  if (isSeasonalitySetupError(error)) {
    return { setupRequired: true, error: error.message };
  }
  logSupabaseError('Seasonality seed check failed', error);
  return { setupRequired: false, error: error?.message || 'Failed to seed seasonality library' };
}

async function auditSeasonalitySave({ caseRow, publicUser, saved, sourceReference }) {
  if (!caseRow?.id || !saved) return;
  const { error } = await supabaseAdmin.from('audit_log').insert({
    case_id: caseRow.id,
    field_name: 'seasonality.monthly_rows',
    old_value: null,
    new_value: JSON.stringify({ saved, source_reference: sourceReference }),
    value_type: 'top_level',
    changed_by: publicUser?.email || publicUser?.id || 'unknown',
    changed_at: new Date().toISOString(),
  });
  if (error) {
    logSupabaseError('Seasonality audit insert failed', error, { caseId: caseRow.id });
  }
}
