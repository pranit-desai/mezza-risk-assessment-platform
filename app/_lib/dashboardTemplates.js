import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildDocumentItems,
  documentStatusLabel,
  formatDocumentDate,
} from './documentWorkflow.js';
import {
  caseCurrency,
  caseGroup,
  caseRegion,
  caseVenue,
  currencyForRegion,
  recommendedCeiling,
  statusLabel,
} from './casePresentation.js';

const TEMPLATE_DIR = path.join(process.cwd(), 'app', '_templates', 'dashboards');
const TEMPLATE_FILES = {
  venue: 'venue.html',
  group: 'group.html',
};
const ELIGIBLE_STATUSES = new Set(['approved', 'accepted']);

const LIVE_STYLE = `
.live-strip{background:var(--card);border:1px solid var(--brd);border-radius:14px;padding:16px 20px;display:grid;grid-template-columns:1.2fr 2fr;gap:16px;align-items:start}
.live-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;color:var(--t2);margin-bottom:8px}
.live-headline{font-size:14px;font-weight:800;color:var(--t1);line-height:1.5}
.live-sub{font-size:11px;color:var(--t2);line-height:1.7;margin-top:5px}
.live-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
.live-kv{background:var(--card-2);border:1px solid var(--brd);border-radius:9px;padding:10px 12px;min-width:0}
.live-k{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--t2);margin-bottom:5px}
.live-v{font-size:13px;font-weight:800;color:var(--t1);line-height:1.35;word-break:break-word}
.live-gap{grid-column:1/-1;background:rgba(212,168,0,.08);border:1px solid rgba(212,168,0,.24);border-radius:9px;padding:10px 12px;color:#d4c060;font-size:11px;line-height:1.65}
@media(max-width:900px){.live-strip{grid-template-columns:1fr}.live-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

export async function renderVenueDashboard(caseData, documents = [], requests = []) {
  const html = await readTemplate('venue');
  const model = buildVenueModel(caseData, documents, requests);
  return applyVenueModel(html, model);
}

export async function renderGroupDashboard(groupData, cases = [], documents = [], requests = []) {
  const html = await readTemplate('group');
  const model = buildGroupModel(groupData, cases, documents, requests);
  return applyGroupModel(html, model);
}

export function dashboardHtmlResponse(html) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

async function readTemplate(kind) {
  return readFile(path.join(TEMPLATE_DIR, TEMPLATE_FILES[kind]), 'utf8');
}

function buildVenueModel(caseData, documents, requests) {
  const items = buildDocumentItems(caseData, documents, requests);
  const currency = caseCurrency(caseData);
  const revenue = ltmRevenue(caseData);
  const financialScore = pickNumber(caseData, [
    'extracted_json.credit_score.financial_health_score',
    'financial_health_score',
  ]);
  const profileScore = pickNumber(caseData, [
    'extracted_json.credit_score.restaurant_profile_score',
    'restaurant_profile_score',
  ]);
  const score = pickNumber(caseData, [
    'score',
    'extracted_json.credit_score.final_score',
    'extracted_json.credit_score.score',
  ]);
  const grade = caseData?.grade || gradeForScore(score);
  const ceiling = recommendedCeiling(caseData);
  const gaps = dataGaps([
    ['Composite score', score],
    ['Financial health score', financialScore],
    ['Restaurant profile score', profileScore],
    ['LTM revenue', revenue],
    ['Lending ceiling', ceiling],
  ]);

  return {
    caseData,
    venueName: caseVenue(caseData),
    groupName: caseGroup(caseData),
    region: caseRegion(caseData),
    currency,
    location: caseData?.location || caseData?.extracted_json?.profile?.location || '',
    concept: caseData?.concept || caseData?.venue_type || '',
    analysisDate: formatDocumentDate(new Date()),
    revenue,
    financialScore,
    profileScore,
    score,
    grade,
    ceiling,
    items,
    documentHeadline: documentHeadline(items),
    gaps,
  };
}

function buildGroupModel(groupData, cases, documents, requests) {
  const region = caseRegion(groupData || cases[0]);
  const currency = currencyForRegion(region);
  const venueModels = cases.map((caseData) => (
    buildVenueModel(
      caseData,
      documents.filter((document) => document.case_id === caseData.id),
      requests.filter((request) => request.case_id === caseData.id)
    )
  ));
  const revenue = venueModels.reduce((sum, venue) => sum + (venue.revenue || 0), 0);
  const weightedRows = venueModels
    .filter((venue) => venue.revenue > 0 && venue.score !== null)
    .map((venue) => ({ score: venue.score, revenue: venue.revenue }));
  const weightedRevenue = weightedRows.reduce((sum, row) => sum + row.revenue, 0);
  const score = weightedRevenue
    ? weightedRows.reduce((sum, row) => sum + row.score * row.revenue, 0) / weightedRevenue
    : average(venueModels.map((venue) => venue.score));
  const grade = gradeForScore(score);
  const documentsNeedingAction = venueModels.flatMap((venue) => (
    venue.items.filter((item) => item.expiryStatus !== 'valid' || item.pendingRequest)
  ));
  const eligibleCeiling = venueModels
    .filter((venue) => countsTowardGroupMetrics(venue.caseData))
    .reduce((sum, venue) => sum + recommendedCeiling(venue.caseData), 0);
  const groupCeiling = eligibleCeiling || revenue * 0.04;
  const gaps = dataGaps([
    ['Group cases', cases.length ? cases.length : null],
    ['Group LTM revenue', revenue],
    ['Weighted score', score],
  ]);
  const missingRevenueCount = venueModels.filter((venue) => venue.revenue === null).length;
  const missingScoreCount = venueModels.filter((venue) => venue.score === null).length;
  if (missingRevenueCount) gaps.push(`${missingRevenueCount} venue${missingRevenueCount === 1 ? '' : 's'} missing LTM revenue`);
  if (missingScoreCount) gaps.push(`${missingScoreCount} venue${missingScoreCount === 1 ? '' : 's'} missing score`);

  return {
    groupData,
    groupName: groupData?.group_name || cases[0]?.group_name || 'Ungrouped',
    groupKey: groupData?.group_key || '',
    region,
    currency,
    cases,
    venueModels,
    revenue,
    score,
    grade,
    groupCeiling,
    conservative: revenue * 0.01,
    moderate: revenue * 0.03,
    aggressive: revenue * 0.05,
    documentsNeedingAction,
    documentHeadline: documentHeadline(documentsNeedingAction.length ? documentsNeedingAction : venueModels.flatMap((venue) => venue.items)),
    gaps,
  };
}

function applyVenueModel(inputHtml, model) {
  let html = addLiveStyles(inputHtml);
  html = replaceTitle(html, `${model.venueName} - ${model.groupName} - Mezza Credit Risk Dashboard`);
  html = insertAfterWrap(html, renderLiveStrip({
    title: 'Live Data Bank Snapshot',
    headline: model.documentHeadline.headline,
    sub: model.documentHeadline.detail,
    pairs: [
      ['Case', model.caseData?.case_ref || model.caseData?.id],
      ['Region', model.region],
      ['Score', scoreText(model.score, model.grade)],
      ['Ceiling', moneyCompact(model.ceiling, model.currency)],
      ['LTM Revenue', moneyCompact(model.revenue, model.currency)],
      ['Documents', documentCountsText(model.items)],
      ['Updated', model.analysisDate],
      ['Status', statusLabel(model.caseData?.status)],
    ],
    gaps: model.gaps,
  }));
  html = html.replace(
    /(<div class="expired-banner">[\s\S]*?<div class="expired-text">)[\s\S]*?(<\/div>\s*<\/div>)/,
    `$1${renderDocumentBannerText(model.documentHeadline)}$2`
  );
  html = replaceClassContent(html, 'header-name', escapeHtml(model.venueName));
  html = replaceClassContent(
    html,
    'header-sub',
    `${escapeHtml(model.location || model.region)} &nbsp;-&nbsp; ${escapeHtml(model.groupName)} &nbsp;-&nbsp; Mezza Credit Risk Assessment`
  );
  html = replaceClassContent(
    html,
    'header-meta',
    `Analysis Date: <span>${escapeHtml(model.analysisDate)}</span><br>Analyst: <span>Pranit</span> &nbsp;-&nbsp; Checked By: <span>Pranit</span>`
  );
  html = replaceSectionNeedle(html, 'sc fin', 100, 108, 84, model.financialScore);
  html = replaceSectionNeedle(html, 'sc prof', 100, 108, 84, model.profileScore);
  html = replaceSectionNeedle(html, 'ob', 140, 150, 108, model.score);
  html = replaceNthClassContent(html, 'si-num go', 0, numberText(model.financialScore));
  html = replaceNthClassContent(html, 'si-num ab', 0, numberText(model.profileScore));
  html = replaceNthClassContent(html, 'rpill rp-go', 0, riskLabel(model.financialScore));
  html = replaceNthClassContent(html, 'rpill rp-ab', 0, riskLabel(model.profileScore));
  html = replaceNthClassContent(html, 'si-desc', 0, `${riskLabel(model.financialScore)} - Grade ${gradeForScore(model.financialScore)}`);
  html = replaceNthClassContent(html, 'si-desc', 1, `${riskLabel(model.profileScore)} - Grade ${gradeForScore(model.profileScore)}`);
  html = replaceClassContent(html, 'ob-label', `Overall Composite Risk Score - Mezza Weighted Model - ${model.documentHeadline.short}`);
  html = replaceClassContent(html, 'ob-num', numberText(model.score));
  html = replaceNthClassContent(html, 'ob-risk', 0, riskLabel(model.score));
  html = replaceNthClassContent(html, 'ob-risk', 1, model.grade);
  html = html.replace(
    /(<div class="ob-bd">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<!-- METRIC CARDS ROW 1 -->)/,
    `$1
      <div>Financial: <strong>${numberText(model.financialScore)}</strong> &nbsp;(70%)</div>
      <div>Profile:&nbsp;&nbsp;&nbsp;<strong>${numberText(model.profileScore)}</strong> &nbsp;(30%)</div>
      <div class="ob-formula">= (${numberText(model.financialScore)} x 0.7) + (${numberText(model.profileScore)} x 0.3) = ${numberText(model.score)} &nbsp;|&nbsp; ${escapeHtml(model.documentHeadline.short)}</div>
    $2`
  );
  html = replaceMetricValue(html, 'LTM Revenue (Net VAT)', moneyFull(model.revenue, model.currency));
  html = replaceKchValue(html, 'Trade License Expiry', documentValue(model.items, 'trade_licence'));
  html = replaceKchValue(html, 'Tenancy Contract Expiry', documentValue(model.items, 'ejari_lease') || documentValue(model.items, 'business_lease'));
  return html;
}

function applyGroupModel(inputHtml, model) {
  let html = addLiveStyles(inputHtml);
  html = replaceTitle(html, `${model.groupName} - Mezza Credit Risk Group Dashboard`);
  html = insertAfterWrap(html, renderLiveStrip({
    title: 'Live Group Data Bank Snapshot',
    headline: model.documentHeadline.headline,
    sub: model.documentHeadline.detail,
    pairs: [
      ['Group', model.groupName],
      ['Region', model.region],
      ['Venues', String(model.venueModels.length)],
      ['Weighted Score', scoreText(model.score, model.grade)],
      ['Group LTM', moneyCompact(model.revenue, model.currency)],
      ['4% Ceiling', moneyCompact(model.groupCeiling, model.currency)],
      ['Documents', documentCountsText(model.venueModels.flatMap((venue) => venue.items))],
      ['Updated', formatDocumentDate(new Date())],
    ],
    gaps: model.gaps,
  }));
  html = replaceClassContent(html, 'grp-name', escapeHtml(model.groupName));
  html = replaceClassContent(html, 'grp-sub', `${escapeHtml(model.region)} portfolio - Mezza Credit Risk - Group Composite Dashboard`);
  html = replaceClassContent(
    html,
    'grp-badge',
    `${model.venueModels.length} Venues - ${model.region} - Group Analysis`
  );
  html = replaceClassContent(
    html,
    'grp-meta',
    `Analysis Date: <span>${escapeHtml(formatDocumentDate(new Date()))}</span><br>
    Analyst: <span>Pranit</span> &nbsp;-&nbsp; Checked By: <span>Pranit</span><br>
    Venues Assessed: <span>${model.venueModels.length} / ${model.venueModels.length}</span>`
  );
  html = html.replace(
    /(<div class="hold-banner">[\s\S]*?<div class="hold-text">)[\s\S]*?(<\/div>\s*<\/div>)/,
    `$1${renderDocumentBannerText(model.documentHeadline)}$2`
  );
  html = replaceKpi(html, 'Weighted Group Score', numberText(model.score), `Revenue-weighted composite<br>Grade ${escapeHtml(model.grade)} - ${riskLabel(model.score)}`);
  html = replaceKpi(html, 'Total Group LTM Revenue', moneyCompact(model.revenue, model.currency), `${moneyFull(model.revenue, model.currency)} net VAT<br>12-month trailing`);
  html = replaceKpi(html, 'Venues Assessed', String(model.venueModels.length), documentCountsText(model.venueModels.flatMap((venue) => venue.items)));
  html = replaceKpi(html, 'Total Green Flags', String(totalGreenFlags(model.venueModels)), `Across ${model.venueModels.length} venues<br>Model-derived where present`);
  html = replaceKpi(html, 'Total Red Flags', String(totalRedFlags(model.venueModels)), `Across ${countVenuesWithRedFlags(model.venueModels)} venues<br>Includes document stops`);
  html = replaceClassContent(html, 'comp-num', numberText(model.score));
  html = html.replace(
    /(<div class="comp-detail">)[\s\S]*?(<\/div>\s*<\/div>\s*<!--)/,
    `$1<div>Methodology: <strong>Revenue-Weighted Composite</strong></div><div>Venues assessed: <strong>${model.venueModels.length}</strong></div><div>Group LTM: <strong>${moneyFull(model.revenue, model.currency)}</strong></div><div class="comp-formula">Score = Sum(Venue Score x Venue LTM / Group LTM)<br>Group Grade ${escapeHtml(model.grade)} - ${riskLabel(model.score)}<br>${escapeHtml(model.documentHeadline.short)}</div>$2`
  );
  html = replaceFirstClassContent(html, 'lend-amt', moneyCompact(model.conservative, model.currency));
  html = replaceNthClassContent(html, 'lend-amt', 1, moneyCompact(model.moderate, model.currency));
  html = replaceNthClassContent(html, 'lend-amt', 2, moneyCompact(model.aggressive, model.currency));
  html = replaceClassContent(html, 'final-amount', moneyCompact(model.groupCeiling, model.currency));
  html = replaceVenueGrid(html, model.venueModels.map((venue) => renderVenueCard(venue, model.revenue)).join('\n'));
  html = replaceDocumentRegister(html, model.venueModels.map(renderDocumentRegisterRow).join('\n'));
  return html;
}

function renderLiveStrip({ title, headline, sub, pairs, gaps }) {
  const kvs = pairs.map(([label, value]) => `
    <div class="live-kv"><div class="live-k">${escapeHtml(label)}</div><div class="live-v">${escapeHtml(value ?? '-')}</div></div>
  `).join('');
  const gapHtml = gaps.length
    ? `<div class="live-gap"><strong>Data gaps:</strong> ${gaps.map(escapeHtml).join('; ')}</div>`
    : '';
  return `
