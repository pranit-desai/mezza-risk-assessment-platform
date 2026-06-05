"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import CaseSearchBox from "./_components/CaseSearchBox";
import { filterCasesByQuery } from "./_lib/caseSearch";
import {
  caseGroup,
  caseRegion,
  formatCurrencyAmount,
  lendingAmountColor,
  recommendedCeiling,
  scoreColor,
} from "./_lib/casePresentation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function money(n, currency) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return formatCurrencyAmount(n, currency);
}

function gradeForScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 80) return "A";
  if (value >= 70) return "B+";
  if (value >= 60) return "B";
  if (value >= 50) return "C";
  return "NM";
}

function pct(n) {
  const value = Number(n || 0);
  return `${value.toFixed(1)}%`;
}

function StatCard({ label, value, color, sub, featured }) {
  return (
    <div className="mz-card" style={{ ...statCard, borderColor: featured ? "var(--mz-accent-40)" : "rgba(80, 50, 38, 0.48)" }}>
      <div className="mz-eyebrow" style={{ color: featured ? "var(--mz-accent)" : "var(--mz-muted)" }}>
        {label}
      </div>
      <div
        className="mz-mono"
        style={{
          fontSize: 29,
          fontWeight: 900,
          color: color || "var(--mz-text)",
          marginTop: 10,
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ color: "var(--mz-muted)", fontSize: "var(--mz-fs-xs)", marginTop: 7 }}>{sub}</div>}
    </div>
  );
}

