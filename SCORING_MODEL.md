# SCORING_MODEL.md — Mezza UAE Risk Scoring Bands

This document captures the full UAE scoring model used by Mezza Risk Assessment to compute composite scores for credit underwriting. Every venue scored under the UAE methodology is evaluated against these bands. The **USA model is separate** and is not represented here — USA underwriting must not request personal credit reports / FICO scores (see AGENTS.md §6.3).

**How the bands work.** Each metric has tiered cut-offs that map to a percentage score (0%, 25%, 50%, 75%, 100%, or in some cases finer tiers). The composite score is a weighted sum across all metrics; weights live in `lib/scoring/` once Phase 5+ is implemented. Some metrics carry **auto-approve** or **auto-reject** thresholds that override the composite score; if any auto-reject is hit, the case is declined regardless of the composite.

**Authoritative source.** This file is the canonical scoring reference. If `lib/scoring/` ever drifts from these bands, the code is wrong, not the file. Update both together.

---

## 1. Prerequisite — Financial Health

### LTM (Last Twelve Months) Revenue of the Company

| Score | Range (AED) |
|---|---|
| 0% | ≤ 2,499,999 |
| 40% | 2,500,000 – 4,999,999 |
| 70% | 5,000,000 – 9,999,999 |
| 100% | ≥ 10,000,000 |

- **Auto-approve:** ≥ 5,000,000
- **Auto-reject:** < 2,500,000

---

## 2. POS Revenue, Volatility and Trend Analysis (Financial Health)

All metrics in this section are computed from Oracle Simphony POS data per AGENTS.md §6.4 (venue-specific VAT/service-charge divisors apply when reconstructing net revenue).

### POS: 12-Month Average Monthly Sales Size (AED)

| Score | Range |
|---|---|
| 0% | < 100,000 |
| 25% | 100,000 – < 210,000 |
| 50% | 210,000 – < 420,000 |
| 75% | 420,000 – < 840,000 |
| 100% | ≥ 840,000 |

- **Auto-reject:** < 210,000

### POS: Average Spend per Head (SPH) (AED)

| Score | Range |
|---|---|
| 0% | < 90 |
| 25% | 90 – < 140 |
| 50% | 140 – < 200 |
| 75% | 200 – < 300 |
| 100% | ≥ 300 |

### POS: Average Spend per Transaction (SPT) (AED)

| Score | Range |
|---|---|
| 0% | < 150 |
| 25% | 150 – < 250 |
| 50% | 250 – < 350 |
| 75% | 350 – < 500 |
| 100% | ≥ 500 |

### POS: Revenue Corroboration to VAT

Compares POS-reported revenue against VAT filings.

| Score | Range |
|---|---|
| 0% | < 70% |
| 25% | 70% – < 80% |
| 50% | 80% – < 90% |
| 75% | 90% – < 100% |
| 100% | ≥ 100% |

- **Auto-approve:** ≥ 70%
- **Auto-reject:** < 70%

### POS: Cash Share of POS Revenue

| Score | Range |
|---|---|
| 0% | > 50% |
| 50% | > 20% – ≤ 50% |
| 75% | > 5% – ≤ 20% |
| 100% | ≤ 5% |

- **Auto-approve:** ≤ 5%
- **Auto-reject:** > 50%

### POS: Monthly Sales Volatility (Coefficient of Variation)

| Score | Range |
|---|---|
| 0% | ≥ 0.35 |
| 25% | 0.22 – < 0.35 |
| 50% | 0.15 – < 0.22 |
| 75% | 0.08 – < 0.15 |
| 100% | < 0.08 |

- **Auto-reject:** > 0.35

### POS: Rent to Revenue Ratio (RED METRIC — flagged in source)

| Score | Range |
|---|---|
| 0% | ≥ 15% |
| 25% | 12% – < 15% |
| 50% | 9% – < 12% |
| 75% | 6% – < 9% |
| 100% | < 5% |

- **Auto-reject:** > 15%

### POS: Void Rate

| Score | Range |
|---|---|
| 0% | ≥ 2.5% (note: source shows ≥ 2.5% maps to 0% — verify with risk team before implementing) |
| 25% | 2.5% – 3.5% |
| 50% | 2.0% – < 2.5% |
| 75% | 1.5% – 2.0% |
| 100% | 0% – 1.5% |

- **Auto-reject:** > 5%

### POS: Delivery vs Dine-In

Higher delivery share = lower score.

| Score | Delivery share |
|---|---|
| 100% | < 35% |
| 75% | 35% – < 50% |
| 50% | 50% – < 65% |
| 25% | 65% – < 80% |
| 0% | ≥ 80% |

- **Auto-reject:** > 35% (cross-check with risk team — auto-reject threshold appears low compared to the 100% band cut-off)

---

## 3. Profitability (Financial Health)

### Next 12 Months Projected EBIT

| Score | Range |
|---|---|
| 0% | < -5% |
| 25% | -5% – < 0% |
| 50% | 0% – < 5% |
| 75% | 5% – < 7.5% |
| 100% | ≥ 7.5% |

- **Auto-approve:** ≥ 7.5%
- **Auto-reject:** < -5%

