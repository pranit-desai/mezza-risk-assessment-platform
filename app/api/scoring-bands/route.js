import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolvePublicUser } from '@/lib/publicUser';
import { loadScoringPolicyBundle, saveScoringPolicy } from '@/lib/scoringPolicyStore';
import { normalizeScoringRegion } from '@/app/_lib/scoringPolicy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function requirePublicUser() {
  const authUser = await requireUser();
  if (!authUser) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };

  const { publicUser, error } = await resolvePublicUser(authUser);
  if (error) {
    return { response: NextResponse.json({ error: 'Failed to resolve user profile' }, { status: 500 }) };
  }
  if (!publicUser) {
    return {
      response: NextResponse.json(
        { error: 'Your user profile is not configured. Ask an admin to add your account.' },
        { status: 403 }
      ),
    };
  }

  return { authUser, publicUser };
}

export async function GET() {
  const { response } = await requirePublicUser();
  if (response) return response;

  const bundle = await loadScoringPolicyBundle();
  return NextResponse.json({
    ...bundle,
    passwordConfigured: scoringPasswordConfigured(),
    setupSqlFile: 'supabase/migrations/20260612110000_scoring_policies.sql',
  });
}

export async function POST(request) {
  const { response, authUser, publicUser } = await requirePublicUser();
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const passwordCheck = verifyScoringPassword(body?.password);
  if (!passwordCheck.configured) {
    return NextResponse.json({ error: 'SCORING_BANDS_PASSWORD is not configured on the server' }, { status: 503 });
  }
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: 'Password is incorrect' }, { status: 403 });
  }

  if (body?.action === 'verify_password') {
    return NextResponse.json({ unlocked: true });
  }

  if (body?.action === 'manual_lock') {
    const region = normalizeScoringRegion(body?.region);
    const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
      case_id: null,
      field_name: `scoring_policy.manual_lock`,
      old_value: null,
      new_value: JSON.stringify({ region, locked_by: publicUser.email || authUser.email }),
      value_type: 'top_level',
      changed_by: publicUser.email || authUser.email,
      changed_at: new Date().toISOString(),
    });
    if (auditError) {
      console.error('[scoring-bands] manual_lock audit insert failed', auditError.message);
    }
    return NextResponse.json({ locked: true });
  }

  if (body?.action !== 'save_policy') {
    return NextResponse.json({ error: 'Unsupported scoring-bands action' }, { status: 400 });
  }

  const region = normalizeScoringRegion(body?.region);
  const result = await saveScoringPolicy({
    region,
    policy: body?.policy,
    userId: publicUser.id,
    userEmail: publicUser.email || authUser.email,
    source: body?.source || 'policy_editor',
  });

  if (result.error) {
    return NextResponse.json(
      {
        error: result.setupRequired
          ? 'scoring_policies table is not available'
          : result.error,
        setupRequired: result.setupRequired,
        setupSqlFile: 'supabase/migrations/20260612110000_scoring_policies.sql',
      },
      { status: result.setupRequired ? 503 : 500 }
    );
  }

  return NextResponse.json({
    region,
    policy: result.policy,
    row: result.row,
  });
}

function scoringPasswordConfigured() {
  return Boolean(process.env.SCORING_BANDS_PASSWORD || process.env.SCORING_BANDS_PASSWORD_SHA256);
}

function verifyScoringPassword(password) {
  const plain = process.env.SCORING_BANDS_PASSWORD;
  const expectedHash = process.env.SCORING_BANDS_PASSWORD_SHA256;
  const supplied = String(password || '');

  if (expectedHash) {
    const suppliedHash = createHash('sha256').update(supplied).digest('hex');
    return { configured: true, ok: safeEqual(suppliedHash, expectedHash) };
  }
  if (plain) {
    return { configured: true, ok: safeEqual(supplied, plain) };
  }
  return { configured: false, ok: false };
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
