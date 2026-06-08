import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
    .select('*, venues(id)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });

  const groups = data.map(({ venues, ...g }) => ({
    ...g,
    venue_count: venues?.length ?? 0,
  }));

  return NextResponse.json(groups);
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
      created_by: user.id,
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
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
