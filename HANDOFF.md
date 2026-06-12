# HANDOFF.md — Mezza Risk Assessment Platform

> **Instruction for all AI agents:** Update this file after every meaningful unit of work and commit it alongside the code. If a session is interrupted, this file must be enough for a fresh agent to resume without re-reading the full conversation.

This document is a bridge for any AI coding tool picking up work on this codebase. It supplements the two canonical reference files:

- **`AGENTS.md`** — product context, business rules, conventions. Read this first, in full.
- **`SCORING_MODEL.md`** — the Mezza UAE scoring bands. Reference when implementing scoring logic.

---

## 1. CURRENT STATE

- **Branch:** `codex/supabase-case-spine-summary`
- **Last commit:** `f8df8ea` (`fix(venues): remove non-existent group_id column from cases INSERT`)
- **Supabase project:** `pplcwqllhjtzkjqekvyd` (mezza-platform, ap-south-1, ACTIVE_HEALTHY)
- **Vercel project:** `prj_VABEuPQGpn3RleTEWX39pnmEZhmm` (team: pranit-7973s-projects)
- **Live case:** Hikari / Sushi Tokyo Miami LLC (`MZA-2026-001`) — **must not be touched**

### Deployment visibility
- **Vercel is deploying from `codex/supabase-case-spine-summary`** (NOT `main`). Promotion to production happens via `npx vercel promote <deployment-id> --yes`.
- **Production URL:** `https://mezza-risk-assessment-platform.vercel.app`
- **Branch alias URL:** `https://mezza-risk-assessment-platform-git-35e8cf-pranit-7973s-projects.vercel.app`
- **Production commit as of session 3:** `f8df8ea` — promoted via `npx vercel promote dpl_c8dxRXPVP8K7QVcgqXw8X4V12EfQ --yes`.
- **Important:** Ask Pranit before merging to `main`.

