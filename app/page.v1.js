"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function formatAED(value) {
  if (value === null || value === undefined) return "—";
  return `AED ${Number(value).toLocaleString("en-AE")}`;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-AE");
}

export default function Home() {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadCases() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE_URL}/cases`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch cases: ${res.status}`);
      }

      const data = await res.json();
      setCases(data);

      if (data.length > 0) {
        await loadCaseDetail(data[0].id);
      }
    } catch (err) {
      setError(err.message || "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }

  async function loadCaseDetail(caseId) {
    try {
      setDetailLoading(true);
      setError("");

      const res = await fetch(`${API_BASE_URL}/cases/${caseId}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch case detail: ${res.status}`);
      }

      const data = await res.json();
      setSelectedCase(data);
    } catch (err) {
      setError(err.message || "Failed to load case detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateStatus(newStatus) {
    if (!selectedCase) return;

    try {
      setSaving(true);
      setError("");

      const res = await fetch(`${API_BASE_URL}/cases/${selectedCase.id}/field`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          field_name: "status",
          old_value: selectedCase.status,
          new_value: newStatus,
          changed_by: "Pranit",
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update status: ${res.status}`);
      }

      const updated = await res.json();
      setSelectedCase(updated);
      await loadCases();
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  const extracted = selectedCase?.extracted_json || {};
  const creditScore = extracted.credit_score || {};
  const posHeadline = extracted.pos_headline || {};
  const crossChecks = extracted.cross_checks || {};
  const outstandingQueries = creditScore.outstanding_queries || [];
  const scoreBreakdown = creditScore.score_breakdown || [];

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-white/10 bg-[#040d18] p-6">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 font-bold text-[#04342c]">
              M
            </div>
            <div>
              <div className="text-xl font-semibold">Mezza</div>
              <div className="text-xs text-slate-400">Risk Assessment Platform</div>
            </div>
          </div>

          <div className="mb-3 text-xs uppercase tracking-widest text-slate-500">
            Cases
          </div>

          <div className="space-y-2">
            {cases.map((item) => (
              <button
                key={item.id}
                onClick={() => loadCaseDetail(item.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedCase?.id === item.id
                    ? "border-emerald-400/40 bg-emerald-400/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="text-sm font-semibold">{item.venue_name}</div>
                <div className="mt-1 text-xs text-slate-400">{item.case_ref}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs">
                    {item.grade}
                  </span>
                  <span className="text-xs text-emerald-300">{item.score}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1 p-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-emerald-300">
                Live Supabase Case Data
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {selectedCase?.venue_name || "Loading case..."}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {selectedCase?.group_name || "—"} · {selectedCase?.location || "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-widest text-slate-500">
                API Status
              </div>
              <div className="mt-1 text-sm text-emerald-300">Connected</div>
              <div className="mt-1 text-xs text-slate-500">{API_BASE_URL}</div>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading || detailLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-slate-300">
              Loading live case data...
            </div>
          ) : selectedCase ? (
            <>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#0d1929] p-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Score
                  </div>
                  <div className="mt-3 text-4xl font-semibold text-emerald-300">
                    {selectedCase.score}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Grade {selectedCase.grade}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0d1929] p-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Ceiling
                  </div>
                  <div className="mt-3 text-2xl font-semibold">
                    {formatAED(selectedCase.ceiling_aed)}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {creditScore.ceiling_basis || "Risk-based exposure"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0d1929] p-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Status
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-amber-300">
                    {selectedCase.status}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Updates write to audit_log
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0d1929] p-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    LTM Revenue
                  </div>
                  <div className="mt-3 text-2xl font-semibold">
                    {formatAED(creditScore.ltm_revenue_aed)}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Card share {posHeadline.card_share_pct || creditScore.card_share_pct || "—"}%
                  </div>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-[#0d1929] p-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Financial Health
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-emerald-300">
                    {creditScore.financial_health_score || "—"}
                  </div>
                  <div className="text-sm text-slate-400">
                    Grade {creditScore.financial_health_grade || "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0d1929] p-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Restaurant Profile
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-indigo-300">
                    {creditScore.restaurant_profile_score || "—"}
                  </div>
                  <div className="text-sm text-slate-400">
                    Grade {creditScore.restaurant_profile_grade || "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0d1929] p-5">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    Trade Licence
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-red-300">
                    {crossChecks.tl_status || "—"}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {crossChecks.tl_flag || "No TL flag available"}
                  </div>
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-white/10 bg-[#0d1929] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500">
                      Analyst Status Controls
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      These buttons call PATCH /cases/&lbrace;id&rbrace;/field and create audit_log rows.
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {saving ? "Saving..." : "Ready"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {["data_bank_ready", "under_review", "approved", "rejected"].map((status) => (
                    <button
                      key={status}
                      onClick={() => updateStatus(status)}
                      disabled={saving || selectedCase.status === status}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Set {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#0d1929] p-5">
                  <div className="mb-4 text-xs uppercase tracking-widest text-slate-500">
                    Score Breakdown
                  </div>

                  <div className="space-y-3">
                    {scoreBreakdown.map((row, index) => (
                      <div key={index} className="rounded-xl bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{row.category}</div>
                          <div className="text-sm text-emerald-300">
                            {row.score}/{row.max}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-slate-400">{row.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0d1929] p-5">
                  <div className="mb-4 text-xs uppercase tracking-widest text-slate-500">
                    Outstanding Queries
                  </div>

                  <div className="space-y-3">
                    {outstandingQueries.map((item, index) => (
                      <div key={index} className="rounded-xl bg-white/[0.03] p-4">
                        <div className="mb-2 inline-flex rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-300">
                          {item.priority}
                        </div>
                        <div className="text-sm text-slate-300">{item.query}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8">
              No cases found.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
