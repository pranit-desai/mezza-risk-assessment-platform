'use client';

import { useMemo, useState } from 'react';

const FILE_TYPES = ['POS statement', 'Bank statement', 'Trade license', 'Lease', 'VAT return', 'Other'];

export default function NewCasePage() {
  const [files, setFiles] = useState([]);
  const [region, setRegion] = useState('UAE');
  const [groupName, setGroupName] = useState('');
  const [venueName, setVenueName] = useState('');

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  function addFiles(fileList) {
    setFiles((current) => [...current, ...Array.from(fileList || [])]);
  }

  return (
    <div style={{ padding: '32px 40px', color: 'var(--mz-text-on-page)' }}>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>New Case</h1>
      <p className="mz-subheader" style={{ margin: '6px 0 22px' }}>
        Add a group or venue case, dump source documents, then send them into the parser workflow.
      </p>

      <section style={grid}>
        <div className="mz-card">
          <div className="mz-eyebrow">Case Intake</div>
          <div style={formGrid}>
            <label style={label}>
              Group
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Restaurant group" />
            </label>
            <label style={label}>
              Venue
              <input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Venue / legal entity" />
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

          <div style={actions}>
            <button className="mz-clickable active" style={actionButton}>+ Add Case</button>
            <button className="mz-clickable active" style={{ ...actionButton, color: 'var(--mz-ai-accent)', borderColor: 'rgba(139, 92, 246, 0.45)', background: 'rgba(139, 92, 246, 0.13)' }}>
              AI Import
            </button>
            <button className="mz-clickable" style={actionButton}>CSV Import</button>
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
