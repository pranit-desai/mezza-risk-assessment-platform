"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DATA_BANK_GROUPS,
  DATA_BANK_SECTIONS,
  SECTIONS_BY_ID,
} from "../../../_lib/dataBankSchema";

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[key];
  }, obj);
}

function resolveMirror(mirroredFrom, extracted) {
  if (!mirroredFrom) return undefined;
  const [sectionId, fieldKey] = mirroredFrom.split(".");
  const section = SECTIONS_BY_ID[sectionId];
  if (!section) return undefined;
  const sectionData = getByPath(extracted, section.jsonPath) || {};
  return sectionData[fieldKey];
}

function formatValue(value, type) {
  if (value === null || value === undefined || value === "") return "—";
  switch (type) {
    case "currency":
      return `AED ${Number(value).toLocaleString("en-AE", { maximumFractionDigits: 2 })}`;
    case "number":
      return Number(value).toLocaleString("en-AE");
    case "percent":
      return `${Number(value).toLocaleString("en-AE", { maximumFractionDigits: 2 })}%`;
    case "date": {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
    case "boolean":
      return value ? "Yes" : "No";
    case "text":
    case "enum":
    default:
      return String(value);
  }
}

function computeCompleteness(section, extracted) {
  const data = getByPath(extracted, section.jsonPath);
  if (data === undefined || data === null) return "missing";
  if (typeof data === "object" && data.error) return "failed";
  if (typeof data !== "object") return "failed";
  const requiredFields = (section.fields || []).filter((f) => f.required);
  if (requiredFields.length === 0) return "complete";
  const missing = requiredFields.filter((f) => {
    const v = Array.isArray(data) ? undefined : data[f.key];
    return v === undefined || v === null || v === "";
  });
  if (missing.length === 0) return "complete";
  if (missing.length === requiredFields.length) return "missing";
  return "partial";
}

function getListRowValue(row, field) {
  if (field.key === "_value") return row;
  if (row === null || row === undefined || typeof row !== "object") return undefined;
  return row[field.key];
}

function badgeStyle(completeness) {
  switch (completeness) {
    case "complete":
      return { bg: "var(--mz-green-bg)", border: "var(--mz-green-border)", color: "var(--mz-green-text)" };
    case "partial":
      return { bg: "var(--mz-amber-bg)", border: "var(--mz-amber-border)", color: "var(--mz-amber-text)" };
    case "failed":
      return { bg: "var(--mz-red-bg)", border: "var(--mz-red-border)", color: "var(--mz-red-text)" };
    case "missing":
    default:
      return { bg: "rgba(255,255,255,0.04)", border: "var(--mz-border-input)", color: "var(--mz-muted)" };
  }
}

const COMPLETENESS_LABEL = {
  complete: "Complete",
  partial: "Partial",
  missing: "Missing",
  failed: "Failed",
};

export default function DataBankPage() {
  const params = useParams();
  const caseId = params?.id;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSectionId, setActiveSectionId] = useState(DATA_BANK_SECTIONS[0].id);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/cases/${caseId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch case: ${res.status}`);
      const data = await res.json();
      setCaseData(data);
    } catch (err) {
      setError(err.message || "Failed to load case");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (caseId) load();
  }, [caseId, load]);

  const onOverrideSaved = useCallback((updatedCase) => {
    setCaseData(updatedCase);
  }, []);

  const extracted = caseData?.extracted_json || {};

  const sectionsByGroup = useMemo(() => {
    const map = new Map();
    for (const g of DATA_BANK_GROUPS) map.set(g.id, []);
    for (const s of DATA_BANK_SECTIONS) {
      if (map.has(s.group)) map.get(s.group).push(s);
    }
    return map;
  }, []);

  const activeSection = SECTIONS_BY_ID[activeSectionId];

  if (loading) {
    return <div style={{ padding: "28px 24px", color: "var(--mz-muted)" }}>Loading data bank...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "28px 24px" }}>
        <Link
          href={`/cases/${caseId}`}
          style={{
            color: "var(--mz-muted)",
            fontSize: "var(--mz-fs-xs)",
            textTransform: "uppercase",
            letterSpacing: 1.5,
            fontWeight: 700,
          }}
        >
          ← Back to Case File
        </Link>
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: "var(--mz-radius-md)",
            background: "var(--mz-red-bg)",
            border: "1px solid var(--mz-red-border)",
            color: "var(--mz-red-text)",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (!caseData) return null;

  return (
    <div style={{ padding: "28px 24px" }}>
      <Link
        href={`/cases/${caseId}`}
        style={{
          color: "var(--mz-muted)",
          fontSize: "var(--mz-fs-xs)",
          textTransform: "uppercase",
          letterSpacing: 1.5,
          fontWeight: 700,
        }}
      >
        ← Back to Case File
      </Link>

      <div style={{ marginTop: 18, marginBottom: 22 }}>
        <div className="mz-eyebrow mz-mono">Data Bank · {caseData.case_ref}</div>
        <h1
          style={{
            fontSize: "var(--mz-fs-h1)",
            fontWeight: 900,
            color: "var(--mz-text-on-page)",
            margin: 0,
            marginTop: 6,
            letterSpacing: "-0.3px",
          }}
        >
          {caseData.venue_name}
        </h1>
        <p className="mz-subheader" style={{ margin: 0, marginTop: 6 }}>
          Extracted and reasoned data. Click a field&apos;s pencil icon to override.
        </p>
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <aside className="mz-card" style={{ width: 260, flexShrink: 0, padding: 14 }}>
          {DATA_BANK_GROUPS.map((group) => {
            const sections = sectionsByGroup.get(group.id) || [];
            if (sections.length === 0) return null;
            return (
              <div key={group.id} style={{ marginBottom: 14 }}>
                <div className="mz-eyebrow" style={{ padding: "0 6px", marginBottom: 6 }}>
                  {group.label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {sections.map((section) => {
                    const completeness = computeCompleteness(section, extracted);
                    const badge = badgeStyle(completeness);
                    const isActive = section.id === activeSectionId;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSectionId(section.id)}
                        className={`mz-clickable ${isActive ? "active" : ""}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          textAlign: "left",
                          border: "1px solid transparent",
                        }}
                      >
                        <span>{section.label}</span>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: badge.color,
                            flexShrink: 0,
                          }}
                          title={COMPLETENESS_LABEL[completeness]}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>

        <main style={{ flex: 1, minWidth: 0 }}>
          {activeSection && (
            <SectionView
              section={activeSection}
              caseId={caseData.id}
              extracted={extracted}
              onOverrideSaved={onOverrideSaved}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function SectionView({ section, caseId, extracted, onOverrideSaved }) {
  const sectionData = getByPath(extracted, section.jsonPath) || {};
  const completeness = computeCompleteness(section, extracted);
  const badge = badgeStyle(completeness);
  const rendersAsTable = section.listOf && Array.isArray(sectionData);

  return (
    <div className="mz-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <div>
          <div className="mz-eyebrow" style={{ marginBottom: 4 }}>
            {section.group}
          </div>
          <h2
            style={{
              fontSize: "var(--mz-fs-h2)",
              fontWeight: 500,
              color: "var(--mz-accent-peach)",
              margin: 0,
            }}
          >
            {section.label}
          </h2>
          <p
            className="mz-mono"
            style={{
              fontSize: "var(--mz-fs-xs)",
              color: "var(--mz-muted)",
              margin: 0,
              marginTop: 4,
            }}
          >
            extracted_json.{section.jsonPath}
          </p>
        </div>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 999,
            background: badge.bg,
            border: "1px solid " + badge.border,
            color: badge.color,
            fontSize: "var(--mz-fs-xs)",
            fontWeight: 500,
          }}
        >
          {COMPLETENESS_LABEL[completeness]}
        </span>
      </div>

      {rendersAsTable ? (
        <ListTable section={section} rows={sectionData} />
      ) : (
        <div>
          {(section.fields || []).map((field) => {
            const rawValue = field.mirroredFrom
              ? resolveMirror(field.mirroredFrom, extracted)
              : Array.isArray(sectionData)
                ? undefined
                : sectionData[field.key];
            return (
              <FieldRow
                key={field.key}
                field={field}
                value={rawValue}
                caseId={caseId}
                fieldPath={
                  field.mirroredFrom || section.listOf || Array.isArray(sectionData)
                    ? null
                    : `${section.jsonPath}.${field.key}`
                }
                onOverrideSaved={onOverrideSaved}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListTable({ section, rows }) {
  const fields = section.fields || [];

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: "14px 0",
          color: "var(--mz-muted)",
          fontSize: "var(--mz-fs-sm)",
          borderTop: "1px solid var(--mz-border-soft)",
        }}
      >
        No {section.listOf} records found.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: Math.max(fields.length * 150, 520),
        }}
      >
        <thead>
          <tr>
            {fields.map((field) => (
              <th
                key={field.key}
                scope="col"
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--mz-border-soft)",
                  color: "var(--mz-muted)",
                  fontSize: "var(--mz-fs-xs)",
                  fontWeight: 700,
                  textAlign: "left",
                  textTransform: "uppercase",
                }}
              >
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {fields.map((field) => (
                <td
                  key={field.key}
                  className="mz-mono"
                  style={{
                    padding: "11px 12px",
                    borderBottom: "1px solid var(--mz-border-soft)",
                    color: "var(--mz-text)",
                    fontSize: "var(--mz-fs-sm)",
                    verticalAlign: "top",
                  }}
                >
                  {formatValue(getListRowValue(row, field), field.type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldRow({ field, value, caseId, fieldPath, onOverrideSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState("");

  const canEdit = field.editable && !field.mirroredFrom && fieldPath;

  function startEdit() {
    setRowError("");
    if (field.type === "boolean") setDraft(value ? "true" : "false");
    else if (value === null || value === undefined) setDraft("");
    else setDraft(String(value));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft("");
    setRowError("");
  }

  function coerceDraft() {
    const raw = draft.trim();
    if (raw === "") return null;
    switch (field.type) {
      case "number":
      case "currency":
      case "percent": {
        const n = Number(raw);
        if (Number.isNaN(n)) throw new Error("Must be a number");
        return n;
      }
      case "boolean":
        return raw === "true" || raw === "yes" || raw === "1";
      case "date":
      case "text":
      case "enum":
      default:
        return raw;
    }
  }

  async function save() {
    if (!fieldPath) return;
    setRowError("");
    setSaving(true);
    let newValue;
    try {
      newValue = coerceDraft();
    } catch (err) {
      setRowError(err.message);
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/cases/${caseId}/extracted-field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_path: fieldPath,
          old_value: value === undefined ? null : value,
          new_value: newValue,
          changed_by: "Pranit",
        }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        setRowError(`Conflict: current value is "${body.detail?.current_value ?? "?"}". Click Cancel and reopen.`);
        setSaving(false);
        return;
      }
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const updatedCase = await res.json();
      onOverrideSaved(updatedCase);
      setEditing(false);
      setSaving(false);
    } catch (err) {
      setRowError(err.message || "Save failed");
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "5fr 6fr 1fr",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid var(--mz-border-soft)",
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: "var(--mz-fs-sm)", color: "var(--mz-muted)", display: "flex", alignItems: "center" }}>
        {field.label}
        {field.required && (
          <span style={{ marginLeft: 6, fontSize: "var(--mz-fs-xs)", color: "var(--mz-amber-text)" }}>*</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        {editing ? (
          <div style={{ display: "flex", gap: 8, width: "100%", alignItems: "center" }}>
            {field.type === "boolean" ? (
              <select value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : field.type === "enum" && Array.isArray(field.options) ? (
              <select value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus>
                <option value="">— select —</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={
                  field.type === "number" || field.type === "currency" || field.type === "percent"
                    ? "number"
                    : field.type === "date"
                      ? "date"
                      : "text"
                }
                step="any"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
                className="mz-mono"
                style={{ flex: 1 }}
              />
            )}
            <button
              onClick={save}
              disabled={saving}
              className="mz-clickable active"
              style={{ padding: "6px 12px" }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="mz-clickable"
              style={{ padding: "6px 12px" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <span className="mz-mono" style={{ fontSize: "var(--mz-fs-sm)", color: "var(--mz-text)" }}>
            {formatValue(value, field.type)}
            {field.mirroredFrom && (
              <span style={{ marginLeft: 8, fontSize: "var(--mz-fs-xs)", color: "var(--mz-muted)" }}>
                (mirrored)
              </span>
            )}
            {field.manualFill && value === undefined && (
              <span style={{ marginLeft: 8, fontSize: "var(--mz-fs-xs)", color: "var(--mz-amber-text)" }}>
                (enter manually)
              </span>
            )}
          </span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            title="Edit"
            className="mz-clickable"
            style={{ padding: "4px 10px" }}
          >
            ✎
          </button>
        )}
      </div>

      {rowError && (
        <div
          style={{
            gridColumn: "1 / -1",
            fontSize: "var(--mz-fs-xs)",
            color: "var(--mz-red-text)",
            marginTop: 4,
          }}
        >
          {rowError}
        </div>
      )}
    </div>
  );
}
