"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DATA_BANK_GROUPS,
  DATA_BANK_SECTIONS,
  SECTIONS_BY_ID,
} from "../../../_lib/dataBankSchema";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// ---------------------------------------------------------------------------
// Path / value helpers
// ---------------------------------------------------------------------------
function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[key];
  }, obj);
}

// Resolve a "section_id.field_key" mirror reference against the full extracted_json
function resolveMirror(mirroredFrom, extracted) {
  if (!mirroredFrom) return undefined;
  const [sectionId, fieldKey] = mirroredFrom.split(".");
  const section = SECTIONS_BY_ID[sectionId];
  if (!section) return undefined;
  const sectionData = getByPath(extracted, section.jsonPath) || {};
  return sectionData[fieldKey];
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
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
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    case "boolean":
      return value ? "Yes" : "No";
    case "text":
    default:
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// Completeness computation
// ---------------------------------------------------------------------------
function computeCompleteness(section, extracted) {
  const data = getByPath(extracted, section.jsonPath);

  if (data === undefined || data === null) return "missing";
  if (typeof data === "object" && data.error) return "failed";
  if (typeof data !== "object") return "failed";

  const requiredFields = section.fields.filter((f) => f.required);
  if (requiredFields.length === 0) return "complete";

  const missing = requiredFields.filter((f) => {
    const v = data[f.key];
    return v === undefined || v === null || v === "";
  });

  if (missing.length === 0) return "complete";
  if (missing.length === requiredFields.length) return "missing";
  return "partial";
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
      return {
        bg: "rgba(255, 255, 255, 0.04)",
        border: "var(--mz-border)",
        color: "var(--mz-muted)",
      };
  }
}

