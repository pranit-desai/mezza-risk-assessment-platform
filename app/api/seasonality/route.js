import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { resolvePublicUser } from '@/lib/publicUser';
import { loadSeasonalityBundle } from '@/lib/seasonalityStore';

export const dynamic = 'force-dynamic';

async function requirePublicUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };

  const { publicUser, error } = await resolvePublicUser(user);
  if (error) {
    return { response: NextResponse.json({ error: 'Failed to resolve user profile' }, { status: 500 }) };
  }
  if (!publicUser) {
    return {
      response: NextResponse.json(
        { error: 'Your user profile is not configured. Ask an admin to add your account.' },
        { status: 403 }
      ),
    };
  }

  return { user, publicUser };
}

export async function GET() {
  const { response } = await requirePublicUser();
  if (response) return response;

  const bundle = await loadSeasonalityBundle();
  return NextResponse.json(bundle);
}
