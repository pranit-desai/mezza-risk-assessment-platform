"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import CaseSearchBox from "./_components/CaseSearchBox";
import DashboardControls from "./_components/DashboardControls";
import DashboardTabs from "./_components/DashboardTabs";
import RegionBadge from "./_components/RegionBadge";
import StatusBadge from "./_components/StatusBadge";
import { filterCasesByQuery } from "./_lib/caseSearch";
import {
  caseGroup,
  caseRegion,
  caseVenue,
  currencyForRegion,
  decisionText,
  formatCurrencyAmount,
  formatTrackerDate,
  lendingAmountColor,
  rationaleText,
  recommendedCeiling,
  scoreColor,
  shortCaseRef,
  trackerDates,
} from "./_lib/casePresentation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const ELIGIBLE_STATUSES = new Set(["approved", "accepted"]);

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function countsTowardGroupMetrics(c) {
  return ELIGIBLE_STATUSES.has(normalizeStatus(c?.status));
}

function venueRevenue(c) {
  return (
    Number(c?.ltm_revenue_aed) ||
    Number(c?.extracted_json?.pos_headline?.net_revenue_ex_tax) ||
    Number(c?.extracted_json?.credit_score?.ltm_revenue_aed) ||
    0
  );
}

function weightedScore(rows) {
  const weightedRows = rows
    .filter(countsTowardGroupMetrics)
    .map((c) => ({
      score: Number(c.score),
      revenue: venueRevenue(c),
    }))
    .filter((row) => Number.isFinite(row.score) && row.revenue > 0);

  const totalRevenue = weightedRows.reduce((sum, row) => sum + row.revenue, 0);
  if (!totalRevenue) return null;

  return weightedRows.reduce((sum, row) => sum + row.score * row.revenue, 0) / totalRevenue;
}

function gradeForScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value >= 80) return "A";
  if (value >= 70) return "B+";
  if (value >= 60) return "B";
  if (value >= 50) return "C";
  return "NM";
}

function money(n, currency = "AED") {
  return formatCurrencyAmount(n, currency).replace(`${currency} 0`, "-");
}

function normalizeVenueName(name) {
  return String(name || "").trim().toLowerCase();
}

function displayVenueCount(groupRow) {
  const names = new Set();
  for (const c of groupRow.rows) names.add(normalizeVenueName(caseVenue(c)));
  for (const venue of groupRow.registryVenues) names.add(normalizeVenueName(venue.venue_name));
  names.delete("");
  return Math.max(names.size, groupRow.rows.length, groupRow.registryVenues.length);
}

function registryVenuesWithoutCases(groupRow) {
  const caseVenueNames = new Set(groupRow.rows.map((c) => normalizeVenueName(caseVenue(c))));
  return groupRow.registryVenues.filter((venue) => !caseVenueNames.has(normalizeVenueName(venue.venue_name)));
}

function groupRows(cases, registeredGroups = []) {
  const map = new Map();
  for (const c of cases) {
    const region = caseRegion(c);
    const group = caseGroup(c);
    const key = `${region}:${group}`;
    if (!map.has(key)) {
      map.set(key, { key, region, group, rows: [], registryVenues: [], registeredGroup: null });
    }
    map.get(key).rows.push(c);
  }

  for (const registeredGroup of registeredGroups) {
    const region = caseRegion(registeredGroup);
    const group = registeredGroup.group_name || registeredGroup.group || "Ungrouped";
    const key = `${region}:${group}`;
    if (!map.has(key)) {
      map.set(key, { key, region, group, rows: [], registryVenues: [], registeredGroup });
    }
    const row = map.get(key);
    row.registeredGroup ??= registeredGroup;
    row.registryVenues = Array.isArray(registeredGroup.venues) ? registeredGroup.venues : [];
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    return a.group.localeCompare(b.group);
  });
}

function latestDate(rows, getter) {
  const values = rows
    .map((row) => getter(trackerDates(row)))
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a);

  return values[0] || null;
}

function groupMetrics(rows) {
  const eligible = rows.filter(countsTowardGroupMetrics);
  const score = weightedScore(rows);
  return {
    eligible,
    score,
    grade: gradeForScore(score),
    ceiling: eligible.reduce((sum, c) => sum + recommendedCeiling(c), 0),
    revenue: eligible.reduce((sum, c) => sum + venueRevenue(c), 0),
  };
}

