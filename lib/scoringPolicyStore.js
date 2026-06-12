import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';
import {
  SCORING_POLICY_REGIONS,
  defaultPolicyForRegion,
  normalizePolicyPayload,
  normalizeScoringRegion,
} from '@/app/_lib/scoringPolicy';

export const SCORING_POLICY_TABLE = 'scoring_policies';

export function isScoringPolicySetupError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST204' ||
    message.includes(SCORING_POLICY_TABLE) ||
    message.includes('schema cache')
  );
}

export async function loadScoringPolicy(region) {
  const normalizedRegion = normalizeScoringRegion(region);
  const fallback = {
    region: normalizedRegion,
    policy: defaultPolicyForRegion(normalizedRegion),
    source: 'default',
    row: null,
    setupRequired: false,
    error: null,
  };

  const { data, error } = await supabaseAdmin
    .from(SCORING_POLICY_TABLE)
    .select('*')
    .eq('region', normalizedRegion)
    .maybeSingle();

  if (error) {
    if (isScoringPolicySetupError(error)) {
      return { ...fallback, setupRequired: true, error: error.message };
    }
    logSupabaseError('Scoring policy lookup failed', error, { region: normalizedRegion });
    return { ...fallback, error: error.message };
  }

  if (!data) {
    const seeded = await saveScoringPolicy({
      region: normalizedRegion,
      policy: fallback.policy,
      userId: null,
      userEmail: 'system-seed',
      audit: false,
    });
    if (seeded.error) {
      return {
        ...fallback,
        setupRequired: seeded.setupRequired,
        error: seeded.error,
      };
    }
    return {
      region: normalizedRegion,
      policy: seeded.policy,
      source: 'database',
      row: seeded.row,
      setupRequired: false,
      error: null,
    };
  }

  return {
    region: normalizedRegion,
    policy: normalizePolicyPayload(normalizedRegion, data.policy_json),
    source: 'database',
    row: data,
    setupRequired: false,
    error: null,
  };
}

export async function loadScoringPolicyBundle() {
  const entries = await Promise.all(SCORING_POLICY_REGIONS.map((region) => loadScoringPolicy(region)));
  return entries.reduce((bundle, entry) => {
    bundle.policies[entry.region] = entry;
    bundle.setupRequired = bundle.setupRequired || entry.setupRequired;
    if (entry.error) bundle.errors.push(`${entry.region}: ${entry.error}`);
    return bundle;
  }, { policies: {}, setupRequired: false, errors: [] });
}

export async function saveScoringPolicy({ region, policy, userId, userEmail, audit = true }) {
  const normalizedRegion = normalizeScoringRegion(region);
  const normalizedPolicy = normalizePolicyPayload(normalizedRegion, policy);

  const { data: previous, error: previousError } = await supabaseAdmin
    .from(SCORING_POLICY_TABLE)
    .select('*')
    .eq('region', normalizedRegion)
    .maybeSingle();

  if (previousError && !isScoringPolicySetupError(previousError)) {
    logSupabaseError('Previous scoring policy lookup failed', previousError, { region: normalizedRegion });
    return { error: 'Failed to inspect existing scoring policy', setupRequired: false };
  }
  if (previousError && isScoringPolicySetupError(previousError)) {
    return { error: previousError.message, setupRequired: true };
  }

  const row = {
    region: normalizedRegion,
    version_label: normalizedPolicy.version_label,
    policy_json: normalizedPolicy,
    locked: true,
    updated_by: userId,
    updated_by_email: userEmail || null,
  };

  const { data, error } = await supabaseAdmin
    .from(SCORING_POLICY_TABLE)
    .upsert(row, { onConflict: 'region' })
    .select('*')
    .single();

  if (error) {
    if (isScoringPolicySetupError(error)) {
      return { error: error.message, setupRequired: true };
    }
    logSupabaseError('Scoring policy save failed', error, { region: normalizedRegion, userId });
    return { error: 'Failed to save scoring policy', setupRequired: false };
  }

  if (audit) {
    const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
      case_id: null,
      field_name: `scoring_policy.${normalizedRegion}`,
      old_value: previous ? JSON.stringify({ version_label: previous.version_label, updated_at: previous.updated_at }) : null,
      new_value: JSON.stringify({ version_label: data.version_label, updated_at: data.updated_at }),
      value_type: 'top_level',
      changed_by: userEmail || userId || 'unknown',
      changed_at: new Date().toISOString(),
    });
    if (auditError) {
      logSupabaseError('Scoring policy audit insert failed', auditError, { region: normalizedRegion, userId });
    }
  }

  return {
    row: data,
    policy: normalizePolicyPayload(normalizedRegion, data.policy_json),
    setupRequired: false,
    error: null,
  };
}