<div class="live-strip">
  <div>
    <div class="live-title">${escapeHtml(title)}</div>
    <div class="live-headline">${escapeHtml(headline)}</div>
    <div class="live-sub">${escapeHtml(sub)}</div>
  </div>
  <div class="live-grid">${kvs}${gapHtml}</div>
</div>`;
}

function renderDocumentBannerText(headline) {
  return `
    <strong>${escapeHtml(headline.headline)}</strong><span class="hold-badge hold-pill">DOCUMENT CONTROL</span><br>
    ${escapeHtml(headline.detail)}
  `;
}

function renderVenueCard(venue, groupRevenue) {
  const severity = documentSeverity(venue.items);
  const revenueShare = venue.revenue && groupRevenue
    ? `${(venue.revenue / groupRevenue * 100).toFixed(1)}% of group`
    : 'Group share unavailable';
  const score = numberText(venue.score);
  const grade = venue.grade || gradeForScore(venue.score);
  const greenFlags = greenFlagCount(venue.caseData);
  const redFlags = redFlagCount(venue.caseData) + venue.items.filter(itemNeedsAction).length;
  const docTags = venue.items.map((item) => (
    `<span class="doc-tag ${severity.docTagClass(item)}">${escapeHtml(shortDocumentTag(item))}</span>`
  )).join('');

  return `
  <div class="vc ${severity.cardClass}">
    <div class="vc-top">
      <div><div class="vc-name">${escapeHtml(venue.venueName)}</div><div class="vc-entity">${escapeHtml(venue.groupName)} - ${escapeHtml(venue.location || venue.region)}</div></div>
      <div class="vc-score"><div class="vc-num" style="color:${scoreColorVar(venue.score)}">${score}</div><div class="vc-outof">/100</div><div><span class="grade-pill ${gradeClass(grade)}">${escapeHtml(grade)}</span></div></div>
    </div>
    <div class="vc-rev">LTM: <strong>${escapeHtml(moneyFull(venue.revenue, venue.currency))}</strong> &nbsp;-&nbsp; ${escapeHtml(revenueShare)}</div>
    <div class="vc-flags"><span class="vc-flag vf-grn">${greenFlags} Green</span><span class="vc-flag vf-red">${redFlags} Red</span></div>
    <div class="vc-alert ${severity.alertClass}">${escapeHtml(venue.documentHeadline.headline)} ${escapeHtml(venue.documentHeadline.detail)}</div>
    <div class="vc-docs">${docTags}</div>
  </div>`;
}

function renderDocumentRegisterRow(venue) {
  const trade = venue.items.find((item) => item.documentType === 'trade_licence') || null;
  const lease = venue.items.find((item) => item.documentType === 'ejari_lease' || item.documentType === 'business_lease') || null;
  const severity = documentSeverity(venue.items);
  return `
      <tr class="${severity.rowClass}">
        <td><div class="doc-venue">${escapeHtml(venue.venueName)}</div><div class="doc-entity">${escapeHtml(venue.groupName)} - ${escapeHtml(venue.location || venue.region)}</div></td>
        ${documentCells(trade, 'Trade License not required')}
        ${documentCells(lease, 'Lease not on record')}
        <td class="doc-action">${escapeHtml(venue.documentHeadline.headline)} ${escapeHtml(venue.documentHeadline.detail)}</td>
      </tr>`;
}

function documentCells(item, emptyText) {
  if (!item) {
    return `<td class="doc-date">${escapeHtml(emptyText)}</td><td style="text-align:center"><span class="doc-days dd-green">N/A</span></td>`;
  }
  const severity = itemSeverity(item);
  return `<td class="doc-date">${escapeHtml(documentValueFromItem(item))}</td><td style="text-align:center"><span class="doc-days ${severity.daysClass}">${escapeHtml(itemStatusShort(item))}</span></td>`;
}

function documentHeadline(items) {
  const actionable = items.filter(itemNeedsAction);
  const missing = items.filter((item) => item.expiryStatus === 'missing');
  const expired = items.filter((item) => item.expiryStatus === 'expired');
  const warning = items.filter((item) => item.warningWindow);
  const expiring = items.filter((item) => item.expiryStatus === 'expiring');
  const pending = items.filter((item) => item.pendingRequest);
  const provided = items.filter((item) => item.providedVisible);

  if (missing.length || expired.length) {
    return {
      short: 'Hard document hold',
      headline: `${missing.length + expired.length} document${missing.length + expired.length === 1 ? '' : 's'} expired or missing`,
      detail: documentListText([...expired, ...missing]) || 'Request renewed documents before any disbursement.',
    };
  }
  if (warning.length) {
    return {
      short: '7-day warning',
      headline: `${warning.length} document${warning.length === 1 ? '' : 's'} expiring within 7 days`,
      detail: documentListText(warning) || 'Send renewal request now.',
    };
  }
  if (expiring.length) {
    return {
      short: '90-day cap window',
      headline: `${expiring.length} document${expiring.length === 1 ? '' : 's'} inside the 90-day cap window`,
      detail: documentListText(expiring) || 'Monitor before final loan amount confirmation.',
    };
  }
  if (pending.length) {
    return {
      short: 'Pending request',
      headline: `${pending.length} document request${pending.length === 1 ? '' : 's'} pending`,
      detail: documentListText(pending),
    };
  }
  if (provided.length) {
    return {
      short: 'Recently provided',
      headline: `${provided.length} document${provided.length === 1 ? '' : 's'} provided this week`,
      detail: documentListText(provided),
    };
  }
  if (actionable.length) {
    return {
      short: 'Document action required',
      headline: `${actionable.length} document${actionable.length === 1 ? '' : 's'} need action`,
      detail: documentListText(actionable),
    };
  }
  return {
    short: 'Documents clear',
    headline: 'Required documents clear',
    detail: 'No expired, missing, pending, or 90-day cap-window documents found.',
  };
}

function documentListText(items) {
  if (!items.length) return '';
  return items.slice(0, 5).map((item) => (
    `${item.venueName} - ${item.label}: ${itemStatusLong(item)}`
  )).join('; ');
}

function documentCountsText(items) {
  const missing = items.filter((item) => item.expiryStatus === 'missing').length;
  const expired = items.filter((item) => item.expiryStatus === 'expired').length;
  const expiring = items.filter((item) => item.expiryStatus === 'expiring').length;
  const pending = items.filter((item) => item.pendingRequest).length;
  if (missing || expired || expiring || pending) {
    return `${missing} missing / ${expired} expired / ${expiring} cap-window / ${pending} pending`;
  }
  return 'All clear';
}

function itemNeedsAction(item) {
  return item.expiryStatus === 'missing' ||
    item.expiryStatus === 'expired' ||
    item.expiryStatus === 'expiring' ||
    !!item.pendingRequest;
}

function itemSeverity(item) {
  if (!item) return { rank: 0, daysClass: 'dd-green', tagClass: 'dt-grn' };
  if (item.expiryStatus === 'missing' || item.expiryStatus === 'expired') {
    return { rank: 5, daysClass: 'dd-expired', tagClass: 'dt-red' };
  }
  if (item.warningWindow || (item.daysToExpiry !== null && item.daysToExpiry <= 30)) {
    return { rank: 4, daysClass: 'dd-critical', tagClass: 'dt-crit' };
  }
  if (item.daysToExpiry !== null && item.daysToExpiry <= 60) {
    return { rank: 3, daysClass: 'dd-amber', tagClass: 'dt-adv' };
  }
  if (item.expiryStatus === 'expiring') {
    return { rank: 2, daysClass: 'dd-watch', tagClass: 'dt-watch' };
  }
  if (item.pendingRequest) {
    return { rank: 1, daysClass: 'dd-amber', tagClass: 'dt-adv' };
  }
  return { rank: 0, daysClass: 'dd-green', tagClass: 'dt-grn' };
}

function documentSeverity(items) {
  const severities = items.map(itemSeverity);
  const maxRank = Math.max(0, ...severities.map((severity) => severity.rank));
  if (maxRank >= 5) {
    return severityConfig('s-hold', 'va-hold', 'row-hold', (item) => itemSeverity(item).tagClass);
  }
  if (maxRank >= 4) {
    return severityConfig('s-crit', 'va-crit', 'row-crit', (item) => itemSeverity(item).tagClass);
  }
  if (maxRank >= 3) {
    return severityConfig('s-adv', 'va-adv', 'row-adv', (item) => itemSeverity(item).tagClass);
  }
  if (maxRank >= 2) {
    return severityConfig('s-watch', 'va-watch', '', (item) => itemSeverity(item).tagClass);
  }
  return severityConfig('s-ok', 'va-ok', '', (item) => itemSeverity(item).tagClass);
}

function severityConfig(cardClass, alertClass, rowClass, docTagClass) {
  return { cardClass, alertClass, rowClass, docTagClass };
}

function itemStatusLong(item) {
  if (item.pendingRequest) return 'pending request';
  if (item.providedVisible) return 'provided this week';
  if (item.expiryStatus === 'missing') return 'expiry date missing';
  if (item.expiryStatus === 'expired') return `expired ${formatDocumentDate(item.expiryDate)}`;
  if (item.warningWindow) return `expires in ${item.daysToExpiry} days`;
  if (item.expiryStatus === 'expiring') return `inside 90-day cap window (${formatDocumentDate(item.expiryDate)})`;
  return `valid until ${formatDocumentDate(item.expiryDate)}`;
}

function itemStatusShort(item) {
  if (item.expiryStatus === 'missing') return 'Missing';
  if (item.expiryStatus === 'expired') return `Expired ${Math.abs(item.daysToExpiry || 0)}d`;
  if (item.pendingRequest) return 'Pending';
  if (item.daysToExpiry === null) return documentStatusLabel(item);
  if (item.daysToExpiry <= 90) return `${item.daysToExpiry}d`;
  return `${item.daysToExpiry}d`;
}

function shortDocumentTag(item) {
  const prefix = item.documentType === 'trade_licence' ? 'TL' : 'Lease';
  if (item.expiryStatus === 'missing') return `${prefix}: Missing`;
  if (item.expiryStatus === 'expired') return `${prefix}: Expired`;
  if (item.pendingRequest) return `${prefix}: Pending`;
  return `${prefix}: ${formatDocumentDate(item.expiryDate)}`;
}

function documentValue(items, documentType) {
  return documentValueFromItem(items.find((item) => item.documentType === documentType));
}

function documentValueFromItem(item) {
  if (!item) return '';
  if (item.expiryStatus === 'missing') return 'Missing';
  return formatDocumentDate(item.expiryDate);
}

function ltmRevenue(c) {
  return pickNumber(c, [
    'ltm_revenue',
    'ltm_revenue_aed',
    'ltm_revenue_usd',
    'extracted_json.pos_headline.net_revenue_ex_tax',
    'extracted_json.credit_score.ltm_revenue',
    'extracted_json.credit_score.ltm_revenue_aed',
    'extracted_json.credit_score.ltm_revenue_usd',
    'extracted_json.financials.ltm_revenue',
  ]);
}

function countsTowardGroupMetrics(c) {
  return ELIGIBLE_STATUSES.has(String(c?.status || '').trim().toLowerCase());
}

function greenFlagCount(caseData) {
  const extracted = caseData?.extracted_json || {};
  return firstArrayLength([
    extracted.green_flags,
    extracted.flags?.green,
    extracted.credit_score?.green_flags,
    extracted.risk_flags?.green,
  ]);
}

function redFlagCount(caseData) {
  const extracted = caseData?.extracted_json || {};
  return firstArrayLength([
    extracted.red_flags,
    extracted.flags?.red,
    extracted.credit_score?.red_flags,
    extracted.risk_flags?.red,
  ]);
}

function totalGreenFlags(venueModels) {
  return venueModels.reduce((sum, venue) => sum + greenFlagCount(venue.caseData), 0);
}

function totalRedFlags(venueModels) {
  return venueModels.reduce((sum, venue) => (
    sum + redFlagCount(venue.caseData) + venue.items.filter(itemNeedsAction).length
  ), 0);
}

function countVenuesWithRedFlags(venueModels) {
  return venueModels.filter((venue) => redFlagCount(venue.caseData) || venue.items.some(itemNeedsAction)).length;
}

function firstArrayLength(values) {
  const found = values.find(Array.isArray);
  return found ? found.length : 0;
}

function pickNumber(source, paths) {
  for (const candidate of paths) {
    const value = getPath(source, candidate);
    const number = toNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function getPath(source, pathValue) {
  return String(pathValue)
    .split('.')
    .reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/,/g, '').replace(/%$/, ''));
  return Number.isFinite(number) ? number : null;
}

function average(values) {
  const clean = values.filter((value) => value !== null && Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function dataGaps(pairs) {
  return pairs
    .filter(([, value]) => value === null || value === undefined || value === '' || value === 0)
    .map(([label]) => label);
}

function gradeForScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value >= 90) return 'A+';
  if (value >= 80) return 'A';
  if (value >= 75) return 'B+';
  if (value >= 70) return 'B';
  if (value >= 65) return 'C+';
  if (value >= 50) return 'C';
  return 'NM';
}

function riskLabel(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 'Not scored';
  if (value >= 80) return 'Low Risk';
  if (value >= 70) return 'Moderate Risk';
  if (value >= 60) return 'Watch';
  return 'High Risk';
}

function scoreColorVar(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 'var(--t2)';
  if (value >= 80) return 'var(--bap)';
  if (value >= 75) return 'var(--bbp)';
  if (value >= 70) return 'var(--bb)';
  if (value >= 60) return 'var(--bcp)';
  return 'var(--blo)';
}

function gradeClass(grade) {
  if (grade === 'A+') return 'gp-aplus';
  if (grade === 'A') return 'gp-a';
  return 'gp-bplus';
}

function scoreText(score, grade) {
  return score === null ? '-' : `${numberText(score)} / ${grade || gradeForScore(score)}`;
}

function numberText(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '-';
}

function moneyCompact(amount, currency) {
  const value = toNumber(amount);
  if (value === null) return '-';
  if (Math.abs(value) >= 1e6) return `${currency} ${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${currency} ${(value / 1e3).toFixed(1)}K`;
  return `${currency} ${value.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
}

function moneyFull(amount, currency) {
  const value = toNumber(amount);
  if (value === null) return '-';
  return `${currency} ${value.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
}

function addLiveStyles(html) {
  if (html.includes('.live-strip')) return html;
  return html.replace('</style>', `${LIVE_STYLE}\n</style>`);
}

function insertAfterWrap(html, content) {
  return html.replace(/(<div class="wrap">\s*)/, `$1${content}\n`);
}

function replaceTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
}

function replaceClassContent(html, className, content) {
  return replaceNthClassContent(html, className, 0, content);
}

function replaceFirstClassContent(html, className, content) {
  return replaceNthClassContent(html, className, 0, content);
}

function replaceNthClassContent(html, className, index, content) {
  let count = 0;
  const re = new RegExp(`(<div class="${escapeRegExp(className)}"[^>]*>)[\\s\\S]*?(<\\/div>)`, 'g');
  return html.replace(re, (match, open, close) => {
    if (count === index) {
      count += 1;
      return `${open}${content}${close}`;
    }
    count += 1;
    return match;
  });
}

function replaceSectionNeedle(html, className, centerX, centerY, radius, score) {
  const point = gaugePoint(score, centerX, centerY, radius);
  if (!point) return html;
  const re = new RegExp(`(<div class="${escapeRegExp(className)}"[^>]*>[\\s\\S]*?<line x1="${centerX}" y1="${centerY}" x2=")[^"]+(" y2=")[^"]+("[^>]*>)`);
  return html.replace(re, `$1${point.x}$2${point.y}$3`);
}

function gaugePoint(score, centerX, centerY, radius) {
  const value = Number(score);
  if (!Number.isFinite(value)) return null;
  const clamped = Math.max(0, Math.min(100, value));
  const angle = Math.PI * (1 - clamped / 100);
  return {
    x: (centerX + radius * Math.cos(angle)).toFixed(1),
    y: (centerY - radius * Math.sin(angle)).toFixed(1),
  };
}

function replaceMetricValue(html, label, value) {
  const re = new RegExp(`(<div class="ml">${escapeRegExp(label)}<\\/div>\\s*<div class="mv">)[\\s\\S]*?(<\\/div>)`);
  return html.replace(re, `$1${escapeHtml(value)}$2`);
}

function replaceKchValue(html, label, value) {
  if (!value) return html;
  const re = new RegExp(`(<div class="kch-label">${escapeRegExp(label)}<\\/div>\\s*<div class="kch-value">)[\\s\\S]*?(<\\/div>)`);
  return html.replace(re, `$1${escapeHtml(value)}$2`);
}

function replaceKpi(html, label, value, sub) {
  const re = new RegExp(`(<div class="kpi-lbl">${escapeRegExp(label)}<\\/div>\\s*<div class="kpi-val"[^>]*>)[\\s\\S]*?(<\\/div>\\s*<div class="kpi-sub">)[\\s\\S]*?(<\\/div>)`);
  return html.replace(re, `$1${escapeHtml(value)}$2${sub}$3`);
}

function replaceVenueGrid(html, content) {
  return html.replace(
    /(<div class="venue-grid">\s*)[\s\S]*?(\s*<\/div>\s*<div class="risk-dist">)/,
    `$1${content}\n$2`
  );
}

function replaceDocumentRegister(html, content) {
  return html.replace(
    /(<table class="doc-table">[\s\S]*?<tbody>\s*)[\s\S]*?(\s*<\/tbody>)/,
    `$1${content}\n$2`
  );
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
