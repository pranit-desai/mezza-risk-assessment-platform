"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import CaseSearchBox from "./_components/CaseSearchBox";
import DashboardControls from "./_components/DashboardControls";
import DashboardModal from "./_components/DashboardModal";
import DashboardTabs from "./_components/DashboardTabs";
import RegionBadge from "./_components/RegionBadge";
import { filterCasesByQuery } from "./_lib/caseSearch";
import {
  caseGroup,
  caseRegion,
  caseVenue,
  currencyForRegion,
  formatCurrencyAmount,
  formatTrackerDate,
  lendingAmountColor,
  recommendedCeiling,
  scoreColor,
  shortCaseRef,
  statusLabel,
  statusStyle,
} from "./_lib/casePresentation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const ELIGIBLE_STATUSES = new Set(["approved", "accepted"]);
const REGION_OPTIONS = ["UAE", "USA"];
const STATUS_OPTIONS = [
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "on_hold", label: "On Hold" },
  { value: "additional_documents_requested", label: "Additional Documents" },
];
const STATUS_VALUES = new Set(STATUS_OPTIONS.map((option) => option.value));
const CHANGED_BY = "Pranit";
const AUDITED_FIELDS = new Set(["submission_date", "verdict_date"]);
const LOCAL_CASE_FIELDS = new Set(["region", "submission_date", "verdict_date", "status"]);

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
  if (value >= 75) return "B+";
  if (value >= 70) return "B";
  if (value >= 65) return "C+";
  return "NM";
}

