import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function withDateAuditStamps(cases) {
  const ids = cases.map((row) => row.id).filter(Boolean);
  if (!ids.length) return cases;

  const { data: auditRows, error } = await supabaseAdmin
    .from('audit_log')
    .select('case_id, field_name, changed_by, changed_at, created_at')
    .in('case_id', ids)
    .in('field_name', ['submission_date', 'verdict_date'])
    .eq('value_type', 'top_level')
    .order('created_at', { ascending: false });

  if (error) {
    logSupabaseError('Case date audit lookup failed', error);
    return cases;
  }

  const stampByKey = new Map();
  for (const row of auditRows || []) {
    const key = `${row.case_id}:${row.field_name}`;
    if (!stampByKey.has(key)) {
      stampByKey.set(key, {
        by: row.changed_by || 'Unknown',
        at: row.changed_at || row.created_at,
      });
    }
  }

  return cases.map((row) => ({
    ...row,
    _audit_stamps: {
      submission_date: stampByKey.get(`${row.id}:submission_date`) || null,
      verdict_date: stampByKey.get(`${row.id}:verdict_date`) || null,
    },
  }));
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('cases')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    logSupabaseError('Cases lookup failed', error);
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }

  return NextResponse.json(await withDateAuditStamps(data || []));
}
