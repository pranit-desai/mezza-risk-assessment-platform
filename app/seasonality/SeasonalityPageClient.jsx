'use client';

import { useMemo, useState } from 'react';
import {
  MONTH_KEYS,
  MONTH_LABELS,
  SEASONALITY_REGIONS,
  defaultPatternIdForRegion,
  normalizeSeasonalityRegion,
} from '../_lib/seasonalityConstants';

export default function SeasonalityPageClient({ initialBundle }) {
  const [bundle] = useState(initialBundle);
  const [activeRegion, setActiveRegion] = useState('UAE');

  const regionData = useMemo(() => {
    const region = normalizeSeasonalityRegion(activeRegion);
    const patterns = (bundle?.patterns || []).filter((row) => normalizeSeasonalityRegion(row.region) === region);
    const venues = (bundle?.venueReference || []).filter((row) => normalizeSeasonalityRegion(row.region) === region);
    const months = (bundle?.venueMonths || []).filter((row) => normalizeSeasonalityRegion(row.region) === region);
    const defaultPatternId = defaultPatternIdForRegion(region);
    const defaultPattern = (
      patterns.find((pattern) => pattern.pattern_id === defaultPatternId) ||
      patterns.find((pattern) => pattern.is_default) ||
      patterns[0] ||
      null
    );
    return { region, patterns, venues, months, defaultPattern };
  }, [activeRegion, bundle]);

  const summary = bundle?.summary?.[regionData.region] || {
    patterns: regionData.patterns.length,
    venues: regionData.venues.length,
    monthlyRows: regionData.months.length,
    latestMonth: null,
    totalRevenue: 0,
    defaultPatternId: regionData.defaultPattern?.pattern_id,
  };

  return (
    <div style={{ padding: '28px 24px', color: 'var(--mz-text-on-page)' }}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ fontSize: 'var(--mz-fs-h1)', fontWeight: 900, margin: 0 }}>
            Seasonality Library
          </h1>
          <p className="mz-subheader" style={{ margin: '6px 0 0' }}>
            Dynamic POS seasonality data bank for underwriting cases.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {SEASONALITY_REGIONS.map((region) => (
            <button
              key={region}
              className={`mz-clickable ${region === activeRegion ? 'active' : ''}`}
              onClick={() => setActiveRegion(region)}
              style={{ padding: '8px 13px' }}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      {(bundle?.setupRequired || bundle?.errors?.length > 0) && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
          {bundle?.setupRequired && (
            <Alert tone="amber">
              Supabase setup required: apply `{bundle.setupSqlFile}` to persist new seasonality rows.
            </Alert>
          )}
          {(bundle?.errors || []).map((error) => <Alert key={error} tone="amber">{error}</Alert>)}
        </div>
      )}

      <section className="mz-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div style={sectionHeader}>
          <div>
            <span className="mz-eyebrow">{regionData.region} Data Bank</span>
            <div style={{ marginTop: 4, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
              {bundle?.source === 'database' ? 'Supabase source' : 'Seed source'} - {bundle?.sourceVersion}
            </div>
          </div>
          <span className="mz-mono" style={{ color: 'var(--mz-accent)', fontWeight: 900 }}>
            {summary.defaultPatternId}
          </span>
        </div>

        <div style={metricGrid}>
          <MetricBlock label="Patterns" value={summary.patterns} />
          <MetricBlock label="Venues" value={summary.venues} />
          <MetricBlock label="Monthly Rows" value={summary.monthlyRows} />
          <MetricBlock label="Latest Month" value={summary.latestMonth ? formatMonth(summary.latestMonth) : '-'} />
          <MetricBlock label="Revenue Bank" value={formatMoney(summary.totalRevenue, regionData.region)} />
        </div>
      </section>

      <section className="mz-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div style={sectionHeader}>
          <div>
            <span className="mz-eyebrow">Pattern Library</span>
            <div style={{ marginTop: 4, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
              Reusable monthly weighting curves.
            </div>
          </div>
        </div>
        <PatternTable patterns={regionData.patterns} />
      </section>

      <section className="mz-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div style={sectionHeader}>
          <div>
            <span className="mz-eyebrow">Venue Reference</span>
            <div style={{ marginTop: 4, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
              Venue-level metadata used for closest pattern selection.
            </div>
          </div>
        </div>
        <VenueReferenceTable venues={regionData.venues} />
      </section>

      <section className="mz-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={sectionHeader}>
          <div>
            <span className="mz-eyebrow">Monthly Data Bank</span>
            <div style={{ marginTop: 4, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
              Stored monthly POS revenue rows.
            </div>
          </div>
        </div>
        <MonthlyBankTable rows={regionData.months} region={regionData.region} />
      </section>
    </div>
  );
}

function PatternTable({ patterns }) {
  if (!patterns.length) return <EmptyState>No patterns stored for this region.</EmptyState>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1280 }}>
        <thead>
          <tr>
            <TableHead>Pattern</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>n</TableHead>
            <TableHead>Confidence</TableHead>
            {MONTH_LABELS.map((month) => <TableHead key={month}>{month}</TableHead>)}
            <TableHead>Status</TableHead>
          </tr>
        </thead>
        <tbody>
          {patterns.map((pattern) => (
            <tr key={`${pattern.region}-${pattern.pattern_id}`}>
              <TableCell strong>{pattern.pattern_id}</TableCell>
              <TableCell>{pattern.format || '-'}</TableCell>
              <TableCell>{pattern.location || '-'}</TableCell>
              <TableCell mono>{pattern.n_venues || 0}</TableCell>
              <TableCell>{pattern.confidence || '-'}</TableCell>
              {MONTH_KEYS.map((month) => (
                <TableCell key={month} mono>{formatPct(pattern.month_weights?.[month])}</TableCell>
              ))}
              <TableCell>{pattern.pattern_use_status || pattern.status || '-'}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VenueReferenceTable({ venues }) {
  if (!venues.length) return <EmptyState>No venue records stored for this region yet.</EmptyState>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1060 }}>
        <thead>
          <tr>
            {['Venue', 'Group', 'City', 'Format', 'Coverage', 'Months', 'Pattern', 'Confidence'].map((head) => (
              <TableHead key={head}>{head}</TableHead>
            ))}
          </tr>
        </thead>
        <tbody>
          {venues.map((venue) => (
            <tr key={`${venue.region}-${venue.venue_name}-${venue.legal_entity || ''}`}>
              <TableCell strong>{venue.venue_name}</TableCell>
              <TableCell>{venue.source_group || '-'}</TableCell>
              <TableCell>{venue.city || '-'}</TableCell>
              <TableCell>{venue.venue_format || venue.concept_type || '-'}</TableCell>
              <TableCell>{venue.data_coverage || '-'}</TableCell>
              <TableCell mono>{venue.months_loaded ?? '-'}</TableCell>
              <TableCell mono>{venue.closest_pattern_id || '-'}</TableCell>
              <TableCell>{venue.concept_match_confidence || '-'}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyBankTable({ rows, region }) {
  if (!rows.length) return <EmptyState>No monthly POS rows stored for this region yet.</EmptyState>;
  return (
    <div style={{ maxHeight: 620, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120 }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--mz-card)' }}>
          <tr>
            {['Month', 'Venue', 'Group', 'Revenue', 'Transactions', 'Avg Ticket', 'Source', 'Pattern'].map((head) => (
              <TableHead key={head}>{head}</TableHead>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.region}-${row.venue_name}-${row.month_start}-${row.source_reference}`}>
              <TableCell mono>{formatMonth(row.month_start) || row.month_label || '-'}</TableCell>
              <TableCell strong>{row.venue_name}</TableCell>
              <TableCell>{row.source_group || '-'}</TableCell>
              <TableCell mono>{formatMoney(row.reported_revenue, region)}</TableCell>
              <TableCell mono>{formatNumber(row.transactions)}</TableCell>
              <TableCell mono>{formatMoney(row.avg_sales_per_transaction, region)}</TableCell>
              <TableCell>{row.source_type || row.source_reference || '-'}</TableCell>
              <TableCell mono>{row.closest_pattern_id || '-'}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricBlock({ label, value }) {
  return (
    <div style={{ padding: 14, borderRight: '1px solid var(--mz-border-soft)', borderBottom: '1px solid var(--mz-border-soft)' }}>
      <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>{label}</div>
      <div className="mz-mono" style={{ color: 'var(--mz-accent)', fontSize: 24, fontWeight: 900, marginTop: 4 }}>
        {value}
      </div>
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
    <div style={{ padding: 12, borderRadius: 8, background: tone === 'amber' ? 'var(--mz-amber-bg)' : 'rgba(255,255,255,0.04)', border: `1px solid ${tone === 'amber' ? 'var(--mz-amber-border)' : 'var(--mz-border-soft)'}`, color: tone === 'amber' ? 'var(--mz-amber-text)' : 'var(--mz-muted)', fontSize: 'var(--mz-fs-sm)' }}>
      {children}
    </div>
  );
}

function EmptyState({ children }) {
  return <div style={{ padding: 18, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-sm)' }}>{children}</div>;
}

function formatPct(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function formatMoney(value, region) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  const currency = region === 'USA' ? 'USD' : 'AED';
  return `${currency} ${number.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return number.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatMonth(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

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

const metricGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
};
