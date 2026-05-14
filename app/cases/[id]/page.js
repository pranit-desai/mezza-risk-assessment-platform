"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function formatAED(value) {
  if (value === null || value === undefined) return "—";
  return `AED ${Number(value).toLocaleString("en-AE")}`;
}

function statusBadgeStyle(status) {
  switch (status) {
    case "approved":
      return {
        bg: "var(--mz-green-bg)",
        border: "var(--mz-green-border)",
        color: "var(--mz-green-text)",
      };
    case "rejected":
    case "declined":
    case "expired":
      return {
        bg: "var(--mz-red-bg)",
        border: "var(--mz-red-border)",
        color: "var(--mz-red-text)",
      };
    case "under_review":
    case "extracting":
    case "uploading":
      return {
        bg: "var(--mz-amber-bg)",
        border: "var(--mz-amber-border)",
        color: "var(--mz-amber-text)",
      };
    default:
      return {
        bg: "rgba(255, 255, 255, 0.04)",
        border: "var(--mz-border)",
        color: "var(--mz-muted)",
      };
  }
}

const STATUS_OPTIONS = [
  "data_bank_ready",
  "under_review",
  "approved",
  "rejected",
];

export default function CaseOverviewPage() {
  const params = useParams();
  const caseId = params?.id;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function updateStatus(newStatus) {
    if (!caseData) return;
    try {
      setSaving(true);
      setError("");
      const res = await fetch(`${API_BASE_URL}/cases/${caseData.id}/field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: "status",
          old_value: caseData.status,
          new_value: newStatus,
          changed_by: "Pranit",
        }),
      });
      if (!res.ok) throw new Error(`Failed to update status: ${res.status}`);
      const updated = await res.json();
      setCaseData(updated);
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  const extracted = caseData?.extracted_json || {};
  const creditScore = extracted.credit_score || {};
  const posHeadline = extracted.pos_headline || {};
  const crossChecks = extracted.cross_checks || {};

  const cardSharePct =
    posHeadline.card_share_pct ?? creditScore.card_share_pct ?? null;

  if (loading) {
    return (
      <div className="px-8 py-8 text-sm text-[color:var(--mz-muted)]">
        Loading case...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-8 py-8">
        <Link
          href="/"
          className="mb-6 inline-block text-xs uppercase tracking-widest text-[color:var(--mz-muted)] hover:text-[color:var(--mz-accent)]"
        >
          ← Back to Dashboard
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

  if (!caseData) {
    return (
      <div className="px-8 py-8 text-sm text-[color:var(--mz-muted)]">
        Case not found.
      </div>
    );
  }

  const statusBadge = statusBadgeStyle(caseData.status);

  return (
    <div className="px-8 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-xs uppercase tracking-widest text-[color:var(--mz-muted)] hover:text-[color:var(--mz-accent)]"
      >
        ← Back to Dashboard
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-[color:var(--mz-accent)]">
            Case File · {caseData.case_ref}
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--mz-text)]">
            {caseData.venue_name}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--mz-muted)]">
            {caseData.group_name || "—"} · {caseData.location || "—"} ·{" "}
            {caseData.concept || "—"}
          </p>
        </div>
        <span
          className="rounded-full border px-3 py-1.5 text-xs"
          style={{
            backgroundColor: statusBadge.bg,
            borderColor: statusBadge.border,
            color: statusBadge.color,
          }}
        >
          {caseData.status || "—"}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Score" value={caseData.score ?? "—"} accent big />
        <KpiCard
          label="Grade"
          value={caseData.grade ?? "—"}
          sub={creditScore.ceiling_basis || "Risk-based"}
        />
        <KpiCard
          label="Ceiling"
          value={formatAED(caseData.ceiling_aed)}
          sub={`${creditScore.ceiling_pct_of_revenue ?? "—"}% of LTM revenue`}
        />
        <KpiCard
          label="LTM Revenue"
          value={formatAED(creditScore.ltm_revenue_aed)}
          sub={
            cardSharePct !== null
              ? `Card share ${cardSharePct}%`
              : "Card share —"
          }
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="Financial Health"
          value={creditScore.financial_health_score ?? "—"}
          sub={`Grade ${creditScore.financial_health_grade || "—"}`}
          accent
        />
        <KpiCard
          label="Restaurant Profile"
          value={creditScore.restaurant_profile_score ?? "—"}
          sub={`Grade ${creditScore.restaurant_profile_grade || "—"}`}
          purple
        />
        <KpiCard
          label="Trade Licence"
          value={crossChecks.tl_status || "—"}
          sub={crossChecks.tl_flag || "No TL flag"}
          danger={
            crossChecks.tl_status === "EXPIRED" ||
            crossChecks.tl_status === "expired"
          }
        />
      </div>

      <div
        className="rounded-2xl border p-5"
        style={{
          backgroundColor: "var(--mz-card)",
          borderColor: "var(--mz-border)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-[color:var(--mz-muted)]">
              Analyst Status Controls
            </div>
            <div className="mt-1 text-sm text-[color:var(--mz-muted)]">
              Each click writes a row to audit_log.
            </div>
          </div>
          <div className="text-xs text-[color:var(--mz-muted)]">
            {saving ? "Saving..." : "Ready"}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => updateStatus(status)}
              disabled={saving || caseData.status === status}
              className="rounded-xl border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderColor: "var(--mz-border)",
                color: "var(--mz-text)",
              }}
            >
              Set {status}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent = false,
  purple = false,
  danger = false,
  big = false,
}) {
  let color = "var(--mz-text)";
  if (accent) color = "var(--mz-accent)";
  if (purple) color = "var(--mz-purple)";
  if (danger) color = "var(--mz-red-text)";

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        backgroundColor: "var(--mz-card)",
        borderColor: "var(--mz-border)",
      }}
    >
      <div className="text-xs uppercase tracking-widest text-[color:var(--mz-muted)]">
        {label}
      </div>
      <div
        className={`mt-3 mz-mono font-semibold ${big ? "text-4xl" : "text-2xl"}`}
        style={{ color }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-sm text-[color:var(--mz-muted)]">{sub}</div>
      )}
    </div>
  );
}