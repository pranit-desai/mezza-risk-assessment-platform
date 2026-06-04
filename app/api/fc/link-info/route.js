import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

  const { data: conn, error } = await supabaseAdmin
    .from('connections')
    .select('id, case_id, status, cases(id, case_ref, venue_name, group_name)')
    .eq('link_token', token)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!conn) return NextResponse.json({ error: 'invalid link' }, { status: 404 });

  const c = conn.cases || {};
  return NextResponse.json({
    caseId: conn.case_id,
    caseRef: c.case_ref || '',
    venueName: c.venue_name || '',
    groupName: c.group_name || '',
    status: conn.status || 'pending',
  });
}
