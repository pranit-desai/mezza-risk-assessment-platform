// Data Bank schema — the contract between extracted_json and the UI.
//
// Each section defines:
//   - id:         URL slug, React key, anchor link target
//   - label:      What appears in the sub-nav and the section header
//   - group:      "legal" | "financial" | "analysis" — drives nav grouping
//   - jsonPath:   dotted path inside extracted_json where this section lives
//                 (empty string means the data is at the root of extracted_json)
//   - fields:     ordered list of {key, label, type, editable, required, mirroredFrom?}
//
// Field types control both display (formatting) and edit UI (input kind):
//   "text"     — plain string
//   "number"   — bare number with locale thousand separators
//   "currency" — "AED 1,234,567" formatting
//   "percent"  — "12.5%" formatting (value stored as raw e.g. 12.5)
//   "date"     — formatted as DD MMM YYYY
//   "boolean"  — "Yes" / "No"
//
// editable: false means the analyst cannot override — used for IDs, computed
// values, cross-check results, and fields mirrored from another section.
//
// mirroredFrom: optional. If set to a "section_id.field_key" string, this
// field is a read-only display of another section's value. Used to show
// rent in Other Expenses without duplicating it as a source-of-truth.
//
// required: true means this field counts toward the completeness badge.
// Sections with all required fields present = "complete", some missing =
// "partial", section absent entirely = "missing", section contains an error
// marker = "failed".

export const DATA_BANK_GROUPS = [
  { id: "legal", label: "Legal & Identity" },
  { id: "financial", label: "Financial Inputs" },
  { id: "analysis", label: "Analysis & Output" },
];

