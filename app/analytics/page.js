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

const ELIGIBLE_STATUSES = new Set(['approved', 'accepted']);

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function countsTowardMetrics(c) {
  return ELIGIBLE_STATUSES.has(normalizeStatus(c?.status));
}

function venueRevenue(c) {
  return (
    Number(c?.ltm_revenue_aed) ||
    Number(c?.extracted_json?.pos_headline?.net_revenue_ex_tax) ||
    Number(c?.extracted_json?.credit_score?.ltm_revenue_aed) ||
    0
  );
}

function weightedScore(cases) {
  const weightedRows = cases
    .filter(countsTowardMetrics)
    .map((c) => ({
      score: Number(c.score),
      revenue: venueRevenue(c),
    }))
    .filter((row) => Number.isFinite(row.score) && row.revenue > 0);

  const totalRevenue = weightedRows.reduce((sum, row) => sum + row.revenue, 0);
  if (!totalRevenue) return null;

  return weightedRows.reduce((sum, row) => sum + row.score * row.revenue, 0) / totalRevenue;
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
    const eligible = row.cases.filter(countsTowardMetrics);
    const revenue = row.cases.reduce((sum, c) => sum + venueRevenue(c), 0);
    const eligibleRevenue = eligible.reduce((sum, c) => sum + venueRevenue(c), 0);
    const recommended = eligible.reduce((sum, c) => sum + recommendedCeiling(c), 0);
    const average = weightedScore(row.cases);
    return { ...row, revenue, eligibleRevenue, recommended, average };
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
  const eligible = rows.filter(countsTowardMetrics);
  const groups = new Set(rows.map(caseGroup));
  const recommended = eligible.reduce((sum, c) => sum + recommendedCeiling(c), 0);
  return {
    region,
    cases: rows.length,
    groups: groups.size,
    average: weightedScore(rows),
    recommended,
    currency: currencyForRegion(region),
  };
}

function gradeBand(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return 'NM';
  if (value >= 80) return 'A';
  if (value >= 70) return 'B+';
  if (value >= 60) return 'B';
  if (value >= 50) return 'C';
  return 'NM';
}

