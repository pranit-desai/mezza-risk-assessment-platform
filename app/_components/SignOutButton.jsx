'use client';

import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabaseBrowser';

export default function SignOutButton({ collapsed }) {
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
        margin: collapsed ? '0 12px 8px' : '0 12px 8px',
        padding: 8,
        width: collapsed ? 40 : 'auto',
      }}
      title="Sign out"
    >
      {collapsed ? 'X' : 'Sign out'}
    </button>
  );
}
