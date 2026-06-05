'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CaseSearchBox from '../_components/CaseSearchBox';
import StatusBadge from '../_components/StatusBadge';
import { filterCasesByQuery } from '../_lib/caseSearch';
import {
  caseGroup,
  caseRegion,
  caseVenue,
  decisionText,
  formatTrackerDate,
  rationaleText,
  shortCaseRef,
  trackerDates,
} from '../_lib/casePresentation';

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

function money(n) {
  const value = Number(n || 0);
  if (!value) return '-';
  if (value >= 1e6) return `AED ${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `AED ${(value / 1e3).toFixed(1)}K`;
  return `AED ${value.toLocaleString('en-AE')}`;
}

function avgScore(cases) {
  const values = cases.map((c) => Number(c.score)).filter((n) => !Number.isNaN(n));
  if (!values.length) return '-';
  return (values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(1);
}

function groupByRegionAndGroup(cases) {
  const regions = { USA: new Map(), UAE: new Map() };
  for (const c of cases) {
    const region = caseRegion(c);
    const group = caseGroup(c);
    if (!regions[region].has(group)) regions[region].set(group, []);
    regions[region].get(group).push(c);
  }
  return regions;
}

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({});
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
        setMsg(e.message || 'Failed to load cases');
        setState('error');
      }
    })();
  }, []);

  const visibleCases = useMemo(() => filterCasesByQuery(cases, query), [cases, query]);
  const grouped = useMemo(() => groupByRegionAndGroup(visibleCases), [visibleCases]);

  function toggle(key) {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div style={{ padding: '32px 40px', color: '#f5f1ea' }}>
      <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>Cases</h1>
      <p style={{ color: '#e8a07a', marginTop: 6 }}>
        Group-first tracker for underwriting submissions, risk response, and final verdicts.
      </p>

      <CaseSearchBox
        value={query}
        onChange={setQuery}
        resultCount={visibleCases.length}
        totalCount={cases.length}
      />

      {state === 'loading' && <div style={empty}>Loading cases...</div>}

      {state === 'error' && (
        <div style={{ ...empty, background: 'var(--mz-red-bg)', border: '1px solid var(--mz-red-border)', color: 'var(--mz-red-text)' }}>
          Failed to load cases: {msg}
        </div>
      )}

      {state === 'ok' && visibleCases.length === 0 && (
        <div style={empty}>No cases match your search.</div>
      )}

      {state === 'ok' && visibleCases.length > 0 && (
        <div style={{ display: 'grid', gap: 20 }}>
          {['USA', 'UAE'].map((region) => {
            const regionGroups = Array.from(grouped[region].entries());
            if (!regionGroups.length) return null;
            return (
              <section key={region} className="mz-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={sectionHeader}>
                  <div>
                    <div className="mz-eyebrow">{region}</div>
                    <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)', marginTop: 4 }}>
                      {regionGroups.length} groups / {regionGroups.reduce((sum, [, rows]) => sum + rows.length, 0)} venues
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120 }}>
                    <thead>
                      <tr>
                        <th style={th}>Group / Venue</th>
                        <th style={th}>Cases</th>
                        <th style={th}>Avg Score</th>
                        <th style={th}>Recommended Ceiling</th>
                        <th style={th}>Status</th>
                        <th style={th}>Submitted</th>
                        <th style={th}>First Response</th>
                        <th style={th}>Final Verdict</th>
                        <th style={th}>Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regionGroups.map(([group, rows]) => {
                        const key = `${region}:${group}`;
                        const isOpen = !!expanded[key];
                        const totalCeiling = rows.reduce((sum, c) => sum + (Number(c.ceiling_aed) || 0), 0);
                        const leadStatus = rows.find((c) => c.status)?.status || 'new';
                        return (
                          <Fragment key={key}>
                            <tr key={key} style={{ borderTop: '1px solid var(--mz-border-soft)', background: 'rgba(255,255,255,0.02)' }}>
                              <td style={{ ...td, fontWeight: 900 }}>
                                <button
                                  onClick={() => toggle(key)}
                                  className="mz-clickable"
                                  style={{ padding: '4px 8px', marginRight: 10 }}
                                  aria-expanded={isOpen}
                                >
                                  {isOpen ? '-' : '+'}
                                </button>
                                {group}
                              </td>
                              <td style={td}>{rows.length}</td>
                              <td style={td} className="mz-mono">{avgScore(rows)}</td>
                              <td style={td} className="mz-mono">{money(totalCeiling)}</td>
                              <td style={td}><StatusBadge status={leadStatus} /></td>
                              <td style={td}>-</td>
                              <td style={td}>-</td>
                              <td style={td}>-</td>
                              <td style={{ ...td, color: 'var(--mz-muted)' }}>Expand for venues</td>
                            </tr>

                            {isOpen && rows.map((c) => {
                              const dates = trackerDates(c);
                              const rationale = rationaleText(c);
                              return (
                                <tr key={c.id} style={{ borderTop: '1px solid var(--mz-border-subtle)' }}>
                                  <td style={{ ...td, paddingLeft: 54 }}>
                                    <button
                                      onClick={() => router.push(`/cases/${c.id}`)}
                                      style={linkButton}
                                    >
                                      <span className="mz-mono" style={{ color: 'var(--mz-accent)', fontWeight: 900 }}>
                                        {shortCaseRef(c)}
                                      </span>
                                      <span style={{ marginLeft: 10, fontWeight: 800 }}>{caseVenue(c)}</span>
                                    </button>
                                  </td>
                                  <td style={td}>1</td>
                                  <td style={td} className="mz-mono">{c.score != null ? Number(c.score).toFixed(1) : '-'}</td>
                                  <td style={td} className="mz-mono">{money(c.ceiling_aed)}</td>
                                  <td style={td}><StatusBadge status={c.status} /></td>
                                  <td style={td}>{formatTrackerDate(dates.submitted)}</td>
                                  <td style={td}>{formatTrackerDate(dates.firstResponse)}</td>
                                  <td style={td}>{formatTrackerDate(dates.verdict)}</td>
                                  <td style={{ ...td, maxWidth: 260 }}>
                                    <div style={{ fontWeight: 800 }}>{decisionText(c)}</div>
                                    {rationale && (
                                      <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)', marginTop: 4 }}>
                                        {String(rationale).slice(0, 120)}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

const sectionHeader = {
  padding: '16px 20px',
  borderBottom: '1px solid var(--mz-border-soft)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
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
  color: 'var(--mz-text)',
  verticalAlign: 'top',
};
const empty = {
  padding: 24,
  color: 'var(--mz-muted)',
  background: 'var(--mz-card)',
  border: '1px solid var(--mz-border)',
  borderRadius: 'var(--mz-radius-lg)',
};
const linkButton = {
  border: 'none',
  background: 'transparent',
  color: 'var(--mz-text)',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  textAlign: 'left',
};
