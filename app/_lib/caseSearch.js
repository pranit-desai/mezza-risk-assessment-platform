export function caseSearchLabel(c) {
  return [
    c?.case_ref,
    c?.group_name,
    c?.group,
    c?.venue_name,
    c?.venue,
    c?.name,
  ].filter(Boolean).join(' ');
}

export function filterCasesByQuery(cases, query) {
  const q = query.trim().toLowerCase();
  if (!q) return cases;
  return cases.filter((c) => caseSearchLabel(c).toLowerCase().includes(q));
}
