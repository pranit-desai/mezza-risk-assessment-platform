'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import CaseSearchBox from '../_components/CaseSearchBox';
import { filterCasesByQuery } from '../_lib/caseSearch';
import {
  actionableDocumentItems,
  buildDocumentItems,
  bucketDocumentItems,
  documentStatusLabel,
  documentStatusTone,
  formatDocumentDate,
} from '../_lib/documentWorkflow';

const sectionHeader = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--mz-border-soft)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

export default function DocumentsPageClient({
  cases,
  documents,
  documentRequests,
  documentError,
}) {
  const [query, setQuery] = useState('');
  const [documentRows, setDocumentRows] = useState(documents || []);
  const [requestRows, setRequestRows] = useState(documentRequests || []);
  const [documentRegion, setDocumentRegion] = useState('UAE');
  const [documentMessage, setDocumentMessage] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [mailDrafts, setMailDrafts] = useState([]);
  const [uploadDrafts, setUploadDrafts] = useState({});
  const [uploadingKey, setUploadingKey] = useState('');

  const visibleCases = useMemo(() => filterCasesByQuery(cases, query), [cases, query]);

  const casesById = useMemo(() => {
    const map = new Map();
    for (const c of cases) map.set(c.id, c);
    return map;
  }, [cases]);

  const documentItems = useMemo(() => {
    return visibleCases.flatMap((c) => buildDocumentItems(c, documentRows, requestRows));
  }, [documentRows, requestRows, visibleCases]);
  const regionDocumentItems = useMemo(
    () => documentItems.filter((item) => item.region === documentRegion),
    [documentItems, documentRegion]
  );
  const documentBuckets = useMemo(() => bucketDocumentItems(regionDocumentItems), [regionDocumentItems]);
  const actionableItems = useMemo(() => actionableDocumentItems(regionDocumentItems), [regionDocumentItems]);

  function updateBundle(caseId, bundle) {
    setDocumentRows((current) => replaceCaseRows(current, caseId, bundle.documents || []));
    setRequestRows((current) => replaceCaseRows(current, caseId, bundle.requests || []));
  }

  async function requestItems(items) {
    if (!items.length) return;
    setRequesting(true);
    setDocumentMessage('');
    setMailDrafts([]);
    try {
      const byCase = groupItemsByCase(items);
      const drafts = [];
      for (const [caseId, caseItems] of byCase.entries()) {
        const res = await fetch(`/api/cases/${caseId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'request_documents',
            document_types: caseItems.map((item) => item.documentType),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
        updateBundle(caseId, body);
        if (body.draft) {
          const caseRow = casesById.get(caseId);
          drafts.push({
            caseId,
            caseRef: caseRow?.case_ref || caseId.slice(0, 8),
            venueName: caseItems[0]?.venueName || caseRow?.venue_name || 'Venue',
            recipient: recipientEmail(caseRow),
            ...body.draft,
          });
        }
      }
      setMailDrafts(drafts);
      setDocumentMessage(`Requested ${items.length} document${items.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setDocumentMessage(err.message || 'Document request failed.');
    } finally {
      setRequesting(false);
    }
  }

  function patchUploadDraft(key, patch) {
    setUploadDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] || {}), ...patch },
    }));
  }

  async function uploadProof(item) {
    const key = itemKey(item);
    const draft = uploadDrafts[key] || {};
    if (!draft.file || !draft.expiryDate) {
      setDocumentMessage('Select a file and expiry date first.');
      return;
    }

    setUploadingKey(key);
    setDocumentMessage('');
    try {
      const formData = new FormData();
      formData.append('document_type', item.documentType);
      formData.append('expiry_date', draft.expiryDate);
      formData.append('file', draft.file);
      if (item.pendingRequest?.id) formData.append('request_id', item.pendingRequest.id);
      if (draft.notes) formData.append('notes', draft.notes);

      const res = await fetch(`/api/cases/${item.caseId}/documents`, {
        method: 'POST',
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Upload failed: ${res.status}`);
      updateBundle(item.caseId, body);
      patchUploadDraft(key, { open: false, file: null, expiryDate: '', notes: '' });
      setDocumentMessage(`${item.label} uploaded for ${item.caseRef}.`);
    } catch (err) {
      setDocumentMessage(err.message || 'Upload failed.');
    } finally {
      setUploadingKey('');
    }
  }

  return (
    <div style={{ padding: '28px 24px', color: 'var(--mz-text-on-page)' }}>
      <h1 style={{ fontSize: 'var(--mz-fs-h1)', fontWeight: 900, margin: 0 }}>
        Documents
      </h1>
      <p className="mz-subheader" style={{ margin: '6px 0 0' }}>
        Cross-case document monitor — 90-day cap window, 7-day renewal warning.
      </p>

      <CaseSearchBox
        value={query}
        onChange={setQuery}
        resultCount={visibleCases.length}
        totalCount={cases.length}
      />

      <section className="mz-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div style={sectionHeader}>
          <div>
            <span className="mz-eyebrow">Documents</span>
            <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)', marginTop: 4 }}>
              {documentRegion} document monitor
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {['UAE', 'USA'].map((region) => (
              <button
                key={region}
                className={`mz-clickable ${region === documentRegion ? 'active' : ''}`}
                onClick={() => setDocumentRegion(region)}
                style={{ padding: '7px 12px' }}
              >
                {region}
              </button>
            ))}
            <button
              className="mz-clickable active"
              onClick={() => requestItems(actionableItems)}
              disabled={requesting || actionableItems.length === 0}
              style={{
                padding: '7px 12px',
                opacity: requesting || actionableItems.length === 0 ? 0.55 : 1,
                cursor: requesting || actionableItems.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {requesting ? 'Requesting...' : `Request Documents (${actionableItems.length})`}
            </button>
          </div>
        </div>

        {documentError && (
          <div style={{ padding: '14px 18px' }}>
            <Alert tone="amber">Document setup needs attention: {documentError}</Alert>
          </div>
        )}

        {(documentMessage || mailDrafts.length > 0) && (
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--mz-border-soft)' }}>
            {documentMessage && <Alert tone={messageTone(documentMessage)}>{documentMessage}</Alert>}
            {mailDrafts.length > 0 && (
              <div style={{ display: 'grid', gap: 10, marginTop: documentMessage ? 10 : 0 }}>
                {mailDrafts.map((draft) => (
                  <MailDraft key={`${draft.caseId}:${draft.subject}`} draft={draft} />
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', borderBottom: '1px solid var(--mz-border-soft)' }}>
          <DocumentStat label="Missing" value={documentBuckets.missing.length} tone="red" />
          <DocumentStat label="Expired" value={documentBuckets.expired.length} tone="red" />
          <DocumentStat label="Expiring" value={documentBuckets.expiring.length} tone="amber" />
          <DocumentStat label="Pending" value={documentBuckets.pending.length} tone="amber" />
          <DocumentStat label="Provided" value={documentBuckets.provided.length} tone="green" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0 }}>
          <DocumentBucket title="Missing" items={documentBuckets.missing} onRequest={(item) => requestItems([item])} />
          <DocumentBucket title="Expired" items={documentBuckets.expired} onRequest={(item) => requestItems([item])} />
          <DocumentBucket title="Expiring" items={documentBuckets.expiring} onRequest={(item) => requestItems([item])} />
          <DocumentBucket
            title="Pending Documents Requested"
            items={documentBuckets.pending}
            uploadDrafts={uploadDrafts}
            uploadingKey={uploadingKey}
            onPatchUploadDraft={patchUploadDraft}
            onUpload={uploadProof}
            pending
          />
          <DocumentBucket title="Provided Documents" items={documentBuckets.provided} provided />
        </div>
      </section>
    </div>
  );
}

function DocumentStat({ label, value, tone }) {
  return (
    <div style={{ padding: '12px 18px', borderRight: '1px solid var(--mz-border-soft)' }}>
      <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>{label}</div>
      <div className="mz-mono" style={{ color: toneColor(tone), fontSize: 24, fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}

function DocumentBucket({
  title,
  items,
  onRequest,
  uploadDrafts,
  uploadingKey,
  onPatchUploadDraft,
  onUpload,
  pending,
  provided,
}) {
  return (
    <div style={{ padding: 18, borderRight: '1px solid var(--mz-border-soft)', borderBottom: '1px solid var(--mz-border-soft)', minHeight: 180 }}>
      <div className="mz-eyebrow" style={{ marginBottom: 10 }}>{title}</div>
      {items.length === 0 && (
        <div style={{ color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-sm)' }}>None</div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => {
          const key = itemKey(item);
          const draft = uploadDrafts?.[key] || {};
          const open = Boolean(draft.open);
          return (
            <div key={key} style={{ border: '1px solid var(--mz-border-soft)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {pending && (
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(event) => onPatchUploadDraft(key, { open: event.target.checked })}
                    title="Received"
                    style={{ marginTop: 3 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <Link href={`/cases/${item.caseId}`} className="mz-mono" style={{ color: 'var(--mz-accent)', fontWeight: 900 }}>
                      {item.caseRef}
                    </Link>
                    <DocumentPill item={item} />
                  </div>
                  <div style={{ marginTop: 4, fontWeight: 800 }}>{item.venueName}</div>
                  <div style={{ marginTop: 2, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
                    {item.label} - {expiryText(item)}
                  </div>
                  {provided && item.latestDocument?.filename && (
                    <div style={{ marginTop: 6, color: 'var(--mz-green-text)', fontSize: 'var(--mz-fs-xs)' }}>
                      {item.latestDocument.filename}
                    </div>
                  )}
                </div>
              </div>

              {onRequest && item.needsRequest && (
                <button
                  className="mz-clickable"
                  onClick={() => onRequest(item)}
                  style={{ marginTop: 10, padding: '6px 10px' }}
                >
                  Request
                </button>
              )}

              {pending && open && (
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  <input
                    type="file"
                    onChange={(event) => onPatchUploadDraft(key, { file: event.target.files?.[0] || null })}
                  />
                  <input
                    type="date"
                    value={draft.expiryDate || ''}
                    onChange={(event) => onPatchUploadDraft(key, { expiryDate: event.target.value })}
                  />
                  <textarea
                    rows={2}
                    value={draft.notes || ''}
                    onChange={(event) => onPatchUploadDraft(key, { notes: event.target.value })}
                    placeholder="Notes"
                  />
                  <button
                    className="mz-clickable active"
                    onClick={() => onUpload(item)}
                    disabled={uploadingKey === key}
                    style={{ padding: '7px 10px', opacity: uploadingKey === key ? 0.6 : 1 }}
                  >
                    {uploadingKey === key ? 'Uploading...' : 'Upload Proof'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentPill({ item }) {
  const tone = documentStatusTone(item);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 6,
        background: toneBackground(tone),
        border: `1px solid ${toneBorder(tone)}`,
        color: toneColor(tone),
        fontSize: 'var(--mz-fs-xs)',
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {documentStatusLabel(item)}
    </span>
  );
}

function MailDraft({ draft }) {
  return (
    <div style={{ border: '1px solid var(--mz-border-soft)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div className="mz-eyebrow">Mail Draft</div>
          <div style={{ marginTop: 4, fontWeight: 800 }}>{draft.venueName}</div>
        </div>
        <a
          className="mz-clickable active"
          href={gmailComposeHref(draft)}
          target="_blank"
          rel="noreferrer"
          style={{ padding: '7px 10px' }}
        >
          Open in Gmail
        </a>
      </div>
      <div style={{ marginTop: 8, color: 'var(--mz-muted)', fontSize: 'var(--mz-fs-xs)' }}>
        To: {draft.recipient || 'add recipient in Gmail'}
      </div>
      <div className="mz-mono" style={{ marginTop: 10, fontSize: 'var(--mz-fs-xs)', color: 'var(--mz-muted)' }}>
        {draft.subject}
      </div>
      <pre
        style={{
          margin: '8px 0 0',
          whiteSpace: 'pre-wrap',
          color: 'var(--mz-text)',
          fontFamily: 'var(--mz-font-sans)',
          fontSize: 'var(--mz-fs-sm)',
          lineHeight: 1.5,
        }}
      >
        {draft.body}
      </pre>
    </div>
  );
}

function Alert({ tone, children }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: toneBackground(tone),
        border: `1px solid ${toneBorder(tone)}`,
        color: toneColor(tone),
        fontSize: 'var(--mz-fs-sm)',
      }}
    >
      {children}
    </div>
  );
}

function groupItemsByCase(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.caseId)) map.set(item.caseId, []);
    map.get(item.caseId).push(item);
  }
  return map;
}

function replaceCaseRows(current, caseId, nextRows) {
  return [
    ...current.filter((row) => row.case_id !== caseId),
    ...nextRows,
  ];
}

function itemKey(item) {
  return `${item.caseId}:${item.documentType}:${item.pendingRequest?.id || item.latestDocument?.id || 'required'}`;
}

function expiryText(item) {
  if (!item.expiryDate) return 'No expiry date';
  const days = item.daysToExpiry;
  if (days < 0) return `${formatDocumentDate(item.expiryDate)} (${Math.abs(days)}d expired)`;
  if (days === 0) return `${formatDocumentDate(item.expiryDate)} (today)`;
  return `${formatDocumentDate(item.expiryDate)} (${days}d)`;
}

function gmailComposeHref(draft) {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    su: draft.subject || '',
    body: draft.body || '',
  });
  if (draft.recipient) params.set('to', draft.recipient);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function recipientEmail(caseRow) {
  const candidates = [
    caseRow?.commercial_poc,
    caseRow?.borrower_email,
    caseRow?.contact_email,
    caseRow?.email,
    caseRow?.extracted_json?.profile?.email,
    caseRow?.extracted_json?.ownership?.email,
    caseRow?.extracted_json?.contact?.email,
  ];
  return candidates.map(extractEmail).find(Boolean) || '';
}

function extractEmail(value) {
  const match = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || '';
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
  if (text.includes('failed') || text.includes('select') || text.includes('required') || text.includes('attention')) {
    return 'amber';
  }
  return 'green';
}
