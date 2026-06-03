import { supabaseAdmin } from '@/lib/supabaseAdmin';
import ConnectLinkButton from './ConnectLinkButton';

export const dynamic = 'force-dynamic';

const wrap = { padding: '32px 40px', color: '#f5f1ea' };
const h1 = { fontSize: 30, fontWeight: 800, margin: 0 };
const card = { marginTop: 14, padding: 16, background: '#0c0a09', border: '1px solid #1f1a16', borderRadius: 12 };

export default async function BankPage({ params }) {
  const caseId = params.caseId;
  const { data: c } = await supabaseAdmin.from('cases').select('*').eq('id', caseId).maybeSingle();
  if (!c) return <div style={wrap}>Case not found.</div>;

  if (c.region !== 'USA') {
    return (
      <div style={wrap}>
        <h1 style={h1}>Bank Data</h1>
        <p style={{ color: '#b8a89c' }}>
          This case is region <b>{c.region ?? 'UAE'}</b>. Stripe Financial Connections works
          only with US bank accounts, so bank linking isn't available here. Use the document-pack
          pipeline for this case.
        </p>
      </div>
    );
  }

  const { data: conn } = await supabaseAdmin.from('connections').select('*').eq('case_id', caseId).maybeSingle();
  const { data: accounts } = await supabaseAdmin.from('fc_accounts').select('*').eq('case_id', caseId);
  const ids = (accounts ?? []).map(a => a.id);
  let txns = [];
  if (ids.length) {
    const { data } = await supabaseAdmin.from('fc_transactions').select('*')
      .in('account_id', ids).order('transacted_at', { ascending: false }).limit(100);
    txns = data ?? [];
  }

  return (
    <div style={wrap}>
      <h1 style={h1}>Bank Data (Stripe)</h1>
      <p style={{ color: '#e8a07a' }}>USA case · permissioned bank data via Stripe Financial Connections</p>

      <ConnectLinkButton caseId={caseId} status={conn?.status ?? 'none'} />

      {(accounts ?? []).map(a => (
        <div key={a.id} style={card}>
          <div style={{ fontWeight: 700 }}>{a.institution_name} ····{a.last4}</div>
          <div style={{ color: '#b8a89c' }}>{a.category} · {a.status}</div>
          <div style={{ marginTop: 6 }}>
            Available: {a.balance?.current?.usd != null ? `$${(a.balance.current.usd / 100).toFixed(2)}` : '—'}
          </div>
        </div>
      ))}

      {txns.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Recent transactions</h3>
          {txns.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1f1a16' }}>
              <span>{t.description}</span>
              <span>{(t.amount / 100).toFixed(2)} {String(t.currency || '').toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
