'use client';

import { useMemo, useState } from 'react';
import {
  SCORING_POLICY_REGIONS,
  defaultPolicyForRegion,
  normalizePolicyPayload,
} from '../_lib/scoringPolicy';

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: 18,
};

const sectionHeader = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--mz-border-soft)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
};

export default function ScoringBandsPageClient({
  initialPolicies,
  initialSetupRequired,
  initialErrors,
  initialPasswordConfigured,
}) {
  const [policies, setPolicies] = useState(() => normalizedInitialPolicies(initialPolicies));
  const [activeRegion, setActiveRegion] = useState('UAE');
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [policyTextByRegion, setPolicyTextByRegion] = useState(() => policyTextMap(initialPolicies));
  const [editSource, setEditSource] = useState('policy_editor');
  const [message, setMessage] = useState('');
  const [setupRequired, setSetupRequired] = useState(Boolean(initialSetupRequired));
  const [passwordConfigured, setPasswordConfigured] = useState(Boolean(initialPasswordConfigured));
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [lockPromptOpen, setLockPromptOpen] = useState(false);

  const activeEntry = policies[activeRegion] || { policy: defaultPolicyForRegion(activeRegion), source: 'default' };
  const activePolicy = activeEntry.policy;
  const activeText = policyTextByRegion[activeRegion] || prettyPolicy(activePolicy);
  const parsedDraft = useMemo(() => {
    try {
      return { policy: normalizePolicyPayload(activeRegion, JSON.parse(activeText)), error: '' };
    } catch (error) {
      return { policy: null, error: error.message };
    }
  }, [activeRegion, activeText]);

  const isDirty = activeText !== prettyPolicy(activePolicy);

  async function refreshPolicies() {
    const res = await fetch('/api/scoring-bands', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Refresh failed: ${res.status}`);
    setPolicies(normalizedInitialPolicies(body.policies));
    setPolicyTextByRegion(policyTextMap(body.policies));
    setSetupRequired(Boolean(body.setupRequired));
    setPasswordConfigured(Boolean(body.passwordConfigured));
    return body;
  }

  async function unlockEditing() {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/scoring-bands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_password', password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Unlock failed: ${res.status}`);
      setUnlocked(true);
      setPasswordConfigured(true);
      setMessage('Scoring bands unlocked for this browser session.');
    } catch (error) {
      setUnlocked(false);
      if (String(error.message || '').includes('not configured')) setPasswordConfigured(false);
      setMessage(error.message || 'Unlock failed.');
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy(source) {
    const resolvedSource = source || editSource;
    if (!unlocked) {
      setMessage('Unlock scoring bands before saving.');
      return false;
    }
    if (parsedDraft.error) {
      setMessage(`Policy JSON is invalid: ${parsedDraft.error}`);
      return false;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/scoring-bands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_policy',
          region: activeRegion,
          password,
          policy: parsedDraft.policy,
          source: resolvedSource,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Save failed: ${res.status}`);
      setPolicies((current) => ({
        ...current,
        [activeRegion]: {
          region: activeRegion,
          policy: body.policy,
          row: body.row,
          source: 'database',
          setupRequired: false,
          error: null,
        },
      }));
      setPolicyTextByRegion((current) => ({
        ...current,
        [activeRegion]: prettyPolicy(body.policy),
      }));
      setMessage(`${activeRegion} scoring bands saved.`);
      await refreshPolicies();
      return true;
    } catch (error) {
      if (String(error.message || '').includes('scoring_policies table')) setSetupRequired(true);
      setMessage(error.message || 'Save failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function resetDraft() {
    setPolicyTextByRegion((current) => ({
      ...current,
      [activeRegion]: prettyPolicy(activePolicy),
    }));
    setEditSource('policy_editor');
    setMessage(`${activeRegion} draft reset.`);
  }

  // Updates a single band field inline; mutates the parsed policy text so editor stays in sync.
  function updateBandField(sectionIndex, categoryIndex, criterionIndex, bandIndex, field, value) {
    setPolicyTextByRegion((current) => {
      try {
        const parsed = JSON.parse(current[activeRegion] || prettyPolicy(activePolicy));
        parsed.sections[sectionIndex].categories[categoryIndex].criteria[criterionIndex].bands[bandIndex][field] = value;
        return { ...current, [activeRegion]: prettyPolicy(parsed) };
      } catch {
        return current;
      }
    });
    setEditSource('bands_inline');
  }

  function requestLock() {
    if (isDirty) {
      setLockPromptOpen(true);
    } else {
      executeLock('discard');
    }
  }

  async function executeLock(choice) {
    setLockPromptOpen(false);
    if (choice === 'cancel') return;
    if (choice === 'save') {
      const saved = await savePolicy('policy_editor');
      if (!saved) return;
    }
    setBusy(true);
    try {
      await fetch('/api/scoring-bands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manual_lock', region: activeRegion, password }),
      });
    } catch { /* non-fatal */ }
    setUnlocked(false);
    setPassword('');
    setEditSource('policy_editor');
    setMessage('Scoring bands locked.');
    setBusy(false);
  }

  return (
    <div style={{ padding: '28px 24px', color: 'var(--mz-text-on-page)' }}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ fontSize: 'var(--mz-fs-h1)', fontWeight: 900, margin: 0 }}>
            Scoring Bands
          </h1>
          <p className="mz-subheader" style={{ margin: '6px 0 0' }}>
            Locked UAE and USA risk-model policy.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {SCORING_POLICY_REGIONS.map((region) => (
            <button
              key={region}
              className={`mz-clickable ${region === activeRegion ? 'active' : ''}`}
              onClick={() => {
                setActiveRegion(region);
                setUnlocked(false);
                setMessage('');
                setLockPromptOpen(false);
              }}
              style={{ padding: '8px 13px' }}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      {(message || setupRequired || initialErrors?.length > 0) && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
          {message && <Alert tone={messageTone(message)}>{message}</Alert>}
          {setupRequired && (
            <Alert tone="amber">
              Supabase setup required: apply `supabase/migrations/20260612110000_scoring_policies.sql` before saving policy changes.
            </Alert>
          )}
          {initialErrors?.map((error) => <Alert key={error} tone="amber">{error}</Alert>)}
        </div>
      )}

      <section className="mz-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div style={sectionHeader}>
          <div>
            <span className="mz-eyebrow">{activeRegion} Policy</span>
            <div style={{ marginTop: 4, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
              Version {activePolicy.version_label} · {activeEntry.source === 'database' ? 'Supabase source' : 'Default source'}
            </div>
          </div>
          <PolicyStatus
            row={activeEntry.row}
            unlocked={unlocked}
            passwordConfigured={passwordConfigured}
            setupRequired={setupRequired || activeEntry.setupRequired}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.8fr) minmax(0, 1.2fr)', gap: 0 }}>
          <div style={{ padding: 18, borderRight: '1px solid var(--mz-border-soft)', borderBottom: '1px solid var(--mz-border-soft)' }}>
            <div className="mz-eyebrow" style={{ marginBottom: 10 }}>Unlock Controls</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !unlocked && password) unlockEditing(); }}
                placeholder="Scoring password"
                autoComplete="current-password"
                readOnly={unlocked}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!unlocked ? (
                  <button
                    className="mz-clickable active"
                    onClick={unlockEditing}
                    disabled={busy || !password}
                    style={{ padding: '7px 10px', opacity: busy || !password ? 0.55 : 1 }}
                  >
                    {busy ? 'Checking...' : 'Unlock'}
                  </button>
                ) : (
                  <button
                    className="mz-clickable"
                    onClick={requestLock}
                    disabled={busy}
                    style={{ padding: '7px 10px', opacity: busy ? 0.55 : 1, color: 'var(--mz-red-text)', borderColor: 'var(--mz-red-border)' }}
                  >
                    Lock
                  </button>
                )}
                <button
                  className="mz-clickable"
                  onClick={refreshPolicies}
                  disabled={busy}
                  style={{ padding: '7px 10px', opacity: busy ? 0.55 : 1 }}
                >
                  Refresh
                </button>
              </div>
              {lockPromptOpen && (
                <div style={{ padding: 12, border: '1px solid var(--mz-amber-border)', borderRadius: 8, background: 'var(--mz-amber-bg)', display: 'grid', gap: 8 }}>
                  <div style={{ color: 'var(--mz-amber-text)', fontSize: 'var(--mz-fs-xs)', fontWeight: 800 }}>
                    You have unsaved changes. What would you like to do?
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="mz-clickable active" onClick={() => executeLock('save')} disabled={busy} style={{ padding: '6px 9px', fontSize: 'var(--mz-fs-xs)' }}>
                      Save &amp; Lock
                    </button>
                    <button className="mz-clickable" onClick={() => executeLock('discard')} disabled={busy} style={{ padding: '6px 9px', fontSize: 'var(--mz-fs-xs)', color: 'var(--mz-red-text)' }}>
                      Discard &amp; Lock
                    </button>
                    <button className="mz-clickable" onClick={() => executeLock('cancel')} style={{ padding: '6px 9px', fontSize: 'var(--mz-fs-xs)' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <MetaGrid policy={activePolicy} row={activeEntry.row} />
            </div>
          </div>

          <div style={{ padding: 18, borderBottom: '1px solid var(--mz-border-soft)' }}>
            <div className="mz-eyebrow" style={{ marginBottom: 10 }}>Model Weights</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {(activePolicy.modelWeights || []).map((item) => (
                <MetricBlock key={item.model} label={item.model} value={`${item.weight}%`} />
              ))}
              <MetricBlock label="Currency" value={activePolicy.currency} />
            </div>
          </div>
        </div>

        <div style={{ padding: 18, borderBottom: '1px solid var(--mz-border-soft)' }}>
          <div className="mz-eyebrow" style={{ marginBottom: 10 }}>Risk Categories</div>
          <RiskCategoryTable rows={activePolicy.riskCategories || []} />
        </div>
      </section>

      <>
        <section className="mz-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
          <div style={sectionHeader}>
            <div>
              <span className="mz-eyebrow">Structured Bands</span>
              <div style={{ marginTop: 4, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
                {activePolicy.methodology}
                {unlocked && isDirty && (
                  <span style={{ marginLeft: 8, color: 'var(--mz-amber-text)' }}>· Unsaved changes</span>
                )}
              </div>
            </div>
            {unlocked && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="mz-clickable"
                  onClick={resetDraft}
                  disabled={busy || !isDirty}
                  style={{ padding: '7px 10px', opacity: busy || !isDirty ? 0.45 : 1 }}
                >
                  Reset
                </button>
                <button
                  className="mz-clickable active"
                  onClick={() => savePolicy(editSource)}
                  disabled={busy || Boolean(parsedDraft.error) || !isDirty}
                  style={{ padding: '7px 10px', opacity: busy || parsedDraft.error || !isDirty ? 0.45 : 1 }}
                >
                  {busy ? 'Saving...' : 'Save Bands'}
                </button>
              </div>
            )}
          </div>
          <PolicySections
            sections={activePolicy.sections || []}
            unlocked={unlocked}
            onBandChange={updateBandField}
          />
          {activePolicy.capCriteria?.length > 0 && (
            <div style={{ padding: 18, borderTop: '1px solid var(--mz-border-soft)' }}>
              <div className="mz-eyebrow" style={{ marginBottom: 10 }}>Capping Criteria</div>
              <CapCriteria rows={activePolicy.capCriteria} />
            </div>
          )}
        </section>

        <section className="mz-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={sectionHeader}>
            <div>
              <span className="mz-eyebrow">Policy Editor</span>
              <div style={{ marginTop: 4, color: unlocked ? 'var(--mz-green-text)' : 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
                {unlocked ? 'Unlocked — editing here and in Structured Bands are one source of truth' : 'Locked — use password above'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {editorOpen && (
                <>
                  <button
                    className="mz-clickable"
                    onClick={resetDraft}
                    disabled={busy}
                    style={{ padding: '7px 10px', opacity: busy ? 0.55 : 1 }}
                  >
                    Reset
                  </button>
                  <button
                    className="mz-clickable active"
                    onClick={() => savePolicy('policy_editor')}
                    disabled={busy || !unlocked || Boolean(parsedDraft.error)}
                    style={{ padding: '7px 10px', opacity: busy || !unlocked || parsedDraft.error ? 0.55 : 1 }}
                  >
                    {busy ? 'Saving...' : 'Save Policy'}
                  </button>
                </>
              )}
              <button
                className="mz-clickable"
                onClick={() => setEditorOpen((open) => !open)}
                style={{ padding: '7px 10px' }}
              >
                {editorOpen ? 'Hide Editor' : 'Show Editor'}
              </button>
            </div>
          </div>
          {editorOpen && (
            <>
              {parsedDraft.error && (
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--mz-border-soft)' }}>
                  <Alert tone="amber">JSON error: {parsedDraft.error}</Alert>
                </div>
              )}
              <textarea
                value={activeText}
                onChange={(event) => {
                  setPolicyTextByRegion((current) => ({
                    ...current,
                    [activeRegion]: event.target.value,
                  }));
                  setEditSource('policy_editor');
                }}
                readOnly={!unlocked}
                rows={34}
                spellCheck={false}
                style={{
                  width: '100%',
                  border: 0,
                  borderRadius: 0,
                  resize: 'vertical',
                  minHeight: 640,
                  fontFamily: 'var(--mz-font-mono)',
                  fontSize: 'var(--mz-fs-xs)',
                  lineHeight: 1.55,
                  opacity: unlocked ? 1 : 0.72,
                }}
              />
            </>
          )}
        </section>
      </>
    </div>
  );
}

function PolicyStatus({ row, unlocked, passwordConfigured, setupRequired }) {
  const items = [
    { label: 'Lock', value: unlocked ? 'Unlocked' : 'Locked', tone: unlocked ? 'green' : 'amber' },
    { label: 'Password', value: passwordConfigured === false ? 'Not configured' : 'Server-side', tone: passwordConfigured === false ? 'amber' : 'green' },
    { label: 'Storage', value: setupRequired ? 'Needs migration' : row ? 'Supabase' : 'Default', tone: setupRequired ? 'amber' : 'green' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {items.map((item) => (
        <span
          key={item.label}
          style={{
            padding: '5px 8px',
            borderRadius: 6,
            background: toneBackground(item.tone),
            border: `1px solid ${toneBorder(item.tone)}`,
            color: toneColor(item.tone),
            fontSize: 'var(--mz-fs-xs)',
            fontWeight: 800,
            whiteSpace: 'nowrap',
          }}
        >
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  );
}

function MetaGrid({ policy, row }) {
  const items = [
    ['Version', policy.version_label],
    ['Effective', policy.effective_date],
    ['Updated', row?.updated_at ? formatDateTime(row.updated_at) : '-'],
    ['Updated By', row?.updated_by_email || '-'],
  ];
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
          <span>{label}</span>
          <span className="mz-mono" style={{ color: 'var(--mz-text)', textAlign: 'right' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function MetricBlock({ label, value }) {
  return (
    <div style={{ border: '1px solid var(--mz-border-soft)', borderRadius: 8, padding: 12, minWidth: 0 }}>
      <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>{label}</div>
      <div className="mz-mono" style={{ color: 'var(--mz-accent)', fontSize: 22, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function RiskCategoryTable({ rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
        <thead>
          <tr>
            {['Category', 'Min', 'Max', 'Ceiling', 'Votes', 'Refinancing'].map((head) => (
              <TableHead key={head} align={['Min', 'Max', 'Votes'].includes(head) ? 'right' : 'left'}>{head}</TableHead>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category}>
              <TableCell strong>{row.category}</TableCell>
              <TableCell mono align="right">{row.min}</TableCell>
              <TableCell mono align="right">{row.max}</TableCell>
              <TableCell mono>{row.ceiling}</TableCell>
              <TableCell mono align="right">{row.votesRequired}</TableCell>
              <TableCell mono>{row.refinancingThreshold}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicySections({ sections, unlocked, onBandChange }) {
  return (
    <div style={{ display: 'grid' }}>
      {sections.map((section, sectionIndex) => (
        <div key={section.id} style={{ padding: 18, borderTop: '1px solid var(--mz-border-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 12 }}>
            <h2 style={{ fontSize: 'var(--mz-fs-h2)', margin: 0 }}>{section.title}</h2>
            {section.aggregateWeight != null && (
              <span style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
                Weight: <span className="mz-mono" style={{ color: 'var(--mz-accent)', fontWeight: 900 }}>{section.aggregateWeight}%</span>
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {(section.categories || []).map((category, categoryIndex) => (
              <div key={category.id}>
                <div className="mz-eyebrow" style={{ color: 'var(--mz-accent-peach)', marginBottom: 8 }}>{category.title}</div>
                <CriteriaTable
                  criteria={category.criteria || []}
                  unlocked={unlocked}
                  onBandChange={(criterionIndex, bandIndex, field, value) =>
                    onBandChange(sectionIndex, categoryIndex, criterionIndex, bandIndex, field, value)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CriteriaTable({ criteria, unlocked, onBandChange }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--mz-border-soft)', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
        <colgroup>
          <col style={{ width: '32%', minWidth: 200 }} />
          <col style={{ width: 72 }} />
          <col style={{ width: '34%', minWidth: 180 }} />
          <col style={{ width: '24%', minWidth: 200 }} />
        </colgroup>
        <thead>
          <tr>
            <TableHead>Metric</TableHead>
            <TableHead align="right">Weight</TableHead>
            <TableHead>Bands</TableHead>
            <TableHead>Auto Rules</TableHead>
          </tr>
        </thead>
        <tbody>
          {criteria.map((item, criterionIndex) => (
            <tr key={item.id}>
              <TableCell strong>{item.label}</TableCell>
              <TableCell mono align="right">{item.weight ?? '-'}</TableCell>
              <TableCell>
                <BandList
                  bands={item.bands || []}
                  unlocked={unlocked}
                  onBandChange={(bandIndex, field, value) =>
                    onBandChange(criterionIndex, bandIndex, field, value)
                  }
                />
              </TableCell>
              <TableCell>
                <RuleList item={item} />
              </TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BandList({ bands, unlocked, onBandChange }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {bands.map((band, bandIndex) => (
        <div
          key={`${band.score}-${band.range}-${bandIndex}`}
          style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 6, alignItems: 'center', fontSize: 'var(--mz-fs-xs)' }}
        >
          {unlocked ? (
            <input
              type="number"
              value={band.score}
              onChange={(event) => onBandChange(bandIndex, 'score', Number(event.target.value))}
              style={{
                width: '100%',
                padding: '3px 5px',
                fontFamily: 'var(--mz-font-mono)',
                fontSize: 'var(--mz-fs-xs)',
                fontWeight: 900,
                color: scoreColor(band.score),
                textAlign: 'right',
                background: 'var(--mz-card-nested)',
                border: '1px solid var(--mz-border-input)',
                borderRadius: 4,
              }}
            />
          ) : (
            <span className="mz-mono" style={{ color: scoreColor(band.score), fontWeight: 900, textAlign: 'right' }}>
              {band.score}
            </span>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 4, alignItems: 'center' }}>
            <span style={{ color: 'var(--mz-muted)' }}>{band.label}</span>
            {unlocked ? (
              <input
                type="text"
                value={band.range}
                onChange={(event) => onBandChange(bandIndex, 'range', event.target.value)}
                style={{
                  width: '100%',
                  padding: '3px 5px',
                  fontSize: 'var(--mz-fs-xs)',
                  color: 'var(--mz-text)',
                  background: 'var(--mz-card-nested)',
                  border: '1px solid var(--mz-border-input)',
                  borderRadius: 4,
                }}
              />
            ) : (
              <span style={{ color: 'var(--mz-muted)' }}>{band.range}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RuleList({ item }) {
  const rules = [
    item.autoApprove && ['Approve', item.autoApprove],
    item.autoReject && ['Reject', item.autoReject],
  ].filter(Boolean);
  if (!rules.length) return <span style={{ color: 'var(--mz-muted)' }}>—</span>;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {rules.map(([label, value]) => (
        <div key={label} style={{ fontSize: 'var(--mz-fs-xs)' }}>
          <span style={{ color: label === 'Approve' ? 'var(--mz-green-text)' : 'var(--mz-red-text)', fontWeight: 900 }}>{label}</span>
          <span style={{ color: 'var(--mz-muted)' }}> {value}</span>
        </div>
      ))}
    </div>
  );
}

function CapCriteria({ rows }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((row) => (
        <div key={row.id} style={{ border: '1px solid var(--mz-border-soft)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <strong>{row.label}</strong>
            <span className="mz-mono" style={{ color: 'var(--mz-accent)' }}>Scoring {row.scoring}</span>
          </div>
          <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
            {row.bands?.map((band) => (
              <div key={`${row.id}-${band.range}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
                <span>{band.range}</span>
                <span className="mz-mono" style={{ color: 'var(--mz-text)', textAlign: 'right' }}>{band.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableHead({ children, align }) {
  return (
    <th style={{
      textAlign: align || 'left',
      padding: '9px 10px',
      borderBottom: '1px solid var(--mz-border-soft)',
      color: 'var(--mz-accent)',
      fontSize: 'var(--mz-fs-xxs)',
      textTransform: 'uppercase',
      letterSpacing: 1,
    }}>
      {children}
    </th>
  );
}

function TableCell({ children, mono, strong, align }) {
  return (
    <td
      className={mono ? 'mz-mono' : undefined}
      style={{
        padding: '10px',
        borderBottom: '1px solid var(--mz-border-soft)',
        color: strong ? 'var(--mz-text)' : 'var(--mz-muted)',
        fontWeight: strong ? 800 : 500,
        verticalAlign: 'top',
        fontSize: 'var(--mz-fs-xs)',
        textAlign: align || 'left',
      }}
    >
      {children}
    </td>
  );
}

function Alert({ tone, children }) {
  return (
    <div style={{ padding: 12, borderRadius: 8, background: toneBackground(tone), border: `1px solid ${toneBorder(tone)}`, color: toneColor(tone), fontSize: 'var(--mz-fs-sm)' }}>
      {children}
    </div>
  );
}

function normalizedInitialPolicies(initialPolicies) {
  const entries = {};
  for (const region of SCORING_POLICY_REGIONS) {
    const entry = initialPolicies?.[region] || {};
    entries[region] = {
      ...entry,
      region,
      source: entry.source || 'default',
      policy: normalizePolicyPayload(region, entry.policy || defaultPolicyForRegion(region)),
    };
  }
  return entries;
}

function policyTextMap(initialPolicies) {
  const normalized = normalizedInitialPolicies(initialPolicies);
  return SCORING_POLICY_REGIONS.reduce((map, region) => {
    map[region] = prettyPolicy(normalized[region].policy);
    return map;
  }, {});
}

function prettyPolicy(policy) {
  return JSON.stringify(policy, null, 2);
}

function scoreColor(score) {
  const value = Number(score);
  if (value >= 90) return 'var(--mz-tier-excellent-plus)';
  if (value >= 80) return 'var(--mz-tier-excellent)';
  if (value >= 70) return 'var(--mz-tier-above-avg)';
  if (value >= 60) return 'var(--mz-tier-average)';
  if (value >= 50) return 'var(--mz-tier-below-avg)';
  if (value >= 25) return 'var(--mz-tier-poor)';
  return 'var(--mz-tier-critical)';
}

function toneBackground(tone) {
  if (tone === 'green') return 'var(--mz-green-bg)';
  if (tone === 'red') return 'var(--mz-red-bg)';
  if (tone === 'amber') return 'var(--mz-amber-bg)';
  return 'rgba(255,255,255,0.04)';
}

function toneBorder(tone) {
  if (tone === 'green') return 'var(--mz-green-border)';
  if (tone === 'red') return 'var(--mz-red-border)';
  if (tone === 'amber') return 'var(--mz-amber-border)';
  return 'var(--mz-border-input)';
}

function toneColor(tone) {
  if (tone === 'green') return 'var(--mz-green-text)';
  if (tone === 'red') return 'var(--mz-red-text)';
  if (tone === 'amber') return 'var(--mz-amber-text)';
  return 'var(--mz-muted)';
}

function messageTone(message) {
  const text = String(message || '').toLowerCase();
  if (text.includes('saved') || text.includes('unlocked') || text.includes('reset') || text.includes('locked')) return 'green';
  return 'amber';
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
