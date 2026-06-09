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

  const { group_id, venue_name, location, concept, lettable_sqm } = body ?? {};

  if (!group_id?.trim()) {
    return NextResponse.json({ error: 'group_id is required' }, { status: 400 });
  }
  if (!venue_name?.trim()) {
    return NextResponse.json({ error: 'venue_name is required' }, { status: 400 });
  }

  // region is always set server-side from the parent group — never trusted from the client
  const { data: group, error: groupError } = await supabaseAdmin
    .from('groups')
    .select('id, group_name, region')
    .eq('id', group_id.trim())
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('venues')
    .insert({
      group_id: group.id,
      venue_name: venue_name.trim(),
      location: location?.trim() || null,
      concept: concept?.trim() || null,
      lettable_sqm: lettable_sqm != null && lettable_sqm !== '' ? Number(lettable_sqm) : null,
      region: group.region,
      created_by: publicUser.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Region mismatch — venue cannot be added to this group' },
        { status: 400 }
      );
    }
    logSupabaseError('Venue create failed', error, {
      authUserId: user.id,
      publicUserId: publicUser.id,
      groupId: group.id,
      region: group.region,
    });
    return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 });
  }

  const { data: createdCase, error: caseError } = await supabaseAdmin
    .from('cases')
    .insert({
      group_id: group.id,
      venue_id: data.id,
      group_name: group.group_name,
      venue_name: data.venue_name,
      location: data.location,
      concept: data.concept,
      region: data.region,
      status: 'under_review',
    })
    .select()
    .single();

  if (caseError) {
    await supabaseAdmin.from('venues').delete().eq('id', data.id);
    logSupabaseError('Case create for venue failed', caseError, {
      authUserId: user.id,
      publicUserId: publicUser.id,
      groupId: group.id,
      venueId: data.id,
      region: group.region,
    });
    return NextResponse.json({ error: 'Failed to create case for venue' }, { status: 500 });
  }

  return NextResponse.json({ ...data, case: createdCase }, { status: 201 });
}
