export const STATUS_LABELS = {
  new: 'New',
  uploading: 'Uploading',
  extracting: 'Extracting',
  data_bank_ready: 'Data Bank Ready',
  under_review: 'Under Review',
  on_hold: 'On Hold',
  additional_documents_requested: 'Additional Documents Requested',
  approved: 'Approved',
  declined: 'Declined',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const STATUS_STYLES = {
  new:                            { bg: 'var(--mz-status-new-bg)',                border: 'var(--mz-status-new-border)',                color: 'var(--mz-status-new-text)' },
  uploading:                      { bg: 'var(--mz-status-uploading-bg)',           border: 'var(--mz-status-uploading-border)',           color: 'var(--mz-status-uploading-text)' },
  extracting:                     { bg: 'var(--mz-status-extracting-bg)',          border: 'var(--mz-status-extracting-border)',          color: 'var(--mz-status-extracting-text)' },
  data_bank_ready:                { bg: 'var(--mz-status-data-bank-ready-bg)',     border: 'var(--mz-status-data-bank-ready-border)',     color: 'var(--mz-status-data-bank-ready-text)' },
  under_review:                   { bg: 'var(--mz-status-under-review-bg)',        border: 'var(--mz-status-under-review-border)',        color: 'var(--mz-status-under-review-text)' },
  on_hold:                        { bg: 'var(--mz-status-on-hold-bg)',             border: 'var(--mz-status-on-hold-border)',             color: 'var(--mz-status-on-hold-text)' },
  additional_documents_requested: { bg: 'var(--mz-status-docs-requested-bg)',     border: 'var(--mz-status-docs-requested-border)',     color: 'var(--mz-status-docs-requested-text)' },
  approved:                       { bg: 'var(--mz-status-approved-bg)',            border: 'var(--mz-status-approved-border)',            color: 'var(--mz-status-approved-text)' },
  declined:                       { bg: 'var(--mz-status-declined-bg)',            border: 'var(--mz-status-declined-border)',            color: 'var(--mz-status-declined-text)' },
  rejected:                       { bg: 'var(--mz-status-rejected-bg)',            border: 'var(--mz-status-rejected-border)',            color: 'var(--mz-status-rejected-text)' },
  expired:                        { bg: 'var(--mz-status-expired-bg)',             border: 'var(--mz-status-expired-border)',             color: 'var(--mz-status-expired-text)' },
};

export function normalizeStatus(status) {
  return String(status || 'new').trim().toLowerCase();
}

export function statusLabel(status) {
  const key = normalizeStatus(status);
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return String(status || 'New')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function statusStyle(status) {
  const key = normalizeStatus(status);
  return STATUS_STYLES[key] || STATUS_STYLES.new;
}

export function scoreColor(score) {
  if (score === null || score === undefined || score === '') return 'var(--mz-muted)';
  const value = Number(score);
  if (!Number.isFinite(value)) return 'var(--mz-muted)';
  if (value >= 90) return 'var(--mz-tier-excellent-plus)';
  if (value >= 80) return 'var(--mz-tier-excellent)';
  if (value >= 70) return 'var(--mz-tier-above-avg)';
  if (value >= 60) return 'var(--mz-tier-average)';
  if (value >= 50) return 'var(--mz-tier-below-avg)';
  if (value >= 25) return 'var(--mz-tier-poor)';
  return 'var(--mz-tier-critical)';
}

export function lendingAmountColor(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 'var(--mz-muted)';
  if (value >= 1000000) return 'var(--mz-red-text)';
  if (value >= 500000) return 'var(--mz-accent)';
  if (value >= 250000) return 'var(--mz-tier-below-avg)';
  if (value >= 100000) return 'var(--mz-tier-average)';
  return 'var(--mz-tier-above-avg)';
}

export function formatCurrencyAmount(amount, currency = 'AED') {
  const value = Number(amount || 0);
  if (!value) return `${currency} 0`;
  if (value >= 1e6) return `${currency} ${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${currency} ${(value / 1e3).toFixed(1)}K`;
  return `${currency} ${value.toLocaleString('en-AE')}`;
}

export function caseRegion(c) {
  const raw = String(c?.region || c?.country || c?.market || '').toUpperCase();
  if (raw.includes('US') || raw.includes('USA') || raw.includes('UNITED STATES')) return 'USA';
  return 'UAE';
}

export function currencyForRegion(region) {
  return String(region || '').toUpperCase() === 'USA' ? 'USD' : 'AED';
}

export function caseCurrency(c) {
  const raw = String(c?.currency || c?.lending_currency || c?.ceiling_currency || '').toUpperCase();
  if (raw === 'USD' || raw === 'AED') return raw;
  return currencyForRegion(caseRegion(c));
}

export function caseGroup(c) {
  return c?.group_name || c?.group || c?.operator_group || 'Ungrouped';
}

export function slugifyGroupName(groupName) {
  return String(groupName || 'ungrouped')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ungrouped';
}

export function caseGroupSlug(c) {
  return slugifyGroupName(caseGroup(c));
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

export function riskNotesText(c) {
  return (
    c?.risk_committee_notes ||
    c?.committee_notes ||
    c?.risk_notes ||
    c?.notes ||
    c?.extracted_json?.risk_committee?.notes ||
    c?.extracted_json?.risk_committee?.rationale ||
    ''
  );
}

export function recommendedCeiling(c) {
  return (
    Number(c?.recommended_lending_amount) ||
    Number(c?.recommended_lending_amount_usd) ||
    Number(c?.recommended_lending_amount_aed) ||
    Number(c?.recommended_ceiling) ||
    Number(c?.recommended_ceiling_usd) ||
    Number(c?.recommended_ceiling_aed) ||
    Number(c?.ceiling) ||
    Number(c?.ceiling_usd) ||
    Number(c?.ceiling_aed) ||
    Number(c?.extracted_json?.credit_score?.ceiling_used_usd) ||
    Number(c?.extracted_json?.credit_score?.ceiling_used_aed) ||
    Number(c?.extracted_json?.credit_score?.ceiling_risk_category_usd) ||
    Number(c?.extracted_json?.credit_score?.ceiling_risk_category_aed) ||
    0
  );
}

export function finalLendingAmount(c) {
  return (
    Number(c?.final_lending_amount) ||
    Number(c?.final_lending_amount_usd) ||
    Number(c?.final_lending_amount_aed) ||
    Number(c?.approved_lending_amount) ||
    Number(c?.approved_lending_amount_usd) ||
    Number(c?.approved_lending_amount_aed) ||
    0
  );
}
