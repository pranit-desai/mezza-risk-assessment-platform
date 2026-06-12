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
  const [message, setMessage] = useState('');
  const [setupRequired, setSetupRequired] = useState(Boolean(initialSetupRequired));
  const [passwordConfigured, setPasswordConfigured] = useState(Boolean(initialPasswordConfigured));
  const [busy, setBusy] = useState(false);

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

  async function savePolicy() {
    if (!unlocked) {
      setMessage('Unlock scoring bands before saving.');
      return;
    }
    if (parsedDraft.error) {
      setMessage(`Policy JSON is invalid: ${parsedDraft.error}`);
      return;
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
      setMessage(`${activeRegion} scoring bands saved to Supabase.`);
      await refreshPolicies();
    } catch (error) {
      if (String(error.message || '').includes('scoring_policies table')) setSetupRequired(true);
      setMessage(error.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  function resetDraft() {
    setPolicyTextByRegion((current) => ({
      ...current,
      [activeRegion]: prettyPolicy(activePolicy),
    }));
    setMessage(`${activeRegion} draft reset.`);
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
                placeholder="Scoring password"
                autoComplete="current-password"
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="mz-clickable active"
                  onClick={unlockEditing}
                  disabled={busy || !password}
                  style={{ padding: '7px 10px', opacity: busy || !password ? 0.55 : 1 }}
                >
                  {busy ? 'Checking...' : 'Unlock'}
                </button>
                <button
                  className="mz-clickable"
                  onClick={refreshPolicies}
                  disabled={busy}
                  style={{ padding: '7px 10px', opacity: busy ? 0.55 : 1 }}
                >
                  Refresh
                </button>
              </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: 18, alignItems: 'start' }}>
        <section className="mz-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={sectionHeader}>
            <div>
              <span className="mz-eyebrow">Structured Bands</span>
              <div style={{ marginTop: 4, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
                {activePolicy.methodology}
              </div>
            </div>
          </div>
          <PolicySections sections={activePolicy.sections || []} />
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
                {unlocked ? 'Unlocked' : 'Locked'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                onClick={savePolicy}
                disabled={busy || !unlocked || Boolean(parsedDraft.error)}
                style={{ padding: '7px 10px', opacity: busy || !unlocked || parsedDraft.error ? 0.55 : 1 }}
              >
                {busy ? 'Saving...' : 'Save Policy'}
              </button>
            </div>
          </div>
          {parsedDraft.error && (
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--mz-border-soft)' }}>
              <Alert tone="amber">JSON error: {parsedDraft.error}</Alert>
            </div>
          )}
          <textarea
            value={activeText}
            onChange={(event) => setPolicyTextByRegion((current) => ({
              ...current,
              [activeRegion]: event.target.value,
            }))}
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
        </section>
      </div>
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
            {['Category', 'Min', 'Max', 'Ceiling', 'Votes', 'Refinancing'].map((head) => <TableHead key={head}>{head}</TableHead>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category}>
              <TableCell strong>{row.category}</TableCell>
              <TableCell mono>{row.min}</TableCell>
              <TableCell mono>{row.max}</TableCell>
              <TableCell mono>{row.ceiling}</TableCell>
              <TableCell mono>{row.votesRequired}</TableCell>
              <TableCell mono>{row.refinancingThreshold}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicySections({ sections }) {
  return (
    <div style={{ display: 'grid' }}>
      {sections.map((section) => (
        <div key={section.id} style={{ padding: 18, borderTop: '1px solid var(--mz-border-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 12 }}>
            <h2 style={{ fontSize: 'var(--mz-fs-h2)', margin: 0 }}>{section.title}</h2>
            {section.aggregateWeight != null && (
              <span className="mz-mono" style={{ color: 'var(--mz-accent)', fontWeight: 900 }}>{section.aggregateWeight}%</span>
            )}
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {(section.categories || []).map((category) => (
              <div key={category.id}>
                <div className="mz-eyebrow" style={{ color: 'var(--mz-accent-peach)', marginBottom: 8 }}>{category.title}</div>
                <CriteriaTable criteria={category.criteria || []} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CriteriaTable({ criteria }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--mz-border-soft)', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
        <thead>
          <tr>
            <TableHead>Metric</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead>Bands</TableHead>
            <TableHead>Auto Rules</TableHead>
          </tr>
        </thead>
        <tbody>
          {criteria.map((item) => (
            <tr key={item.id}>
              <TableCell strong>{item.label}</TableCell>
              <TableCell mono>{item.weight ?? '-'}</TableCell>
              <TableCell>
                <BandList bands={item.bands || []} />
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

function BandList({ bands }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {bands.map((band, index) => (
        <div key={`${band.score}-${band.range}-${index}`} style={{ display: 'grid', gridTemplateColumns: '48px 72px 1fr', gap: 8, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
          <span className="mz-mono" style={{ color: scoreColor(band.score), fontWeight: 900 }}>{band.score}</span>
          <span>{band.label}</span>
          <span>{band.range}</span>
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
  if (!rules.length) return <span style={{ color: 'var(--mz-muted)' }}>-</span>;
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
                <span className="mz-mono" style={{ color: 'var(--mz-text)' }}>{band.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableHead({ children }) {
  return (
    <th style={{ textAlign: 'left', padding: '9px 10px', borderBottom: '1px solid var(--mz-border-soft)', color: 'var(--mz-accent)', fontSize: 'var(--mz-fs-xxs)', textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}
    </th>
  );
}

function TableCell({ children, mono, strong }) {
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
  if (text.includes('saved') || text.includes('unlocked') || text.includes('reset')) return 'green';
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
