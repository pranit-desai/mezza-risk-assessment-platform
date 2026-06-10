export const DOCUMENT_CAP_WINDOW_DAYS = 90;
export const DOCUMENT_RENEWAL_WARNING_DAYS = 7;
export const PROVIDED_VISIBLE_DAYS = 7;

export const DOCUMENT_TYPES = {
  trade_licence: {
    label: 'Trade Licence',
    regions: ['UAE'],
  },
  ejari_lease: {
    label: 'Ejari / Lease Agreement',
    regions: ['UAE'],
  },
  business_lease: {
    label: 'Lease Agreement / Tenancy Contract',
    regions: ['USA'],
  },
};

const UAE_REQUIRED_DOCUMENTS = ['trade_licence', 'ejari_lease'];
const USA_REQUIRED_DOCUMENTS = ['business_lease'];

export function normalizeDocumentRegion(region) {
  const value = String(region || '').toUpperCase();
  return value === 'USA' ? 'USA' : 'UAE';
}

export function requiredDocumentTypes(region) {
  return normalizeDocumentRegion(region) === 'USA'
    ? USA_REQUIRED_DOCUMENTS
    : UAE_REQUIRED_DOCUMENTS;
}

export function documentLabel(documentType) {
  return DOCUMENT_TYPES[documentType]?.label || titleize(documentType);
}

