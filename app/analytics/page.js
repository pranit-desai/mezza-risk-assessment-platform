'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import CaseSearchBox from '../_components/CaseSearchBox';
import DashboardTabs from '../_components/DashboardTabs';
import StatusBadge from '../_components/StatusBadge';
import { filterCasesByQuery } from '../_lib/caseSearch';
import {
  caseGroup,
  caseRegion,
  caseVenue,
  currencyForRegion,
  formatCurrencyAmount,
  lendingAmountColor,
  recommendedCeiling,
  scoreColor,
  shortCaseRef,
  slugifyGroupName,
} from '../_lib/casePresentation';

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

function avgScore(cases) {
  const values = cases.map((c) => Number(c.score)).filter((n) => Number.isFinite(n));
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function groupRows(cases) {
  const map = new Map();
  for (const c of cases) {
    const region = caseRegion(c);
    const group = caseGroup(c);
    const key = `${region}:${group}`;
    if (!map.has(key)) map.set(key, { key, region, group, cases: [] });
    map.get(key).cases.push(c);
  }
  return Array.from(map.values()).map((row) => {
    const recommended = row.cases.reduce((sum, c) => sum + recommendedCeiling(c), 0);
    const average = avgScore(row.cases);
    return { ...row, recommended, average };
  });
}

function statusRows(cases) {
  const map = new Map();
  for (const c of cases) {
    const key = String(c.status || 'new').toLowerCase();
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function regionSummary(cases, region) {
  const rows = cases.filter((c) => caseRegion(c) === region);
  const groups = new Set(rows.map(caseGroup));
  const recommended = rows.reduce((sum, c) => sum + recommendedCeiling(c), 0);
  return {
    region,
    cases: rows.length,
    groups: groups.size,
    average: avgScore(rows),
    recommended,
    currency: currencyForRegion(region),
  };
}

export default function AnalyticsPage() {
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/cases`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setCases(Array.isArray(data) ? data : data.cases ?? []);
        setState('ok');
      } catch (e) {
        setMsg(e.message || 'Failed to load analytics');
        setState('error');
      }
    })();
  }, []);

  const visibleCases = useMemo(() => filterCasesByQuery(cases, query), [cases, query]);
  const groups = useMemo(() => groupRows(visibleCases), [visibleCases]);
  const statuses = useMemo(() => statusRows(visibleCases), [visibleCases]);
  const regions = useMemo(() => ['USA', 'UAE'].map((r) => regionSummary(visibleCases, r)), [visibleCases]);
  const maxStatus = Math.max(...statuses.map(([, count]) => count), 1);
  const maxGroupExposure = Math.max(...groups.map((g) => g.recommended), 1);
  const topGroups = [...groups].sort((a, b) => b.recommended - a.recommended).slice(0, 8);
  const topVenues = [...visibleCases]
    .sort((a, b) => recommendedCeiling(b) - recommendedCeiling(a))
    .slice(0, 8);

  return (
    <div style={{ padding: '32px 40px', color: 'var(--mz-text-on-page)' }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Analytics</h1>
      <p style={{ color: 'var(--mz-accent)', marginTop: 6 }}>
        Portfolio exposure, regional split, status movement, and venue concentration.
      </p>

      <DashboardTabs />

      <CaseSearchBox
        value={query}
        onChange={setQuery}
        resultCount={visibleCases.length}
        totalCount={cases.length}
      />

      {state === 'loading' && <div style={empty}>Loading analytics...</div>}

      {state === 'error' && (
        <div style={{ ...empty, background: 'var(--mz-red-bg)', border: '1px solid var(--mz-red-border)', color: 'var(--mz-red-text)' }}>
          Failed to load analytics: {msg}
        </div>
      )}

      {state === 'ok' && (
        <>
          <section style={regionGrid}>
            {regions.map((r) => (
              <div key={r.region} className="mz-card">
                <div className="mz-eyebrow">{r.region}</div>
                <div style={metricRow}>
                  <MiniMetric label="Groups" value={r.groups} />
                  <MiniMetric label="Cases" value={r.cases} />
                  <MiniMetric label="Avg Score" value={r.average == null ? '-' : r.average.toFixed(1)} color={scoreColor(r.average)} />
                </div>
                <div className="mz-mono" style={{ marginTop: 14, fontSize: 28, fontWeight: 900, color: lendingAmountColor(r.recommended) }}>
                  {formatCurrencyAmount(r.recommended, r.currency)}
                </div>
                <div style={caption}>Recommended lending amount</div>
              </div>
            ))}
          </section>

          <section style={twoCol}>
            <div className="mz-card" style={{ minWidth: 0 }}>
              <div className="mz-eyebrow">Status Funnel</div>
              <div style={{ display: 'grid', gap: 11, marginTop: 14 }}>
                {statuses.length === 0 && <div style={caption}>No status data available.</div>}
                {statuses.map(([status, count]) => (
                  <div key={status}>
                    <div style={barHeader}>
                      <StatusBadge status={status} />
                      <span className="mz-mono">{count}</span>
                    </div>
                    <div style={track}>
                      <div style={{ ...bar, width: `${Math.max((count / maxStatus) * 100, 4)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mz-card" style={{ minWidth: 0 }}>
              <div className="mz-eyebrow">Highest Exposure Groups</div>
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                {topGroups.map((g) => {
                  const currency = currencyForRegion(g.region);
                  return (
                    <Link key={g.key} href={`/groups/${slugifyGroupName(g.group)}?region=${g.region}`}>
                      <div style={barHeader}>
                        <span style={{ color: 'var(--mz-text)', fontWeight: 900 }}>{g.group}</span>
                        <span className="mz-mono" style={{ color: lendingAmountColor(g.recommended), fontWeight: 900 }}>
                          {formatCurrencyAmount(g.recommended, currency)}
                        </span>
                      </div>
                      <div style={track}>
                        <div style={{ ...bar, background: lendingAmountColor(g.recommended), width: `${Math.max((g.recommended / maxGroupExposure) * 100, 4)}%` }} />
                      </div>
                    </Link>
                  );
                })}
                {topGroups.length === 0 && <div style={caption}>No group exposure data available.</div>}
              </div>
            </div>
          </section>

          <section className="mz-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--mz-border-soft)' }}>
              <span className="mz-eyebrow">Top Venue Recommendations</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                <thead>
                  <tr>
                    <th style={th}>Case</th>
                    <th style={th}>Venue</th>
                    <th style={th}>Group</th>
                    <th style={th}>Region</th>
                    <th style={th}>Score</th>
                    <th style={th}>Recommended</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topVenues.map((c) => {
                    const currency = currencyForRegion(caseRegion(c));
                    const amount = recommendedCeiling(c);
                    return (
                      <tr key={c.id}>
                        <td style={td}>
                          <Link href={`/cases/${c.id}`} className="mz-mono" style={{ color: 'var(--mz-accent)', fontWeight: 900 }}>
                            {shortCaseRef(c)}
                          </Link>
                        </td>
                        <td style={{ ...td, fontWeight: 900 }}>{caseVenue(c)}</td>
                        <td style={td}>{caseGroup(c)}</td>
                        <td style={td}>{caseRegion(c)}</td>
                        <td style={{ ...td, color: scoreColor(c.score), fontWeight: 900 }} className="mz-mono">
                          {c.score != null ? Number(c.score).toFixed(1) : '-'}
                        </td>
                        <td style={{ ...td, color: lendingAmountColor(amount), fontWeight: 900 }} className="mz-mono">
                          {formatCurrencyAmount(amount, currency)}
                        </td>
                        <td style={td}><StatusBadge status={c.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MiniMetric({ label, value, color }) {
  return (
    <div>
      <div style={caption}>{label}</div>
      <div className="mz-mono" style={{ color: color || 'var(--mz-text)', fontSize: 18, fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}

const regionGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 16 };
const metricRow = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 12 };
const twoCol = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 16 };
const caption = { color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' };
const barHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 };
const track = { height: 8, borderRadius: 999, background: 'var(--mz-card-nested)', overflow: 'hidden', border: '1px solid var(--mz-border-soft)' };
const bar = { height: '100%', borderRadius: 999, background: 'var(--mz-accent)' };
const empty = {
  padding: 18,
  borderRadius: 8,
  background: 'var(--mz-card)',
  border: '1px solid var(--mz-border)',
  color: 'var(--mz-muted)',
};
const th = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 'var(--mz-fs-xxs)',
  fontWeight: 800,
  color: 'var(--mz-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  borderBottom: '1px solid var(--mz-border-soft)',
};
const td = {
  padding: '13px 14px',
  fontSize: 'var(--mz-fs-sm)',
  borderBottom: '1px solid var(--mz-border-subtle)',
  color: 'var(--mz-text)',
};
