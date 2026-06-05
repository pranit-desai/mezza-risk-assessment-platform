'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import CaseSearchBox from '../_components/CaseSearchBox';
import DashboardControls from '../_components/DashboardControls';
import DashboardTabs from '../_components/DashboardTabs';
import StatusBadge from '../_components/StatusBadge';
import { filterCasesByQuery } from '../_lib/caseSearch';
import {
  caseGroup,
  caseGroupSlug,
  caseRegion,
  caseVenue,
  currencyForRegion,
  lendingAmountColor,
  recommendedCeiling,
  scoreColor,
} from '../_lib/casePresentation';

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

function money(n, currency) {
  const value = Number(n || 0);
  if (!value) return '-';
  if (value >= 1e6) return `${currency} ${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${currency} ${(value / 1e3).toFixed(1)}K`;
  return `${currency} ${value.toLocaleString('en-AE')}`;
}

function avgScore(cases) {
  const values = cases.map((c) => Number(c.score)).filter((n) => !Number.isNaN(n));
  if (!values.length) return '-';
  return (values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(1);
}

function groupStatus(cases) {
  const statuses = new Set(cases.map((c) => String(c.status || '').toLowerCase()));
  if (statuses.has('additional_documents_requested')) return 'additional_documents_requested';
  if (statuses.has('declined') || statuses.has('rejected')) return 'declined';
  if (statuses.has('under_review')) return 'under_review';
  if (statuses.has('approved') && cases.every((c) => String(c.status || '').toLowerCase() === 'approved')) return 'approved';
  return cases.find((c) => c.status)?.status || 'new';
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
  return Array.from(map.values()).sort((a, b) => {
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    return a.group.localeCompare(b.group);
  });
}

export default function GroupsPage() {
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [mode, setMode] = useState('Recommended');
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
        setMsg(e.message || 'Failed to load groups');
        setState('error');
      }
    })();
  }, []);

  const regionCases = useMemo(() => {
    if (regionFilter === 'All') return cases;
    return cases.filter((c) => caseRegion(c) === regionFilter);
  }, [cases, regionFilter]);
  const visibleCases = useMemo(() => filterCasesByQuery(regionCases, query), [regionCases, query]);
  const rows = useMemo(() => groupRows(visibleCases), [visibleCases]);

  return (
    <div style={{ padding: '32px 40px', color: 'var(--mz-text-on-page)' }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Groups</h1>
      <p style={{ color: 'var(--mz-accent)', marginTop: 6 }}>
        Group-level lending dashboards for signed operators and their venues.
      </p>

      <DashboardTabs />
      <DashboardControls region={regionFilter} onRegionChange={setRegionFilter} mode={mode} onModeChange={setMode} />

      <CaseSearchBox
        value={query}
        onChange={setQuery}
        resultCount={visibleCases.length}
        totalCount={regionCases.length}
      />

      {state === 'loading' && <div style={empty}>Loading groups...</div>}

      {state === 'error' && (
        <div style={{ ...empty, background: 'var(--mz-red-bg)', border: '1px solid var(--mz-red-border)', color: 'var(--mz-red-text)' }}>
          Failed to load groups: {msg}
        </div>
      )}

      {state === 'ok' && rows.length === 0 && (
        <div style={empty}>No groups match your search.</div>
      )}

      {state === 'ok' && rows.length > 0 && (
        <section className="mz-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--mz-border-soft)' }}>
            <span className="mz-eyebrow">Signed Groups</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={th}>Group</th>
                  <th style={th}>Region</th>
                  <th style={th}>Venues</th>
                  <th style={th}>Top Venue</th>
                  <th style={th}>Avg Score</th>
                  <th style={th}>Recommended Lending Amount</th>
                  <th style={th}>Status</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const currency = currencyForRegion(row.region);
                  const recommended = row.cases.reduce((sum, c) => sum + recommendedCeiling(c), 0);
                  const top = [...row.cases].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))[0];
                  return (
                    <tr key={row.key}>
                      <td style={{ ...td, fontWeight: 900 }}>{row.group}</td>
                      <td style={td}>{row.region}</td>
                      <td style={td}>{row.cases.length}</td>
                      <td style={td}>{top ? caseVenue(top) : '-'}</td>
                      <td style={{ ...td, color: scoreColor(avgScore(row.cases)), fontWeight: 900 }} className="mz-mono">{avgScore(row.cases)}</td>
                      <td style={{ ...td, color: lendingAmountColor(recommended), fontWeight: 900 }} className="mz-mono">{money(recommended, currency)}</td>
                      <td style={td}><StatusBadge status={groupStatus(row.cases)} /></td>
                      <td style={td}>
                        <Link
                          href={`/groups/${caseGroupSlug(row.cases[0])}?region=${row.region}`}
                          className="mz-clickable"
                          style={{ padding: '6px 10px', display: 'inline-flex' }}
                        >
                          Open group
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

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
