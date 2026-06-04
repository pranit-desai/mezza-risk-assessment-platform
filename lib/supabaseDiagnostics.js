export function getSupabaseProjectRef() {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
    return host.split('.')[0] || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function logSupabaseError(context, error, details = {}) {
  console.error(context, {
    ...details,
    supabaseProject: getSupabaseProjectRef(),
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}
