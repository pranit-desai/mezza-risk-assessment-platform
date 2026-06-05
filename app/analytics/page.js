'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import CaseSearchBox from '../_components/CaseSearchBox';
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
    const revenue = row.cases.reduce((sum, c) => sum + (Number(c.ltm_revenue_aed) || 0), 0);
    const recommended = row.cases.reduce((sum, c) => sum + recommendedCeiling(c), 0);
    const average = avgScore(row.cases);
    return { ...row, revenue, recommended, average };
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

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 26px 40px' }} />}>
      <AnalyticsContent />
    </Suspense>
  );
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const regionFilter = (searchParams.get('region') || 'All').toUpperCase();
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

  const regionCases = useMemo(() => {
    if (regionFilter === 'ALL') return cases;
    return cases.filter((c) => caseRegion(c) === regionFilter);
  }, [cases, regionFilter]);
  const visibleCases = useMemo(() => filterCasesByQuery(regionCases, query), [regionCases, query]);
  const groups = useMemo(() => groupRows(visibleCases), [visibleCases]);
  const statuses = useMemo(() => statusRows(visibleCases), [visibleCases]);
  const maxStatus = Math.max(...statuses.map(([, count]) => count), 1);
  const maxGroupExposure = Math.max(...groups.map((g) => g.recommended), 1);
  const topGroups = [...groups].sort((a, b) => b.recommended - a.recommended).slice(0, 8);
  const topVenues = [...visibleCases]
    .sort((a, b) => recommendedCeiling(b) - recommendedCeiling(a))
    .slice(0, 8);
  const totalRevenue = visibleCases.reduce((sum, c) => sum + (Number(c.ltm_revenue_aed) || 0), 0);
  const totalRecommended = visibleCases.reduce((sum, c) => sum + recommendedCeiling(c), 0);
  const totalGroups = groups.length;
  const averageScore = avgScore(visibleCases);
  const displayCurrency = regionFilter === 'USA' ? 'USD' : 'AED';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 26px 40px', color: 'var(--mz-text-on-page)' }}>
      <section style={statGrid}>
        <AnalyticsStat label="Groups" value={totalGroups} />
        <AnalyticsStat label="Venues" value={visibleCases.length} />
        <AnalyticsStat label="Total Revenue" value={formatCurrencyAmount(totalRevenue, displayCurrency)} />
        <AnalyticsStat label="Portfolio Mezza" value={averageScore == null ? '-' : `${averageScore.toFixed(1)} / ${gradeForScore(averageScore)}`} color={scoreColor(averageScore)} />
        <AnalyticsStat label="Total Disbursal (Recommended)" value={formatCurrencyAmount(totalRecommended, displayCurrency)} color="var(--mz-accent)" featured sub={`${totalRevenue ? ((totalRecommended / totalRevenue) * 100).toFixed(1) : '0.0'}% of LTM`} />
      </section>

      <div style={subControls}>
        <button className="mz-clickable active" style={smallPill}>By Group</button>
        <button className="mz-clickable" style={smallPill}>By Grade</button>
        <button className="mz-clickable" style={smallPill}>Monthly Approvals</button>
      </div>

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
          <section style={twoCol}>
            <div className="mz-card" style={{ minWidth: 0 }}>
              <div className="mz-eyebrow">Disbursal Share by Group</div>
              <div style={caption}>Total: {formatCurrencyAmount(totalRecommended, displayCurrency)}</div>
              <div style={pieWrap}>
                <div style={{
                  ...pie,
                  background: pieBackground(topGroups, totalRecommended),
                }} />
              </div>
              <div style={legend}>
                {topGroups.slice(0, 10).map((g, index) => (
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
                {topGroups.length === 0 && <div style={caption}>No group revenue data available.</div>}
                {[...groups].sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((g, index) => (
                  <div key={g.key}>
                    <div style={barHeader}>
                      <span style={{ color: 'var(--mz-text)', fontWeight: 900 }}>{g.group}</span>
                      <span className="mz-mono">{formatCurrencyAmount(g.revenue, displayCurrency)}</span>
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

function AnalyticsStat({ label, value, color, sub, featured }) {
  return (
    <div className="mz-card" style={{ minHeight: 138, borderColor: featured ? 'var(--mz-accent-40)' : 'rgba(80, 50, 38, 0.48)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="mz-eyebrow" style={{ color: featured ? 'var(--mz-accent)' : 'var(--mz-muted)' }}>{label}</div>
      <div className="mz-mono" style={{ marginTop: 10, fontSize: 29, lineHeight: 1.05, fontWeight: 900, color: color || 'var(--mz-text)' }}>
        {value}
      </div>
      {sub && <div style={{ ...caption, marginTop: 7 }}>{sub}</div>}
    </div>
  );
}

function gradeForScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value >= 80) return 'A';
  if (value >= 70) return 'B+';
  if (value >= 60) return 'B';
  if (value >= 50) return 'C';
  return 'NM';
}

function pieBackground(rows, total) {
  if (!rows.length || !total) return 'var(--mz-card-nested)';
  let cursor = 0;
  const stops = rows.slice(0, 10).map((row, index) => {
    const start = cursor;
    const end = cursor + (row.recommended / total) * 100;
    cursor = end;
    const color = chartColors[index % chartColors.length];
    return `${color} ${start}% ${end}%`;
  });
  if (cursor < 100) stops.push(`var(--mz-card-nested) ${cursor}% 100%`);
  return `conic-gradient(${stops.join(', ')})`;
}

const statGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 };
const subControls = { display: 'flex', gap: 8, marginBottom: 10 };
const smallPill = { height: 28, minWidth: 80, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 };
const twoCol = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 16 };
const caption = { color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' };
const barHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 };
const track = { height: 8, borderRadius: 999, background: 'var(--mz-card-nested)', overflow: 'hidden', border: '1px solid var(--mz-border-soft)' };
const bar = { height: '100%', borderRadius: 999, background: 'var(--mz-accent)' };
const pieWrap = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 250 };
const pie = { width: 220, height: 220, borderRadius: '50%', border: '1px solid var(--mz-border-soft)' };
const legend = { display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 };
const legendItem = { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--mz-text)', fontSize: 'var(--mz-fs-xs)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
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
  'var(--mz-tier-excellent)',
  'var(--mz-tier-below-avg)',
];