---

## 4. Flags (Financial Health)

### Personal AECB Score

**UAE only.** AECB (Al Etihad Credit Bureau) is the UAE personal credit bureau. **This metric does not apply to USA cases** — USA underwriting does not request personal credit reports (AGENTS.md §6.3).

| Score | Range |
|---|---|
| 0% | 1 – 540 |
| 50% | > 540 – ≤ 650 |
| 70% | > 650 – ≤ 710 |
| 90% | > 710 – ≤ 745 |
| 100% | > 745 |

- **Auto-approve:** > 745

### Reconstructed Business Credit History

| Score | Range |
|---|---|
| 0% | < 3.5 |
| 25% | 3.5 – < 5 |
| 50% | 5 – < 6 |
| 75% | 6 – < 7 |
| 100% | ≥ 7 |

- **Auto-approve:** 7
- **Auto-reject:** < 3.5

### Open Court Case Obligations

| Score | Value |
|---|---|
| 0% | YES |
| 100% | NO |

- **Auto-approve qualifier:** Civil cases and routine commercial disputes do not auto-fail — verify case nature with risk team before flagging.

---

## 5. Cheques (Financial Health)

Thresholds vary by look-back window (3 / 6 / 12 months).

### Bounced INF Cheques (Last 3 / 6 / 12 Months)

| Score | Count |
|---|---|
| 0% | ≥ 2 |
| 25% | 1 |
| 100% | 0 |

- **Auto-approve:** ≤ 1 (3-mo) / ≤ 2 (6-mo) / ≤ 4 (12-mo)
- **Auto-reject:** > 1 / > 2 / > 4

### Total Rejected Cheques

| Score | Count |
|---|---|
| 0% | > 8 |
| 100% | ≤ 8 |

- **Auto-approve:** ≤ 4 (3-mo) / ≤ 8 (6-mo) / ≤ 16 (12-mo)

### Average DPD (Days Past Due) for Late Cheques (Last 6 Months)

| Score | Range |
|---|---|
| 0% | > 7 |
| 100% | ≤ 7 |

- **Auto-approve:** ≤ 7

---

## 6. Leverage (Financial Health)

### Pre-Mezza DBR (Debt Burden Ratio)

Sum of all existing EMI obligations divided by average monthly LTM revenue.

| Score | Range |
|---|---|
| 0% | ≥ 25% |
| 25% | 20% – < 25% |
| 50% | 15% – < 20% |
| 75% | 10% – < 15% |
| 100% | < 10% |

- **Auto-approve:** < 10%
- **Auto-reject:** ≥ 25%

### Pre-Mezza Debt-Revenue Ratio

Sum of all unsecured debt divided by LTM revenue. Same banding as DBR.

| Score | Range |
|---|---|
| 0% | ≥ 25% |
| 25% | 20% – < 25% |
| 50% | 15% – < 20% |
| 75% | 10% – < 15% |
| 100% | < 10% |

- **Auto-approve:** < 10%
- **Auto-reject:** ≥ 25%

---

## 7. Restaurant Profile

### Effective Years of Operations

| Score | Range |
|---|---|
| 0% | < 1 |
| 25% | 1 – < 2 |
| 50% | 2 – < 3 |
| 75% | 3 – < 7 |
| 100% | ≥ 7 |

- **Auto-approve:** ≥ 7
- **Auto-reject:** < 1

### Entity Structure

| Score | Structure |
|---|---|
| 30% | Standalone entity |
| 60% | Small group (2–4 venues) |
| 100% | Established group (5+ venues) |

### API Readiness

| Score | Value |
|---|---|
| 0% | NO |
| 100% | YES |

### Location Tier (UAE-specific)

| Score | Tier |
|---|---|
| 0% | Far outlying areas, poorly accessible locations |
| 25% | Jebel Ali, Dubai Investment Park, Al Quoz (non-Alserkal) |
| 50% | JLT, Sports City, Jumeirah residential streets, Motor City, Discovery Gardens, Dubai Mall |
| 75% | Business Bay, Dubai Marina (non-waterfront), Ibn Battuta Mall, Dragon Mart, Mirdif City Centre, International City |
| 100% | Mall of the Emirates, DIFC, City Walk, Bluewaters, JBR Walk, La Mer |

### Seat Turnover Rate (turns per session)

| Score | Rate |
|---|---|
| 25% | < 1× |
| 75% | 1× – 2× |
| 100% | ≥ 2× |

### Venue Type

| Score | Type |
|---|---|
| 25% | Outdoor / terrace primary |
| 75% | Standalone indoor |
| 100% | Mall- or hotel-linked |

---

## 8. Non-Core Financials — BANK Data

Bank-source equivalents to POS metrics. Used when POS data is incomplete or as cross-corroboration. Same bands as POS unless noted below.

### BANK: 12-Month Average Monthly Sales Size

Same banding as POS counterpart.

### BANK: Average Balance to Revenue (Last 12 Months)

| Score | Range |
|---|---|
| 0% | < 5% |
| 25% | 5% – < 7% |
| 50% | 7% – < 10% |
| 75% | 10% – < 12% |
| 100% | ≥ 12% |

