<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AGENTS.md — Mezza Risk Assessment Platform

This file is the canonical context document for any AI coding tool (Claude Code, Cursor, Codex, others) working in this repository. `CLAUDE.md` includes this file via `@agents`. **Do not edit anything inside the `<!-- BEGIN:nextjs-agent-rules -->` / `<!-- END:nextjs-agent-rules -->` block above** — Next.js manages that block automatically and your changes will be overwritten on the next install.

If you are an AI coding tool reading this: **read the file fully before responding to the first prompt of a session.** Do not skim. Several rules below are non-negotiable and override default behaviour.

---

## 1. Product overview

**What this is.** The Mezza Risk Assessment Platform is a full-stack credit intelligence tool that automates the underwriting workflow for MezzaPay, an F&B-focused fintech lender headquartered in Dubai. It ingests venue financial and operational data, runs scoring and benchmarking, produces credit dashboards, and supports the end-to-end deal lifecycle from intake through approval.

**Who uses it.** Internally: the risk team (owners), commercial team (read access for deal context), and senior management (approval views). Externally: borrowers connect their financial data through Stripe Financial Connections; they do not log into the platform itself.

**Markets served.** Two distinct regions with materially different underwriting methodologies:
- **UAE** — primary market. POS data from Oracle Simphony. Lease docs are EJARI.
- **USA** — newer market, currently scaling. POS data from Toast. Florida is the most active state.

**Lifecycle stage.** Go-live. The first real live case (Hikari / Sushi Tokyo Miami LLC) is in Supabase. The platform is functional but has known gaps (see §10).

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) | TypeScript, strict mode. **Read `node_modules/next/dist/docs/` before assuming any API** — see the Next.js block above. |
| Hosting | Vercel | Production + Preview deployments per branch |
| Database | Supabase (Postgres) | RLS enabled; service-role used only server-side |
| Auth | Supabase Auth | Magic-link / SSO for internal users |
| Data connectivity | Stripe Financial Connections | Live mode for both UAE and USA |
| Styling | Tailwind CSS | Mezza brand tokens (see §8) |
| Python extraction engine | `mezza_databank.py` | Separate utility, format-agnostic, calls Claude API per document type |

**Versions.** Always check `package.json` before assuming versions. Do not upgrade major versions without explicit approval.

---

## 3. Repository structure

The expected top-level layout is below, based on what is currently in the project root. If reality diverges, **update this section** before continuing other work — never let the doc drift.

```
mezza-risk-assessment-platform/
├── app/                       # Next.js App Router
│   ├── (dashboard)/           # Authenticated routes
│   │   ├── cases/             # Case list + detail views
│   │   └── ...
│   ├── api/
│   │   ├── fc/                # Stripe Financial Connections endpoints
│   │   │   └── session/       # /api/fc/session — known fragile, see §10
│   │   └── ...
│   └── connect/               # Borrower-facing Stripe FC connect page
├── public/                    # Static assets, Mezza logo, fonts
├── .env.local                 # Local environment variables (gitignored)
├── eslint.config.mjs
├── jsconfig.json
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── AGENTS.md                  # This file
├── CLAUDE.md                  # Pointer to AGENTS.md (contains `@agents`)
└── README.md
```

Folders not yet visible at the root but likely to appear as the codebase grows:
- `components/` — reusable React components
- `lib/supabase/`, `lib/stripe/`, `lib/scoring/`, `lib/benchmarks/`
- `supabase/migrations/` — SQL migrations, versioned, append-only
- `scripts/` — ops scripts (case insertion, backfills)

---

## 4. Database conventions

### Entity hierarchy

The data model follows a strict hierarchy. Every entity below is a first-class table with its own UUID primary key.

```
groups → venues (1:1) → cases
                          ├── disbursements   (one-to-many tranches)
                          ├── documents        (one-to-many files)
                          ├── fc_accounts      (Stripe FC)
                          └── audit_log
```

### Table reference