const COMPLETENESS_LABEL = {
  complete: "Complete",
  partial: "Partial",
  missing: "Missing",
  failed: "Failed",
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DataBankPage() {
  const params = useParams();
  const caseId = params?.id;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSectionId, setActiveSectionId] = useState(
    DATA_BANK_SECTIONS[0].id,
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}`, {
        cache: "no-store",
      });
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
    if (caseId) load();
  }, [caseId, load]);

  // Reload the case after a successful override (cheaper than mutating local state
  // because the backend may have side effects we want reflected exactly)
  const onOverrideSaved = useCallback((updatedCase) => {
    setCaseData(updatedCase);
  }, []);

  const extracted = caseData?.extracted_json || {};

  // Group sections for the sub-nav
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
    return (
      <div className="px-8 py-8 text-sm text-[color:var(--mz-muted)]">
        Loading data bank...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-8 py-8">
        <Link
          href={`/cases/${caseId}`}
          className="mb-6 inline-block text-xs uppercase tracking-widest text-[color:var(--mz-muted)] hover:text-[color:var(--mz-accent)]"
        >
          ← Back to Case File
        </Link>
        <div
          className="rounded-xl border p-4 text-sm"
          style={{
            backgroundColor: "var(--mz-red-bg)",
            borderColor: "var(--mz-red-border)",
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
    <div className="px-8 py-8">
      <Link
        href={`/cases/${caseId}`}
        className="mb-6 inline-block text-xs uppercase tracking-widest text-[color:var(--mz-muted)] hover:text-[color:var(--mz-accent)]"
      >
        ← Back to Case File
      </Link>

      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-[color:var(--mz-accent)]">
          Data Bank · {caseData.case_ref}
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-[color:var(--mz-text)]">
          {caseData.venue_name}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--mz-muted)]">
          Extracted and reasoned data. Click a field's pencil icon to override.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Inner sub-nav */}
        <aside
          className="w-64 shrink-0 rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--mz-card)",
            borderColor: "var(--mz-border)",
          }}
        >
          {DATA_BANK_GROUPS.map((group) => {
            const sections = sectionsByGroup.get(group.id) || [];
            if (sections.length === 0) return null;
            return (
              <div key={group.id} className="mb-4 last:mb-0">
                <div className="mb-2 px-2 text-xs uppercase tracking-widest text-[color:var(--mz-muted)]">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {sections.map((section) => {
                    const completeness = computeCompleteness(section, extracted);
                    const badge = badgeStyle(completeness);
                    const isActive = section.id === activeSectionId;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSectionId(section.id)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition"
                        style={{
                          backgroundColor: isActive
                            ? "rgba(0, 196, 159, 0.08)"
                            : "transparent",
                          color: isActive
                            ? "var(--mz-accent)"
                            : "var(--mz-text)",
                        }}
                      >
                        <span>{section.label}</span>
                        <span
                          className="h-2 w-2 rounded-full"
                          title={COMPLETENESS_LABEL[completeness]}
                          style={{ backgroundColor: badge.color }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>

        {/* Section content */}
        <main className="flex-1 min-w-0">
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

// ---------------------------------------------------------------------------
// SectionView — renders one section's fields
// ---------------------------------------------------------------------------
function SectionView({ section, caseId, extracted, onOverrideSaved }) {
  const sectionData = getByPath(extracted, section.jsonPath) || {};
  const completeness = computeCompleteness(section, extracted);
  const badge = badgeStyle(completeness);

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        backgroundColor: "var(--mz-card)",
        borderColor: "var(--mz-border)",
      }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[color:var(--mz-text)]">
            {section.label}
          </h2>
          <p className="mt-1 text-xs text-[color:var(--mz-muted)]">
            extracted_json.{section.jsonPath}
          </p>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-xs"
          style={{
            backgroundColor: badge.bg,
            borderColor: badge.border,
            color: badge.color,
          }}
        >
          {COMPLETENESS_LABEL[completeness]}
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--mz-border)" }}>
        {section.fields.map((field) => {
          const rawValue = field.mirroredFrom
            ? resolveMirror(field.mirroredFrom, extracted)
            : sectionData[field.key];

          return (
            <FieldRow
              key={field.key}
              field={field}
              value={rawValue}
              caseId={caseId}
              fieldPath={
                field.mirroredFrom
                  ? null // mirrored fields never become editable here
                  : `${section.jsonPath}.${field.key}`
              }
              onOverrideSaved={onOverrideSaved}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldRow — one row, optionally editable
// ---------------------------------------------------------------------------
function FieldRow({ field, value, caseId, fieldPath, onOverrideSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState("");

  const canEdit = field.editable && !field.mirroredFrom && fieldPath;

  function startEdit() {
    setRowError("");
    if (field.type === "boolean") {
      setDraft(value ? "true" : "false");
    } else if (value === null || value === undefined) {
      setDraft("");
    } else {
      setDraft(String(value));
    }
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft("");
    setRowError("");
  }

  function coerceDraft() {
    // Convert the string draft to the right JS type before sending to the API
    const raw = draft.trim();
    if (raw === "") return null;
    switch (field.type) {
      case "number":
      case "currency":
      case "percent": {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          throw new Error("Must be a number");
        }
        return n;
      }
      case "boolean":
        return raw === "true" || raw === "yes" || raw === "1";
      case "date":
      case "text":
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
      const res = await fetch(
        `${API_BASE_URL}/cases/${caseId}/extracted-field`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field_path: fieldPath,
            old_value: value === undefined ? null : value,
            new_value: newValue,
            changed_by: "Pranit",
          }),
        },
      );

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        setRowError(
          `Conflict: current value is "${body.detail?.current_value ?? "?"}". Click Cancel and reopen.`,
        );
        setSaving(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

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
    <div className="grid grid-cols-12 gap-4 py-3">
      <div className="col-span-4 flex items-center text-sm text-[color:var(--mz-muted)]">
        {field.label}
        {field.required && (
          <span
            className="ml-2 text-xs"
            style={{ color: "var(--mz-amber-text)" }}
          >
            *
          </span>
        )}
      </div>

      <div className="col-span-7 flex items-center">
        {editing ? (
          <div className="flex w-full items-center gap-2">
            {field.type === "boolean" ? (
              <select
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="rounded border bg-transparent px-2 py-1 text-sm"
                style={{
                  borderColor: "var(--mz-border)",
                  color: "var(--mz-text)",
                }}
                autoFocus
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                type={
                  field.type === "number" ||
                  field.type === "currency" ||
                  field.type === "percent"
                    ? "number"
                    : "text"
                }
                step="any"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") cancelEdit();
                }}
                className="w-full rounded border bg-transparent px-2 py-1 text-sm mz-mono"
                style={{
                  borderColor: "var(--mz-border)",
                  color: "var(--mz-text)",
                }}
                autoFocus
              />
            )}
            <button
              onClick={save}
              disabled={saving}
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
              style={{
                backgroundColor: "rgba(0, 196, 159, 0.1)",
                borderColor: "var(--mz-accent)",
                color: "var(--mz-accent)",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
              style={{
                borderColor: "var(--mz-border)",
                color: "var(--mz-muted)",
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <span
            className="mz-mono text-sm"
            style={{ color: "var(--mz-text)" }}
          >
            {formatValue(value, field.type)}
            {field.mirroredFrom && (
              <span
                className="ml-2 text-xs"
                style={{ color: "var(--mz-muted)" }}
              >
                (mirrored)
              </span>
            )}
          </span>
        )}
      </div>

      <div className="col-span-1 flex items-center justify-end">
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            title="Edit"
            className="rounded border px-2 py-1 text-xs hover:opacity-80"
            style={{
              borderColor: "var(--mz-border)",
              color: "var(--mz-muted)",
            }}
          >
            ✎
          </button>
        )}
      </div>

      {rowError && (
        <div
          className="col-span-12 text-xs"
          style={{ color: "var(--mz-red-text)" }}
        >
          {rowError}
        </div>
      )}
    </div>
  );
}