- **Auto-approve:** ≥ 12%
- **Auto-reject:** < 5%

### BANK: Average Revenue-Generating Credit Size (AED)

| Score | Range |
|---|---|
| 0% | < 150 |
| 25% | 150 – < 250 |
| 50% | 250 – < 350 |
| 75% | 350 – < 500 |
| 100% | ≥ 500 |

- **Auto-approve:** ≥ 250

### BANK: Revenue Corroboration to VAT

Same banding as POS counterpart.

### BANK: Delivery vs Dine-In

Same banding as POS counterpart.

### BANK: Coefficient of Variation (CV)

Same banding as POS Monthly Sales Volatility.

### BANK: Rent to Revenue Ratio

Same banding as POS counterpart.

---

## 9. Reputation Metrics

### Weighted Average Customer Ratings (Google / aggregator-wide)

| Score | Range |
|---|---|
| 0% | 0 – < 2.5 |
| 25% | 2.6 – < 3 |
| 50% | 3.1 – < 4 |
| 75% | 4.1 – < 4.5 |
| 100% | 4.6 – ≤ 5 |

- **Auto-approve:** 4.5 – ≤ 5
- **Auto-reject:** 0 – < 2.5

### Google Review Integrity Score

Measures authenticity of reviews (higher = more authentic, fewer red flags).

| Score | Range |
|---|---|
| 30% | 0 – ≤ 30 |
| 60% | > 30 – ≤ 60 |
| 100% | > 60 – ≤ 100 |

- **Auto-reject:** > 60 — **verify direction with risk team.** Source spreadsheet shows ">60" as auto-reject, which contradicts the band where >60 maps to 100% score. Likely this is a typo in the source or "Integrity" is being used in an inverted sense (e.g. share of suspicious reviews). Do not implement until clarified.

---

## 10. Brand Strength

All metrics on a 0.00 – 1.00 normalised scale.

### Audience Reach and Scale

| Score | Value |
|---|---|
| 20% | 0.20 |
| 40% | 0.40 |
| 70% | 0.70 |
| 100% | 1.00 |

- **Auto-approve:** 1.00

### Engagement Quality

| Score | Range |
|---|---|
| 40% | ≥ 0.40 – ≤ 0.50 |
| 70% | > 0.50 – ≤ 0.80 |
| 100% | > 0.80 – ≤ 1.00 |

- **Auto-approve:** > 0.80

### Content Consistency & Recency

Same banding as Engagement Quality.

| Score | Range |
|---|---|
| 40% | ≥ 0.40 – ≤ 0.50 |
| 70% | > 0.50 – ≤ 0.80 |
| 100% | > 0.80 – ≤ 1.00 |

- **Auto-approve:** > 0.80

### Digital Footprint Maturity

| Score | Range |
|---|---|
| 40% | 0.00 – ≤ 0.40 |
| 70% | > 0.40 – ≤ 0.80 |
| 100% | > 0.80 – ≤ 1.00 |

- **Auto-approve:** > 0.80

### Traction Indicator

| Score | Range |
|---|---|
| 40% | 0 – 2 |
| 70% | 3 – 4 |
| 100% | 5 |

- **Auto-approve:** 5

---

## 11. Customer Experience — Mystery Shopping

All four metrics use the same 1–5 scoring scale.

| Score | Rating |
|---|---|
| 20% | 1 |
| 40% | 2 |
| 60% | 3 |
| 80% | 4 |
| 100% | 5 |

Metrics evaluated:

1. **Service quality and responsiveness**
2. **Food quality, presentation, and menu execution**
3. **Cleanliness and overall ambience**
4. **Consistency with stated brand positioning and pricing**

---

## 12. Open clarifications (must resolve before implementing)

These items have ambiguity in the source spreadsheet and need risk-team confirmation:

1. **POS Void Rate band at 0%.** Source maps "≥ 2.5%" to 0%, but 25% maps to "2.5% – 3.5%" — the boundary overlaps. Confirm: is 2.5% included in the 0% band or the 25% band?
2. **POS Delivery vs Dine-In auto-reject.** Auto-reject "> 35%" overlaps with the 75% scoring band (35% – < 50%). Confirm: is auto-reject a hard kill at any value > 35%, or only at the 0% band threshold (≥ 80%)?
3. **Google Review Integrity auto-reject direction.** Source shows ">60" as auto-reject while the same value scores 100%. Confirm what "Integrity" measures — high score is good or bad.
4. **Open Court Case Obligations qualifier.** "Civil and..." is truncated in source. Confirm full qualifier.
5. **Composite score weights.** This document defines the per-metric bands but not the weights that combine them into a single 0–100 composite. Weights live in `lib/scoring/` (to be built); confirm with risk team during Phase 5.

---

## 13. USA model

The USA scoring model is **not represented in this document**. USA underwriting uses a different set of metrics and explicitly excludes personal credit reports / FICO scores per AGENTS.md §6.3. A separate `SCORING_MODEL_USA.md` should be created once the USA model is formalised.

---

*Last updated: at the time of Codex handoff. Source: Mezza UAE risk model spreadsheet.*
