import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req) {
  const { caseId } = await req.json();

  const { data: c } = await supabaseAdmin
    .from('cases').select('id, region').eq('id', caseId).maybeSingle();
  if (!c) return NextResponse.json({ error: 'case not found' }, { status: 404 });
  if (c.region !== 'USA')
    return NextResponse.json({ error: 'Financial Connections is only available for USA cases.' }, { status: 400 });

  let { data: conn } = await supabaseAdmin
    .from('connections').select('*').eq('case_id', caseId).maybeSingle();

  if (!conn) {
    const token = crypto.randomBytes(24).toString('hex');
    const { data: created } = await supabaseAdmin
      .from('connections').insert({ case_id: caseId, link_token: token }).select().single();
    conn = created;
  }

  return NextResponse.json({ url: `${process.env.NEXT_PUBLIC_APP_URL}/connect/${conn.link_token}` });
}
