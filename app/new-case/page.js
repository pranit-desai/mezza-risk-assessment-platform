'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { slugifyGroupName } from '@/app/_lib/casePresentation';

const FILE_TYPES = ['POS statement', 'Bank statement', 'Trade license', 'Lease', 'VAT return', 'Other'];

function initialSearchParam(name) {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) || '';
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function NewCasePage() {
  const [files, setFiles] = useState([]);
  const [region, setRegion] = useState(() => initialSearchParam('region') || 'UAE');
  const [groupName, setGroupName] = useState(() => initialSearchParam('group_name'));
  const [venueName, setVenueName] = useState(() => initialSearchParam('venue_name'));
  const [commercialPoc, setCommercialPoc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const groupKey = useMemo(() => slugifyGroupName(groupName), [groupName]);

  function addFiles(fileList) {
    setFiles((current) => [...current, ...Array.from(fileList || [])]);
  }

  async function ensureGroup() {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_name: groupName.trim(),
        group_key: groupKey,
        region,
        commercial_poc: commercialPoc.trim() || undefined,
      }),
    });
    const data = await readJson(res);

    if (res.status === 409) {
      const lookup = await fetch(`/api/groups/by-key/${encodeURIComponent(groupKey)}`, { cache: 'no-store' });
      const existing = await readJson(lookup);
      if (!lookup.ok) {
        throw new Error(existing?.error || 'A group with this key exists, but it could not be loaded.');
      }
      if (existing.region !== region) {
        throw new Error(`This group already exists in ${existing.region}. Select ${existing.region} to add venues.`);
      }
      return existing;
    }

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to create group');
    }

    return data;
  }

  async function createVenue(group) {
    const res = await fetch('/api/venues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: group.id,
        venue_name: venueName.trim(),
      }),
    });
    const data = await readJson(res);

    if (!res.ok) {
      throw new Error(data?.error || 'Failed to create venue');
    }

    return data;
  }

  async function handleAddCase() {
    setError('');
    setCreated(null);

    if (!groupName.trim()) {
      setError('Group is required.');
      return;
    }
    if (!venueName.trim()) {
      setError('Venue is required.');
      return;
    }

    setSubmitting(true);
    try {
      const group = await ensureGroup();
      const venue = await createVenue(group);
      setCreated({ group, venue });
      setVenueName('');
    } catch (err) {
      setError(err.message || 'Failed to add case intake');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: '32px 40px', color: 'var(--mz-text-on-page)' }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>New Case</h1>
      <p className="mz-subheader" style={{ margin: '6px 0 22px' }}>
        Register the group and venue, then stage source documents for parser intake.
      </p>

      <section style={grid}>
        <div className="mz-card">
          <div className="mz-eyebrow">Case Intake</div>
          <div style={formGrid}>
            <label style={label}>
              Group
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Restaurant group"
              />
            </label>
            <label style={label}>
              Venue
              <input
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Venue / legal entity"
              />
            </label>
            <label style={label}>
              Commercial PoC
              <input
                value={commercialPoc}
                onChange={(e) => setCommercialPoc(e.target.value)}
                placeholder="Name or email"
              />
            </label>
            <label style={label}>
              Region
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option>UAE</option>
                <option>USA</option>
              </select>
            </label>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            style={dropZone}
          >
            <div className="mz-eyebrow">Drop Documents</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 8 }}>Upload files for parsing</div>
            <div style={{ color: 'var(--mz-muted)', marginTop: 6 }}>
              POS, bank statements, licenses, leases, VAT, or supporting documents.
            </div>
            <input
              type="file"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              style={{ marginTop: 16 }}
            />
          </div>

          {error && <div style={{ ...notice, ...errorNotice }}>{error}</div>}
          {created && (
            <div style={{ ...notice, ...successNotice }}>
              Added {created.venue.venue_name} under {created.group.group_name}.{' '}
              <Link href={`/groups/${created.group.group_key}`} style={{ color: 'inherit', fontWeight: 900 }}>
                Open group
              </Link>
            </div>
          )}

          <div style={actions}>
            <button
              type="button"
              className="mz-clickable active"
              style={{ ...actionButton, opacity: submitting ? 0.65 : 1 }}
              disabled={submitting}
              onClick={handleAddCase}
            >
              {submitting ? 'Adding...' : '+ Add Case'}
            </button>
            <button
              type="button"
              className="mz-clickable active"
              style={{ ...actionButton, color: 'var(--mz-ai-accent)', borderColor: 'rgba(139, 92, 246, 0.45)', background: 'rgba(139, 92, 246, 0.13)' }}
            >
              AI Import
            </button>
            <button type="button" className="mz-clickable" style={actionButton}>CSV Import</button>
          </div>
        </div>

        <aside className="mz-card">
          <div className="mz-eyebrow">Parser Queue</div>
          <div className="mz-mono" style={{ fontSize: 28, fontWeight: 900, marginTop: 10 }}>{files.length}</div>
          <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
            files staged / {(totalSize / 1024 / 1024).toFixed(2)} MB
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
            {files.length === 0 && <div style={empty}>No files staged yet.</div>}
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} style={fileRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <select defaultValue={FILE_TYPES[0]} style={{ width: 150 }}>
                  {FILE_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

const grid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.8fr)',
  gap: 16,
};

const formGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  marginTop: 14,
};

const label = {
  display: 'grid',
  gap: 6,
  color: 'var(--mz-muted)',
  fontSize: 'var(--mz-fs-xs)',
};

const dropZone = {
  marginTop: 18,
  minHeight: 230,
  border: '1px dashed var(--mz-accent-40)',
  borderRadius: 8,
  background: 'var(--mz-accent-06)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 20,
};

const actions = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 16,
};

const actionButton = {
  minHeight: 34,
  padding: '8px 13px',
  fontWeight: 900,
};

const notice = {
  marginTop: 14,
  padding: '10px 12px',
  borderRadius: 8,
  fontSize: 'var(--mz-fs-sm)',
  fontWeight: 800,
};

const errorNotice = {
  background: 'var(--mz-red-bg)',
  border: '1px solid var(--mz-red-border)',
  color: 'var(--mz-red-text)',
};

const successNotice = {
  background: 'var(--mz-status-approved-bg)',
  border: '1px solid var(--mz-status-approved-border)',
  color: 'var(--mz-status-approved-text)',
};

const fileRow = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'center',
  padding: 10,
  border: '1px solid var(--mz-border-soft)',
  borderRadius: 8,
  background: 'var(--mz-card-nested)',
};

const empty = {
  padding: 12,
  borderRadius: 8,
  border: '1px solid var(--mz-border-soft)',
  color: 'var(--mz-muted)',
};
