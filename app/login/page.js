'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabaseBrowser';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [denied] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('denied') === '1';
  });

  async function signIn() {
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setLoading(false);
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#07111f', color: '#f5f1ea', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 380, padding: 32, background: '#040d18',
        border: '1px solid #14202e', borderRadius: 16, textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Mezza Risk Platform</h1>
        <p style={{ color: '#8aa0b2', fontSize: 14, margin: '0 0 24px' }}>
          Sign in with your company Google account to continue.
        </p>
        {denied && (
          <div style={{
            marginBottom: 16, padding: 12, borderRadius: 8,
            background: '#2a1416', border: '1px solid #5a2329', color: '#f0a0a0', fontSize: 13,
          }}>
            That account isn&apos;t authorized. Use your @mezzapay.com or @mezzaapp.com account.
          </div>
        )}
        <button onClick={signIn} disabled={loading} style={{
          width: '100%', padding: '12px 16px', fontSize: 15, fontWeight: 700,
          borderRadius: 10, border: 'none', cursor: 'pointer',
          background: '#00c49f', color: '#04121a',
        }}>
          {loading ? 'Redirecting…' : 'Sign in with Google'}
        </button>
      </div>
    </main>
  );
}
