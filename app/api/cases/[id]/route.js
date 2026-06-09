import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function withDateAuditStamps(row) {
  if (!row?.id) return row;

  const { data: auditRows, error } = await supabaseAdmin
    .from('audit_log')
    .select('field_name, changed_by, changed_at, created_at')
    .eq('case_id', row.id)
    .in('field_name', ['submission_date', 'verdict_date'])
    .eq('value_type', 'top_level')
    .order('created_at', { ascending: false });

  if (error) {
    logSupabaseError('Single case date audit lookup failed', error, { caseId: row.id });
    return row;
  }

  const stamps = {};
  for (const auditRow of auditRows || []) {
    if (!stamps[auditRow.field_name]) {
      stamps[auditRow.field_name] = {
        by: auditRow.changed_by || 'Unknown',
        at: auditRow.changed_at || auditRow.created_at,
      };
    }
  }

  return {
    ...row,
    _audit_stamps: {
      submission_date: stamps.submission_date || null,
      verdict_date: stamps.verdict_date || null,
    },
  };
}

export async function GET(_request, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const query = supabaseAdmin.from('cases').select('*');
  const { data, error } = UUID_RE.test(id)
    ? await query.eq('id', id).maybeSingle()
    : await query.eq('case_ref', id).maybeSingle();

  if (error) {
    logSupabaseError('Case lookup failed', error, { caseId: id, authUserId: user.id });
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  return NextResponse.json(await withDateAuditStamps(data));
}
