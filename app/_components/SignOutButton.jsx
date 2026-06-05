'use client';

import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabaseBrowser';

export default function SignOutButton({ collapsed, compact = false, style }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="mz-clickable"
      style={{
        margin: compact ? 0 : (collapsed ? '0 12px 8px' : '0 12px 8px'),
        padding: compact ? '6px 10px' : 8,
        width: collapsed && !compact ? 40 : 'auto',
        ...style,
      }}
      title="Sign out"
    >
      {collapsed && !compact ? 'X' : 'Sign out'}
    </button>
  );
}