function scoreBandRows(cases) {
  const order = ['A', 'B+', 'B', 'C', 'NM'];
  const counts = new Map(order.map((label) => [label, 0]));
  for (const c of cases) {
    const label = gradeBand(c.score);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return order.map((label) => ({ label, count: counts.get(label) || 0 }));
}

export default function AnalyticsPage() {
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [state, setState] = useState('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/cases', { cache: 'no-store' });
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

  const regionCases = useMemo(() => {
    if (regionFilter === 'All') return cases;
    return cases.filter((c) => caseRegion(c) === regionFilter);
  }, [cases, regionFilter]);
  const visibleCases = useMemo(() => filterCasesByQuery(regionCases, query), [regionCases, query]);
  const eligibleVisibleCases = useMemo(() => visibleCases.filter(countsTowardMetrics), [visibleCases]);
  const groups = useMemo(() => groupRows(visibleCases), [visibleCases]);
  const statuses = useMemo(() => statusRows(visibleCases), [visibleCases]);
  const regions = useMemo(() => {
    const list = regionFilter === 'All' ? ['USA', 'UAE'] : [regionFilter];
    return list.map((r) => regionSummary(visibleCases, r));
  }, [visibleCases, regionFilter]);
  const maxStatus = Math.max(...statuses.map(([, count]) => count), 1);
  const maxGroupExposure = Math.max(...groups.map((g) => g.recommended), 1);
  const topGroups = [...groups].sort((a, b) => b.recommended - a.recommended).slice(0, 8);
  const topRevenueGroups = [...groups].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const totalRecommended = eligibleVisibleCases.reduce((sum, c) => sum + recommendedCeiling(c), 0);
  const totalRevenue = visibleCases.reduce((sum, c) => sum + venueRevenue(c), 0);
  const scoreBands = scoreBandRows(eligibleVisibleCases);
  const maxScoreBand = Math.max(...scoreBands.map((row) => row.count), 1);
  const lendingRatioGroups = [...groups]
    .filter((g) => g.eligibleRevenue > 0 && g.recommended > 0)
    .map((g) => ({ ...g, ratio: g.recommended / g.eligibleRevenue }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 8);
  const maxLendingRatio = Math.max(...lendingRatioGroups.map((g) => g.ratio), 0.01);
  const topVenues = [...eligibleVisibleCases]
    .sort((a, b) => recommendedCeiling(b) - recommendedCeiling(a))
    .slice(0, 8);

  return (
    <div style={{ padding: '32px 40px', color: 'var(--mz-text-on-page)' }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>Analytics</h1>
      <p style={{ color: 'var(--mz-accent)', marginTop: 6 }}>
        Portfolio exposure, regional split, status movement, and venue concentration.
      </p>

      <DashboardTabs />
      <DashboardControls region={regionFilter} onRegionChange={setRegionFilter} />

      <CaseSearchBox
        value={query}
        onChange={setQuery}
        resultCount={visibleCases.length}
        totalCount={regionCases.length}
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
              <div className="mz-eyebrow">Disbursal Share by Group</div>
              <div style={caption}>Total: {formatCurrencyAmount(totalRecommended, 'AED')}</div>
              <div style={pieWrap}>
                <div style={{ ...pie, background: pieBackground(topGroups, totalRecommended) }} />
              </div>
              <div style={legend}>
                {topGroups.map((g, index) => (
                  <span key={g.key} style={legendItem}>
                    <span style={{ ...legendDot, background: chartColors[index % chartColors.length] }} />
                    {g.group}
                  </span>
                ))}
              </div>
            </div>

            <div className="mz-card" style={{ minWidth: 0 }}>
              <div className="mz-eyebrow">LTM Revenue by Group</div>
              <div style={{ display: 'grid', gap: 11, marginTop: 14 }}>
                {topRevenueGroups.length === 0 && <div style={caption}>No group revenue data available.</div>}
                {topRevenueGroups.map((g, index) => (
                  <div key={g.key}>
                    <div style={barHeader}>
                      <span style={{ color: 'var(--mz-text)', fontWeight: 900 }}>{g.group}</span>
                      <span className="mz-mono">{formatCurrencyAmount(g.revenue, 'AED')}</span>
                    </div>
                    <div style={track}>
                      <div style={{ ...bar, background: chartColors[index % chartColors.length], width: `${Math.max((g.revenue / Math.max(totalRevenue, 1)) * 100, 4)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

          <section style={twoCol}>
            <div className="mz-card" style={{ minWidth: 0 }}>
              <div className="mz-eyebrow">Score Distribution</div>
              <div style={{ display: 'grid', gap: 11, marginTop: 14 }}>
                {scoreBands.map((row) => {
                  const proxyScore = row.label === 'A' ? 85 : row.label === 'B+' ? 75 : row.label === 'B' ? 65 : row.label === 'C' ? 55 : 35;
                  return (
                    <div key={row.label}>
                      <div style={barHeader}>
                        <span className="mz-mono" style={{ color: scoreColor(proxyScore), fontWeight: 900 }}>{row.label}</span>
                        <span className="mz-mono">{row.count}</span>
                      </div>
                      <div style={track}>
                        <div style={{ ...bar, background: scoreColor(proxyScore), width: `${Math.max((row.count / maxScoreBand) * 100, row.count ? 4 : 0)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mz-card" style={{ minWidth: 0 }}>
              <div className="mz-eyebrow">Lending to Revenue</div>
              <div style={caption}>Recommended amount as a percentage of LTM revenue.</div>
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                {lendingRatioGroups.map((g) => (
                  <Link key={g.key} href={`/groups/${slugifyGroupName(g.group)}?region=${g.region}`}>
                    <div style={barHeader}>
                      <span style={{ color: 'var(--mz-text)', fontWeight: 900 }}>{g.group}</span>
                      <span className="mz-mono" style={{ color: lendingAmountColor(g.recommended), fontWeight: 900 }}>
                        {(g.ratio * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={track}>
                      <div style={{ ...bar, background: lendingAmountColor(g.recommended), width: `${Math.max((g.ratio / maxLendingRatio) * 100, 4)}%` }} />
                    </div>
                  </Link>
                ))}
                {lendingRatioGroups.length === 0 && <div style={caption}>No revenue-backed lending ratio data available.</div>}
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

function pieBackground(rows, total) {
  if (!rows.length || !total) return 'var(--mz-card-nested)';
  let cursor = 0;
  const stops = rows.map((row, index) => {
    const start = cursor;
    const end = cursor + (row.recommended / total) * 100;
    cursor = end;
    return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
  });
  if (cursor < 100) stops.push(`var(--mz-card-nested) ${cursor}% 100%`);
  return `conic-gradient(${stops.join(', ')})`;
}

const regionGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 16 };
const metricRow = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 12 };
const twoCol = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 16 };
const caption = { color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' };
const barHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 };
const track = { height: 8, borderRadius: 999, background: 'var(--mz-card-nested)', overflow: 'hidden', border: '1px solid var(--mz-border-soft)' };
const bar = { height: '100%', borderRadius: 999, background: 'var(--mz-accent)' };
const pieWrap = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 220 };
const pie = { width: 190, height: 190, borderRadius: '50%', border: '1px solid var(--mz-border-soft)' };
const legend = { display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 };
const legendItem = { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--mz-text)', fontSize: 'var(--mz-fs-xs)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const legendDot = { width: 10, height: 10, borderRadius: 2, flexShrink: 0 };
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

const chartColors = [
  'var(--mz-chart-1)',
  'var(--mz-chart-2)',
  'var(--mz-chart-9)',
  'var(--mz-chart-5)',
  'var(--mz-chart-10)',
  'var(--mz-ai-accent)',
  'var(--mz-chart-4)',
  'var(--mz-chart-7)',
];
