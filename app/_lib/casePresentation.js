export const STATUS_LABELS = {
  new: 'New',
  uploading: 'Uploading',
  extracting: 'Extracting',
  data_bank_ready: 'Data Bank Ready',
  under_review: 'Under Review',
  additional_documents_requested: 'Additional Documents Requested',
  approved: 'Approved',
  declined: 'Declined',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const STATUS_STYLES = {
  new: { bg: 'rgba(255,255,255,0.05)', border: 'var(--mz-border-input)', color: 'var(--mz-muted)' },
  uploading: { bg: 'rgba(139, 92, 246, 0.14)', border: 'rgba(139, 92, 246, 0.4)', color: 'var(--mz-ai-accent)' },
  extracting: { bg: 'rgba(59, 130, 246, 0.14)', border: 'rgba(59, 130, 246, 0.4)', color: 'var(--mz-chart-9)' },
  data_bank_ready: { bg: 'var(--mz-green-bg)', border: 'var(--mz-green-border)', color: 'var(--mz-green-text)' },
  under_review: { bg: 'var(--mz-amber-bg)', border: 'var(--mz-amber-border)', color: 'var(--mz-amber-text)' },
  additional_documents_requested: { bg: 'rgba(224, 136, 0, 0.18)', border: 'rgba(224, 136, 0, 0.5)', color: 'var(--mz-tier-below-avg)' },
  approved: { bg: 'var(--mz-green-bg)', border: 'var(--mz-green-border)', color: 'var(--mz-green-text)' },
  declined: { bg: 'var(--mz-red-bg)', border: 'var(--mz-red-border)', color: 'var(--mz-red-text)' },
  rejected: { bg: 'var(--mz-red-bg)', border: 'var(--mz-red-border)', color: 'var(--mz-red-text)' },
  expired: { bg: 'var(--mz-red-bg)', border: 'var(--mz-red-border)', color: 'var(--mz-red-text)' },
};

export function normalizeStatus(status) {
  return String(status || 'new').trim().toLowerCase();
}

export function statusLabel(status) {
  const key = normalizeStatus(status);
  return STATUS_LABELS[key] || String(status || 'New');
}

export function statusStyle(status) {
  const key = normalizeStatus(status);
  return STATUS_STYLES[key] || STATUS_STYLES.new;
}

export function caseRegion(c) {
  const raw = String(c?.region || c?.country || c?.market || '').toUpperCase();
  if (raw.includes('US') || raw.includes('USA') || raw.includes('UNITED STATES')) return 'USA';
  return 'UAE';
}

export function caseGroup(c) {
  return c?.group_name || c?.group || c?.operator_group || 'Ungrouped';
}

export function caseVenue(c) {
  return c?.venue_name || c?.venue || c?.name || 'Unnamed venue';
}

export function shortCaseRef(c) {
  const ref = c?.case_ref || '';
  if (/^MZA-\d{4}-\d+$/i.test(ref)) {
    const parts = ref.split('-');
    return `MZA-${parts.at(-1)}`;
  }
  if (ref.length > 14) return ref.replace(/-/g, '').slice(0, 10).toUpperCase();
  return ref || String(c?.id || '').slice(0, 8);
}

export function formatTrackerDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function trackerDates(c) {
  return {
    submitted:
      c?.submitted_at ||
      c?.submission_date ||
      c?.created_at ||
      c?.intake_date ||
      null,
    firstResponse:
      c?.first_response_at ||
      c?.risk_first_response_at ||
      c?.first_reviewed_at ||
      c?.review_started_at ||
      null,
    verdict:
      c?.final_verdict_at ||
      c?.decision_at ||
      c?.approved_at ||
      c?.declined_at ||
      null,
  };
}

export function decisionText(c) {
  return (
    c?.risk_decision ||
    c?.decision ||
    c?.verdict ||
    statusLabel(c?.status)
  );
}

export function rationaleText(c) {
  return (
    c?.approval_rationale ||
    c?.decision_rationale ||
    c?.risk_rationale ||
    c?.rationale ||
    c?.extracted_json?.risk_committee?.rationale ||
    ''
  );
}
