'use client';

import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const page = {
  minHeight: '100vh',
  background: '#f7f4ef',
  color: '#171412',
  fontFamily: 'var(--mz-font-sans)',
};
const shell = {
  width: '100%',
  maxWidth: 1120,
  margin: '0 auto',
  padding: '28px 24px 40px',
};
const top = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 48,
};
const logo = {
  width: 38,
  height: 38,
  borderRadius: 9,
  background: '#ff6b35',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
};
const badge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 10px',
  borderRadius: 999,
  background: '#fff',
  border: '1px solid #e5ddd4',
  color: '#51483f',
  fontSize: 13,
  fontWeight: 800,
};
const grid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
  gap: 28,
  alignItems: 'start',
};
const panel = {
  background: '#fff',
  border: '1px solid #e5ddd4',
  borderRadius: 10,
  padding: 24,
  boxShadow: '0 18px 40px rgba(23, 20, 18, 0.08)',
};
const button = {
  width: '100%',
  padding: '14px 18px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  background: '#635bff',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 900,
};
const muted = { color: '#6f665c' };

export default function ConnectClient({ token }) {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [linkInfo, setLinkInfo] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadInfo() {
      try {
        const res = await fetch(`/api/fc/link-info?token=${encodeURIComponent(token)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setLinkInfo(data);
      } catch {}
    }
    if (token) loadInfo();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleConnect() {
    if (!token) {
      setMessage('Missing connection token.');
      setStatus('error');
      return;
    }

    setMessage('');
    setStatus('loading');
    try {
      const res = await fetch('/api/fc/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const { clientSecret, publishableKey, error } = await res.json();
      if (error) {
        setMessage(error);
        setStatus('error');
        return;
      }
      const stripe = await loadStripe(publishableKey);
      const result = await stripe.collectFinancialConnectionsAccounts({ clientSecret });
      if (result.error) {
        setMessage(result.error.message);
        setStatus('error');
        return;
      }
      const linked = result.financialConnectionsSession.accounts.length;
      setStatus(linked > 0 ? 'done' : 'cancelled');
    } catch (e) {
      setMessage(e?.message || 'Something went wrong.');
      setStatus('error');
    }
  }

  return (
    <main style={page}>
      <div style={shell}>
        <header style={top}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logo}>M</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Mezza</div>
              <div style={{ ...muted, fontSize: 13 }}>Secure bank connection</div>
            </div>
          </div>
          <div style={badge}>
            <span style={{ color: '#635bff', fontWeight: 900 }}>stripe</span>
            <span>Financial Connections</span>
          </div>
        </header>

        <section style={grid}>
          <div>
            <div style={{ ...badge, marginBottom: 18, background: '#fff7f1', color: '#9a4525' }}>
              Requested by Mezza
            </div>
            <h1 style={{ fontSize: 44, lineHeight: 1.05, margin: '0 0 16px', letterSpacing: 0 }}>
              Connect your bank securely through Stripe.
            </h1>
            <p style={{ ...muted, fontSize: 18, lineHeight: 1.6, maxWidth: 720, margin: 0 }}>
              Mezza uses Stripe Financial Connections so you can grant read-only access to bank account
              information needed for underwriting. You will authenticate directly with your bank through Stripe.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 28 }}>
              <TrustItem title="Read-only" body="No payment or transfer permission is requested." />
              <TrustItem title="No credentials" body="Mezza never sees your bank login details." />
              <TrustItem title="You consent" body="You choose the accounts and data to share." />
            </div>
          </div>

          <aside style={panel}>
            <div style={{ fontSize: 12, color: '#8a817a', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 900 }}>
              Connection request
            </div>
            <h2 style={{ margin: '8px 0 4px', fontSize: 24 }}>
              {linkInfo?.venueName || 'Your business'}
            </h2>
            {(linkInfo?.caseRef || linkInfo?.groupName) && (
              <div style={{ ...muted, fontSize: 14, marginBottom: 18 }}>
                {[linkInfo.caseRef, linkInfo.groupName].filter(Boolean).join(' - ')}
              </div>
            )}

            <div style={{ borderTop: '1px solid #eee5dc', paddingTop: 18, marginTop: 18 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Data requested</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#51483f', lineHeight: 1.8 }}>
                <li>Bank account details</li>
                <li>Balances</li>
                <li>Transactions</li>
                <li>Account ownership information</li>
              </ul>
            </div>

            <button onClick={handleConnect} disabled={status === 'loading'} style={{ ...button, marginTop: 24, opacity: status === 'loading' ? 0.7 : 1 }}>
              {status === 'loading' ? 'Opening Stripe...' : 'Continue securely with Stripe'}
            </button>

            {status === 'done' && <p style={{ color: '#147a45', fontWeight: 800 }}>Connected. You can close this page.</p>}
            {status === 'cancelled' && <p style={{ color: '#8a5b00', fontWeight: 800 }}>No account was connected. You can try again.</p>}
            {status === 'error' && <p style={{ color: '#b42318', fontWeight: 800 }}>Something went wrong: {message || 'please retry.'}</p>}

            <p style={{ ...muted, fontSize: 12, lineHeight: 1.6, marginTop: 16 }}>
              This link opens a Stripe-hosted bank authentication flow. Contact your Mezza representative if you
              did not expect this request.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}

function TrustItem({ title, body }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5ddd4', borderRadius: 8, padding: 14 }}>
      <div style={{ fontWeight: 900, marginBottom: 4 }}>{title}</div>
      <div style={{ ...muted, fontSize: 13, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}
