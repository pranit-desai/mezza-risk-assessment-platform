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

const th = {
  padding: '11px 14px',
  textAlign: 'left',
  color: 'var(--mz-muted)',
  fontSize: 'var(--mz-fs-xxs)',
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--mz-border-soft)',
};
const td = {
  padding: '13px 14px',
  borderBottom: '1px solid var(--mz-border-subtle)',
  fontSize: 'var(--mz-fs-sm)',
};

const sectionHeader = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--mz-border-soft)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

function caseVenue(c) {
  return c.venue_name || c.venue || c.name || '-';
}

function caseGroup(c) {
  return c.group_name || c.group || '-';
}

function formatDate(value) {
  if (!value) return '-';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatUsd(cents) {
  if (cents == null) return '-';
  return `$${(Math.abs(Number(cents)) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function latestDate(values) {
  const timestamps = values
    .map((v) => {
      if (!v) return 0;
      if (typeof v === 'number') return v * 1000;
      const d = new Date(v).getTime();
      return Number.isNaN(d) ? 0 : d;
    })
    .filter(Boolean);
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

export default function BankingPageClient({
  cases,
  connections,
  accounts,
  transactions,
  documents,
  documentRequests,
  error,
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
  const visibleIds = useMemo(() => new Set(visibleCases.map((c) => c.id)), [visibleCases]);

  const connectionsByCase = useMemo(() => {
    const map = new Map();
    for (const conn of connections) map.set(conn.case_id, conn);
    return map;
  }, [connections]);

  const accountsByCase = useMemo(() => {
    const map = new Map();
    for (const account of accounts) {
      if (!map.has(account.case_id)) map.set(account.case_id, []);
      map.get(account.case_id).push(account);
    }
    return map;
  }, [accounts]);

  const accountCase = useMemo(() => {
    const map = new Map();
    for (const account of accounts) map.set(account.id, account.case_id);
    return map;
  }, [accounts]);

  const casesById = useMemo(() => {
    const map = new Map();
    for (const c of cases) map.set(c.id, c);
    return map;
  }, [cases]);

  const visibleTransactions = useMemo(() => {
    return transactions
      .filter((txn) => visibleIds.has(accountCase.get(txn.account_id)))
      .slice(0, 100);
  }, [accountCase, transactions, visibleIds]);

  const documentItems = useMemo(() => {
    return visibleCases.flatMap((c) => buildDocumentItems(c, documentRows, requestRows));
  }, [documentRows, requestRows, visibleCases]);
  const regionDocumentItems = useMemo(
    () => documentItems.filter((item) => item.region === documentRegion),
    [documentItems, documentRegion]
  );
  const documentBuckets = useMemo(() => bucketDocumentItems(regionDocumentItems), [regionDocumentItems]);
  const actionableItems = useMemo(() => actionableDocumentItems(regionDocumentItems), [regionDocumentItems]);

  const connectedCount = connections.filter((conn) => conn.status === 'connected').length;
  const activeAccounts = accounts.filter((account) => account.status === 'active').length;

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
          drafts.push({
            caseId,
            caseRef: casesById.get(caseId)?.case_ref || caseId.slice(0, 8),
            venueName: caseItems[0]?.venueName || casesById.get(caseId)?.venue_name || 'Venue',
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
        Banking
      </h1>
      <p className="mz-subheader" style={{ margin: '6px 0 0' }}>
        Stripe Financial Connections accounts and transactions saved in Supabase.
      </p>

      <CaseSearchBox
        value={query}
        onChange={setQuery}
        resultCount={visibleCases.length}
        totalCount={cases.length}
      />

      {error && (
        <Alert tone="red">
          Failed to load some banking data: {error}
        </Alert>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
        <SummaryTile label="Connected Cases" value={connectedCount} />
        <SummaryTile label="Bank Accounts" value={accounts.length} />
        <SummaryTile label="Active Accounts" value={activeAccounts} />
      </div>

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderBottom: '1px solid var(--mz-border-soft)' }}>
          <DocumentStat label="Expired" value={documentBuckets.expired.length} tone="red" />
          <DocumentStat label="Expiring" value={documentBuckets.expiring.length} tone="amber" />
          <DocumentStat label="Pending" value={documentBuckets.pending.length} tone="amber" />
          <DocumentStat label="Provided" value={documentBuckets.provided.length} tone="green" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0 }}>
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

      <section className="mz-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--mz-border-soft)' }}>
          <span className="mz-eyebrow">Connected cases</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 840 }}>
            <thead>
              <tr>
                <th style={th}>Case Ref</th>
                <th style={th}>Venue</th>
                <th style={th}>Group</th>
                <th style={th}>Connection</th>
                <th style={th}>Accounts</th>
                <th style={th}>Last Linked</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleCases.map((c) => {
                const conn = connectionsByCase.get(c.id);
                const caseAccounts = accountsByCase.get(c.id) ?? [];
                const linkedAt = latestDate([conn?.connected_at, conn?.created_at, ...caseAccounts.map((a) => a.updated_at)]);
                return (
                  <tr key={c.id}>
                    <td style={td} className="mz-mono">{c.case_ref || c.id.slice(0, 8)}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{caseVenue(c)}</td>
                    <td style={{ ...td, color: 'var(--mz-muted)' }}>{caseGroup(c)}</td>
                    <td style={td}>
                      <StatusBadge value={conn?.status || 'none'} />
                    </td>
                    <td style={td}>{caseAccounts.length}</td>
                    <td style={td}>{formatDate(linkedAt)}</td>
                    <td style={td}>
                      <Link href={`/bank/${c.id}`} className="mz-clickable" style={{ padding: '6px 10px', display: 'inline-block' }}>
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {visibleCases.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...td, color: 'var(--mz-muted)' }}>No cases match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mz-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--mz-border-soft)' }}>
          <span className="mz-eyebrow">Recent transactions</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Case</th>
                <th style={th}>Description</th>
                <th style={th}>Debit</th>
                <th style={th}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((txn) => {
                const caseId = accountCase.get(txn.account_id);
                const c = casesById.get(caseId);
                const amount = Number(txn.amount || 0);
                return (
                  <tr key={txn.id}>
                    <td style={td}>{formatDate(txn.transacted_at)}</td>
                    <td style={td} className="mz-mono">{c?.case_ref || caseId?.slice(0, 8) || '-'}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{txn.description || '-'}</td>
                    <td style={{ ...td, color: amount < 0 ? 'var(--mz-red-text)' : 'var(--mz-muted)' }}>
                      {amount < 0 ? formatUsd(amount) : '-'}
                    </td>
                    <td style={{ ...td, color: amount > 0 ? 'var(--mz-green-text)' : 'var(--mz-muted)' }}>
                      {amount > 0 ? formatUsd(amount) : '-'}
                    </td>
                  </tr>
                );
              })}
              {visibleTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...td, color: 'var(--mz-muted)' }}>No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="mz-card">
      <div className="mz-eyebrow">{label}</div>
      <div className="mz-mono" style={{ marginTop: 6, fontSize: 28, fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ value }) {
  const active = value === 'connected';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        borderRadius: 6,
        background: active ? 'var(--mz-green-bg)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'var(--mz-green-border)' : 'var(--mz-border-input)'}`,
        color: active ? 'var(--mz-green-text)' : 'var(--mz-muted)',
        fontSize: 'var(--mz-fs-xs)',
        fontWeight: 800,
      }}
    >
      {value}
    </span>
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
        <a className="mz-clickable" href={mailtoHref(draft)} style={{ padding: '7px 10px' }}>
          Open Mail
        </a>
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

function mailtoHref(draft) {
  return `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
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
