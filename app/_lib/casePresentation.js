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
