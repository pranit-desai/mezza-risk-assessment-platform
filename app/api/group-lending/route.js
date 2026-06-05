import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABLE = 'group_lending_settings';

function isMissingTable(error) {
  return error?.code === '42P01' || String(error?.message || '').includes(TABLE);
}

async function requireUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function cleanRegion(region) {
  const value = String(region || '').toUpperCase();
  return value === 'USA' || value === 'UAE' ? value : '';
}

function cleanCurrency(currency, region) {
  const value = String(currency || '').toUpperCase();
  if (value === 'USD' || value === 'AED') return value;
  return region === 'USA' ? 'USD' : 'AED';
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function setupRequiredResponse(status = 500) {
  return NextResponse.json(
    {
      error: 'group_lending_settings table is not available',
      setupRequired: true,
      sqlFile: 'docs/sql/2026-06-05-group-lending-settings.sql',
    },
    { status }
  );
}

export async function GET(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const groupKey = url.searchParams.get('groupKey');
  const region = cleanRegion(url.searchParams.get('region'));

  if (!groupKey || !region) {
    return NextResponse.json({ error: 'groupKey and region are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('group_key', groupKey)
    .eq('region', region)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({
        setting: null,
        setupRequired: true,
        sqlFile: 'docs/sql/2026-06-05-group-lending-settings.sql',
      });
    }
    logSupabaseError('Group lending settings lookup failed', error, { groupKey, region });
    return NextResponse.json({ error: 'settings lookup failed' }, { status: 500 });
  }

  return NextResponse.json({ setting: data || null });
}

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const groupKey = String(body.groupKey || '').trim();
  const groupName = String(body.groupName || groupKey).trim();
  const region = cleanRegion(body.region);
  const currency = cleanCurrency(body.currency, region);
  const recommendedAmount = numberOrZero(body.recommendedAmount);
  const finalAmount = numberOrZero(body.finalAmount);
  const pilotPercent = body.pilotPercent === undefined ? 20 : numberOrZero(body.pilotPercent);

  if (!groupKey || !groupName || !region) {
    return NextResponse.json({ error: 'groupKey, groupName, and region are required' }, { status: 400 });
  }
  if (recommendedAmount < 0 || finalAmount < 0 || pilotPercent < 0 || pilotPercent > 100) {
    return NextResponse.json({ error: 'amounts must be positive and pilotPercent must be 0-100' }, { status: 400 });
  }

  const row = {
    group_key: groupKey,
    group_name: groupName,
    region,
    currency,
    recommended_amount: recommendedAmount,
    final_amount: finalAmount,
    pilot_percent: pilotPercent,
    notes: String(body.notes || '').trim() || null,
    updated_by: user.id,
    updated_by_email: user.email,
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .upsert(row, { onConflict: 'group_key,region' })
    .select('*')
    .single();

  if (error) {
    if (isMissingTable(error)) return setupRequiredResponse();
    logSupabaseError('Group lending settings save failed', error, { groupKey, region });
    return NextResponse.json({ error: 'settings save failed' }, { status: 500 });
  }

  return NextResponse.json({ setting: data });
}