**`groups`** — top-level borrower entity. `group_key` (text slug) is the stable identifier used in URLs and `group_lending_settings`. `group_name` is the display name.

**`venues`** — one venue per group member. `group_id` FK→`groups`. A venue is a physical location; it has exactly one persistent `cases` row linked via `cases.venue_id`. `venues.region` is enforced to match `groups.region` via a composite FK constraint — do not set them independently.

**`cases`** — the spine of the platform. Every analysis, document, and scoring run hangs off a row here. Critical columns:

- `region` — `'UAE'` or `'USA'`. **This column drives the entire downstream methodology branch**, including which Stripe FC flow runs, which benchmarks apply, and which currency is used. Never treat region as cosmetic.
- `venue_id` — nullable FK→`venues`. NULL only for rows that predate the CRUD build; all new cases must carry a `venue_id`.
- `score` — numeric, 0–100. Maps to a letter grade (see §6).
- `grade` — letter grade derived from `score` (A / B+ / B / C+ / NM).
- `ceiling_aed` — risk-adjusted lending ceiling. Holds AED for UAE cases and USD for USA cases (naming inconsistency — to be fixed in a later rename migration; do not rely on the column name as a currency indicator, check `region` instead).
- `ltm_revenue_aed` — LTM revenue, same currency caveat as above.
- `status` — workflow state. Full allowed set: `new` → `uploading` → `extracting` → `data_bank_ready` → `under_review` → `additional_documents_requested` → `approved` / `declined` / `rejected` / `expired`. Analyst-writable: `under_review`, `additional_documents_requested`, `approved`, `declined`. System-controlled: all others.
- `submission_date`, `first_response_date`, `verdict_date` — the three tracker dates. Top-level `date` columns; never nest in `extracted_json`.
- `risk_committee_rationale` — free-text rationale written by the risk team. Displayed on both the case detail view and the cases tracker page.
- `extracted_json` — the full 39-section data bank as JSONB. Schema defined in `app/_lib/dataBankSchema.js`.

**`disbursements`** — one row per tranche. Variable cadence and amount; no fixed "quarter" field. The pilot tranche (20% of final lending amount) is conventionally the first row by `disbursement_date` for a given case. `status` values: `scheduled`, `disbursed`, `cancelled`. Carries `created_by` and `updated_by` uuid FK→`users`; populated by the app layer, not triggers.

**`documents`** — tracks both uploaded originals and generated outputs. `document_category`: `'original'` (uploaded by analyst) or `'output'` (generated by platform). `storage_path` follows the convention: `originals/{case_id}/{filename}` or `outputs/{case_id}/{filename}` in Supabase Storage. `expiry_date` is NULL for non-expiring documents. `renewal_status` (`pending` / `received`) is set manually by the risk team. `document_type` is free-text validated at the app layer; known values documented in the migration file.

**`group_lending_settings`** — group-level lending amounts keyed by (`group_key`, `region`). `recommended_amount`, `final_amount`, `custom_amount` (> 0 overrides final), generated `pilot_amount` and `quarterly_capacity`. Source of planning figures; `disbursements` is the authoritative tranche schedule.

**`fc_accounts`**, **`fc_transactions`**, **`connections`**, **`webhook_events`** — Stripe Financial Connections data. See §7.

**`audit_log`** — field-level change history. `value_type`: `'top_level'` (column on `cases`) or `'extracted_field'` (path inside `extracted_json`).

**`users`** — internal users. `role`: `risk` / `commercial` / `admin`.

### Migration rules

- **Every schema change goes through a migration file** in `supabase/migrations/`. File naming: `YYYYMMDDHHMMSS_description.sql`. No ad-hoc DDL in Supabase Studio for anything that touches the live schema.
- Migrations are append-only. Never edit a migration that has been applied to a non-local environment.
- Before any migration that touches `cases`, run it against a branch DB first and verify Hikari (`MZA-2026-001`) loads without error.
- Use the Supabase MCP in **read-only mode** against production unless explicitly switched for a specific approved change.

### RLS

