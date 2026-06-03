'use client';
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

export default function ConnectPage({ params }) {
  const [status, setStatus] = useState('idle');

  async function handleConnect() {
    setStatus('loading');
    try {
      const res = await fetch('/api/fc/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token }),
      });
      const { clientSecret, publishableKey, error } = await res.json();
      if (error) { setStatus('error'); return; }
      const stripe = await loadStripe(publishableKey);
      const result = await stripe.collectFinancialConnectionsAccounts({ clientSecret });
      if (result.error) { setStatus('error'); return; }
      const linked = result.financialConnectionsSession.accounts.length;
      setStatus(linked > 0 ? 'done' : 'cancelled');
    } catch { setStatus('error'); }
  }

  return (
    <main style={{ maxWidth: 460, margin: '80px auto', textAlign: 'center', fontFamily: 'system-ui', color: '#1a1a1a' }}>
      <h1>Securely connect your bank</h1>
      <p>We'll review balances, transactions, and account ownership to assess your application. You choose exactly what to share, through your bank's own secure login.</p>
      <button onClick={handleConnect} disabled={status === 'loading'}
        style={{ padding: '12px 20px', fontSize: 16, borderRadius: 8, border: 'none', background: '#635bff', color: '#fff', cursor: 'pointer' }}>
        {status === 'loading' ? 'Opening…' : 'Connect bank account'}
      </button>
      {status === 'done' && <p>✅ Connected. You can close this page.</p>}
      {status === 'cancelled' && <p>No account was connected. You can try again.</p>}
      {status === 'error' && <p>Something went wrong — please retry.</p>}
    </main>
  );
}