function venueWeight(c, metrics) {
  if (!countsTowardGroupMetrics(c)) return "Excluded";
  const revenue = venueRevenue(c);
  if (!metrics.revenue || !revenue) return "-";
  return `${((revenue / metrics.revenue) * 100).toFixed(1)}%`;
}

function Tile({ label, value, color }) {
  return (
    <div className="mz-card" style={{ flex: 1, minWidth: 180 }}>
      <div className="mz-eyebrow" style={{ color: "var(--mz-muted)" }}>
        {label}
      </div>
      <div
        className="mz-mono"
        style={{
          fontSize: "var(--mz-fs-stat)",
          fontWeight: 900,
          color: color || "var(--mz-text)",
          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [registeredGroups, setRegisteredGroups] = useState([]);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All");
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [casesRes, groupsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/cases`, { cache: "no-store" }),
          fetch("/api/groups", { cache: "no-store" }),
        ]);
        if (!casesRes.ok) throw new Error(`Cases status ${casesRes.status}`);
        if (!groupsRes.ok) throw new Error(`Groups status ${groupsRes.status}`);
        const casesData = await casesRes.json();
        const groupsData = await groupsRes.json();
        setCases(Array.isArray(casesData) ? casesData : casesData.cases ?? []);
        setRegisteredGroups(Array.isArray(groupsData) ? groupsData : []);
      } catch (e) {
        setError(e.message || "Failed to load cases");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const regionCases = useMemo(() => {
    if (region === "All") return cases;
    return cases.filter((c) => caseRegion(c) === region);
  }, [cases, region]);

  const visibleCases = useMemo(() => filterCasesByQuery(regionCases, query), [regionCases, query]);
  const visibleRegisteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registeredGroups.filter((group) => {
      if (region !== "All" && caseRegion(group) !== region) return false;
      if (!q) return true;
      const values = [
        group.group_name,
        group.group_key,
        group.commercial_poc,
        ...(Array.isArray(group.venues) ? group.venues.map((venue) => venue.venue_name) : []),
      ];
      return values.some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [registeredGroups, query, region]);
  const groups = useMemo(() => groupRows(visibleCases, visibleRegisteredGroups), [visibleCases, visibleRegisteredGroups]);
  const eligibleCases = visibleCases.filter(countsTowardGroupMetrics);
  const portfolioScore = weightedScore(visibleCases);
  const approvedCeiling = eligibleCases.reduce((sum, c) => sum + recommendedCeiling(c), 0);
  const venueTotal = groups.reduce((sum, group) => sum + displayVenueCount(group), 0);

  function toggle(key) {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div style={{ padding: "28px 24px" }}>
      <h1
        style={{
          fontSize: "var(--mz-fs-h1)",
          fontWeight: 900,
          color: "var(--mz-text-on-page)",
          margin: 0,
          marginBottom: 6,
          letterSpacing: "-0.3px",
        }}
      >
        Portfolio Overview
      </h1>
      <p className="mz-subheader" style={{ margin: 0 }}>
        Group-first summary of every venue case, tracker date, and lending metric.
      </p>

      <DashboardTabs />
      <DashboardControls region={region} onRegionChange={setRegion} />

      <CaseSearchBox
        value={query}
        onChange={setQuery}
        resultCount={visibleCases.length + visibleRegisteredGroups.length}
        totalCount={regionCases.length + registeredGroups.length}
      />

      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <Tile label="Groups" value={groups.length} />
        <Tile label="Venues" value={venueTotal} />
        <Tile label="Approved Venues" value={eligibleCases.length} />
        <Tile
          label="Weighted Score"
          value={portfolioScore != null ? `${portfolioScore.toFixed(1)} / ${gradeForScore(portfolioScore)}` : "-"}
          color={scoreColor(portfolioScore)}
        />
        <Tile label="Approved Ceiling" value={money(approvedCeiling)} color={lendingAmountColor(approvedCeiling)} />
      </div>

      <div className="mz-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "14px 22px",
            borderBottom: "1px solid var(--mz-accent-15)",
            background: "linear-gradient(90deg, var(--mz-accent-06), transparent)",
          }}
        >
          <span className="mz-eyebrow">Case Breakdown</span>
          <div style={{ color: "var(--mz-muted)", fontSize: "var(--mz-fs-xs)", marginTop: 6 }}>
            Group metrics include only approved or accepted venues. Pending, rejected, declined, and document-requested venues remain visible but excluded from score and ceiling.
          </div>
        </div>

        {loading && (
          <div style={emptyState}>
            Loading cases...
          </div>
        )}

        {error && (
          <div style={{ padding: 22 }}>
            <div style={errorBox}>
              Failed to load cases: {error}
            </div>
          </div>
        )}

        {!loading && !error && cases.length === 0 && registeredGroups.length === 0 && (
          <div style={emptyState}>
            No cases or registered groups found.
          </div>
        )}

        {!loading && !error && (cases.length > 0 || registeredGroups.length > 0) && groups.length === 0 && (
          <div style={emptyState}>
            No groups match your search.
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1260 }}>
              <thead>
                <tr style={{ background: "var(--mz-card-subtle)" }}>
                  {[
                    "Group / Venue",
                    "Region",
                    "Venues",
                    "Score",
                    "Grade",
                    "Weight",
                    "Recommended Ceiling",
                    "Status",
                    "Submitted",
                    "First Response",
                    "Verdict",
                    "Decision",
                    "",
                  ].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(({ key, region: groupRegion, group, rows, registryVenues }) => {
                  const isOpen = !!expanded[key];
                  const metrics = groupMetrics(rows);
                  const currency = currencyForRegion(groupRegion);
                  const submitted = latestDate(rows, (dates) => dates.submitted);
                  const firstResponse = latestDate(rows, (dates) => dates.firstResponse);
                  const verdict = latestDate(rows, (dates) => dates.verdict);
                  const registeredOnlyVenues = registryVenuesWithoutCases({ rows, registryVenues });
                  const venueCount = displayVenueCount({ rows, registryVenues });

                  return (
                    <Fragment key={key}>
                      <tr style={{ borderTop: "1px solid var(--mz-border-soft)", background: "rgba(255,255,255,0.02)" }}>
                        <td style={{ ...td, fontWeight: 900 }}>
                          <button
                            onClick={() => toggle(key)}
                            className="mz-clickable"
                            style={{ padding: "4px 8px", marginRight: 10 }}
                            aria-expanded={isOpen}
                          >
                            {isOpen ? "-" : "+"}
                          </button>
                          {group}
                        </td>
                        <td style={td}><RegionBadge region={groupRegion} /></td>
                        <td style={td} className="mz-mono">{venueCount}</td>
                        <td style={{ ...td, color: scoreColor(metrics.score), fontWeight: 900 }} className="mz-mono">
                          {metrics.score != null ? metrics.score.toFixed(1) : "-"}
                        </td>
                        <td style={td}>{metrics.grade}</td>
                        <td style={td}>{metrics.eligible.length} included</td>
                        <td style={{ ...td, color: lendingAmountColor(metrics.ceiling), fontWeight: 900 }} className="mz-mono">
                          {money(metrics.ceiling, currency)}
                        </td>
                        <td style={td}>
                          {rows.length === 0 ? (
                            <span style={mutedText}>Registered</span>
                          ) : metrics.eligible.length === rows.length ? (
                            <StatusBadge status="approved" />
                          ) : (
                            <span style={mutedText}>{metrics.eligible.length} / {rows.length} approved</span>
                          )}
                        </td>
                        <td style={td}>{formatTrackerDate(submitted)}</td>
                        <td style={td}>{formatTrackerDate(firstResponse)}</td>
                        <td style={td}>{formatTrackerDate(verdict)}</td>
                        <td style={td}>
                          {rows.length === 0
                            ? "Awaiting case data"
                            : metrics.eligible.length
                              ? "Included in lending model"
                              : "Not in lending model"}
                        </td>
                        <td style={td}>
                          <Link
                            className="mz-clickable"
                            href={`/new-case?group_name=${encodeURIComponent(group)}&region=${encodeURIComponent(groupRegion)}`}
                            style={smallAction}
                          >
                            Add venue
                          </Link>
                        </td>
                      </tr>

                      {isOpen && rows.map((c) => {
                        const dates = trackerDates(c);
                        const eligible = countsTowardGroupMetrics(c);
                        const ceiling = recommendedCeiling(c);
                        const rationale = rationaleText(c);
                        const score = Number(c.score);
                        return (
                          <tr key={c.id} style={{ borderTop: "1px solid var(--mz-border-subtle)" }}>
                            <td style={{ ...td, paddingLeft: 54 }}>
                              <Link href={`/cases/${c.id}`} style={{ color: "var(--mz-text)", textDecoration: "none" }}>
                                <span className="mz-mono" style={{ color: "var(--mz-accent)", fontWeight: 900 }}>
                                  {shortCaseRef(c)}
                                </span>
                                <span style={{ marginLeft: 10, fontWeight: 800 }}>{caseVenue(c)}</span>
                              </Link>
                            </td>
                            <td style={td}>-</td>
                            <td style={td} className="mz-mono">1</td>
                            <td style={{ ...td, color: scoreColor(score), fontWeight: 900 }} className="mz-mono">
                              {Number.isFinite(score) ? score.toFixed(1) : "-"}
                            </td>
                            <td style={td}>{c.grade || gradeForScore(score)}</td>
                            <td style={td}>{venueWeight(c, metrics)}</td>
                            <td style={{ ...td, color: eligible ? lendingAmountColor(ceiling) : "var(--mz-muted)", fontWeight: 900 }} className="mz-mono">
                              {eligible ? money(ceiling, currency) : "Excluded"}
                            </td>
                            <td style={td}><StatusBadge status={c.status} /></td>
                            <td style={td}>{formatTrackerDate(dates.submitted)}</td>
                            <td style={td}>{formatTrackerDate(dates.firstResponse)}</td>
                            <td style={td}>{formatTrackerDate(dates.verdict)}</td>
                            <td style={{ ...td, maxWidth: 280 }}>
                              <div style={{ fontWeight: 800 }}>{decisionText(c)}</div>
                              {rationale && (
                                <div style={{ ...mutedText, marginTop: 4 }}>
                                  {String(rationale).slice(0, 120)}
                                </div>
                              )}
                            </td>
                            <td style={td}>
                              <Link className="mz-clickable" href={`/cases/${c.id}`} style={smallAction}>
                                Open
                              </Link>
                            </td>
                          </tr>
                        );
                      })}

                      {isOpen && registeredOnlyVenues.map((venue) => (
                        <tr key={`registered:${venue.id}`} style={{ borderTop: "1px solid var(--mz-border-subtle)" }}>
                          <td style={{ ...td, paddingLeft: 54 }}>
                            <span style={{ fontWeight: 800 }}>{venue.venue_name}</span>
                            <div style={{ ...mutedText, marginTop: 4 }}>Registered venue, case pending</div>
                          </td>
                          <td style={td}>-</td>
                          <td style={td} className="mz-mono">1</td>
                          <td style={td}>-</td>
                          <td style={td}>-</td>
                          <td style={td}>No case yet</td>
                          <td style={td}>-</td>
                          <td style={td}><StatusBadge status={venue.status || "active"} /></td>
                          <td style={td}>-</td>
                          <td style={td}>-</td>
                          <td style={td}>-</td>
                          <td style={td}>Awaiting case data</td>
                          <td style={td}>
                            <Link
                              className="mz-clickable"
                              href={`/new-case?group_name=${encodeURIComponent(group)}&venue_name=${encodeURIComponent(venue.venue_name)}&region=${encodeURIComponent(groupRegion)}`}
                              style={smallAction}
                            >
                              Start case
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const emptyState = {
  padding: 28,
  color: "var(--mz-muted)",
  fontSize: "var(--mz-fs-sm)",
};

const errorBox = {
  padding: "12px 16px",
  borderRadius: "var(--mz-radius-md)",
  background: "var(--mz-red-bg)",
  border: "1px solid var(--mz-red-border)",
  color: "var(--mz-red-text)",
  fontSize: "var(--mz-fs-sm)",
};

const th = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: "var(--mz-fs-xxs)",
  fontWeight: 800,
  color: "var(--mz-muted)",
  textTransform: "uppercase",
  letterSpacing: 1.2,
  borderBottom: "1px solid var(--mz-border-soft)",
};

const td = {
  padding: "13px 14px",
  fontSize: "var(--mz-fs-sm)",
  color: "var(--mz-text)",
  verticalAlign: "top",
};

const mutedText = {
  color: "var(--mz-muted)",
  fontSize: "var(--mz-fs-xs)",
};

const smallAction = {
  padding: "6px 10px",
  textDecoration: "none",
  whiteSpace: "nowrap",
  display: "inline-flex",
};
