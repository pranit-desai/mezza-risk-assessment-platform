import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSupabaseProjectRef, logSupabaseError } from '@/lib/supabaseDiagnostics';
import ConnectLinkButton from './ConnectLinkButton';

export const dynamic = 'force-dynamic';

const wrap = { padding: '32px 40px', color: '#f5f1ea' };
const h1 = { fontSize: 30, fontWeight: 800, margin: 0 };
const card = { marginTop: 14, padding: 16, background: '#0c0a09', border: '1px solid #1f1a16', borderRadius: 12 };
const th = {
  padding: '10px 12px',
  textAlign: 'left',
  color: '#8a817a',
  fontSize: 11,
  letterSpacing: 1,
  textTransform: 'uppercase',
  borderBottom: '1px solid #1f1a16',
};
const td = { padding: '10px 12px', borderBottom: '1px solid #1f1a16' };

function formatUsd(cents) {
  if (cents == null) return '-';
  return `$${(Math.abs(Number(cents)) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTxnDate(value) {
  if (!value) return '-';
  const date = typeof value === 'number'
    ? new Date(value * 1000)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatBalance(balance) {
  const cents = balance?.current?.usd ?? balance?.cash?.available?.usd ?? balance?.cash?.current?.usd;
  if (cents == null) return '-';
  return formatUsd(cents);
}

export default async function BankPage({ params }) {
  const { caseId } = await params;
  const projectRef = getSupabaseProjectRef();

  const { data: c, error: caseError } = await supabaseAdmin
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .maybeSingle();

  if (caseError) {
    logSupabaseError('Bank case lookup failed', caseError, { caseId });
    return (
      <div style={wrap}>
        <h1 style={h1}>Bank Data</h1>
        <p style={{ color: '#f0a0a0' }}>Could not load this case from Supabase.</p>
        <p style={{ color: '#b8a89c' }}>Checked project <b>{projectRef}</b> for cases.id <b>{caseId}</b>.</p>
      </div>
    );
  }

  if (!c) {
    return (
      <div style={wrap}>
        <h1 style={h1}>Bank Data</h1>
        <p style={{ color: '#f0a0a0' }}>Case not found.</p>
        <p style={{ color: '#b8a89c' }}>Checked project <b>{projectRef}</b> for cases.id <b>{caseId}</b>.</p>
      </div>
    );
  }

  const { data: conn, error: connError } = await supabaseAdmin
    .from('connections')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle();
  if (connError) logSupabaseError('Bank connection lookup failed', connError, { caseId });

  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('fc_accounts')
    .select('*')
    .eq('case_id', caseId);
  if (accountsError) logSupabaseError('Bank account lookup failed', accountsError, { caseId });

  const ids = (accounts ?? []).map((a) => a.id);
  let txns = [];
  if (ids.length) {
    const { data, error: txnsError } = await supabaseAdmin
      .from('fc_transactions')
      .select('*')
      .in('account_id', ids)
      .order('transacted_at', { ascending: false })
      .limit(100);
    if (txnsError) logSupabaseError('Bank transaction lookup failed', txnsError, { caseId, accountIds: ids });
    txns = data ?? [];
  }

  return (
    <div style={wrap}>
      <h1 style={h1}>Bank Data (Stripe)</h1>
      {c.region === 'USA' ? (
        <p style={{ color: '#e8a07a' }}>USA case - permissioned bank data via Stripe Financial Connections</p>
      ) : (
        <p style={{ color: '#b8a89c' }}>
          Saved bank data remains visible. New bank linking is disabled because this case is region <b>{c.region ?? 'UAE'}</b>.
        </p>
      )}

      {c.region === 'USA' && <ConnectLinkButton caseId={caseId} status={conn?.status ?? 'none'} />}

      {c.region !== 'USA' && !ids.length && (
        <div style={card}>
          No saved bank accounts yet. Use the document-pack pipeline for non-USA cases.
        </div>
      )}

      {(accounts ?? []).map((a) => (
        <div key={a.id} style={card}>
          <div style={{ fontWeight: 700 }}>{a.institution_name} ****{a.last4}</div>
          <div style={{ color: '#b8a89c' }}>{a.category} - {a.status}</div>
          <div style={{ marginTop: 6 }}>
            Available: {formatBalance(a.balance)}
          </div>
        </div>
      ))}

      {txns.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Recent transactions</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Description</th>
                  <th style={th}>Debit</th>
                  <th style={th}>Credit</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => {
                  const amount = Number(t.amount || 0);
                  return (
                    <tr key={t.id}>
                      <td style={td}>{formatTxnDate(t.transacted_at)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{t.description || '-'}</td>
                      <td style={{ ...td, color: amount < 0 ? '#f0a0a0' : '#8a817a' }}>
                        {amount < 0 ? formatUsd(amount) : '-'}
                      </td>
                      <td style={{ ...td, color: amount > 0 ? '#36c692' : '#8a817a' }}>
                        {amount > 0 ? formatUsd(amount) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