New tables (`groups`, `venues`, `disbursements`, `documents`) have RLS enabled with no public policies — all access uses the service-role key server-side. The pre-existing `cases`, `audit_log`, and `users` tables currently have RLS **disabled** (known gap; fix tracked separately). **Never expose the service-role key to the browser**, and never disable RLS to "make something work."

---

## 5. Domain glossary

The platform's vocabulary is specific. Use these terms consistently in code, comments, commit messages, and UI copy.

| Term | Meaning |
|---|---|
| **Group** | A borrower entity that owns one or more venues (e.g. Solutions Hospitality Group). Stored as a row in `groups`; identified by `group_key` slug. |
| **Venue** | A single physical F&B location owned by a group (e.g. "LSB JBR"). Stored in `venues` with a FK to `groups`. Has exactly one persistent `cases` row. |
| **Tranche** | A single disbursement event — one row in the `disbursements` table with its own date, amount, and status. |
| **Pilot tranche** | The first tranche in a disbursement schedule, conventionally equal to 20% of the group's final lending amount. |
| **Disbursement schedule** | The full ordered set of `disbursements` rows for a case. Cadence and amount are variable (weekly, monthly, quarterly, etc.). |
| **Submission date** | The date (`cases.submission_date`) a venue's case was formally submitted for underwriting review. |
| **First response date** | The date (`cases.first_response_date`) the risk team first responded to the submission. |
| **Verdict date** | The date (`cases.verdict_date`) the final credit decision (approved / declined) was reached. |
| **Risk committee rationale** | Free-text stored in `cases.risk_committee_rationale`; the written justification for the credit decision. Displayed on the cases tracker and case detail pages. |
| **Document expiry** | The date (`documents.expiry_date`) a regulatory document becomes invalid. Platform surfaces docs expiring within 60 days. |
| **Renewal pending** | A document whose `renewal_status = 'pending'`: the risk team has flagged it for renewal but the replacement has not yet been received. |
| **LTM** | Last Twelve Months. The standard look-back window for revenue and cost figures. |
| **Net Sales** | For USA: the authoritative top-line from Toast POS, **excluding** gratuity and auto-service-charge. For UAE: revenue after the venue's VAT/service-charge divisor (see §6). |
| **Active Tenders** | The consolidated payment categories. USA: Card / Cash / Delivery / Online. |
| **Sales COGS** | Cost of goods sold on dine-in / in-house sales. |
| **Delivery COGS** | Cost of goods sold on delivery-channel sales (tracked separately; margins differ). |
| **SPT** | Sales Per (employee-)Tier. Used in salary-band benchmarking. |
| **Composite Score** | The 0–100 output of the scoring model. Stored as `cases.score`. Drives Grade and Ceiling. |
| **Ceiling** | The risk-adjusted maximum facility size we will extend. Stored as `cases.ceiling_aed` (holds AED for UAE, USD for USA — naming to be corrected). |
| **Facility** | The credit product itself (i.e. the loan). |
| **EJARI** | UAE official rental contract registration. Used to verify lease terms for UAE venues. Tracked in `documents` with `document_type = 'ejari_lease'`. |
| **Trade Licence** | UAE business operating licence. Tracked in `documents` with `document_type = 'trade_licence'`. Expiry must be checked at every underwriting cycle. |
| **Sunbiz / DBPR / Florida ABT** | USA regulatory licences (Florida). Tracked in `documents` with types `sunbiz_registration`, `dbpr_licence`, `florida_abt_licence`. |
| **Simphony** | Oracle's POS system; standard for UAE venues. |
| **Toast** | The USA POS system standard. |
| **Stripe FC** | Stripe Financial Connections — the bank/financial data connectivity layer. |

---

## 6. Underwriting business rules (the parts that affect code)

These rules are not arbitrary — they reflect Mezza's policy and have been worked out case by case. If a feature seems to violate one of them, that is a flag, not a license to override.

