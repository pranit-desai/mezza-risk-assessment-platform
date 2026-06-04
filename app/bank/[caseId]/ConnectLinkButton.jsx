'use client';
import { useState } from 'react';

export default function ConnectLinkButton({ caseId, status }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch('/api/fc/create-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      const data = await res.json();
      if (data.url) setUrl(data.url); else alert(data.error || 'Failed');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ margin: '16px 0' }}>
      <div style={{ color: '#b8a89c', marginBottom: 8 }}>Connection status: <b>{status}</b></div>
      <button onClick={generate} disabled={loading}
        style={{ padding: '10px 16px', background: '#e8604a', border: 'none', borderRadius: 8, color: '#0a0a0a', fontWeight: 700, cursor: 'pointer' }}>
        {loading ? 'Generating…' : 'Generate bank-connection link'}
      </button>
      {url && (
        <div style={{ marginTop: 12, padding: 12, background: '#0c0a09', border: '1px solid #1f1a16', borderRadius: 8 }}>
          <div style={{ color: '#8a817a', fontSize: 12, marginBottom: 6 }}>Send this link to the venue&apos;s bank signatory:</div>
          <code style={{ wordBreak: 'break-all', color: '#36c692' }}>{url}</code>
        </div>
      )}
    </div>
  );
}