export function canonicalDocumentType(documentType, region = 'UAE') {
  const raw = String(documentType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return '';
  if (raw === 'trade_license') return 'trade_licence';
  if (raw === 'trade_licence') return 'trade_licence';
  if (raw === 'ejari' || raw === 'ejari_lease' || raw === 'ejari_lease_agreement') return 'ejari_lease';
  if (raw === 'business_lease' || raw === 'tenancy_contract') return 'business_lease';
  if (raw === 'lease' || raw === 'lease_agreement') {
    return normalizeDocumentRegion(region) === 'USA' ? 'business_lease' : 'ejari_lease';
  }
  return raw;
}

export function normalizeCaseRegion(c) {
  return normalizeDocumentRegion(c?.region || c?.country || c?.market);
}

export function getCaseDisplay(c) {
  return {
    caseId: c?.id,
    caseRef: c?.case_ref || String(c?.id || '').slice(0, 8),
    venueName: c?.venue_name || c?.venue || c?.name || 'Unnamed venue',
    groupName: c?.group_name || c?.group || 'Ungrouped',
    region: normalizeCaseRegion(c),
  };
}

export function formatDocumentDate(value) {
  const date = parseDateOnly(value);
  if (!date) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function daysToExpiry(expiryDate, now = new Date()) {
  const expiry = dateOnlyTime(expiryDate);
  if (expiry === null) return null;
  const today = startOfUtcDay(now).getTime();
  return Math.round((expiry - today) / 86400000);
}

export function ageInDays(value, now = new Date()) {
  const date = parseDateOnly(value);
  if (!date) return null;
  const today = startOfUtcDay(now).getTime();
  return Math.floor((today - startOfUtcDay(date).getTime()) / 86400000);
}

export function getDataBankExpiry(caseData, documentType) {
  const extracted = caseData?.extracted_json || {};
  if (documentType === 'trade_licence') {
    return extracted.trade_licence?.expiry_date || null;
  }
  if (documentType === 'ejari_lease') {
    return extracted.lease?.ejari_expiry_date || extracted.lease?.expiry_date || null;
  }
  if (documentType === 'business_lease') {
    return extracted.lease?.expiry_date || extracted.lease?.tenancy_expiry_date || null;
  }
  return null;
}

export function buildDocumentItems(caseData, documents = [], requests = [], now = new Date()) {
  const display = getCaseDisplay(caseData);
  const required = requiredDocumentTypes(display.region);

  return required.map((documentType) => {
    const matchingDocuments = documents
      .filter((doc) => doc.case_id === display.caseId)
      .filter((doc) => canonicalDocumentType(doc.document_type, display.region) === documentType)
      .sort(sortNewestFirst);
    const latestDocument = matchingDocuments[0] || null;

    const matchingRequests = requests
      .filter((request) => request.case_id === display.caseId)
      .filter((request) => canonicalDocumentType(request.document_type, display.region) === documentType)
      .sort(sortNewestRequestFirst);
    const latestRequest = matchingRequests[0] || null;
    const pendingRequest = matchingRequests.find((request) => request.status === 'pending') || null;
    const providedRequest = matchingRequests.find((request) => request.status === 'provided') || null;

    const dbExpiry = getDataBankExpiry(caseData, documentType);
    const expiryDate = latestDocument?.expiry_date || dbExpiry || null;
    const daysRemaining = daysToExpiry(expiryDate, now);
    const source = latestDocument?.expiry_date ? 'documents' : dbExpiry ? 'data_bank' : 'missing';
    const latestDocumentProvided = latestDocument?.renewal_status === 'received';
    const providedAt = providedRequest?.provided_at || (latestDocumentProvided ? latestDocument.updated_at || latestDocument.created_at : null);
    const providedAge = ageInDays(providedAt, now);
    const providedVisible = providedAt && providedAge !== null && providedAge <= PROVIDED_VISIBLE_DAYS;
    const requestStatus = pendingRequest ? 'pending' : providedVisible ? 'provided' : latestRequest?.status || null;
    const expiryStatus = expiryStatusForDays(daysRemaining);

    return {
      ...display,
      documentType,
      label: documentLabel(documentType),
      expiryDate,
      daysToExpiry: daysRemaining,
      expiryStatus,
      requestStatus,
      source,
      latestDocument,
      latestRequest,
      pendingRequest,
      providedRequest,
      providedAt,
      providedVisible,
      capWindow: daysRemaining === null || daysRemaining <= DOCUMENT_CAP_WINDOW_DAYS,
      warningWindow: daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= DOCUMENT_RENEWAL_WARNING_DAYS,
      needsRequest: !pendingRequest && !providedVisible && (
        expiryStatus === 'missing' ||
        expiryStatus === 'expired' ||
        expiryStatus === 'expiring'
      ),
    };
  });
}

export function actionableDocumentItems(items) {
  return items.filter((item) => item.needsRequest);
}

export function bucketDocumentItems(items) {
  return {
    missing: items.filter((item) => item.expiryStatus === 'missing' && !item.pendingRequest && !item.providedVisible),
    expired: items.filter((item) => item.expiryStatus === 'expired' && !item.providedVisible),
    expiring: items.filter((item) => item.expiryStatus === 'expiring' && !item.providedVisible),
    pending: items.filter((item) => item.pendingRequest),
    provided: items.filter((item) => item.providedVisible),
  };
}

export function documentStatusLabel(item) {
  if (item.pendingRequest) return 'Pending requested';
  if (item.providedVisible) return 'Provided';
  if (item.expiryStatus === 'missing') return 'Missing';
  if (item.expiryStatus === 'expired') return 'Expired';
  if (item.warningWindow) return 'Expires this week';
  if (item.expiryStatus === 'expiring') return 'Cap window';
  return 'Valid';
}

export function documentStatusTone(item) {
  if (item.providedVisible) return 'green';
  if (item.pendingRequest) return 'amber';
  if (item.expiryStatus === 'expired' || item.expiryStatus === 'missing') return 'red';
  if (item.warningWindow || item.expiryStatus === 'expiring') return 'amber';
  return 'muted';
}

export function buildDocumentRequestEmail(caseData, items, now = new Date()) {
  const display = getCaseDisplay(caseData);
  const selected = items.filter((item) => item.caseId === display.caseId);
  const subject = `Document renewal request - ${display.venueName}`;
  const dateText = formatDocumentDate(now);
  const lines = selected.map((item) => {
    const timing = item.expiryDate
      ? `${item.daysToExpiry < 0 ? 'expired on' : 'expires on'} ${formatDocumentDate(item.expiryDate)}`
      : 'expiry date not on record';
    return `- ${item.label}: ${timing}`;
  });

  const body = [
    `Hi ${display.groupName},`,
    '',
    `We are updating the underwriting file for ${display.venueName}. Please send renewed copies of the following document${selected.length === 1 ? '' : 's'}:`,
    '',
    ...lines,
    '',
    'These documents are required to keep the facility review current and avoid any expiry-related cap on the approved amount.',
    '',
    `Request date: ${dateText}`,
    '',
    'Regards,',
    'Mezza Risk Team',
  ].join('\n');

  return { subject, body };
}

function expiryStatusForDays(daysRemaining) {
  if (daysRemaining === null) return 'missing';
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= DOCUMENT_CAP_WINDOW_DAYS) return 'expiring';
  return 'valid';
}

function sortNewestFirst(a, b) {
  return timestamp(b.updated_at || b.created_at) - timestamp(a.updated_at || a.created_at);
}

function sortNewestRequestFirst(a, b) {
  return timestamp(b.requested_at || b.updated_at || b.created_at) - timestamp(a.requested_at || a.updated_at || a.created_at);
}

function timestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnlyTime(value) {
  const date = parseDateOnly(value);
  if (!date) return null;
  return startOfUtcDay(date).getTime();
}

function startOfUtcDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function titleize(value) {
  return String(value || 'Document')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