### 6.1 Facility sizing
- Facility size = **1–5% of LTM revenue**, capped at **USD 2.75M** (or AED equivalent).
- The platform must surface both the policy ceiling (formulaic) and the **risk-adjusted ceiling** (after composite-score adjustment). Never display only one.

### 6.2 Grade mapping
Grades are derived from `composite_score`. The current mapping (illustrative; check `lib/scoring/` for the authoritative table before editing):
- 80+ → A
- 75–79 → B+
- 70–74 → B
- 65–69 → C+
- below 65 → manual review / decline

Hikari's 76.36 → B+ is the reference example.

### 6.3 USA methodology
- **Toast Net Sales is the authoritative top-line.** Do not derive revenue from credit-card settlement totals or bank deposit volumes when Toast data exists.
- Active tenders consolidate to **Card / Cash / Delivery / Online** — collapse any sub-tenders into these four.
- **Exclude gratuity and auto-service-charge from the revenue base.** These are pass-through to staff.
- COGS splits into **Sales COGS** and **Delivery COGS** — kept separate, never merged.
- **NEVER request, fetch, store, or display individual / guarantor personal credit reports or FICO scores.** This is a firm Mezza USA policy. Any feature that would require these data must be flagged for human review before being built. This rule applies to UI, API, scraping, third-party integrations, and any "we could just check…" suggestions.

### 6.4 UAE methodology
- Venue-specific VAT / service-charge divisors apply when reconstructing net revenue from Simphony POS exports. Examples currently encoded:
  - **LSB venues** → divide gross by **1.1235**
  - **Asia Asia venues** → divide gross by **1.10**
  - **Mott32** → multiply by **1.2361** (different structure)
- Simphony COGS data represents **food cost only** — do not treat it as full COGS without adding beverage and other adjustments.
- Blended COGS rates are applied at venue level; check the venue's category before applying a default.
- Trade Licence expiry and EJARI presence are hard checks; surface clearly if missing or expired.

### 6.5 Cash flagging
Cash payment share above category-specific thresholds triggers a flag. Do not silently round, group, or hide cash figures in any view.

---

## 7. Stripe Financial Connections architecture

- Live mode is enabled for both UAE and USA. Sandbox is no longer the default.
- The `region` column on `cases` determines which Stripe account / config branch is used. Server-side, the FC session creator reads `region` and picks the right config — do not hardcode region in the frontend.
- The borrower-facing connect page lives under `/connect` and is reached via a signed, single-use link tied to a case ID.
- `/api/fc/session` creates the FC session and returns the client secret. **This endpoint is currently fragile in live mode (see §10).**
- Never log full client secrets, FC session tokens, or bank account numbers. Log only IDs and event types.

---

## 8. Mezza brand and formatting conventions

These apply to anything that may be exported, emailed, or shown to a customer / commercial counterparty.

- **Font:** Montserrat. Body weight regular; headings semi-bold or bold. Default body size in financial tables: **11pt black**.
- **Currency display:**
  - USA cases: **USD**, no `$` sign, comma thousands separator. Example: `2,831,408` not `$2,831,408.00`.
  - UAE cases: **AED**, same convention.
- **Decimals:** revenue and ceiling figures are whole numbers. Scores carry two decimals (e.g. `76.36`).
- **Email templates:** Mezza standard HTML template. Inline CSS only — no external stylesheets, no `<style>` blocks in `<head>` that some mail clients drop.
- **Tone in customer-facing copy:** clear, professional, no hedge words ("kindly", "please be advised"), no jargon the borrower would not recognise.

---

## 9. Working with AI coding tools (meta-rules)

These rules govern how Claude Code, Cursor, and any other AI tool should operate inside this repo.

