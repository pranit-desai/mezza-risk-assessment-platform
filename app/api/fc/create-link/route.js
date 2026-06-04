import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSupabaseProjectRef, logSupabaseError } from '@/lib/supabaseDiagnostics';

export const runtime = 'nodejs';

export async function POST(req) {
  const { caseId } = await req.json();
  const projectRef = getSupabaseProjectRef();

  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }

  const { data: c, error: caseError } = await supabaseAdmin
    .from('cases').select('id, region').eq('id', caseId).maybeSingle();
  if (caseError) {
    logSupabaseError('Create link case lookup failed', caseError, { caseId });
    return NextResponse.json(
      { error: 'case lookup failed', caseId, supabaseProject: projectRef },
      { status: 500 }
    );
  }
  if (!c) {
    return NextResponse.json(
      { error: 'case not found', caseId, supabaseProject: projectRef },
      { status: 404 }
    );
  }
  if (c.region !== 'USA')
    return NextResponse.json({ error: 'Financial Connections is only available for USA cases.' }, { status: 400 });

  let { data: conn, error: connError } = await supabaseAdmin
    .from('connections').select('*').eq('case_id', caseId).maybeSingle();
  if (connError) {
    logSupabaseError('Create link connection lookup failed', connError, { caseId });
    return NextResponse.json({ error: 'connection lookup failed' }, { status: 500 });
  }

  if (!conn) {
    const token = crypto.randomBytes(24).toString('hex');
    const { data: created, error: createError } = await supabaseAdmin
      .from('connections').insert({ case_id: caseId, link_token: token }).select().single();
    if (createError) {
      logSupabaseError('Create link insert failed', createError, { caseId });
      return NextResponse.json({ error: 'connection create failed' }, { status: 500 });
    }
    conn = created;
  }

  return NextResponse.json({ url: `${process.env.NEXT_PUBLIC_APP_URL}/connect/${conn.link_token}` });
}
