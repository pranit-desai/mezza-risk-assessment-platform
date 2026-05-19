"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

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

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/cases`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setCases(data);
      } catch (e) {
        setError(e.message || "Failed to load cases");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalCases = cases.length;
  const totalRev = cases.reduce(
    (s, c) => s + (Number(c.ltm_revenue_aed) || 0), 0);
  const totalCeiling = cases.reduce((s, c) => s + (Number(c.ceiling_aed) || 0), 0);
  const avgScore =
    totalCases > 0
      ? cases.reduce((s, c) => s + (Number(c.score) || 0), 0) / totalCases
      : 0;

  const Tile = ({ label, value, accent }) => (
    <div className="mz-card" style={{ flex: 1, minWidth: 0 }}>
      <div className="mz-eyebrow" style={{ color: accent ? "var(--mz-accent)" : "var(--mz-muted)" }}>
        {label}
      </div>
      <div
        className="mz-mono"
        style={{
          fontSize: "var(--mz-fs-stat)",
          fontWeight: 900,
          color: accent ? "var(--mz-accent)" : "var(--mz-text)",
          marginTop: 8,
          letterSpacing: "-0.5px",
        }}
      >
        {value}
      </div>
    </div>
  );

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
      <p
        className="mz-subheader"
        style={{ margin: 0, marginBottom: 24 }}
      >
        Live snapshot of every venue case in the risk pipeline.
      </p>

      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <Tile label="Total Cases" value={totalCases} />
        <Tile label="Avg Score" value={avgScore > 0 ? avgScore.toFixed(1) : "—"} />
        <Tile label="Total LTM Revenue" value={fm(totalRev)} />
        <Tile label="Total Ceiling" value={fm(totalCeiling)} accent />
      </div>

      <div className="mz-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "14px 22px",
            borderBottom: "1px solid var(--mz-accent-15)",
            background: "linear-gradient(90deg, var(--mz-accent-06), transparent)",
          }}
        >
          <span className="mz-eyebrow">Cases</span>
        </div>

        {loading && (
          <div style={{ padding: 28, color: "var(--mz-muted)", fontSize: "var(--mz-fs-sm)" }}>
            Loading cases...
          </div>
        )}

        {error && (
          <div style={{ padding: 22 }}>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "var(--mz-radius-md)",
                background: "var(--mz-red-bg)",
                border: "1px solid var(--mz-red-border)",
                color: "var(--mz-red-text)",
                fontSize: "var(--mz-fs-sm)",
              }}
            >
              Failed to load cases: {error}
            </div>
          </div>
        )}

        {!loading && !error && cases.length === 0 && (
          <div style={{ padding: 28, color: "var(--mz-muted)", fontSize: "var(--mz-fs-sm)" }}>
            No cases found.
          </div>
        )}

        {!loading && cases.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr style={{ background: "var(--mz-card-subtle)" }}>
                  {["Case Ref", "Venue", "Group", "Score", "Grade", "Ceiling (AED)", "Status"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "var(--mz-fs-xxs)",
                        fontWeight: 500,
                        color: "var(--mz-muted)",
                        textTransform: "uppercase",
                        letterSpacing: 1.4,
                        borderBottom: "1px solid var(--mz-border-soft)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: "1px solid var(--mz-border-subtle)",
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontSize: "var(--mz-fs-sm)" }}>
                      <Link
                        href={`/cases/${c.case_ref || c.id}`}
                        className="mz-mono"
                        style={{
                          color: "var(--mz-accent)",
                          fontWeight: 700,
                          transition: "color 0.15s",
                        }}
                      >
                        {c.case_ref || c.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "var(--mz-fs-sm)", color: "var(--mz-text)", fontWeight: 600 }}>
                      {c.venue_name || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "var(--mz-fs-sm)", color: "var(--mz-muted)" }}>
                      {c.group_name || "—"}
                    </td>
                    <td
                      className="mz-mono"
                      style={{
                        padding: "12px 16px",
                        fontSize: "var(--mz-fs-body)",
                        fontWeight: 800,
                        color: scoreColor(c.score),
                      }}
                    >
                      {c.score != null ? Number(c.score).toFixed(1) : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "var(--mz-fs-sm)" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 6,
                          background: scoreColor(c.score) + "25",
                          color: scoreColor(c.score),
                          fontWeight: 700,
                          fontSize: "var(--mz-fs-xs)",
                          border: "1px solid " + scoreColor(c.score) + "40",
                        }}
                      >
                        {c.grade || "—"}
                      </span>
                    </td>
                    <td
                      className="mz-mono"
                      style={{
                        padding: "12px 16px",
                        fontSize: "var(--mz-fs-sm)",
                        fontWeight: 700,
                        color: "var(--mz-accent)",
                      }}
                    >
                      {fm(c.ceiling_aed)}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "var(--mz-fs-sm)", color: "var(--mz-muted)" }}>
                      {c.status || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}