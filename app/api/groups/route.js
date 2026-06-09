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

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('*, venues!venues_group_id_fkey(id, venue_name, status, region, created_at)')
    .order('created_at', { ascending: false });

  if (error) {
    logSupabaseError('Groups lookup failed', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }

  const groups = data.map(({ venues, ...g }) => ({
    ...g,
    venues: venues || [],
    venue_count: venues?.length ?? 0,
  }));

  return NextResponse.json(groups);
}

export async function POST(req) {
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { group_name, group_key, region, commercial_poc } = body ?? {};

  if (!group_name?.trim()) {
    return NextResponse.json({ error: 'group_name is required' }, { status: 400 });
  }
  if (!group_key?.trim()) {
    return NextResponse.json({ error: 'group_key is required' }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(group_key.trim())) {
    return NextResponse.json(
      { error: 'group_key must be lowercase letters, numbers, and hyphens only' },
      { status: 400 }
    );
  }
  if (group_key.trim().length > 80) {
    return NextResponse.json({ error: 'group_key must be 80 characters or fewer' }, { status: 400 });
  }
  if (!['UAE', 'USA'].includes(region)) {
    return NextResponse.json({ error: 'region must be UAE or USA' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('groups')
    .insert({
      group_name: group_name.trim(),
      group_key: group_key.trim(),
      region,
      commercial_poc: commercial_poc?.trim() || null,
      created_by: publicUser.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A group with that key already exists. Choose a different key.' },
        { status: 409 }
      );
    }
    logSupabaseError('Group create failed', error, {
      authUserId: user.id,
      publicUserId: publicUser.id,
      groupKey: group_key?.trim(),
      region,
    });
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
