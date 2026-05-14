"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function DashboardPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE_URL}/cases`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch cases: ${res.status}`);
        const data = await res.json();
        setCases(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Failed to load cases");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalCases = cases.length;
  const avgScore =
    cases.length > 0
      ? (
          cases.reduce((s, c) => s + (Number(c.score) || 0), 0) / cases.length
        ).toFixed(1)
      : "—";
  const totalCeiling = cases.reduce(
    (s, c) => s + (Number(c.ceiling_aed) || 0),
    0,
  );

  const statusCounts = cases.reduce((acc, c) => {
    const k = c.status || "unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const statusEntries = Object.entries(statusCounts).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-[color:var(--mz-muted)]">
          Dashboard
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-[color:var(--mz-text)]">
          Portfolio Overview
        </h1>
        <p className="mt-2 text-sm text-[color:var(--mz-muted)]">
          Live case database. Click a row to open the case file.
        </p>
      </div>

      {error && (
        <div
          className="mb-6 rounded-xl border p-4 text-sm"
          style={{
            backgroundColor: "var(--mz-red-bg)",
            borderColor: "var(--mz-red-border)",
            color: "var(--mz-red-text)",
          }}
        >
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatTile label="Total Cases" value={loading ? "…" : totalCases} />
        <StatTile
          label="Average Score"
          value={loading ? "…" : avgScore}
          accent
        />
        <StatTile
          label="Aggregate Ceiling"
          value={loading ? "…" : formatAED(totalCeiling)}
          small
        />
        <StatTile
          label="Statuses"
          value={
            loading
              ? "…"
              : statusEntries.length === 0
                ? "—"
                : `${statusEntries[0][0]} (${statusEntries[0][1]})`
          }
          small
        />
      </div>

      <div
        className="rounded-2xl border"
        style={{
          backgroundColor: "var(--mz-card)",
          borderColor: "var(--mz-border)",
        }}
      >
        <div
          className="border-b px-6 py-4 text-xs uppercase tracking-widest text-[color:var(--mz-muted)]"
          style={{ borderColor: "var(--mz-border)" }}
        >
          Cases
        </div>

        {loading ? (
          <div className="p-6 text-sm text-[color:var(--mz-muted)]">
            Loading cases...
          </div>
        ) : cases.length === 0 ? (
          <div className="p-6 text-sm text-[color:var(--mz-muted)]">
            No cases yet.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr
                className="text-left text-xs uppercase tracking-widest text-[color:var(--mz-muted)]"
                style={{ borderBottom: "1px solid var(--mz-border)" }}
              >
                <th className="px-6 py-3 font-medium">Case Ref</th>
                <th className="px-6 py-3 font-medium">Venue</th>
                <th className="px-6 py-3 font-medium">Group</th>
                <th className="px-6 py-3 font-medium">Score</th>
                <th className="px-6 py-3 font-medium">Grade</th>
                <th className="px-6 py-3 font-medium">Ceiling</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const badge = statusBadgeStyle(c.status);
                return (
                  <tr
                    key={c.id}
                    className="text-sm transition hover:bg-white/[0.02]"
                    style={{ borderBottom: "1px solid var(--mz-border)" }}
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/cases/${c.case_ref || c.id}`}
                        className="mz-mono text-[color:var(--mz-accent)] hover:underline"
                      >
                        {c.case_ref || "—"}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-[color:var(--mz-text)]">
                      {c.venue_name || "—"}
                    </td>
                    <td className="px-6 py-4 text-[color:var(--mz-muted)]">
                      {c.group_name || "—"}
                    </td>
                    <td className="px-6 py-4 mz-mono text-[color:var(--mz-accent)]">
                      {c.score ?? "—"}
                    </td>
                    <td className="px-6 py-4 mz-mono text-[color:var(--mz-text)]">
                      {c.grade || "—"}
                    </td>
                    <td className="px-6 py-4 mz-mono text-[color:var(--mz-text)]">
                      {formatAED(c.ceiling_aed)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="rounded-full border px-2.5 py-1 text-xs"
                        style={{
                          backgroundColor: badge.bg,
                          borderColor: badge.border,
                          color: badge.color,
                        }}
                      >
                        {c.status || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, accent = false, small = false }) {
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
        className={`mt-3 mz-mono font-semibold ${small ? "text-xl" : "text-3xl"}`}
        style={{
          color: accent ? "var(--mz-accent)" : "var(--mz-text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}