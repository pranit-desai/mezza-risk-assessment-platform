'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import CaseSearchBox from '../_components/CaseSearchBox';
import { filterCasesByQuery } from '../_lib/caseSearch';

const th = {
  padding: '11px 14px',
  textAlign: 'left',
  color: 'var(--mz-muted)',
  fontSize: 'var(--mz-fs-xxs)',
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--mz-border-soft)',
};
const td = {
  padding: '13px 14px',
  borderBottom: '1px solid var(--mz-border-subtle)',
  fontSize: 'var(--mz-fs-sm)',
};

function caseVenue(c) {
  return c.venue_name || c.venue || c.name || '-';
}

function caseGroup(c) {
  return c.group_name || c.group || '-';
}

function formatDate(value) {
  if (!value) return '-';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatUsd(cents) {
  if (cents == null) return '-';
  return `$${(Math.abs(Number(cents)) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function latestDate(values) {
  const timestamps = values
    .map((v) => {
      if (!v) return 0;
      if (typeof v === 'number') return v * 1000;
      const d = new Date(v).getTime();
      return Number.isNaN(d) ? 0 : d;
    })
    .filter(Boolean);
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

export default function BankingPageClient({ cases, connections, accounts, transactions, error }) {
  const [query, setQuery] = useState('');

  const visibleCases = useMemo(() => filterCasesByQuery(cases, query), [cases, query]);
  const visibleIds = useMemo(() => new Set(visibleCases.map((c) => c.id)), [visibleCases]);

  const connectionsByCase = useMemo(() => {
    const map = new Map();
    for (const conn of connections) map.set(conn.case_id, conn);
    return map;
  }, [connections]);

  const accountsByCase = useMemo(() => {
    const map = new Map();
    for (const account of accounts) {
      if (!map.has(account.case_id)) map.set(account.case_id, []);
      map.get(account.case_id).push(account);
    }
    return map;
  }, [accounts]);

  const accountCase = useMemo(() => {
    const map = new Map();
    for (const account of accounts) map.set(account.id, account.case_id);
    return map;
  }, [accounts]);

  const casesById = useMemo(() => {
    const map = new Map();
    for (const c of cases) map.set(c.id, c);
    return map;
  }, [cases]);

  const visibleTransactions = useMemo(() => {
    return transactions
      .filter((txn) => visibleIds.has(accountCase.get(txn.account_id)))
      .slice(0, 100);
  }, [accountCase, transactions, visibleIds]);

  const connectedCount = connections.filter((conn) => conn.status === 'connected').length;
  const activeAccounts = accounts.filter((account) => account.status === 'active').length;

  return (
    <div style={{ padding: '28px 24px', color: 'var(--mz-text-on-page)' }}>
      <h1 style={{ fontSize: 'var(--mz-fs-h1)', fontWeight: 900, margin: 0 }}>
        Banking
      </h1>
      <p className="mz-subheader" style={{ margin: '6px 0 0' }}>
        Stripe Financial Connections accounts and transactions saved in Supabase.
      </p>

      <CaseSearchBox
        value={query}
        onChange={setQuery}
        resultCount={visibleCases.length}
        totalCount={cases.length}
      />

      {error && (
        <div
          style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 'var(--mz-radius-md)',
            background: 'var(--mz-red-bg)',
            border: '1px solid var(--mz-red-border)',
            color: 'var(--mz-red-text)',
          }}
        >
          Failed to load some banking data: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
        <SummaryTile label="Connected Cases" value={connectedCount} />
        <SummaryTile label="Bank Accounts" value={accounts.length} />
        <SummaryTile label="Active Accounts" value={activeAccounts} />
      </div>

      <section className="mz-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--mz-border-soft)' }}>
          <span className="mz-eyebrow">Connected cases</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 840 }}>
            <thead>
              <tr>
                <th style={th}>Case Ref</th>
                <th style={th}>Venue</th>
                <th style={th}>Group</th>
                <th style={th}>Connection</th>
                <th style={th}>Accounts</th>
                <th style={th}>Last Linked</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleCases.map((c) => {
                const conn = connectionsByCase.get(c.id);
                const caseAccounts = accountsByCase.get(c.id) ?? [];
                const linkedAt = latestDate([conn?.connected_at, conn?.created_at, ...caseAccounts.map((a) => a.updated_at)]);
                return (
                  <tr key={c.id}>
                    <td style={td} className="mz-mono">{c.case_ref || c.id.slice(0, 8)}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{caseVenue(c)}</td>
                    <td style={{ ...td, color: 'var(--mz-muted)' }}>{caseGroup(c)}</td>
                    <td style={td}>
                      <StatusBadge value={conn?.status || 'none'} />
                    </td>
                    <td style={td}>{caseAccounts.length}</td>
                    <td style={td}>{formatDate(linkedAt)}</td>
                    <td style={td}>
                      <Link href={`/bank/${c.id}`} className="mz-clickable" style={{ padding: '6px 10px', display: 'inline-block' }}>
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {visibleCases.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...td, color: 'var(--mz-muted)' }}>No cases match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mz-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--mz-border-soft)' }}>
          <span className="mz-eyebrow">Recent transactions</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Case</th>
                <th style={th}>Description</th>
                <th style={th}>Debit</th>
                <th style={th}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((txn) => {
                const caseId = accountCase.get(txn.account_id);
                const c = casesById.get(caseId);
                const amount = Number(txn.amount || 0);
                return (
                  <tr key={txn.id}>
                    <td style={td}>{formatDate(txn.transacted_at)}</td>
                    <td style={td} className="mz-mono">{c?.case_ref || caseId?.slice(0, 8) || '-'}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{txn.description || '-'}</td>
                    <td style={{ ...td, color: amount < 0 ? 'var(--mz-red-text)' : 'var(--mz-muted)' }}>
                      {amount < 0 ? formatUsd(amount) : '-'}
                    </td>
                    <td style={{ ...td, color: amount > 0 ? 'var(--mz-green-text)' : 'var(--mz-muted)' }}>
                      {amount > 0 ? formatUsd(amount) : '-'}
                    </td>
                  </tr>
                );
              })}
              {visibleTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...td, color: 'var(--mz-muted)' }}>No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="mz-card">
      <div className="mz-eyebrow">{label}</div>
      <div className="mz-mono" style={{ marginTop: 6, fontSize: 28, fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ value }) {
  const active = value === 'connected';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        borderRadius: 6,
        background: active ? 'var(--mz-green-bg)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'var(--mz-green-border)' : 'var(--mz-border-input)'}`,
        color: active ? 'var(--mz-green-text)' : 'var(--mz-muted)',
        fontSize: 'var(--mz-fs-xs)',
        fontWeight: 800,
      }}
    >
      {value}
    </span>
  );
}
