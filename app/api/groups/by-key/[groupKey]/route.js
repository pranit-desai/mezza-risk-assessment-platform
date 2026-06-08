import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { groupKey } = await params;

  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('*, venues!venues_group_id_fkey(*)')
    .eq('group_key', groupKey)
    .single();

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      logSupabaseError('Group lookup by key failed', error, { groupKey });
    }
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  data.venues = (data.venues || []).sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  return NextResponse.json(data);
}