function gradeColor(grade, score) {
  const value = Number(score);
  if (Number.isFinite(value)) return scoreColor(value);
  const key = String(grade || "").trim().toUpperCase();
  if (key === "A") return scoreColor(85);
  if (key === "B+") return scoreColor(76);
  if (key === "B") return scoreColor(72);
  if (key === "C+" || key === "C") return scoreColor(66);
  if (key === "NM") return scoreColor(20);
  return "var(--mz-muted)";
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

function dateFromRows(rows, fieldName, direction = "asc") {
  const values = rows
    .map((row) => dateInputValue(row[fieldName]))
    .filter(Boolean)
    .sort();

  if (!values.length) return "";
  return direction === "desc" ? values.at(-1) : values[0];
}

function earliestDateValue(rows, fieldName) {
  return dateFromRows(rows, fieldName, "asc");
}

function latestDateValue(rows, fieldName) {
  return dateFromRows(rows, fieldName, "desc");
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

function dateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function aggregateStatus(rows) {
  if (!rows.length) return "";
  const statuses = new Set(rows.map((row) => normalizeStatus(row.status)));
  if (statuses.size === 1) return Array.from(statuses)[0];
  return "";
}

function validStatusValue(value) {
  const status = normalizeStatus(value);
  return STATUS_VALUES.has(status) ? status : "";
}

function groupCaseStatus(registeredGroup, rows) {
  return validStatusValue(registeredGroup?.case_status) || aggregateStatus(rows) || "under_review";
}

function optionsWithCurrent(options, value, labelForValue = statusLabel) {
  if (!value || options.some((option) => option.value === value)) return options;
  return [{ value, label: labelForValue(value) }, ...options];
}

function fieldKey(id, fieldName) {
  return `${id}:${fieldName}`;
}

function apiFieldValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function groupFieldSaving(rows, savingFields, fieldName) {
  return rows.some((row) => savingFields[fieldKey(row.id, fieldName)]);
}

function fieldStamp(row, auditStamps, fieldName) {
  return auditStamps[fieldKey(row.id, fieldName)] || row?._audit_stamps?.[fieldName] || null;
}

function SelectControl({ label, value, options, onChange, disabled, color, mixedLabel }) {
  const renderedOptions = optionsWithCurrent(options, value);
  return (
    <select
      aria-label={label}
      value={value || ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      style={{
        ...controlSelect,
        color: color || "var(--mz-text)",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {mixedLabel && <option value="">{mixedLabel}</option>}
      {renderedOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function StatusSelect({ value, onChange, disabled, label, mixedLabel }) {
  return (
    <SelectControl
      label={label}
      value={value}
      options={STATUS_OPTIONS}
      onChange={onChange}
      disabled={disabled}
      mixedLabel={mixedLabel}
      color={value ? statusStyle(value).color : "var(--mz-muted)"}
    />
  );
}

function RegionSelect({ value, onChange, disabled, label }) {
  return (
    <select
      aria-label={label}
      value={value || "UAE"}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      style={{
        ...controlSelect,
        width: 92,
        color: value === "USA" ? "var(--mz-region-usa-text)" : "var(--mz-region-uae-text)",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {REGION_OPTIONS.map((option) => {
        return (
          <option key={option} value={option}>
            {option}
          </option>
        );
      })}
    </select>
  );
}

function formatAuditTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuditStamp({ stamp }) {
  const text = stamp ? `${stamp.by} · ${formatAuditTime(stamp.at)}` : "No date audit yet";
  return <div style={{ ...mutedText, marginTop: 5 }}>{text}</div>;
}

function DateEditor({ label, value, onSave, disabled, stamp }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(dateInputValue(value));
  const displayValue = formatTrackerDate(value);

  function startEditing() {
    setDraft(dateInputValue(value));
    setEditing(true);
  }

  async function save() {
    const success = await onSave(draft || null);
    if (success) setEditing(false);
  }

  if (!editing) {
    return (
      <div>
        <div style={dateDisplay}>
          <span className="mz-mono">{displayValue}</span>
          <button type="button" className="mz-clickable" onClick={startEditing} disabled={disabled} style={miniButton}>
            Edit
          </button>
        </div>
        <AuditStamp stamp={stamp} />
      </div>
    );
  }

  return (
    <div>
      <input
        aria-label={label}
        type="date"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        style={{
          ...dateControl,
          opacity: disabled ? 0.55 : 1,
        }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button type="button" className="mz-clickable" onClick={save} disabled={disabled} style={miniButton}>
          Save
        </button>
        <button type="button" className="mz-clickable" onClick={() => setEditing(false)} disabled={disabled} style={miniButton}>
          Cancel
        </button>
      </div>
      <AuditStamp stamp={stamp} />
    </div>
  );
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
  const [mutationError, setMutationError] = useState("");
  const [savingFields, setSavingFields] = useState({});
  const [auditStamps, setAuditStamps] = useState({});
  const [dashboardFrame, setDashboardFrame] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [casesRes, groupsRes] = await Promise.all([
          fetch("/api/cases", { cache: "no-store" }),
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

  function setFieldSaving(caseId, fieldName, saving) {
    setSavingFields((current) => {
      const next = { ...current };
      if (saving) {
        next[fieldKey(caseId, fieldName)] = true;
      } else {
        delete next[fieldKey(caseId, fieldName)];
      }
      return next;
    });
  }

  async function updateCaseField(c, fieldName, newValue) {
    if (!c?.id) return false;
    const oldValue = c[fieldName] ?? null;
    if ((oldValue ?? "") === (newValue ?? "")) return true;

    setMutationError("");
    setFieldSaving(c.id, fieldName, true);
    try {
      const fieldUrl = LOCAL_CASE_FIELDS.has(fieldName)
        ? `/api/cases/${c.id}/field`
        : `${API_BASE_URL}/cases/${c.id}/field`;
      const res = await fetch(fieldUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: fieldName,
          old_value: apiFieldValue(oldValue),
          new_value: apiFieldValue(newValue),
          changed_by: CHANGED_BY,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Update failed (${res.status}): ${body.slice(0, 180)}`);
      }

      const updated = await res.json();
      const localValue = newValue === "" ? null : newValue;
      setCases((current) => current.map((row) => {
        if (row.id !== c.id) return row;
        const merged = { ...row, ...updated, [fieldName]: localValue };
        if (!LOCAL_CASE_FIELDS.has(fieldName)) {
          for (const localField of LOCAL_CASE_FIELDS) {
            if (row[localField] !== undefined) merged[localField] = row[localField];
          }
        }
        return merged;
      }));
      if (AUDITED_FIELDS.has(fieldName)) {
        setAuditStamps((current) => ({
          ...current,
          [fieldKey(c.id, fieldName)]: { by: CHANGED_BY, at: new Date().toISOString() },
        }));
      }
      return true;
    } catch (err) {
      const message = err.message || "Failed to update case";
      setMutationError(message);
      alert(message);
      return false;
    } finally {
      setFieldSaving(c.id, fieldName, false);
    }
  }

  async function updateRegisteredGroupRegion(registeredGroup, nextRegion) {
    if (!registeredGroup?.id || nextRegion === caseRegion(registeredGroup)) return true;
    setMutationError("");
    setFieldSaving(registeredGroup.id, "region", true);
    try {
      const res = await fetch(`/api/groups/${registeredGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: nextRegion }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Group region update failed (${res.status})`);
      }

      setRegisteredGroups((current) => current.map((group) => (group.id === body.id ? body : group)));
      return true;
    } catch (err) {
      const message = err.message || "Failed to update registered group region";
      setMutationError(message);
      alert(message);
      return false;
    } finally {
      setFieldSaving(registeredGroup.id, "region", false);
    }
  }

  async function updateRegisteredGroupStatus(registeredGroup, nextStatus) {
    const status = validStatusValue(nextStatus);
    if (!registeredGroup?.id || !status || status === validStatusValue(registeredGroup.case_status)) return true;

    setMutationError("");
    setFieldSaving(registeredGroup.id, "case_status", true);
    try {
      const res = await fetch(`/api/groups/${registeredGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_status: status }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Group status update failed (${res.status})`);
      }

      setRegisteredGroups((current) => current.map((group) => (group.id === body.id ? body : group)));
      return true;
    } catch (err) {
      const message = err.message || "Failed to update registered group status";
      setMutationError(message);
      alert(message);
      return false;
    } finally {
      setFieldSaving(registeredGroup.id, "case_status", false);
    }
  }

  async function updateGroupRegion(rows, nextRegion, groupName, currentRegion, registeredGroup = null) {
    if (nextRegion === currentRegion) return;
    const confirmed = window.confirm(
      rows.length > 0
        ? `Change ${groupName} from ${currentRegion} to ${nextRegion} for ${rows.length} venue case${rows.length === 1 ? "" : "s"}?`
        : `Change ${groupName} from ${currentRegion} to ${nextRegion}?`
    );
    if (!confirmed) return;

    if (registeredGroup) {
      const registrySuccess = await updateRegisteredGroupRegion(registeredGroup, nextRegion);
      if (!registrySuccess) return;
    }

    for (const row of rows) {
      const success = await updateCaseField(row, "region", nextRegion);
      if (!success) return;
    }
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

        {mutationError && !error && (
          <div style={{ padding: "0 22px 16px" }}>
            <div style={errorBox}>
              {mutationError}
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
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1120 }}>
              <thead>
                <tr style={{ background: "var(--mz-card-subtle)" }}>
                  {[
                    "Group / Venue",
                    "Region",
                    "Venues",
                    "Score",
                    "Grade",
                    "Rec. Ceiling",
                    "Submitted",
                    "Verdict",
                    "Status",
                    "",
                  ].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(({ key, region: groupRegion, group, rows, registryVenues, registeredGroup }) => {
                  const isOpen = !!expanded[key];
                  const metrics = groupMetrics(rows);
                  const currency = currencyForRegion(groupRegion);
                  const submitted = earliestDateValue(rows, "submission_date");
                  const verdict = latestDateValue(rows, "verdict_date");
                  const registeredOnlyVenues = registryVenuesWithoutCases({ rows, registryVenues });
                  const venueCount = displayVenueCount({ rows, registryVenues });
                  const groupStatus = groupCaseStatus(registeredGroup, rows);
                  const statusSaving = registeredGroup ? !!savingFields[fieldKey(registeredGroup.id, "case_status")] : false;
                  const regionSaving = groupFieldSaving(rows, savingFields, "region");
                  const registryRegionSaving = registeredGroup ? !!savingFields[fieldKey(registeredGroup.id, "region")] : false;
                  const dashboardGroupId = registeredGroup?.id || key;

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
                        <td style={td}>
                          {rows.length > 0 || registeredGroup ? (
                            <RegionSelect
                              value={groupRegion}
                              disabled={regionSaving || registryRegionSaving}
                              label={`${group} region`}
                              onChange={(nextRegion) => updateGroupRegion(rows, nextRegion, group, groupRegion, registeredGroup)}
                            />
                          ) : (
                            <RegionBadge region={groupRegion} />
                          )}
                        </td>
                        <td style={td} className="mz-mono">{venueCount}</td>
                        <td style={{ ...td, color: scoreColor(metrics.score), fontWeight: 900 }} className="mz-mono">
                          {metrics.score != null ? metrics.score.toFixed(1) : "-"}
                        </td>
                        <td style={{ ...td, color: gradeColor(metrics.grade, metrics.score), fontWeight: 900 }}>
                          {metrics.grade}
                        </td>
                        <td style={{ ...td, color: lendingAmountColor(metrics.ceiling), fontWeight: 900 }} className="mz-mono">
                          {money(metrics.ceiling, currency)}
                        </td>
                        <td style={td}>
                          <span className="mz-mono">{formatTrackerDate(submitted)}</span>
                        </td>
                        <td style={td}>
                          <span className="mz-mono">{formatTrackerDate(verdict)}</span>
                        </td>
                        <td style={td}>
                          {registeredGroup ? (
                            <StatusSelect
                              value={groupStatus}
                              disabled={statusSaving}
                              label={`${group} status`}
                              onChange={(nextStatus) => updateRegisteredGroupStatus(registeredGroup, nextStatus)}
                            />
                          ) : (
                            <span style={{ ...mutedText, color: statusStyle(groupStatus).color }}>{statusLabel(groupStatus)}</span>
                          )}
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="mz-clickable"
                              onClick={() => setDashboardFrame({
                                title: `${group} Group Dashboard`,
                                url: `/api/dashboards/group/${encodeURIComponent(dashboardGroupId)}`,
                              })}
                              style={{ ...smallAction, cursor: "pointer" }}
                            >
                              Dashboard
                            </button>
                          <Link
                            className="mz-clickable"
                            href={`/new-case?group_name=${encodeURIComponent(group)}&region=${encodeURIComponent(groupRegion)}`}
                            style={smallAction}
                          >
                            Add venue
                          </Link>
                          </div>
                        </td>
                      </tr>

                      {isOpen && rows.map((c) => {
                        const eligible = countsTowardGroupMetrics(c);
                        const ceiling = recommendedCeiling(c);
                        const score = Number(c.score);
                        const currentStatus = normalizeStatus(c.status);
                        const rowStatusSaving = !!savingFields[fieldKey(c.id, "status")];
                        const submittedSaving = !!savingFields[fieldKey(c.id, "submission_date")];
                        const verdictSaving = !!savingFields[fieldKey(c.id, "verdict_date")];
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
                            <td style={td}>
                              <RegionBadge region={caseRegion(c)} />
                            </td>
                            <td style={td} className="mz-mono">1</td>
                            <td style={{ ...td, color: scoreColor(score), fontWeight: 900 }} className="mz-mono">
                              {Number.isFinite(score) ? score.toFixed(1) : "-"}
                            </td>
                            <td style={{ ...td, color: gradeColor(c.grade, score), fontWeight: 900 }}>
                              {c.grade || gradeForScore(score)}
                            </td>
                            <td style={{ ...td, color: eligible ? lendingAmountColor(ceiling) : "var(--mz-muted)", fontWeight: 900 }} className="mz-mono">
                              {eligible ? money(ceiling, currency) : "Excluded"}
                            </td>
                            <td style={td}>
                              <DateEditor
                                label={`${caseVenue(c)} submitted date`}
                                value={c.submission_date}
                                disabled={submittedSaving}
                                stamp={fieldStamp(c, auditStamps, "submission_date")}
                                onSave={(value) => updateCaseField(c, "submission_date", value)}
                              />
                            </td>
                            <td style={td}>
                              <DateEditor
                                label={`${caseVenue(c)} verdict date`}
                                value={c.verdict_date}
                                disabled={verdictSaving}
                                stamp={fieldStamp(c, auditStamps, "verdict_date")}
                                onSave={(value) => updateCaseField(c, "verdict_date", value)}
                              />
                            </td>
                            <td style={{ ...td, maxWidth: 280 }}>
                              <StatusSelect
                                value={currentStatus}
                                disabled={rowStatusSaving}
                                label={`${caseVenue(c)} status`}
                                onChange={(nextStatus) => updateCaseField(c, "status", nextStatus)}
                              />
                            </td>
                            <td style={td}>
                              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  className="mz-clickable"
                                  onClick={() => setDashboardFrame({
                                    title: `${caseVenue(c)} Risk Dashboard`,
                                    url: `/api/dashboards/venue/${c.id}`,
                                  })}
                                  style={{ ...smallAction, cursor: "pointer" }}
                                >
                                  Dashboard
                                </button>
                                <Link className="mz-clickable" href={`/cases/${c.id}`} style={smallAction}>
                                  Open
                                </Link>
                              </div>
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
                          <td style={td}><RegionBadge region={groupRegion} /></td>
                          <td style={td} className="mz-mono">1</td>
                          <td style={td}>-</td>
                          <td style={td}>-</td>
                          <td style={td}>-</td>
                          <td style={td}>-</td>
                          <td style={td}>-</td>
                          <td style={td}><span style={mutedText}>Registered</span></td>
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
      <DashboardModal
        title={dashboardFrame?.title || "Risk Dashboard"}
        url={dashboardFrame?.url || ""}
        onClose={() => setDashboardFrame(null)}
      />
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
  whiteSpace: "nowrap",
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

const controlSelect = {
  width: 148,
  minHeight: 31,
  padding: "5px 8px",
  fontSize: "var(--mz-fs-xs)",
  fontWeight: 800,
};

const dateControl = {
  width: 132,
  minHeight: 31,
  padding: "5px 8px",
  fontSize: "var(--mz-fs-xs)",
  fontWeight: 700,
};

const dateDisplay = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 31,
};

const miniButton = {
  padding: "4px 8px",
  fontSize: "var(--mz-fs-xxs)",
  fontWeight: 800,
};