### .env.local — two issues fixed this session
- **Correct Supabase project:** was pointing at `xwcqtemtisakdubgltjf` (pranit-desai's dashboard, which has NO tables). Fixed to `pplcwqllhjtzkjqekvyd` with the correct publishable key.
- **SCORING_BANDS_PASSWORD_SHA256:** added to `.env.local` (hash value from Vercel, never committed).
- **Still missing: `SUPABASE_SERVICE_ROLE_KEY`.** `lib/supabaseAdmin.js` throws if this is absent, so every server-side route fails locally. The value lives in Vercel production env vars. **Action for Pranit:** copy it from the Vercel dashboard → Project → Settings → Environment Variables and add to `.env.local`.

### What works
- All core tables exist: `cases`, `groups`, `venues`, `disbursements`, `documents`, `document_requests`, `audit_log`, `users`, `group_lending_settings`, `connections`, `fc_accounts`, `fc_transactions`, `webhook_events`
- Stripe FC integration complete (Parts 1–5)
- Document renewal request workflow complete
- `lib/seasonalityStore.js` degrades gracefully when seasonality tables are missing (catches error codes `42P01` / `PGRST204` → returns `fallbackSeasonalityBundle`)

### All migrations applied as of session 3 (see migration table below)

---

## 2. IN PROGRESS

Nothing in flight. Branch is clean, production is promoted to `f8df8ea`.
One action item for Pranit before local dev works fully — see PENDING.

---

## 3. COMPLETED THIS SESSION

| When | Work item |
|---|---|
| Session 1 start | Verified MCP connectivity: Supabase ✅ Vercel ✅ |
| Session 1 | Audited 8 migration files vs. ledger + actual DB — found 5 not in ledger |
| Session 1 | Confirmed `scoring_policies` + `seasonality_*` tables do NOT exist in DB |
| Session 1 | Confirmed `on_hold` status missing from `cases_status_check` |
| Session 1 | Confirmed `seasonalityStore.js` already degrades gracefully (Task 3 ✅ — no code change needed) |
| Session 1 | Confirmed `SCORING_BANDS_PASSWORD` absent from `.env.local` and not visible in Vercel project config — logged under PENDING |
| Session 1 | Registered `20260608000000` retroactively in Supabase ledger |
| Session 1 | Registered `20260609112500` retroactively in Supabase ledger |
| Session 1 | Applied `20260609061000` — `on_hold` added to constraint, `venues_group_region_fk` made DEFERRABLE INITIALLY IMMEDIATE |
| Session 1 | Applied `20260612110000` — `scoring_policies` table created, RLS enabled |
| Session 1 | Applied `20260612123000` — `seasonality_patterns`, `seasonality_venues`, `seasonality_venue_months` created, RLS enabled |
| Session 1 | Verified all 4 new tables, all indexes, constraint, deferrable FK — all correct |
| Session 1 | Verified Hikari (MZA-2026-001): score 76.36, grade B+, ceiling 84,942.24 USD — untouched ✅ |
| Session 1 | `npm run lint` ✅ no errors; `npm run build` ✅ 17 pages, 0 errors |
| Session 2 | **Task 4D** — Created + applied `20260612140000_cases_scoring_policy_version.sql`. `cases.scoring_policy_version text` column added so editing bands later never retroactively changes historical scores. |
| Session 2 | **Task 4B (API)** — `lib/scoringPolicyStore.js`: `saveScoringPolicy` now accepts `source` param; audit log `new_value` includes `source` ('bands_inline' \| 'policy_editor'). |
| Session 2 | **Task 4B/C (API)** — `app/api/scoring-bands/route.js`: added `manual_lock` action handler (writes audit_log, returns `{locked: true}`); passes `source` from body to `saveScoringPolicy`. |
| Session 2 | **Task 4A/B/C (UI)** — `app/scoring-bands/ScoringBandsPageClient.jsx` fully rewritten: explicit column widths in `CriteriaTable` (32%/72px/34%/24%), numerics right-aligned, section weight labeled "Weight: N%", all colours use CSS token references (WCAG-safe), "Supabase" correctly spelled. Inline band editing when unlocked (score number input + range text input, calls `updateBandField` → mutates policyText, tracks `editSource:'bands_inline'`). Lock button visible when unlocked; dirty-state prompt with Save & Lock / Discard & Lock / Cancel options. Policy editor and structured bands share same policyText state (single source of truth). |
| Session 2 | **Task 5** — `npm run lint` ✅ no errors; `npm run build` ✅ 17 pages compiled, 0 errors |
| Session 3 | **Item 1 (.env.local)** — Fixed `.env.local` to point at correct Supabase project (`pplcwqllhjtzkjqekvyd`, was `xwcqtemtisakdubgltjf` which has no tables); added `SCORING_BANDS_PASSWORD_SHA256`. Still needs `SUPABASE_SERVICE_ROLE_KEY` from Pranit (see PENDING). |
| Session 3 | **Item 2 (seasonality DB proof)** — Created ZZ_TEST_DELETE group/venue/case via Supabase MCP. Monthly path: 3 rows landed in `seasonality_venue_months` with `source_type='case intake'`, `closest_pattern_id='USA_F&B_BASELINE'`, correct revenue/transaction figures. Non-monthly path: 0 rows in table, `extraction_meta.seasonality_source='seasonality_library_reference'`, `pos_exports_are_monthly=false`. Cleanup: all 4 tables returned 0 rows after DELETE. |
| Session 3 | **Bug found + fixed** — `app/api/venues/route.js` was inserting `group_id` into `cases` but that column doesn't exist (relationship is via `venue_id → venues.group_id`). PostgREST would have returned 400 on every `/new-case` submission. Fix: removed the field from the INSERT. Committed as `f8df8ea`. |
| Session 3 | **Item 3 (production promotion)** — Deployed `f8df8ea` to production via `npx vercel promote dpl_c8dxRXPVP8K7QVcgqXw8X4V12EfQ --yes`. Production URL `https://mezza-risk-assessment-platform.vercel.app` now on the route-fix commit. |

---

## 4. PENDING / BLOCKED

### SUPABASE_SERVICE_ROLE_KEY missing from .env.local — action required by Pranit

`lib/supabaseAdmin.js` throws `SUPABASE_SERVICE_ROLE_KEY is not set` if this env var is absent. Every server-side API route that uses `supabaseAdmin` will fail locally.

**Action:** Copy the value from Vercel dashboard → Project → Settings → Environment Variables and add to `.env.local`. Do not commit it. Once added, restart the dev server and `/scoring-bands` will show "Password: Server-side".

The value is already set correctly in Vercel production — this is local-only.

### SCORING_BANDS_PASSWORD_SHA256 — done
Added to `.env.local` (hash `d764de4f…`). Vercel production already had it. No further action needed.

---

## 5. KNOWN ISSUES

| # | Issue | Status |
|---|---|---|
| 1 | `SUPABASE_SERVICE_ROLE_KEY` missing from `.env.local` — dev server admin routes broken locally | Open — Pranit to add from Vercel dashboard |
| 2 | `/groups/new` form → generic 500 "Failed to create group" (FK violation or wrong Supabase client) | Open from prior Codex session |
| 3 | `/api/fc/session` was fragile in live mode | Resolved (Stripe keys added to Vercel) |
| 4 | `/connect` page WCAG contrast `#8a817a` | Resolved (`--mz-text-subtle` token added) |
| 5 | No case-creation UI (`/cases/new`) | Open — known gap |
| 6 | `mezza_databank.py` not integrated | Open — known gap, Phase 9 |
| 7 | `seasonality_*` tables are empty — auto-seed triggers on first `loadSeasonalityBundle()` call (first `/seasonality` page load in browser) | Open — harmless, self-heals on first page visit |
| 8 | `/new-case` venue creation was broken — `group_id` column doesn't exist on `cases` | Fixed in `f8df8ea` |

---

## 6. VERIFICATION STATUS

| Check | Result |
|---|---|
| `scoring_policies` table applied | ✅ RLS enabled, index created |
| `seasonality_*` tables applied | ✅ All 3 tables, RLS enabled, all indexes created |
| `on_hold` status in constraint | ✅ Confirmed in `cases_status_check` |
| `venues_group_region_fk` deferrable | ✅ `condeferrable=true`, `condeferred=false` |
| `cases.scoring_policy_version` column | ✅ Applied via `20260612140000` |
| Hikari case integrity | ✅ score 76.36, B+, 84,942.24 USD — untouched |
| Seasonality monthly path (DB) | ✅ 3 rows in `seasonality_venue_months`, correct fields, cleaned up |
| Seasonality non-monthly path (DB) | ✅ 0 rows in table, `seasonality_source='seasonality_library_reference'` |
| `.env.local` Supabase project | ✅ Fixed to `pplcwqllhjtzkjqekvyd` (was wrong project) |
| `.env.local` scoring password | ✅ `SCORING_BANDS_PASSWORD_SHA256` added |
| `/api/venues` POST route | ✅ `group_id` removed from cases INSERT (bug fixed) |
| `npm run lint` | ✅ No errors (session 3) |
| `npm run build` | ✅ Clean — 17 pages compiled, 0 errors (session 3) |
| Production deployment | ✅ `f8df8ea` promoted to `https://mezza-risk-assessment-platform.vercel.app` |
| `/scoring-bands` password: Server-side | ⏳ Blocked locally — needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` |

---

## MIGRATION STATE REFERENCE

| Migration | In ledger | Tables exist | Status |
|---|---|---|---|
| `20260608000000` phase1_groups_venues_disbursements_documents | ✅ registered | ✅ | Retroactively registered session 1 |
| `20260609061000` on_hold_and_group_region_update | ✅ | ✅ | Applied session 1 |
| `20260609112500` reconcile_legacy_schema_for_case_spine | ✅ | ✅ | Retroactively registered session 1 |
| `20260609153500` add_group_case_status | ✅ | ✅ | Was in ledger |
| `20260609154500` backfill_case_groups_for_summary | ✅ | ✅ | Was in ledger |
| `20260610110000` document_renewal_requests | ✅ | ✅ | Was in ledger |
| `20260612110000` scoring_policies | ✅ | ✅ | Applied session 1 |
| `20260612123000` seasonality_library | ✅ | ✅ | Applied session 1 |
| `20260612140000` cases_scoring_policy_version | ✅ | ✅ (column on cases) | Applied session 2 |

All 9 migrations are in ledger and applied. No pending migrations.

---

## HISTORICAL CONTEXT (from prior sessions)

---

## 1. Where the build is right now

| Phase | Status | What landed |
|---|---|---|
| 0 — Recon | ✅ Complete | Codebase audited, schema mapped, business rules clarified |
| 1 — Schema foundation | ✅ Applied to production | `groups`, `venues`, `disbursements`, `documents` tables; `cases` extended with `venue_id`, three date columns, `risk_committee_rationale`; `additional_documents_requested` status; `group_lending_settings.custom_amount` |
| 2 — Sign-out + status palette | ✅ Shipped | Sign-out verified; full `--mz-status-*` token palette in globals.css; `additional_documents_requested` moved from chart-pink to burnt orange |
| 3 — Groups & Venues CRUD | 🟡 In progress | Region tokens shipped (`--mz-region-uae`, `--mz-region-usa`); `RegionBadge` component; both API routes (`/api/groups`, `/api/groups/[id]`); list / new / detail pages created; venue create flow nested under group detail. **Known bug: see §2.** |
| 3.5 — Pre-Codex finishing | ⏳ Not started | Edit + cancel on groups/venues; date editing UI for cases (submission, first response, verdict) |
| 4 — Cases page redesign | ⏳ Pending | UAE/USA tabs, shorter case refs, collapsible group→venues rows, date columns |
| 5 — Group dashboard with lending model | ⏳ Pending | Recommended vs final amount, 20% pilot tranche, variable-cadence disbursement calendar |
| 6 — Risk committee decision propagation | ⏳ Pending | Rationale visible on cases tracker, not just detail |
| 7 — Document expiry tracker | ⏳ Pending | 60-day default warning, mailto to commercial team |
| 8 — Analytics embedding | ⏳ Pending | Visual parity rebuild from mezza-platform.vercel.app, with page-local region tabs |
| 9 — Python script + file storage + Stripe persistence | ⏳ Pending | In-app upload, server-side extraction, originals + outputs in Supabase Storage, FC bank data persisted to `bank_connections` |

---

## 2. Outstanding bug — blocker for Phase 3.5

`/groups/new` form submission returns generic 500 `"Failed to create group"`. The cause was never diagnosed before this handoff. Most likely:

- **`created_by` FK violation.** The route inserts with `created_by: user.id` referencing `public.users(id)`. If the authenticated user has a row in `auth.users` but not in `public.users` (no sync trigger), the insert fails with Postgres error 23503.
- **Wrong Supabase client.** The insert must use `supabaseAdmin` (service-role, bypasses RLS), not the auth-scoped server client. Verify `app/api/groups/route.js`.
- **RLS blocking.** New tables have RLS enabled with no public policies (intentional — all access is server-side). Confirm the route uses the service-role client.

**Diagnosis prompt (paste to Codex/Claude Code first thing):**

> Use the Vercel MCP (or the deployment dashboard) to pull function logs for `/api/groups` POST from the last 24 hours. Identify the actual Postgres error code and message. Cross-check `app/api/groups/route.js` to confirm `supabaseAdmin` is used for the insert. Use the Supabase MCP to check whether `public.users` has a row matching the authenticated user's ID. Report the diagnosis. Do not write any code until I approve the fix.

---

## 3. Architectural decisions already made (Phase 0 Q&A)

These were resolved through a structured Q&A in the earlier session. **Do not reopen them without explicit user confirmation.**

| ID | Decision |
|---|---|
| Q1 | Venues and cases are 1:1. Renewals update the existing case row in place. Hierarchy: `groups → venues → cases (1:1)`. |
| Q2 | Analytics page rebuilt in this app sourcing from local Supabase. No iframe, no external API. |
| Q3 | Databank integration is "pull" — user uploads docs in-app, app runs Python extraction invisibly. Python execution environment is NOT Vercel; needs a separate service (Modal, Railway, Render, async queue). |
| Q4 | `submission_date`, `first_response_date`, `verdict_date` are top-level columns on `cases`, not nested in JSON. |
| Q5 | Disbursements are a multi-tranche calendar with **variable cadence (weekly/monthly/quarterly/etc.) and variable amount per tranche**. Pilot tranche = first row in `disbursements`, equal to 20% of final lending amount. |
| Q6 | Risk committee rationale is free-text on `cases.risk_committee_rationale`. Must display on the cases tracker, not just the detail view. |
| Q7 | Region tabs (UAE/USA) are **page-local** — each page owns its own selection state. No global persistence. |
| Q8a | Document expiry tracker covers: UAE → Trade Licence, EJARI lease; USA → Sunbiz, DBPR, Florida ABT, business lease. Warning threshold: 60 days global default. |
| Q8b | "Request from client" uses **mailto, addressed to the commercial team** (not the client directly). Risk team flags; commercial team handles outreach. |
| Q9 | File storage: Supabase Storage. Keep both originals (`originals/{case_id}/`) and extracted outputs (`outputs/{case_id}/`). |
| Q10a | Sign-out button already exists in the sidebar. Verified working in Phase 2. |
| Q10b | `declined` and `rejected` use different colours: declined = amber/orange (soft no), rejected = deep red (terminal). |

---

## 4. Conventions established so far

These are now repo-wide patterns. New code conforms.

- **URL keying for groups.** Pages key off `group_key` slug (`/groups/[groupKey]`), API routes key off `id` UUID (`/api/groups/[id]`). There's a `GET /api/groups/by-key/[groupKey]` for slug-to-entity lookup on the page side.
- **Region tokens.** Always use `--mz-region-uae-*` / `--mz-region-usa-*` for region badges. Never borrow status tokens for region display.
- **Status tokens.** Every case status has a `text` / `bg` / `border` token under `--mz-status-{status_name}-*` in `app/globals.css`. Don't hardcode hex values.
- **RegionBadge component.** All region rendering goes through `app/_components/RegionBadge.jsx`. Don't recreate inline.
- **Server-side region lookup for venue creation.** The `/api/venues` POST route looks up `groups.region` from the supplied `group_id` and sets `venues.region` server-side. The client never provides region. The composite FK `(group_id, region) → groups(id, region)` enforces this at the DB layer.
- **Audit columns.** `created_by` and `updated_by` (`uuid REFERENCES users(id)`) are populated from `auth.uid()` in API routes. The `set_updated_at()` trigger only stamps `updated_at`; `_by` columns are app-layer.
- **Plan-mode workflow.** For any non-trivial change, AI tool produces a written plan first, user approves, then files are written. Do not skip this for anything touching `cases`, scoring logic, migrations, RLS, or `/api/` routes (per AGENTS.md §9).

---

## 5. Phase 3.5 — pre-Codex finishing

These three small additions should land before RMAL Hospitality onboarding tomorrow. Paste each to Claude Code as a separate prompt.

### 5.1 — Fix the create-group bug

See §2 above for the diagnosis prompt.

### 5.2 — Edit + cancel for groups and venues

> Add edit and cancel flows to the existing Groups & Venues CRUD.
>
> **Groups edit:**
> - Add an "Edit" button on `/groups/[groupKey]` next to the group header
> - Opens an inline edit form (same fields as create, populated from current values)
> - "Save" calls `PATCH /api/groups/[id]` with the diff
> - "Cancel" hides the form and discards changes
> - Editable fields: `group_name`, `commercial_poc`, `status`. **Do not allow editing `group_key` or `region`** (key is in URL, region is FK-enforced).
>
> **Venues edit:**
> - "Edit" link on each venue row in the venues table
> - Inline edit form (same fields as add)
> - "Save" calls `PATCH /api/venues/[id]` with the diff
> - "Cancel" reverts and hides the form
> - Editable fields: `venue_name`, `location`, `concept`, `lettable_sqm`, `status`. **Do not allow editing `region` or `group_id`** (FK-enforced).
>
> **Cancel from form:**
> - On both `/groups/new` and the inline venue-add form, add a "Cancel" button next to the submit. Cancel returns to `/groups` (for the new-group form) or hides the inline form (for venue-add).
>
> Audit:
> - Populate `updated_by: auth.uid()` on every PATCH.
>
> Plan first, then implement as one commit: `feat(groups): edit + cancel for groups and venues`.

### 5.3 — Date editing UI for cases

> Add inline date editing to the case detail page for the three date columns already in the schema: `submission_date`, `first_response_date`, `verdict_date`.
>
> - Three date input fields in a new "Case timeline" section on the case detail page
> - Each saves on blur via `PATCH /api/cases/[id]`
> - Optimistic UI: show "Saving..." inline, fall back to error toast on failure
> - Permission: editable by users with `risk` or `admin` role; read-only for `commercial`
>
> Plan first. Implement as one commit: `feat(cases): timeline date editing on detail page`.

---

## 6. Phase 4 onwards — paste-ready prompts for Codex

Run these in order. **Do not start a new phase until the previous one is merged and deployed.**

### 6.1 Phase 4 — Cases page redesign

> Phase 4 — Cases page redesign. References AGENTS.md §10 and the Phase 0 answers in HANDOFF.md §3.
>
> Requirements:
> 1. Two top-level tabs at `/cases`: **UAE** and **USA**, controlled by `cases.region`. Default to the region of the logged-in user's most recent case, or UAE if none.
> 2. Shorten case refs. Propose a new format (e.g. `MZ-UAE-0001`, `MZ-USA-0001`). Produce a migration adding `case_ref_short` column, backfill existing rows. Long ref stays in DB; short ref is what displays.
> 3. Each row in the tracker is a **group**, not an individual case. Group name shown first. Clicking a chevron expands the row to reveal that group's venues with their case data.
> 4. Columns: short ref, group name, submission date, first response date, verdict date, status badge.
> 5. Sortable by any date column. Default sort: submission date desc.
> 6. Risk committee rationale visible in expanded row (per Q6).
>
> Plan first. Show wireframes as written descriptions before any code. Implement in one commit: `feat(cases): redesign tracker with region tabs and collapsible group rows`.

### 6.2 Phase 5 — Group dashboard with lending model

> Phase 5 — Group dashboard. **High-touch — involves credit math. Extra review.**
>
> Build `/groups/[groupKey]/dashboard`. Requirements per AGENTS.md §6.1 and Phase 0 Q5:
> 1. Summary section: group name, region, number of venues, aggregate LTM revenue, composite score (worst across venues), grade.
> 2. Lending block:
>    - **Recommended lending amount** (read-only). Computed from risk-adjusted ceiling.
>    - **Final lending amount** (admin-editable). Must be ≤ recommended. Persists to `cases.final_lending_amount`. Confirmation dialog before save.
>    - **Pilot tranche**: 20% of final lending amount. Read-only.
>    - **Disbursement schedule**: variable-cadence (weekly/monthly/quarterly/etc.) calendar of tranches. Each row: date, amount, status (`scheduled`/`disbursed`/`cancelled`). Editable inline. Sum of remaining tranches ≤ 80% of final lending amount.
> 3. Currency display per AGENTS.md §8.
> 4. Defer the utilisation graph — that's a later phase.
>
> Plan first. Show me the math for Hikari: with its current ceiling, what would recommended, pilot tranche, and disbursement capacity all be? Sanity-check the numbers in plan mode before any code. Implement after I approve both plan and worked example.
>
> Update AGENTS.md §6 with a new "Lending tranche policy" sub-section.

### 6.3 Phase 6 — Risk committee decision on cases tracker

> Phase 6. Display `risk_committee_rationale` (already exists on `cases`) on the cases tracker page per Q6.
> - Visible inline in the expanded row (Phase 4's collapsible group→venues row)
> - Editable only by users with `risk` role; read-only for others
> - Add audit-trail: write a row to `case_decision_history` (new table — migration needed) on every change
>
> Plan first. Implement in one commit: `feat(cases): risk committee decision with audit trail`.

### 6.4 Phase 7 — Document expiry tracker

> Phase 7. Build `/documents`.
> - List of documents from `documents` table, sorted by `expiry_date` ascending
> - Vercel-deployments-style visual: date prominent, status badge, action menu per row
> - Each row: case ref, group name, document_type, expiry_date, days-until-expiry, status
> - Actions per row:
>   - **Request from commercial** (per Q8b — mailto addressed to commercial team, NOT the client): opens default mail client, subject + body pre-filled per Mezza template (AGENTS.md §8), sets renewal_status to `pending`
>   - **Upload renewal**: file upload to Supabase Storage at `originals/{case_id}/`, updates expiry_date based on new doc, sets renewal_status to `received`
>   - **Dismiss**: confirmation, sets renewal_status to `received` (or add a `dismissed` enum value if not already present)
> - Tab toggle: Active / Pending / Resolved
> - Warning threshold per Q8a: 60 days global default
>
> Plan first — including Supabase Storage bucket policies and the email composition template. Implement after approval.

### 6.5 Phase 8 — Analytics embedding

> Phase 8 — Recon + proposal first.
>
> 1. `web_fetch` `https://mezza-platform.vercel.app/` and describe the analytics features visible. Per Q2, we are rebuilding components in this app for visual parity, sourcing data from our Supabase schema.
> 2. Propose which features make sense in this app context, what data they source from our schema, and what new analytics features to add (composite score distribution, region split of LTM revenue, avg days from submission to verdict).
> 3. Propose UAE/USA tab handling at the top level (per Q7 — page-local).
>
> Written proposal first. After I approve which features to build, implement them in subsequent prompts (one per commit).

### 6.6 Phase 9 — Python integration, file storage, Stripe persistence

> Phase 9 — Design conversation, not implementation.
>
> Integrate three currently-separate workflows:
> 1. `mezza_databank.py` runs from within the web app, triggered when source documents are uploaded to a new case (per Q3). Python execution environment is NOT Vercel — propose Modal / Railway / Render / async queue.
> 2. All files related to a case stored in Supabase Storage at `originals/{case_id}/` and `outputs/{case_id}/` (per Q9).
> 3. Stripe FC bank account data persisted in detail against the case (account name, balances, transactions) in the `bank_connections` table.
> 4. All triggered from a "New Cases" tab where case creation uploads docs and the system auto-populates the case fields from the extraction.
>
> Produce a written design doc covering: architecture (Python execution), file storage patterns, FC data sync mechanism (webhook vs on-demand), new-case wizard flow. Identify decisions I need to make before any code can be written. No code yet.
>
> This phase will spawn 4–6 sub-prompts after the design doc lands. The design doc is the deliverable for this prompt.

---

## 7. Working with Codex effectively

A few things that worked well in the Claude Code sessions and should carry over:

- **Plan first, code second.** Even for small changes. Saves dramatically more time than it costs.
- **Hikari is the canary.** After every phase touching case data, verify Hikari (the first live case) still loads correctly. Numbers haven't drifted (composite 76.36, ceiling 84,942 USD).
- **Update `AGENTS.md` after material changes.** New conventions, resolved gaps, new domain terms — all go in the relevant section. Don't let the doc decay.
- **Never paste real borrower data into prompts.** Use synthetic fixtures when iterating on logic. Redact PII when reproducing a bug from a real case.
- **Refuse confidently** for: personal credit reports / FICO scores (AGENTS.md §6.3), disabling RLS broadly, logging secrets, removing methodology constraints without policy change.
- **Branch DB testing not available** (Supabase paid feature). Mitigations: take a manual backup (Dashboard → Database → Backups) before any destructive migration; run additive migrations directly to prod with the Hikari verification query immediately after.
- **The codebase has live state.** Existing routes (`app/groups/page.js`, `app/groups/[groupKey]/page.js`) predated Phase 3 and were preserved via the graceful fallback pattern. Expect similar conflicts during Phase 4+; flag them rather than working around silently.

---

## 8. The RMAL Hospitality scenario (immediate)

Tomorrow Pranit is onboarding RMAL Hospitality — a group with 12 venues. Realistic platform involvement:

- ✅ Once the create-group bug is fixed: register RMAL Hospitality as a group
- ✅ Add all 12 venues to that group via the UI
- ✅ Show the group + venues on the platform for the meeting
- ❌ Run automated extraction (Python script integration is Phase 9 — not built)
- ❌ Auto-populate cases from uploaded docs (Phase 9)
- ❌ Generate dashboards (Phase 5/8)
- ❌ Store documents in-app (Phase 7/9)

For the actual underwriting work tomorrow, the existing offline workflow (Python script on laptop → workbook → manual case insertion via SQL) remains the path. The platform's role tomorrow is to present registered entities, not to process the new analysis.

---

*Last updated: at the time of Codex handoff. Maintainer: Pranit.*
