import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';
import { resolvePublicUser } from '@/lib/publicUser';

const ALLOWED_FIELDS = new Set(['region', 'submission_date', 'verdict_date', 'status']);
const STATUS_VALUES = new Set([
  'under_review',
  'approved',
  'rejected',
  'on_hold',
  'additional_documents_requested',
]);
const AUDITED_FIELDS = new Set(['submission_date', 'verdict_date']);

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function normalizeDate(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new Error('date must use YYYY-MM-DD');
  }
  return String(value);
}

function normalizeFieldValue(fieldName, value) {
  if (fieldName === 'region') {
    const region = String(value || '').toUpperCase();
    if (!['UAE', 'USA'].includes(region)) {
      throw new Error('region must be UAE or USA');
    }
    return region;
  }

  if (fieldName === 'status') {
    const status = String(value || '').trim().toLowerCase();
    if (!STATUS_VALUES.has(status)) {
      throw new Error('status is not supported');
    }
    return status;
  }

  return normalizeDate(value);
}

export async function PATCH(request, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { publicUser, error: publicUserError } = await resolvePublicUser(user);
  if (publicUserError) {
    return NextResponse.json({ error: 'Failed to resolve user profile' }, { status: 500 });
  }
  if (!publicUser) {
    return NextResponse.json(
      { error: 'Your user profile is not configured. Ask an admin to add your account.' },
      { status: 403 }
    );
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const fieldName = String(body?.field_name || '');
  if (!ALLOWED_FIELDS.has(fieldName)) {
    return NextResponse.json({ error: 'Field is not allowed for update' }, { status: 400 });
  }

  let newValue;
  try {
    newValue = normalizeFieldValue(fieldName, body?.new_value);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let oldValue = null;
  if (AUDITED_FIELDS.has(fieldName)) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from('cases')
      .select(fieldName)
      .eq('id', id)
      .maybeSingle();

    if (currentError) {
      logSupabaseError('Case field audit lookup failed', currentError, {
        caseId: id,
        fieldName,
        authUserId: user.id,
        publicUserId: publicUser.id,
      });
      return NextResponse.json({ error: 'Failed to update case field' }, { status: 500 });
    }
    oldValue = current?.[fieldName] ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from('cases')
    .update({
      [fieldName]: newValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      logSupabaseError('Case field update failed', error, {
        caseId: id,
        fieldName,
        authUserId: user.id,
        publicUserId: publicUser.id,
      });
    }
    return NextResponse.json({ error: 'Failed to update case field' }, { status: 500 });
  }

  if (AUDITED_FIELDS.has(fieldName)) {
    const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
      case_id: id,
      field_name: fieldName,
      old_value: oldValue == null ? null : String(oldValue),
      new_value: newValue == null ? null : String(newValue),
      value_type: 'top_level',
      changed_by: publicUser.email || publicUser.id,
      changed_at: new Date().toISOString(),
    });

    if (auditError) {
      logSupabaseError('Case field audit insert failed', auditError, {
        caseId: id,
        fieldName,
        authUserId: user.id,
        publicUserId: publicUser.id,
      });
    }
  }

  return NextResponse.json(data);
}
