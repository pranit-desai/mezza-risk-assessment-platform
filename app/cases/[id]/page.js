"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import DashboardModal from "../../_components/DashboardModal";
import StatusBadge from "../../_components/StatusBadge";
import {
  buildDocumentItems,
  documentStatusLabel,
  documentStatusTone,
  formatDocumentDate,
} from "../../_lib/documentWorkflow";

function fm(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n >= 1e6) return "AED " + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "AED " + (n / 1e3).toFixed(1) + "K";
  return "AED " + Number(n).toLocaleString("en-AE");
}

function scoreColor(s) {
  if (s == null) return "var(--mz-muted)";
  if (s >= 90) return "var(--mz-tier-excellent-plus)";
  if (s >= 80) return "var(--mz-tier-excellent)";
  if (s >= 70) return "var(--mz-tier-above-avg)";
  if (s >= 60) return "var(--mz-tier-average)";
  if (s >= 50) return "var(--mz-tier-below-avg)";
  if (s >= 25) return "var(--mz-tier-poor)";
  return "var(--mz-tier-critical)";
}

// Analyst-clickable status transitions.
// System-set statuses (new, uploading, extracting, data_bank_ready, rejected, expired)
// are NOT shown as buttons — they appear only as the current status label.
const ANALYST_STATUSES = [
  { value: "under_review", label: "Under Review" },
  { value: "additional_documents_requested", label: "Additional Documents Requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "on_hold", label: "On Hold" },
];

function KpiCard({ label, value, sub, color, danger, mono }) {
  const accent = danger ? "var(--mz-tier-critical)" : color || "var(--mz-accent)";
  return (
    <div className="mz-card" style={{ minWidth: 0 }}>
      <div className="mz-eyebrow">{label}</div>
      <div
        className={mono ? "mz-mono" : ""}
        style={{
          fontSize: "var(--mz-fs-stat)",
          fontWeight: 900,
          color: accent,
          marginTop: 8,
          letterSpacing: "-0.5px",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "var(--mz-fs-xs)", color: "var(--mz-muted)", marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

function DocumentAlertStrip({ items, error }) {
  const alertItems = items.filter((item) => (
    item.pendingRequest ||
    item.providedVisible ||
    item.expiryStatus === "missing" ||
    item.expiryStatus === "expired" ||
    item.expiryStatus === "expiring"
  ));

  return (
    <div
      className="mz-card"
      style={{
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 220 }}>
        <div className="mz-eyebrow">Document Expiry</div>
        <div style={{ color: "var(--mz-muted)", fontSize: "var(--mz-fs-xs)", marginTop: 4 }}>
          90-day cap window / 7-day renewal warning
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
        {error && <DocumentChip label={error} tone="amber" />}
        {!error && alertItems.length === 0 && <DocumentChip label="Required docs clear" tone="green" />}
        {alertItems.map((item) => (
          <DocumentChip
            key={`${item.caseId}:${item.documentType}`}
            label={`${item.label}: ${documentSummary(item)}`}
            tone={documentStatusTone(item)}
          />
        ))}
      </div>

      <Link href="/documents" className="mz-clickable" style={{ padding: "8px 12px" }}>
        Open Documents
      </Link>
    </div>
  );
}

function DocumentChip({ label, tone }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 30,
        padding: "5px 9px",
        borderRadius: 8,
        background: toneBackground(tone),
        border: `1px solid ${toneBorder(tone)}`,
        color: toneColor(tone),
        fontSize: "var(--mz-fs-xs)",
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

function documentSummary(item) {
  if (item.providedVisible) return "provided";
  if (item.pendingRequest) return "pending";
  if (!item.expiryDate) return documentStatusLabel(item);
  if (item.daysToExpiry < 0) return `expired ${formatDocumentDate(item.expiryDate)}`;
  if (item.daysToExpiry <= 7) return `expires in ${item.daysToExpiry}d`;
  if (item.daysToExpiry <= 90) return `cap window ${formatDocumentDate(item.expiryDate)}`;
  return documentStatusLabel(item);
}

function toneBackground(tone) {
  if (tone === "green") return "var(--mz-green-bg)";
  if (tone === "red") return "var(--mz-red-bg)";
  if (tone === "amber") return "var(--mz-amber-bg)";
  return "rgba(255,255,255,0.04)";
}

function toneBorder(tone) {
  if (tone === "green") return "var(--mz-green-border)";
  if (tone === "red") return "var(--mz-red-border)";
  if (tone === "amber") return "var(--mz-amber-border)";
  return "var(--mz-border-input)";
}

function toneColor(tone) {
  if (tone === "green") return "var(--mz-green-text)";
  if (tone === "red") return "var(--mz-red-text)";
  if (tone === "amber") return "var(--mz-amber-text)";
  return "var(--mz-muted)";
}

export default function CaseOverviewPage() {
  const params = useParams();
  const caseId = params?.id;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [documentBundle, setDocumentBundle] = useState({ documents: [], requests: [] });
  const [documentError, setDocumentError] = useState("");
  const [dashboardUrl, setDashboardUrl] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setDocumentError("");
      const [res, documentsRes] = await Promise.all([
        fetch(`/api/cases/${caseId}`, { cache: "no-store" }),
        fetch(`/api/cases/${caseId}/documents`, { cache: "no-store" }),
      ]);
      if (!res.ok) throw new Error(`Failed to fetch case: ${res.status}`);
      const data = await res.json();
      setCaseData(data);
      if (documentsRes.ok) {
        setDocumentBundle(await documentsRes.json());
      } else {
        setDocumentBundle({ documents: [], requests: [] });
        setDocumentError(`Documents unavailable: ${documentsRes.status}`);
      }
    } catch (err) {
      setError(err.message || "Failed to load case");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return undefined;
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [caseId, load]);

  async function updateStatus(newStatus) {
    if (!caseData) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/cases/${caseData.id}/field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: "status",
          old_value: caseData.status,
          new_value: newStatus,
          changed_by: "Pranit",
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Status update failed: ${res.status} — ${body.slice(0, 200)}`);
      }
      const updated = await res.json();
      setCaseData(updated);
    } catch (err) {
      alert(err.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "28px 24px", color: "var(--mz-muted)" }}>
        Loading case...
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div style={{ padding: "28px 24px" }}>
        <Link
          href="/"
          style={{
            color: "var(--mz-muted)",
            fontSize: "var(--mz-fs-xs)",
            textTransform: "uppercase",
            letterSpacing: 1.5,
            fontWeight: 700,
          }}
        >
          ← Back to Dashboard
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
          {error || "Case not found"}
        </div>
      </div>
    );
  }

  const crossChecks = caseData.extracted_json?.cross_checks || {};
  const documentItems = buildDocumentItems(
    caseData,
    documentBundle?.documents || [],
    documentBundle?.requests || []
  );
  return (
    <div style={{ padding: "28px 24px" }}>
      <Link
        href="/"
        style={{
          color: "var(--mz-muted)",
          fontSize: "var(--mz-fs-xs)",
          textTransform: "uppercase",
          letterSpacing: 1.5,
          fontWeight: 700,
        }}
      >
        ← Back to Dashboard
      </Link>

      <div style={{ marginTop: 18, marginBottom: 22 }}>
        <div className="mz-eyebrow mz-mono">{caseData.case_ref}</div>
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
        <div className="mz-subheader" style={{ marginTop: 6 }}>
          {caseData.group_name} · {caseData.location} · {caseData.concept || "—"}
        </div>
      </div>

      <DocumentAlertStrip items={documentItems} error={documentError} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 14 }}>
        <KpiCard
          label="Mezza Score"
          value={caseData.score != null ? Number(caseData.score).toFixed(1) : "—"}
          sub={`Grade ${caseData.grade || "—"}`}
          color={scoreColor(caseData.score)}
          mono
        />
        <KpiCard
          label="Lending Ceiling"
          value={fm(caseData.ceiling_aed)}
          sub="Approved disbursal cap"
          color="var(--mz-accent)"
          mono
        />
        <KpiCard
          label="LTM Revenue"
          value={fm(caseData.extracted_json?.pos_headline?.net_revenue_ex_tax)}
          sub="Trailing 12 months"
          color="var(--mz-text)"
          mono
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 22 }}>
        <KpiCard
          label="Financial Health"
          value={
            caseData.extracted_json?.credit_score?.financial_health_score != null
              ? Number(caseData.extracted_json.credit_score.financial_health_score).toFixed(1)
              : "—"
          }
          sub="Component score"
          color={scoreColor(caseData.extracted_json?.credit_score?.financial_health_score)}
          mono
        />
        <KpiCard
          label="Restaurant Profile"
          value={
            caseData.extracted_json?.credit_score?.restaurant_profile_score != null
              ? Number(caseData.extracted_json.credit_score.restaurant_profile_score).toFixed(1)
              : "—"
          }
          sub="Component score"
          color={scoreColor(caseData.extracted_json?.credit_score?.restaurant_profile_score)}
          mono
        />
        <KpiCard
          label="Trade Licence"
          value={crossChecks.tl_status || "—"}
          sub={crossChecks.tl_flag || "No TL flag"}
          danger={crossChecks.tl_status === "EXPIRED" || crossChecks.tl_status === "expired"}
        />
      </div>

      <div style={{ marginBottom: 22, display: "flex", gap: 12 }}>
        <Link
          href={`/cases/${caseData.id}/data-bank`}
          className="mz-clickable"
          style={{ padding: "10px 18px", display: "inline-block" }}
        >
          Open Data Bank →
        </Link>
        <button
          type="button"
          className="mz-clickable"
          onClick={() => setDashboardUrl(`/api/dashboards/venue/${caseData.id}`)}
          style={{ padding: "10px 18px", cursor: "pointer" }}
        >
          Open Risk Dashboard
        </button>
      </div>

      <div className="mz-card">
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="mz-eyebrow">Analyst Status Controls</div>
            <div style={{ fontSize: "var(--mz-fs-xs)", color: "var(--mz-muted)", marginTop: 4 }}>
              Each click writes a row to audit_log.
            </div>
          </div>
          <div style={{ fontSize: "var(--mz-fs-xs)", color: "var(--mz-muted)" }}>
            Current: <StatusBadge status={caseData.status} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ANALYST_STATUSES.map((s) => {
            const active = s.value === caseData.status;
            return (
              <button
                key={s.value}
                onClick={() => updateStatus(s.value)}
                disabled={updatingStatus}
                className={`mz-clickable ${active ? "active" : ""}`}
                style={{
                  padding: "8px 14px",
                  cursor: updatingStatus ? "wait" : "pointer",
                  opacity: updatingStatus ? 0.5 : 1,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16, fontSize: "var(--mz-fs-xs)", color: "var(--mz-muted)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--mz-accent-peach)" }}>System-set states</strong> (not clickable here):
          {" "}new, uploading, extracting, data_bank_ready, additional_documents_requested, rejected (auto-policy), expired.
          {" "}Use the Data Bank to trigger ingestion-stage transitions.
        </div>
      </div>
      <DashboardModal
        title={`${caseData.venue_name || "Venue"} Risk Dashboard`}
        url={dashboardUrl}
        onClose={() => setDashboardUrl("")}
      />
    </div>
  );
}