1. **Read this file fully before the first response of a session.** When the file is updated, re-read it at the top of the next session.
2. **Use plan mode (or equivalent dry-run) for anything touching:** database migrations, scoring logic, Stripe live-mode endpoints, RLS policies, or anything in `/api/`. Show the plan, get approval, then act.
3. **Commit per logical change.** Do not batch unrelated edits. Commit messages: imperative mood, scoped (`api: fix fc/session live-mode header`).
4. **Never push directly to `main`.** All changes flow through a branch and a PR / Vercel preview.
5. **Never paste real borrower data into prompts when iterating on logic.** Use synthetic fixtures. If a real-case bug needs reproduction, redact PII first (venue name, owner names, bank details).
6. **When something is ambiguous, ask one focused question before acting.** Do not guess on business rules.
7. **Update this file** when you (a) introduce a new convention, (b) discover the doc is wrong, or (c) add a new domain term. The file is not append-only — refactor it when it gets stale. **Never edit inside the Next.js managed block at the top of this file.**
8. **Refuse confidently** if asked to add personal-credit-report logic, disable RLS broadly, log secrets, or remove a methodology constraint without a documented policy change. Explain why, do not just comply.
9. **Read before writing.** Grep the codebase for existing helpers and patterns before creating new ones. Scoring, benchmarks, and Supabase client factories should live in single canonical locations — do not duplicate them.
10. **Prefer small, reversible changes** when working near live cases (currently: Hikari). A one-line fix with a test is better than a refactor.
11. **Honour the Next.js block.** Before writing Next.js code, consult `node_modules/next/dist/docs/` as that block instructs. Do not rely on training-data assumptions about App Router, server actions, route handlers, or caching behaviour.

---

## 10. Current state and known issues

This section is intentionally mutable. Update it as issues are resolved or new ones surface.

### Open bugs

_(none at present)_

### Recently resolved

1. **`/api/fc/session` failing in live mode.** Root cause: `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` were not set in Vercel Production environment variables. Fix: add both keys in Vercel dashboard and redeploy; defensive guard added to `lib/stripe.js` to surface a clear error if the key is ever missing again.

2. **Text contrast on `/connect` page.** `#8a817a` at 12px failed WCAG AA (3.82:1). Fix: introduced `--mz-text-subtle: #5c544b` and `--mz-text-body: #171412` tokens in `app/globals.css`; replaced hardcoded hex values in `ConnectClient.jsx` with `var(--mz-text-subtle)`.

3. **Sign-out button verified.** `SignOutButton.jsx` calls `supabase.auth.signOut()` then `router.push('/login')` + `router.refresh()` to flush the session cache. Reachable from all authenticated pages via `Sidebar.js:136`. No code change required.

### Known gaps (not bugs, but missing functionality)

- **No case-creation UI.** Cases are currently inserted directly into Supabase via SQL. The `/cases/new` route does not exist yet. When this is built, it must respect the `region` column and the validation rules implied by §6.
- **No automated approval-email rendering inside the platform.** Currently produced manually in the Mezza HTML template format.
- **`mezza_databank.py` is not yet integrated with the web platform.** It runs as a separate utility today.

### Recent context

- Stripe FC integration completed across Parts 1–5 of the integration runbook.
- Supabase auto-pause bug and missing `/cases` index page were resolved earlier; do not reintroduce them.
- Region split (UAE / USA) was implemented via a `region` column on `cases`; preserve this contract.

---

## 11. Internal stakeholders (for context, not for direct mention in commits)

- **Yossi Milhem** — commercial PoC. Owns deal pipeline.
- **Kevin** — internal.
- **Nathan** — internal.

Do not reference individuals in commit messages or user-facing copy. Use roles ("commercial") when context is needed.

---

## 12. Things this file does NOT cover

When a task requires knowledge outside what is in this file, the correct path is:

- For Mezza credit policy details not captured here → ask Pranit.
- For Stripe FC API behaviour → fetch the Stripe docs; do not guess.
- For Supabase / Postgres behaviour → fetch the Supabase docs; do not guess.
- For Next.js / Vercel platform behaviour → consult `node_modules/next/dist/docs/` (per the managed block at the top of this file) and the Vercel MCP for runtime state. Do not rely on training-data assumptions.

When you fetch from external docs, cite the URL in the response so the human can verify.

---

*Last updated: at the start of go-live phase. Maintainer: Pranit.*