function groupRows(cases) {
  const map = new Map();
  for (const c of cases) {
    const group = caseGroup(c);
    if (!map.has(group)) map.set(group, []);
    map.get(group).push(c);
  }
  return Array.from(map.entries()).map(([group, rows], index) => {
    const revenue = rows.reduce((sum, c) => sum + (Number(c.ltm_revenue_aed) || 0), 0);
    const disbursal = rows.reduce((sum, c) => sum + recommendedCeiling(c), 0);
    const scoreValues = rows.map((c) => Number(c.score)).filter((n) => Number.isFinite(n));
    const score = scoreValues.length ? scoreValues.reduce((sum, n) => sum + n, 0) / scoreValues.length : null;
    return { group, rows, revenue, disbursal, score, color: chartColors[index % chartColors.length] };
  }).sort((a, b) => b.disbursal - a.disbursal);
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div style={pageWrap} />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const region = (searchParams.get("region") || "All").toUpperCase();
  const [cases, setCases] = useState([]);
  const [query, setQuery] = useState("");
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

  const regionCases = useMemo(() => {
    if (region === "ALL") return cases;
    return cases.filter((c) => caseRegion(c) === region);
  }, [cases, region]);
  const visibleCases = useMemo(() => filterCasesByQuery(regionCases, query), [regionCases, query]);
  const groups = useMemo(() => groupRows(visibleCases), [visibleCases]);
  const displayCurrency = region === "USA" ? "USD" : "AED";

  const totalCases = visibleCases.length;
  const totalGroups = groups.length;
  const totalRev = visibleCases.reduce(
    (s, c) => s + (Number(c.ltm_revenue_aed) || 0), 0);
  const totalCeiling = visibleCases.reduce((s, c) => s + recommendedCeiling(c), 0);
  const avgScore =
    totalCases > 0
      ? visibleCases.reduce((s, c) => s + (Number(c.score) || 0), 0) / totalCases
      : 0;

  return (
    <div style={pageWrap}>
      <section style={statsGrid}>
        <StatCard label="Groups" value={totalGroups} />
        <StatCard label="Venues" value={totalCases} />
        <StatCard label="Total Revenue" value={money(totalRev, displayCurrency)} />
        <StatCard label="Portfolio Mezza" value={`${avgScore > 0 ? avgScore.toFixed(1) : "—"} / ${gradeForScore(avgScore)}`} color={scoreColor(avgScore)} />
        <StatCard
          label="Total Disbursal (Recommended)"
          value={money(totalCeiling, displayCurrency)}
          color="var(--mz-accent)"
          sub={`${totalRev ? pct((totalCeiling / totalRev) * 100) : "0.0%"} of LTM`}
          featured
        />
      </section>

      <div style={subControls}>
        <button className="mz-clickable active" style={smallPill}>By Group</button>
        <button className="mz-clickable" style={smallPill}>By Grade</button>
        <button className="mz-clickable" style={smallPill}>Monthly Approvals</button>
      </div>

      <CaseSearchBox
        value={query}
        onChange={setQuery}
        resultCount={visibleCases.length}
        totalCount={cases.length}
      />

      <div className="mz-card" style={{ padding: 0, overflow: "hidden", borderColor: "rgba(80, 50, 38, 0.48)" }}>
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--mz-accent-15)",
          }}
        >
          <span className="mz-eyebrow">Group Disbursal Breakdown</span>
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

        {!loading && !error && regionCases.length === 0 && (
          <div style={{ padding: 28, color: "var(--mz-muted)", fontSize: "var(--mz-fs-sm)" }}>
            No cases found.
          </div>
        )}

        {!loading && !error && cases.length > 0 && visibleCases.length === 0 && (
          <div style={{ padding: 28, color: "var(--mz-muted)", fontSize: "var(--mz-fs-sm)" }}>
            No cases match your search.
          </div>
        )}

        {!loading && visibleCases.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr>
                  {["Group", "Revenue", "Mezza", "Type", "Disbursal", "% of Rev"].map((h) => (
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
                {groups.map((g) => (
                  <tr
                    key={g.group}
                    style={{
                      borderBottom: "1px solid var(--mz-border-subtle)",
                    }}
                  >
                    <td style={{ padding: "14px 16px", fontSize: "var(--mz-fs-sm)", color: "var(--mz-text)", fontWeight: 900 }}>
                      <span style={{ ...dot, background: g.color }} />
                      <Link href={`/groups/${encodeURIComponent(g.group.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))}`}>
                        {g.group}
                      </Link>
                    </td>
                    <td className="mz-mono" style={tableCell}>
                      {money(g.revenue, displayCurrency)}
                    </td>
                    <td
                      className="mz-mono"
                      style={{
                        ...tableCell,
                        color: scoreColor(g.score),
                        fontWeight: 900,
                      }}
                    >
                      {g.score == null ? "—" : `${g.score.toFixed(1)} ${gradeForScore(g.score)}`}
                    </td>
                    <td style={{ ...tableCell, color: "var(--mz-accent)", fontWeight: 900 }}>
                      Recommended
                    </td>
                    <td
                      className="mz-mono"
                      style={{
                        ...tableCell,
                        fontWeight: 900,
                        color: lendingAmountColor(g.disbursal),
                      }}
                    >
                      {money(g.disbursal, displayCurrency)}
                    </td>
                    <td className="mz-mono" style={{ ...tableCell, color: "var(--mz-muted)" }}>
                      {g.revenue ? pct((g.disbursal / g.revenue) * 100) : "0.0%"}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...tableCell, color: "var(--mz-accent)", fontWeight: 900 }}>Total</td>
                  <td className="mz-mono" style={{ ...tableCell, color: "var(--mz-accent)", fontWeight: 900 }}>{money(totalRev, displayCurrency)}</td>
                  <td style={tableCell}>-</td>
                  <td style={tableCell}>-</td>
                  <td className="mz-mono" style={{ ...tableCell, color: "var(--mz-accent)", fontWeight: 900 }}>{money(totalCeiling, displayCurrency)}</td>
                  <td className="mz-mono" style={{ ...tableCell, color: "var(--mz-muted)" }}>{totalRev ? pct((totalCeiling / totalRev) * 100) : "0.0%"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const pageWrap = {
  maxWidth: 1400,
  margin: "0 auto",
  padding: "20px 26px 40px",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const statCard = {
  minHeight: 138,
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const subControls = {
  display: "flex",
  gap: 8,
  marginBottom: 10,
};

const smallPill = {
  height: 28,
  minWidth: 80,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
};

const tableCell = {
  padding: "14px 16px",
  fontSize: "var(--mz-fs-sm)",
  color: "var(--mz-text)",
};

const dot = {
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: 3,
  marginRight: 10,
};

const chartColors = [
  "var(--mz-chart-1)",
  "var(--mz-chart-2)",
  "var(--mz-chart-9)",
  "var(--mz-chart-5)",
  "var(--mz-chart-10)",
  "var(--mz-ai-accent)",
  "var(--mz-chart-4)",
  "var(--mz-chart-7)",
];
