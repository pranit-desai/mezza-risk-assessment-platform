import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';
import { resolvePublicUser } from '@/lib/publicUser';

function getByPath(obj, path) {
  return path.reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return current[key];
  }, obj);
}

function setByPath(obj, path, value) {
  const root = obj && typeof obj === 'object' && !Array.isArray(obj) ? { ...obj } : {};
  let cursor = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const existing = cursor[key];
    cursor[key] = existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {};
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = value;
  return root;
}

function sameJson(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
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

  const path = String(body?.field_path || '')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!path.length || path.some((part) => !/^[A-Za-z0-9_]+$/.test(part))) {
    return NextResponse.json({ error: 'field_path is invalid' }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('cases')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (lookupError) {
    logSupabaseError('Case extracted field lookup failed', lookupError, {
      caseId: id,
      authUserId: user.id,
    });
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  const extracted = existing.extracted_json || {};
  const currentValue = getByPath(extracted, path);
  if (!sameJson(currentValue, body?.old_value)) {
    return NextResponse.json(
      { error: 'Conflict', detail: { current_value: currentValue ?? null } },
      { status: 409 }
    );
  }

  const nextExtracted = setByPath(extracted, path, body?.new_value ?? null);
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('cases')
    .update({
      extracted_json: nextExtracted,
      updated_by: publicUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError || !updated) {
    logSupabaseError('Case extracted field update failed', updateError, {
      caseId: id,
      fieldPath: path.join('.'),
      authUserId: user.id,
      publicUserId: publicUser.id,
    });
    return NextResponse.json({ error: 'Failed to update extracted field' }, { status: 500 });
  }

  await supabaseAdmin.from('audit_log').insert({
    case_id: id,
    field_name: path.join('.'),
    old_value: JSON.stringify(currentValue ?? null),
    new_value: JSON.stringify(body?.new_value ?? null),
    value_type: 'extracted_field',
    changed_by: publicUser.id,
    changed_by_email: publicUser.email,
  });

  return NextResponse.json(updated);
}
