'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import RegionBadge from '../../_components/RegionBadge';
import { useEffect, useMemo, useState } from 'react';
import DashboardTabs from '../../_components/DashboardTabs';
import StatusBadge from '../../_components/StatusBadge';
import {
  caseGroup,
  caseGroupSlug,
  caseRegion,
  caseVenue,
  currencyForRegion,
  decisionText,
  formatTrackerDate,
  lendingAmountColor,
  rationaleText,
  recommendedCeiling,
  riskNotesText,
  scoreColor,
  shortCaseRef,
  trackerDates,
} from '../../_lib/casePresentation';

const API = process.env.NEXT_PUBLIC_API_BASE_URL;
const SETTINGS_API = '/api/group-lending';

function formatMoney(n, currency) {
  const value = Number(n || 0);
  if (!value) return `${currency} 0`;
  if (value >= 1e6) return `${currency} ${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${currency} ${(value / 1e3).toFixed(1)}K`;
  return `${currency} ${value.toLocaleString('en-AE')}`;
}

function avg(values) {
  const nums = values.map(Number).filter((n) => !Number.isNaN(n));
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function groupDecision(cases) {
  const statuses = new Set(cases.map((c) => String(c.status || '').toLowerCase()));
  if (statuses.has('additional_documents_requested')) return 'Additional Documents Requested';
  if (statuses.has('declined') || statuses.has('rejected')) return 'Declined / Review Required';
  if (statuses.has('approved') && cases.every((c) => String(c.status || '').toLowerCase() === 'approved')) return 'Approved';
  if (statuses.has('under_review')) return 'Under Review';
  return 'Pending Review';
}

function topVenue(cases) {
  return [...cases]
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))[0];
}

function formatSavedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortNote(value, max = 140) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

