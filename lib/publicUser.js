import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';

export async function resolvePublicUser(authUser) {
  if (!authUser?.id) {
    return { publicUser: null, error: null };
  }

  const { data: userById, error: idError } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (idError) {
    logSupabaseError('Public user lookup by auth id failed', idError, {
      authUserId: authUser.id,
      authUserEmail: authUser.email,
    });
    return { publicUser: null, error: idError };
  }

  if (userById) {
    return { publicUser: userById, error: null };
  }

  if (!authUser.email) {
    return { publicUser: null, error: null };
  }

  const { data: userByEmail, error: emailError } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .ilike('email', authUser.email)
    .maybeSingle();

  if (emailError) {
    logSupabaseError('Public user lookup by email failed', emailError, {
      authUserId: authUser.id,
      authUserEmail: authUser.email,
    });
    return { publicUser: null, error: emailError };
  }

  return { publicUser: userByEmail || null, error: null };
}