export const DATA_BANK_SECTIONS = [
  // ─────────────────────────────────────────────────────────────────────
  // LEGAL & IDENTITY
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "identity",
    label: "Identity",
    group: "legal",
    jsonPath: "identity",
    fields: [
      { key: "venue_name", label: "Venue Name", type: "text", editable: true, required: true },
      { key: "group_name", label: "Group", type: "text", editable: true, required: true },
      { key: "location", label: "Location", type: "text", editable: true, required: true },
      { key: "concept", label: "Concept", type: "text", editable: true, required: false },
      { key: "analyst", label: "Analyst", type: "text", editable: true, required: false },
      { key: "commercial_poc", label: "Commercial POC", type: "text", editable: true, required: false },
      { key: "lettable_sqm", label: "Lettable Sqm", type: "number", editable: true, required: false },
    ],
  },
  {
    id: "trade-licence",
    label: "Trade Licence",
    group: "legal",
    jsonPath: "trade_licence",
    fields: [
      { key: "licence_number", label: "Licence Number", type: "text", editable: true, required: true },
      { key: "issuing_authority", label: "Issuing Authority", type: "text", editable: true, required: false },
      { key: "issue_date", label: "Issue Date", type: "date", editable: true, required: false },
      { key: "expiry_date", label: "Expiry Date", type: "date", editable: true, required: true },
      { key: "status", label: "Status", type: "text", editable: false, required: true },
      { key: "activities", label: "Licensed Activities", type: "text", editable: true, required: false },
    ],
  },
  {
    id: "moa",
    label: "MOA",
    group: "legal",
    jsonPath: "moa",
    fields: [
      { key: "legal_form", label: "Legal Form", type: "text", editable: true, required: true },
      { key: "share_capital_aed", label: "Share Capital", type: "currency", editable: true, required: true },
      { key: "establishment_date", label: "Establishment Date", type: "date", editable: true, required: false },
      { key: "ownership_summary", label: "Ownership Summary", type: "text", editable: true, required: true },
    ],
  },
  {
    id: "lease",
    label: "Lease & Rent",
    group: "legal",
    jsonPath: "lease",
    fields: [
      // Core contractual terms
      { key: "landlord", label: "Landlord", type: "text", editable: true, required: true },
      { key: "premises", label: "Premises", type: "text", editable: true, required: true },
      { key: "term_years", label: "Term (Years)", type: "number", editable: true, required: true },
      { key: "commencement_date", label: "Commencement Date", type: "date", editable: true, required: false },
      { key: "expiry_date", label: "Expiry Date", type: "date", editable: true, required: true },
      // Financial terms
      { key: "base_rent_aed_per_year", label: "Base Rent / Year", type: "currency", editable: true, required: true },
      { key: "annual_escalation_pct", label: "Annual Escalation %", type: "percent", editable: true, required: false },
      { key: "security_deposit_aed", label: "Security Deposit", type: "currency", editable: true, required: false },
      { key: "rent_free_months", label: "Rent-Free Period (Months)", type: "number", editable: true, required: false },
      // Ejari registration
      { key: "ejari_registered", label: "Ejari Registered", type: "boolean", editable: true, required: true },
      { key: "ejari_number", label: "Ejari Number", type: "text", editable: true, required: false },
      { key: "ejari_expiry_date", label: "Ejari Expiry", type: "date", editable: true, required: false },
    ],
  },
  {
    id: "vat-certificate",
    label: "VAT Certificate",
    group: "legal",
    jsonPath: "vat_certificate",
    fields: [
      { key: "trn", label: "TRN", type: "text", editable: true, required: true },
      { key: "registration_date", label: "Registration Date", type: "date", editable: true, required: true },
      { key: "tax_period", label: "Tax Period", type: "text", editable: true, required: false },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // FINANCIAL INPUTS
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "vat-returns",
    label: "VAT Returns",
    group: "financial",
    jsonPath: "vat_returns",
    fields: [
      { key: "period_count", label: "Periods Filed", type: "number", editable: false, required: true },
      { key: "total_net_supplies_aed", label: "Total Net Supplies", type: "currency", editable: false, required: true },
      { key: "total_output_vat_aed", label: "Total Output VAT", type: "currency", editable: false, required: false },
      { key: "total_input_vat_aed", label: "Total Input VAT", type: "currency", editable: false, required: false },
      { key: "latest_period", label: "Latest Period Filed", type: "text", editable: false, required: true },
    ],
  },
  {
    id: "pos-monthly",
    label: "POS Monthly",
    group: "financial",
    jsonPath: "pos_headline",
    fields: [
      { key: "ltm_revenue_aed", label: "LTM Revenue (Gross)", type: "currency", editable: true, required: true },
      { key: "ltm_revenue_net_aed", label: "LTM Revenue (Net)", type: "currency", editable: true, required: false },
      { key: "card_share_pct", label: "Card Share %", type: "percent", editable: true, required: true },
      { key: "cash_share_pct", label: "Cash Share %", type: "percent", editable: true, required: false },
      { key: "avg_monthly_revenue_aed", label: "Avg Monthly Revenue", type: "currency", editable: false, required: false },
      { key: "monthly_cv_pct", label: "Monthly CV %", type: "percent", editable: false, required: false },
      { key: "avg_spt_aed", label: "Avg SPT", type: "currency", editable: true, required: false },
      { key: "avg_sph_aed", label: "Avg SPH", type: "currency", editable: true, required: false },
      { key: "avg_covers_per_month", label: "Avg Covers / Month", type: "number", editable: true, required: false },
      { key: "void_rate_pct", label: "Void Rate %", type: "percent", editable: true, required: false },
    ],
  },
  {
    id: "pos-category",
    label: "POS Category Mix",
    group: "financial",
    jsonPath: "pos_category_mix",
    fields: [
      { key: "food_pct", label: "Food %", type: "percent", editable: true, required: false },
      { key: "beverage_pct", label: "Beverage %", type: "percent", editable: true, required: false },
      { key: "beer_pct", label: "Beer %", type: "percent", editable: true, required: false },
      { key: "wine_pct", label: "Wine %", type: "percent", editable: true, required: false },
      { key: "cocktail_pct", label: "Cocktail %", type: "percent", editable: true, required: false },
      { key: "spirits_pct", label: "Spirits %", type: "percent", editable: true, required: false },
      { key: "other_pct", label: "Other %", type: "percent", editable: true, required: false },
    ],
  },
  {
    id: "cogs",
    label: "COGS Reasoning",
    group: "financial",
    jsonPath: "cogs",
    fields: [
      { key: "weighted_avg_cogs_pct", label: "Weighted Avg COGS %", type: "percent", editable: false, required: true },
      { key: "food_cogs_pct", label: "Food COGS %", type: "percent", editable: true, required: false },
      { key: "beverage_cogs_pct", label: "Beverage COGS %", type: "percent", editable: true, required: false },
      { key: "rationale", label: "Rationale", type: "text", editable: true, required: false },
    ],
  },
  {
    id: "other-expenses",
    label: "Other Expenses",
    group: "financial",
    jsonPath: "other_expenses",
    fields: [
      // Rent mirrored from lease — read-only display for analyst convenience.
      // Source of truth lives in section "lease", field "base_rent_aed_per_year".
      { key: "rent_aed_per_year", label: "Rent / Year (from Lease)", type: "currency", editable: false, required: false, mirroredFrom: "lease.base_rent_aed_per_year" },
      { key: "total_oe_aed_per_year", label: "Total OE / Year", type: "currency", editable: true, required: true },
      { key: "oe_aed_per_sqm_per_year", label: "OE per Sqm / Year", type: "currency", editable: false, required: false },
      { key: "utilities_aed", label: "Utilities", type: "currency", editable: true, required: false },
      { key: "marketing_aed", label: "Marketing", type: "currency", editable: true, required: false },
      { key: "rationale", label: "Rationale", type: "text", editable: true, required: false },
    ],
  },
  {
    id: "salary",
    label: "Salary",
    group: "financial",
    jsonPath: "salary",
    fields: [
      { key: "spt_band", label: "SPT Band", type: "text", editable: true, required: true },
      { key: "salary_aed_per_year", label: "Salary / Year", type: "currency", editable: true, required: true },
      { key: "salary_pct_of_revenue", label: "Salary % of Revenue", type: "percent", editable: false, required: false },
      { key: "rationale", label: "Rationale", type: "text", editable: true, required: false },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  // ANALYSIS & OUTPUT
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "seasonality",
    label: "Seasonality",
    group: "analysis",
    jsonPath: "seasonality",
    fields: [
      { key: "pattern_id", label: "Pattern ID", type: "text", editable: true, required: true },
      { key: "pattern_label", label: "Pattern", type: "text", editable: true, required: false },
      { key: "confidence", label: "Confidence", type: "text", editable: true, required: false },
      { key: "peak_months", label: "Peak Months", type: "text", editable: true, required: false },
      { key: "trough_months", label: "Trough Months", type: "text", editable: true, required: false },
    ],
  },
  {
    id: "cross-checks",
    label: "Cross-Checks",
    group: "analysis",
    jsonPath: "cross_checks",
    fields: [
      { key: "vat_pos_correlation_pct", label: "VAT vs POS Correlation %", type: "percent", editable: false, required: true },
      { key: "vat_pos_status", label: "VAT/POS Status", type: "text", editable: false, required: true },
      { key: "tl_status", label: "Trade Licence Status", type: "text", editable: false, required: true },
      { key: "tl_flag", label: "TL Flag", type: "text", editable: false, required: false },
      { key: "document_completeness_pct", label: "Document Completeness %", type: "percent", editable: false, required: false },
      { key: "rent_to_revenue_pct", label: "Rent to Revenue %", type: "percent", editable: false, required: false },
    ],
  },
  {
    id: "pnl",
    label: "P&L Reconstruction",
    group: "analysis",
    jsonPath: "pnl",
    fields: [
      { key: "gross_revenue_aed", label: "Gross Revenue", type: "currency", editable: false, required: true },
      { key: "net_revenue_aed", label: "Net Revenue", type: "currency", editable: false, required: true },
      { key: "cogs_aed", label: "COGS", type: "currency", editable: false, required: true },
      { key: "gross_profit_aed", label: "Gross Profit", type: "currency", editable: false, required: true },
      { key: "rent_aed", label: "Rent", type: "currency", editable: true, required: true },
      { key: "salary_aed", label: "Salary", type: "currency", editable: false, required: true },
      { key: "other_expenses_aed", label: "Other Expenses", type: "currency", editable: false, required: true },
      { key: "ebit_aed", label: "EBIT", type: "currency", editable: false, required: true },
      { key: "ebit_margin_pct", label: "EBIT Margin %", type: "percent", editable: false, required: true },
    ],
  },
];

// Quick lookup by section ID — used by the page when handling URL hash navigation.
export const SECTIONS_BY_ID = Object.fromEntries(
  DATA_BANK_SECTIONS.map((s) => [s.id, s]),
);