export default function GroupDashboardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const groupKey = params?.groupKey;
  const initialRegion = searchParams.get('region') || 'All';

  const [cases, setCases] = useState([]);
  const [state, setState] = useState('loading');
  const [msg, setMsg] = useState('');
  const [region, setRegion] = useState(initialRegion);
  const [finalAmountOverrides, setFinalAmountOverrides] = useState({});
  const [customAmountOverrides, setCustomAmountOverrides] = useState({});
  const [settingsByKey, setSettingsByKey] = useState({});
  const [settingsLoadByKey, setSettingsLoadByKey] = useState({});
  const [saveStateByKey, setSaveStateByKey] = useState({});

  const [entity, setEntity] = useState(null);
  const [entityState, setEntityState] = useState('loading');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/cases`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setCases(Array.isArray(data) ? data : data.cases ?? []);
        setState('ok');
      } catch (e) {
        setMsg(e.message || 'Failed to load group');
        setState('error');
      }
    })();
  }, []);

  async function refetchEntity() {
    if (!groupKey) return;
    try {
      const res = await fetch(`/api/groups/by-key/${encodeURIComponent(groupKey)}`, { cache: 'no-store' });
      if (res.status === 404) { setEntityState('not-registered'); return; }
      if (!res.ok) { setEntityState('not-registered'); return; }
      const data = await res.json();
      setEntity(data);
      setEntityState('found');
    } catch {
      setEntityState('not-registered');
    }
  }

  useEffect(() => {
    refetchEntity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  const groupCasesAll = useMemo(() => {
    return cases.filter((c) => caseGroupSlug(c) === groupKey);
  }, [cases, groupKey]);

  const groupName = caseGroup(groupCasesAll[0]);
  const availableRegions = useMemo(() => {
    const set = new Set(groupCasesAll.map(caseRegion));
    return ['USA', 'UAE'].filter((r) => set.has(r));
  }, [groupCasesAll]);
  const activeRegion = availableRegions.includes(region) ? region : (availableRegions[0] || 'UAE');
  const currency = currencyForRegion(activeRegion);
  const settingKey = `${groupKey || 'unknown'}:${activeRegion}`;

  const groupCases = useMemo(() => {
    return groupCasesAll.filter((c) => caseRegion(c) === activeRegion);
  }, [groupCasesAll, activeRegion]);

  useEffect(() => {
    if (!groupKey || !activeRegion || !groupCasesAll.length) return;
    let cancelled = false;

    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setSettingsLoadByKey((current) => ({ ...current, [settingKey]: { status: 'loading' } }));
      try {
        const url = `${SETTINGS_API}?groupKey=${encodeURIComponent(groupKey)}&region=${encodeURIComponent(activeRegion)}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Status ${res.status}`);
        if (cancelled) return;
        if (data.setting) {
          setSettingsByKey((current) => ({ ...current, [settingKey]: data.setting }));
        }
        setSettingsLoadByKey((current) => ({
          ...current,
          [settingKey]: data.setupRequired
            ? { status: 'setup', message: `Run ${data.sqlFile}` }
            : { status: 'ready' },
        }));
      } catch (e) {
        if (cancelled) return;
        setSettingsLoadByKey((current) => ({
          ...current,
          [settingKey]: { status: 'error', message: e.message || 'Failed to load saved amount' },
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupKey, activeRegion, settingKey, groupCasesAll.length]);

  const savedSetting = settingsByKey[settingKey];
  const loadState = settingsLoadByKey[settingKey];
  const saveState = saveStateByKey[settingKey];
  const finalAmountText = finalAmountOverrides[settingKey] ?? (
    savedSetting?.final_amount != null ? String(Number(savedSetting.final_amount)) : ''
  );
  const customAmountText = customAmountOverrides[settingKey] ?? (
    savedSetting?.custom_amount != null && Number(savedSetting.custom_amount) > 0
      ? String(Number(savedSetting.custom_amount))
      : ''
  );
  const recommended = groupCases.reduce((sum, c) => sum + recommendedCeiling(c), 0);
  const finalAmount = finalAmountText.trim() === '' ? recommended : Number(finalAmountText) || 0;
  const customAmount = Number(customAmountText) || 0;
  const effectiveAmount = customAmount > 0 ? customAmount : finalAmount;
  const pilot = effectiveAmount * 0.2;
  const remaining = Math.max(effectiveAmount - pilot, 0);
  const best = topVenue(groupCases);
  const averageScore = avg(groupCases.map((c) => c.score));
  const rationale = groupCases.map(rationaleText).find(Boolean);
  const riskNotes = groupCases.map(riskNotesText).find(Boolean);

  async function saveFinalAmount() {
    setSaveStateByKey((current) => ({ ...current, [settingKey]: { status: 'saving' } }));
    try {
      const res = await fetch(SETTINGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupKey,
          groupName,
          region: activeRegion,
          currency,
          recommendedAmount: recommended,
          finalAmount,
          customAmount,
          effectiveAmount,
          pilotPercent: 20,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const suffix = data.sqlFile ? ` Run ${data.sqlFile}.` : '';
        throw new Error(`${data.error || `Status ${res.status}`}.${suffix}`);
      }
      setSettingsByKey((current) => ({ ...current, [settingKey]: data.setting }));
      setFinalAmountOverrides((current) => {
        const next = { ...current };
        delete next[settingKey];
        return next;
      });
      setCustomAmountOverrides((current) => {
        const next = { ...current };
        delete next[settingKey];
        return next;
      });
      setSaveStateByKey((current) => ({ ...current, [settingKey]: { status: 'saved', message: 'Saved' } }));
    } catch (e) {
      setSaveStateByKey((current) => ({
        ...current,
        [settingKey]: { status: 'error', message: e.message || 'Failed to save' },
      }));
    }
  }

  return (
    <div style={{ padding: '28px 24px', color: 'var(--mz-text-on-page)' }}>
      <Link href="/cases" style={backLink}>Back to Cases</Link>

      {entityState === 'found' && entity && <EntityCard entity={entity} onVenueAdded={refetchEntity} />}
      {entityState === 'not-registered' && (
        <RegisterBanner groupKey={groupKey} groupName={groupName} />
      )}

      <div style={{ marginTop: 18, marginBottom: 18 }}>
        <div className="mz-eyebrow">Group Dashboard</div>
        <h1 style={{ fontSize: 32, lineHeight: 1.1, margin: '6px 0 0', fontWeight: 900 }}>
          {state === 'loading' ? 'Loading group...' : groupName}
        </h1>
        <p className="mz-subheader" style={{ margin: '8px 0 0' }}>
          Lending recommendation, committee view, and venue-level underwriting analytics.
        </p>
      </div>

      <DashboardTabs />

      {state === 'error' && (
        <div style={errorBox}>Failed to load group: {msg}</div>
      )}

      {state === 'ok' && groupCasesAll.length === 0 && (
        <div style={emptyBox}>No group found for this dashboard.</div>
      )}

      {state === 'ok' && groupCasesAll.length > 0 && (
        <>
          <div style={tabs}>
            {availableRegions.map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`mz-clickable ${activeRegion === r ? 'active' : ''}`}
                style={{ padding: '8px 14px' }}
              >
                {r}
              </button>
            ))}
          </div>

          <section style={summaryGrid}>
            <MetricCard label="Venues" value={groupCases.length} sub={activeRegion} />
            <MetricCard label="Average Score" value={averageScore == null ? '-' : averageScore.toFixed(1)} sub={best ? `Top: ${caseVenue(best)}` : 'No scored venues'} valueColor={scoreColor(averageScore)} />
            <MetricCard label="Recommended Lending Amount" value={formatMoney(recommended, currency)} sub="System recommendation from venue ceilings" valueColor={lendingAmountColor(recommended)} />
            <div className="mz-card" style={{ minWidth: 0 }}>
              <div className="mz-eyebrow">Final Lending Amount</div>
              <input
                type="number"
                value={finalAmountText}
                onChange={(e) => {
                  const value = e.target.value;
                  setFinalAmountOverrides((current) => ({ ...current, [settingKey]: value }));
                }}
                placeholder={String(Math.round(recommended))}
                style={{ width: '100%', marginTop: 8, height: 38 }}
              />
              <div className="mz-mono" style={{ fontSize: 24, fontWeight: 900, color: lendingAmountColor(finalAmount), marginTop: 8 }}>
                {formatMoney(finalAmount, currency)}
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="mz-eyebrow" style={{ color: 'var(--mz-muted)' }}>Custom Amount</div>
                <input
                  type="number"
                  value={customAmountText}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomAmountOverrides((current) => ({ ...current, [settingKey]: value }));
                  }}
                  placeholder="0"
                  style={{ width: '100%', marginTop: 8, height: 38 }}
                />
              </div>
              <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)', marginTop: 8 }}>
                Custom overrides final when greater than zero.
              </div>
              <div style={effectiveBox}>
                <div className="mz-eyebrow" style={{ color: 'var(--mz-muted)' }}>Effective Lending Amount</div>
                <div className="mz-mono" style={{ fontSize: 22, fontWeight: 900, color: lendingAmountColor(effectiveAmount), marginTop: 4 }}>
                  {formatMoney(effectiveAmount, currency)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={saveFinalAmount}
                  disabled={saveState?.status === 'saving'}
                  className="mz-clickable active"
                  style={{ padding: '7px 10px', opacity: saveState?.status === 'saving' ? 0.65 : 1 }}
                >
                  {saveState?.status === 'saving' ? 'Saving...' : 'Save amount'}
                </button>
                <span style={savedMetaStyle}>
                  {savedSetting
                    ? `Saved ${formatSavedAt(savedSetting.updated_at)}${savedSetting.updated_by_email ? ` by ${savedSetting.updated_by_email}` : ''}`
                    : loadState?.status === 'loading'
                      ? 'Checking saved amount...'
                      : 'Not saved yet'}
                </span>
              </div>
              {(loadState?.status === 'setup' || loadState?.status === 'error' || saveState?.status === 'error' || saveState?.status === 'saved') && (
                <div style={{
                  ...saveNoticeStyle,
                  color: saveState?.status === 'saved' ? 'var(--mz-green-text)' : 'var(--mz-amber-text)',
                  borderColor: saveState?.status === 'saved' ? 'var(--mz-green-border)' : 'var(--mz-amber-border)',
                  background: saveState?.status === 'saved' ? 'var(--mz-green-bg)' : 'var(--mz-amber-bg)',
                }}>
                  {saveState?.message || loadState?.message}
                </div>
              )}
            </div>
          </section>

          <section style={twoCol}>
            <div className="mz-card">
              <div className="mz-eyebrow">Disbursement Policy</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
                <MiniStat label="Pilot - 20%" value={formatMoney(pilot, currency)} />
                <MiniStat label="Quarterly Top-Up Capacity" value={formatMoney(remaining, currency)} />
              </div>
              <p style={mutedCopy}>
                The pilot is calculated as 20% of the effective lending amount. Remaining exposure can be released
                quarterly up to the outstanding approved amount, subject to usage and risk review.
              </p>
            </div>

            <div className="mz-card">
              <div className="mz-eyebrow">Risk Committee Decision</div>
              <h2 style={{ margin: '10px 0 6px', fontSize: 22 }}>{groupDecision(groupCases)}</h2>
              <p style={mutedCopy}>
                {rationale || 'No committee rationale is attached yet. Once captured on the case, it will surface here and on the tracker.'}
              </p>
              <div style={{ marginTop: 14 }}>
                <div className="mz-eyebrow" style={{ color: 'var(--mz-muted)' }}>Risk Committee Notes</div>
                <p style={{ ...mutedCopy, marginTop: 8 }}>
                  {riskNotes || 'No committee notes are attached yet for this group.'}
                </p>
              </div>
            </div>
          </section>

          <section className="mz-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--mz-border-soft)' }}>
              <span className="mz-eyebrow">Venue Analytics</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                <thead>
                  <tr>
                    <th style={th}>Case</th>
                    <th style={th}>Venue</th>
                    <th style={th}>Region</th>
                    <th style={th}>Score</th>
                    <th style={th}>Recommended</th>
                    <th style={th}>Pilot 20%</th>
                    <th style={th}>Status</th>
                    <th style={th}>Submitted</th>
                    <th style={th}>Decision</th>
                    <th style={th}>Risk Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {groupCases.map((c) => {
                    const dates = trackerDates(c);
                    const ceiling = recommendedCeiling(c);
                    const notes = riskNotesText(c);
                    return (
                      <tr key={c.id}>
                        <td style={td} className="mz-mono">
                          <Link href={`/cases/${c.id}`} style={{ color: 'var(--mz-accent)', fontWeight: 900 }}>
                            {shortCaseRef(c)}
                          </Link>
                        </td>
                        <td style={{ ...td, fontWeight: 800 }}>{caseVenue(c)}</td>
                        <td style={td}>{caseRegion(c)}</td>
                        <td style={{ ...td, color: scoreColor(c.score), fontWeight: 900 }} className="mz-mono">{c.score != null ? Number(c.score).toFixed(1) : '-'}</td>
                        <td style={{ ...td, color: lendingAmountColor(ceiling), fontWeight: 900 }} className="mz-mono">{formatMoney(ceiling, currency)}</td>
                        <td style={td} className="mz-mono">{formatMoney(ceiling * 0.2, currency)}</td>
                        <td style={td}><StatusBadge status={c.status} /></td>
                        <td style={td}>{formatTrackerDate(dates.submitted)}</td>
                        <td style={td}>{decisionText(c)}</td>
                        <td style={{ ...td, color: 'var(--mz-muted)', maxWidth: 280 }}>{shortNote(notes) || '-'}</td>
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

function MetricCard({ label, value, sub, valueColor }) {
  return (
    <div className="mz-card" style={{ minWidth: 0 }}>
      <div className="mz-eyebrow">{label}</div>
      <div className="mz-mono" style={{ fontSize: 28, fontWeight: 900, color: valueColor || 'var(--mz-text)', marginTop: 8 }}>
        {value}
      </div>
      <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)', marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: 'var(--mz-card-nested)', border: '1px solid var(--mz-border-soft)', borderRadius: 8, padding: 12 }}>
      <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>{label}</div>
      <div className="mz-mono" style={{ fontWeight: 900, fontSize: 20, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function EntityCard({ entity, onVenueAdded }) {
  const venues = entity.venues || [];
  const [showForm, setShowForm] = useState(false);
  const [venueForm, setVenueForm] = useState({ venue_name: '', location: '', concept: '', lettable_sqm: '' });
  const [submitting, setSubmitting] = useState(false);
  const [venueError, setVenueError] = useState('');

  async function handleAddVenue(e) {
    e.preventDefault();
    setVenueError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: entity.id,
          venue_name: venueForm.venue_name,
          location: venueForm.location || undefined,
          concept: venueForm.concept || undefined,
          lettable_sqm: venueForm.lettable_sqm !== '' ? venueForm.lettable_sqm : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setVenueError(data.error || 'Failed to add venue'); return; }
      setShowForm(false);
      setVenueForm({ venue_name: '', location: '', concept: '', lettable_sqm: '' });
      onVenueAdded();
    } catch {
      setVenueError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  const venueInputStyle = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 'var(--mz-radius-sm)',
    border: '1px solid var(--mz-border-input)',
    background: 'var(--mz-card-nested)',
    color: 'var(--mz-text)',
    fontFamily: 'var(--mz-font-sans)',
    fontSize: 'var(--mz-fs-sm)',
    boxSizing: 'border-box',
  };

  return (
    <div className="mz-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <RegionBadge region={entity.region} />
            <span style={{ fontSize: 'var(--mz-fs-xs)', color: 'var(--mz-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {entity.status}
            </span>
          </div>
          <h2 style={{ margin: '0 0 4px', fontSize: 'var(--mz-fs-h2)', fontWeight: 800 }}>{entity.group_name}</h2>
          <p style={{ margin: 0, fontSize: 'var(--mz-fs-sm)', color: 'var(--mz-muted)', fontFamily: 'var(--mz-font-mono)' }}>
            {entity.group_key}{entity.commercial_poc ? ` · PoC: ${entity.commercial_poc}` : ''}
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setVenueError(''); }}
          className="mz-clickable"
          style={{ padding: '6px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {showForm ? 'Cancel' : '+ Add Venue'}
        </button>
      </div>

      {venues.length === 0 && !showForm && (
        <p style={{ margin: 0, fontSize: 'var(--mz-fs-sm)', color: 'var(--mz-muted)' }}>No venues registered yet.</p>
      )}
      {venues.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mz-border-soft)' }}>
                {['Venue', 'Location', 'Concept', 'Sqm', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 'var(--mz-fs-xxs)', fontWeight: 700, color: 'var(--mz-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--mz-border-subtle)' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, fontSize: 'var(--mz-fs-sm)' }}>{v.venue_name}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-sm)' }}>{v.location || '—'}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-sm)' }}>{v.concept || '—'}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'var(--mz-font-mono)', fontSize: 'var(--mz-fs-sm)' }}>{v.lettable_sqm ?? '—'}</td>
                  <td style={{ padding: '9px 12px', fontSize: 'var(--mz-fs-xs)', color: 'var(--mz-muted)', textTransform: 'uppercase' }}>{v.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--mz-border-soft)' }}>
          <div className="mz-eyebrow" style={{ marginBottom: 12 }}>Add a venue</div>
          <p style={{ margin: '0 0 14px', fontSize: 'var(--mz-fs-xs)', color: 'var(--mz-muted)' }}>
            Region: <strong style={{ color: 'var(--mz-text)' }}>{entity.region}</strong> — inherited from this group, not editable.
          </p>
          <form onSubmit={handleAddVenue}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 'var(--mz-fs-xs)', fontWeight: 700, color: 'var(--mz-muted)' }}>
                  Venue name <span style={{ color: 'var(--mz-accent)' }}>*</span>
                </label>
                <input
                  type="text"
                  style={venueInputStyle}
                  value={venueForm.venue_name}
                  onChange={(e) => setVenueForm((f) => ({ ...f, venue_name: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 'var(--mz-fs-xs)', fontWeight: 700, color: 'var(--mz-muted)' }}>Location</label>
                <input
                  type="text"
                  style={venueInputStyle}
                  value={venueForm.location}
                  onChange={(e) => setVenueForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. JBR, Dubai"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 'var(--mz-fs-xs)', fontWeight: 700, color: 'var(--mz-muted)' }}>Concept</label>
                <input
                  type="text"
                  style={venueInputStyle}
                  value={venueForm.concept}
                  onChange={(e) => setVenueForm((f) => ({ ...f, concept: e.target.value }))}
                  placeholder="e.g. Sushi, Mediterranean"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 'var(--mz-fs-xs)', fontWeight: 700, color: 'var(--mz-muted)' }}>Floor area (sqm)</label>
                <input
                  type="number"
                  style={venueInputStyle}
                  value={venueForm.lettable_sqm}
                  onChange={(e) => setVenueForm((f) => ({ ...f, lettable_sqm: e.target.value }))}
                  min="0"
                  step="1"
                />
              </div>
            </div>
            {venueError && (
              <p style={{ margin: '0 0 10px', color: 'var(--mz-red-text)', fontSize: 'var(--mz-fs-xs)' }}>{venueError}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={submitting}
                className="mz-clickable active"
                style={{ padding: '7px 14px', opacity: submitting ? 0.65 : 1 }}
              >
                {submitting ? 'Adding…' : 'Add venue'}
              </button>
              <button
                type="button"
                className="mz-clickable"
                style={{ padding: '7px 14px' }}
                onClick={() => { setShowForm(false); setVenueError(''); }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function RegisterBanner({ groupKey, groupName }) {
  const p = new URLSearchParams();
  if (groupKey) p.set('group_key', groupKey);
  if (groupName && groupName !== 'Ungrouped') p.set('group_name', groupName);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 16px',
      marginBottom: 16,
      borderRadius: 'var(--mz-radius-md)',
      background: 'var(--mz-accent-06)',
      border: '1px solid var(--mz-border-on-page)',
      fontSize: 'var(--mz-fs-sm)',
    }}>
      <span style={{ color: 'var(--mz-muted)' }}>This group is not registered as an entity yet.</span>
      <Link href={`/new-case?${p.toString()}`} style={{ color: 'var(--mz-accent)', fontWeight: 700, whiteSpace: 'nowrap', textDecoration: 'none' }}>
        Register it →
      </Link>
    </div>
  );
}

const backLink = {
  color: 'var(--mz-muted)',
  fontSize: 'var(--mz-fs-xs)',
  textTransform: 'uppercase',
  letterSpacing: 1.4,
  fontWeight: 800,
};
const tabs = { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' };
const summaryGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 };
const twoCol = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 16 };
const mutedCopy = { color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-sm)', lineHeight: 1.7, margin: '12px 0 0' };
const savedMetaStyle = { color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' };
const effectiveBox = {
  marginTop: 10,
  padding: '10px 12px',
  borderRadius: 8,
  background: 'var(--mz-card-nested)',
  border: '1px solid var(--mz-border-soft)',
};
const saveNoticeStyle = {
  border: '1px solid',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 'var(--mz-fs-xs)',
  lineHeight: 1.5,
  marginTop: 10,
};
const errorBox = { padding: 16, borderRadius: 8, background: 'var(--mz-red-bg)', border: '1px solid var(--mz-red-border)', color: 'var(--mz-red-text)' };
const emptyBox = { padding: 16, borderRadius: 8, background: 'var(--mz-card)', border: '1px solid var(--mz-border)', color: 'var(--mz-muted)' };
const th = {
  padding: '11px 13px',
  textAlign: 'left',
  color: 'var(--mz-muted)',
  fontSize: 'var(--mz-fs-xxs)',
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--mz-border-soft)',
};
const td = {
  padding: '12px 13px',
  borderBottom: '1px solid var(--mz-border-subtle)',
  fontSize: 'var(--mz-fs-sm)',
};
