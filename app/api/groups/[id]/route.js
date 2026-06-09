import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';
import { resolvePublicUser } from '@/lib/publicUser';

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('*, venues!venues_group_id_fkey(*)')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      logSupabaseError('Group lookup by id failed', error, { groupId: id });
    }
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  data.venues = (data.venues || []).sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  return NextResponse.json(data);
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

  const region = String(body?.region || '').toUpperCase();
  if (!['UAE', 'USA'].includes(region)) {
    return NextResponse.json({ error: 'region must be UAE or USA' }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin.rpc('update_group_region', {
    p_group_id: id,
    p_region: region,
    p_updated_by: publicUser.id,
  });

  if (updateError) {
    if (updateError.code === 'P0002') {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    if (updateError.code === '42883') {
      return NextResponse.json(
        { error: 'Group region update migration has not been applied.' },
        { status: 500 }
      );
    }
    logSupabaseError('Group region update failed', updateError, {
      groupId: id,
      region,
      authUserId: user.id,
      publicUserId: publicUser.id,
    });
    return NextResponse.json({ error: 'Failed to update group region' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('*, venues!venues_group_id_fkey(id, venue_name, status, region, created_at)')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      logSupabaseError('Group lookup after region update failed', error, { groupId: id });
    }
    return NextResponse.json({ error: 'Group not found after update' }, { status: 404 });
  }

  return NextResponse.json({
    ...data,
    venues: data.venues || [],
    venue_count: data.venues?.length ?? 0,
  });
}
