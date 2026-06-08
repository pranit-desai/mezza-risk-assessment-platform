import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
    .select('id, region')
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
      created_by: user.id,
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
    return NextResponse.json({ error: 'Failed to create venue' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
