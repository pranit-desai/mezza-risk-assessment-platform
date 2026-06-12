// Data Bank schema — the contract between extracted_json and the UI.
//
// REWRITTEN: schema reconciled against epik_extracted.json (MZA-2025-031).
// 19 baseline matches preserved; 130 reality-only fields incorporated;
// 69 schema-only orphans either renamed, reshaped, or flagged manualFill.
//
// Each section defines:
//   - id:         URL slug, React key, anchor link target
//   - label:      What appears in the sub-nav and the section header
//   - group:      "legal" | "financial" | "analysis" — drives nav grouping
//   - jsonPath:   dotted path inside extracted_json where this section lives
//                 (empty string means the data is at the root of extracted_json)
//   - fields:     ordered list of field descriptors
//   - listOf:     optional. If present, this section renders as a table where
//                 each row comes from a list at jsonPath; "fields" describes
//                 columns instead of single values.
//
// Field types control both display (formatting) and edit UI (input kind):
//   "text"     — plain string
//   "number"   — bare number with locale thousand separators
//   "currency" — "AED 1,234,567" formatting
//   "percent"  — "12.5%" formatting (value stored as raw e.g. 12.5)
//   "date"     — formatted as DD MMM YYYY
//   "boolean"  — "Yes" / "No"
//   "enum"     — dropdown; field must define options:[...]
//
// editable: false means the analyst cannot override — used for IDs, computed
// values, cross-check results, and fields mirrored from another section.
//
// manualFill: true means the extractor does not produce this value; the
// analyst must enter it. Affects the completeness badge logic.
//
// mirroredFrom: optional. "section_id.field_key" — read-only display of
// another section's value. Used so analysts don't double-enter the same data.
//
// computedNote: optional. A small grey hint shown next to the value that
// references a different but related field (e.g. "_as_filed" editable but
// the score uses "_corrected" — surface both transparently).
//
// required: true means this field counts toward the completeness badge.

export const DATA_BANK_GROUPS = [
  { id: "legal", label: "Legal & Identity" },
  { id: "financial", label: "Financial Inputs" },
  { id: "analysis", label: "Analysis & Output" },
];

export const DATA_BANK_SECTIONS = [
  // ────────────────────────────────────────────────────────────────────
  // LEGAL & IDENTITY
  // ────────────────────────────────────────────────────────────────────
  {
    id: "identity",
    label: "Identity",
    group: "legal",
    jsonPath: "identity",
    fields: [
      { key: "venue_name", label: "Venue Name", type: "text", editable: true, required: true },
      { key: "venue_legal_name", label: "Legal Name", type: "text", editable: true, required: true },
      { key: "operator_group", label: "Operator Group", type: "text", editable: true, required: true },
      { key: "holding_entity", label: "Holding Entity", type: "text", editable: true, required: false },
      { key: "venue_type", label: "Venue Type", type: "text", editable: true, required: true },
      { key: "sub_industry", label: "Sub-Industry", type: "text", editable: true, required: false },
      { key: "location_city", label: "City", type: "text", editable: true, required: true },
      { key: "location_district", label: "District", type: "text", editable: true, required: true },
      { key: "specific_location", label: "Specific Location", type: "text", editable: true, required: false },
      { key: "lettable_sqm", label: "Lettable Sqm", type: "number", editable: true, required: true },
      { key: "website", label: "Website", type: "text", editable: true, required: false },
      { key: "analyst", label: "Analyst", type: "text", editable: true, required: false },
      { key: "commercial_poc", label: "Commercial POC", type: "text", editable: true, required: false },
    ],
  },
  {
    id: "trade-licence",
    label: "Trade Licence",
    group: "legal",
    jsonPath: "trade_licence",
    fields: [
      { key: "licence_number", label: "Licence Number", type: "text", editable: true, required: true },
      { key: "formation_number", label: "Formation Number", type: "text", editable: true, required: false },
      { key: "company_name_en", label: "Company Name (EN)", type: "text", editable: true, required: true },
      { key: "company_name_ar", label: "Company Name (AR)", type: "text", editable: true, required: false },
      { key: "company_type", label: "Company Type", type: "text", editable: true, required: false },
      { key: "issuing_authority", label: "Issuing Authority", type: "text", editable: true, required: true },
      { key: "issue_date", label: "Issue Date", type: "date", editable: true, required: true },
      { key: "expiry_date", label: "Expiry Date", type: "date", editable: true, required: true },
      { key: "days_to_expiry", label: "Days to Expiry", type: "number", editable: false, required: false },
      { key: "status", label: "Status", type: "text", editable: false, required: true },
      { key: "licence_period_years", label: "Licence Period (yrs)", type: "number", editable: true, required: false },
      { key: "years_operational", label: "Years Operational", type: "number", editable: false, required: false },
      { key: "registered_address", label: "Registered Address", type: "text", editable: true, required: false },
    ],
  },
  {
    id: "trade-licence-activities",
    label: "Permitted Activities",
    group: "legal",
    jsonPath: "trade_licence.permitted_activities",
    listOf: "activity",
    fields: [
      { key: "code", label: "Code", type: "text", editable: true },
      { key: "name", label: "Activity Name", type: "text", editable: true },
    ],
  },
  {
    id: "trade-licence-managers",
    label: "Managers on Licence",
    group: "legal",
    jsonPath: "trade_licence.managers_on_licence",
    listOf: "manager_name",
    fields: [
      { key: "_value", label: "Manager Name", type: "text", editable: true },
    ],
  },
  {
    id: "moa",
    label: "Memorandum & Shareholders",
    group: "legal",
    jsonPath: "moa",
    fields: [
      { key: "company_name", label: "Company Name", type: "text", editable: true, required: true },
      { key: "execution_date", label: "Execution Date", type: "date", editable: true, required: true },
      { key: "capital_aed", label: "Share Capital", type: "currency", editable: true, required: true },
      { key: "total_shares", label: "Total Shares", type: "number", editable: true, required: false },
      { key: "share_value_aed", label: "Share Value", type: "currency", editable: true, required: false },
      { key: "vat_signatory", label: "VAT Signatory", type: "text", editable: true, required: false },
      { key: "registered_address", label: "Registered Address", type: "text", editable: true, required: false },
    ],
  },
  {
    id: "moa-individuals",
    label: "Individual Shareholders / Officers",
    group: "legal",
    jsonPath: "moa.individuals",
    listOf: "individual",
    fields: [
      { key: "name", label: "Name", type: "text", editable: true },
      { key: "nationality", label: "Nationality", type: "text", editable: true },
      { key: "passport", label: "Passport", type: "text", editable: true },
      { key: "is_manager", label: "Manager", type: "boolean", editable: true },
      { key: "is_director", label: "Director", type: "boolean", editable: true },
    ],
  },
  {
    id: "moa-corporate",
    label: "Corporate Shareholders",
    group: "legal",
    jsonPath: "moa.corporate_shareholders",
    listOf: "corporate",
    fields: [
      { key: "name", label: "Entity Name", type: "text", editable: true },
      { key: "role", label: "Role", type: "text", editable: true },
      { key: "jurisdiction", label: "Jurisdiction", type: "text", editable: true },
      { key: "registration_no", label: "Registration No.", type: "text", editable: true },
      { key: "shares", label: "Shares", type: "number", editable: true },
      { key: "ownership_pct", label: "Ownership %", type: "percent", editable: true },
    ],
  },
  {
    id: "lease",
    label: "Lease",
    group: "legal",
    jsonPath: "lease",
    fields: [
      { key: "expiry_date", label: "Lease Expiry Date", type: "date", editable: true, required: true, manualFill: true },
      { key: "lettable_sqm", label: "Lettable Sqm", type: "number", editable: true, required: true, mirroredFrom: "identity.lettable_sqm" },
      { key: "annual_rent_aed", label: "Annual Rent (Fixed)", type: "currency", editable: true, required: true },
      { key: "rent_type", label: "Rent Type", type: "enum", editable: true, required: true, options: ["fixed", "variable", "hybrid"], manualFill: true },
      { key: "variable_rent_pct", label: "Variable Rent (% of LTM Revenue)", type: "percent", editable: true, required: false, manualFill: true, computedNote: "Only applicable if rent_type ≠ fixed. Scoring engine adds this to fixed rent." },
      { key: "rent_as_pct_of_net_revenue", label: "Computed Rent / Net Revenue", type: "percent", editable: false, required: false, computedNote: "Auto-calc: (annual_rent + variable_rent_pct × LTM net revenue) ÷ LTM net revenue" },
      { key: "source", label: "Source", type: "text", editable: false, required: false },
      { key: "note", label: "Lease Note", type: "text", editable: true, required: false },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  // FINANCIAL INPUTS
  // ────────────────────────────────────────────────────────────────────
  {
    id: "pnl",
    label: "P&L",
    group: "financial",
    jsonPath: "pnl",
    fields: [
      { key: "gross_revenue_aed", label: "Gross Revenue", type: "currency", editable: true, required: true },
      { key: "tax_aed", label: "VAT", type: "currency", editable: true, required: true },
      { key: "net_revenue_aed", label: "Net Revenue", type: "currency", editable: true, required: true },
      { key: "cogs_aed", label: "COGS", type: "currency", editable: true, required: true },
      { key: "cogs_pct", label: "COGS %", type: "percent", editable: false, required: false },
      { key: "gross_profit_aed", label: "Gross Profit", type: "currency", editable: false, required: false },
      { key: "gp_margin_pct", label: "GP Margin %", type: "percent", editable: false, required: false },
      { key: "salary_aed_placeholder", label: "Salary (placeholder, 15%)", type: "currency", editable: true, required: true, computedNote: "15% placeholder. Score uses corrected: from salary_aed_corrected" },
      { key: "salary_pct_placeholder", label: "Salary % (placeholder)", type: "percent", editable: false, required: false },
      { key: "salary_aed_corrected", label: "Salary (corrected)", type: "currency", editable: true, required: false, computedNote: "Used by scoring engine. 27% reflects SPT-implied actual." },
      { key: "salary_pct_corrected", label: "Salary % (corrected)", type: "percent", editable: false, required: false },
      { key: "salary_note", label: "Salary Note", type: "text", editable: true, required: false },
      { key: "rent_aed", label: "Rent", type: "currency", editable: true, required: true, mirroredFrom: "lease.annual_rent_aed" },
      { key: "other_expenses_aed", label: "Other Expenses", type: "currency", editable: true, required: true },
      { key: "other_expenses_basis", label: "Other Expenses Basis", type: "text", editable: true, required: false },
      { key: "ebit_aed_as_filed", label: "EBIT (as filed)", type: "currency", editable: true, required: true, computedNote: "Score uses corrected: from ebit_aed_corrected" },
      { key: "ebit_margin_as_filed_pct", label: "EBIT Margin % (as filed)", type: "percent", editable: false, required: false },
      { key: "ebit_aed_corrected", label: "EBIT (corrected)", type: "currency", editable: false, required: false, computedNote: "Used by scoring engine. Reflects corrected salary + mid OE." },
      { key: "ebit_margin_corrected_pct", label: "EBIT Margin % (corrected)", type: "percent", editable: false, required: false },
      { key: "ebit_note", label: "EBIT Note", type: "text", editable: true, required: false },
    ],
  },
  {
    id: "cogs",
    label: "COGS Breakdown",
    group: "financial",
    jsonPath: "cogs",
    fields: [
      { key: "cogs_aed", label: "COGS", type: "currency", editable: false, required: true, mirroredFrom: "pnl.cogs_aed" },
      { key: "gross_profit_aed", label: "Gross Profit", type: "currency", editable: false, required: false, mirroredFrom: "pnl.gross_profit_aed" },
      { key: "gp_margin_pct", label: "GP Margin %", type: "percent", editable: false, required: false, mirroredFrom: "pnl.gp_margin_pct" },
      { key: "cogs_used", label: "COGS Tier Used", type: "enum", editable: true, required: true, options: ["low", "mid", "high"] },
      { key: "blended_low_pct", label: "Blended COGS % (Low)", type: "percent", editable: false, required: false },
      { key: "blended_mid_pct", label: "Blended COGS % (Mid)", type: "percent", editable: false, required: false },
      { key: "blended_high_pct", label: "Blended COGS % (High)", type: "percent", editable: false, required: false },
    ],
  },
  {
    id: "other-expenses",
    label: "Other Expenses",
    group: "financial",
    jsonPath: "other_expenses",
    fields: [
      { key: "lettable_sqm", label: "Lettable Sqm", type: "number", editable: false, required: true, mirroredFrom: "identity.lettable_sqm" },
      { key: "oe_per_sqm_low", label: "OE per Sqm (Low)", type: "currency", editable: true, required: false },
      { key: "oe_per_sqm_mid", label: "OE per Sqm (Mid)", type: "currency", editable: true, required: false },
      { key: "oe_per_sqm_high", label: "OE per Sqm (High)", type: "currency", editable: true, required: false },
      { key: "annual_oe_low_aed", label: "Annual OE (Low)", type: "currency", editable: false, required: false },
      { key: "annual_oe_mid_aed", label: "Annual OE (Mid)", type: "currency", editable: false, required: false },
      { key: "annual_oe_high_aed", label: "Annual OE (High)", type: "currency", editable: false, required: false },
    ],
  },
  {
    id: "other-expenses-categories",
    label: "OE Categories",
    group: "financial",
    jsonPath: "other_expenses.categories",
    listOf: "oe_category",
    fields: [
      { key: "name", label: "Category", type: "text", editable: true },
      { key: "low", label: "Low (AED/sqm)", type: "currency", editable: true },
      { key: "mid", label: "Mid (AED/sqm)", type: "currency", editable: true },
      { key: "high", label: "High (AED/sqm)", type: "currency", editable: true },
    ],
  },
  {
    id: "vat",
    label: "VAT",
    group: "financial",
    jsonPath: "vat",
    fields: [
      { key: "trn", label: "TRN", type: "text", editable: true, required: true },
      { key: "effective_registration_date", label: "Effective Registration Date", type: "date", editable: true, required: false },
      { key: "tax_year_end", label: "Tax Year End", type: "date", editable: true, required: false },
      { key: "stagger", label: "Stagger", type: "text", editable: true, required: false },
      { key: "period_note", label: "Period Note", type: "text", editable: true, required: false },
      { key: "vat_vs_pos_correlation_pct", label: "VAT vs POS Correlation %", type: "percent", editable: false, required: true, computedNote: "Canonical VAT-POS correlation. Used by cross-checks." },
    ],
  },
  {
    id: "vat-annual-totals",
    label: "VAT Annual Totals",
    group: "financial",
    jsonPath: "vat.annual_totals",
    fields: [
      { key: "total_net_supplies", label: "Total Net Supplies", type: "currency", editable: false, required: true },
      { key: "total_vat_due", label: "Total VAT Due", type: "currency", editable: false, required: true },
      { key: "total_payable", label: "Total Payable", type: "currency", editable: false, required: true },
    ],
  },
  {
    id: "vat-signatory",
    label: "VAT Authorised Signatory",
    group: "financial",
    jsonPath: "vat.authorised_signatory",
    fields: [
      { key: "name", label: "Name", type: "text", editable: true, required: false },
      { key: "email", label: "Email", type: "text", editable: true, required: false },
      { key: "mobile", label: "Mobile", type: "text", editable: true, required: false },
    ],
  },
  {
    id: "vat-quarterly-returns",
    label: "VAT Quarterly Returns",
    group: "financial",
    jsonPath: "vat.quarterly_returns",
    listOf: "vat_quarter",
    fields: [
      { key: "quarter", label: "Quarter", type: "text", editable: false },
      { key: "period_start", label: "Period Start", type: "date", editable: false },
      { key: "period_end", label: "Period End", type: "date", editable: false },
      { key: "net_supplies", label: "Net Supplies", type: "currency", editable: false },
      { key: "box8_total", label: "Box 8 Total", type: "currency", editable: false },
      { key: "vat_due", label: "VAT Due", type: "currency", editable: false },
      { key: "payable", label: "Payable", type: "currency", editable: false },
    ],
  },
  {
    id: "pos-headline",
    label: "POS Headline",
    group: "financial",
    jsonPath: "pos_headline",
    fields: [
      { key: "period_start", label: "Period Start", type: "date", editable: true, required: true },
      { key: "period_end", label: "Period End", type: "date", editable: true, required: true },
      { key: "period_months", label: "Period (months)", type: "number", editable: false, required: false },
      { key: "gross_revenue_inc_tax", label: "Gross Revenue (inc. tax)", type: "currency", editable: false, required: true },
      { key: "net_revenue_ex_tax", label: "Net Revenue (ex. tax)", type: "currency", editable: false, required: true },
      { key: "total_tax", label: "Total Tax", type: "currency", editable: false, required: false },
      { key: "card_revenue_aed", label: "Card Revenue", type: "currency", editable: false, required: false },
      { key: "cash_revenue_aed", label: "Cash Revenue", type: "currency", editable: false, required: false },
      { key: "card_share_pct", label: "Card Share %", type: "percent", editable: false, required: true },
      { key: "cash_share_pct", label: "Cash Share %", type: "percent", editable: false, required: false },
      { key: "visa_aed", label: "Visa", type: "currency", editable: false, required: false },
      { key: "mastercard_aed", label: "Mastercard", type: "currency", editable: false, required: false },
      { key: "total_orders", label: "Total Orders", type: "number", editable: false, required: false },
      { key: "total_covers", label: "Total Covers", type: "number", editable: false, required: false },
      { key: "avg_spend_per_cover_aed", label: "Avg Spend / Cover", type: "currency", editable: false, required: false },
      { key: "avg_spend_per_order_spt_aed", label: "Avg SPT", type: "currency", editable: false, required: false },
      { key: "cancelled_count", label: "Cancelled Orders", type: "number", editable: false, required: false },
      { key: "cancelled_value_aed", label: "Cancelled Value", type: "currency", editable: false, required: false },
      { key: "cancellation_rate_pct", label: "Cancellation Rate %", type: "percent", editable: false, required: false },
    ],
  },
  {
    id: "pos-monthly",
    label: "POS Monthly",
    group: "financial",
    jsonPath: "pos_monthly",
    listOf: "month",
    fields: [
      { key: "month", label: "Month", type: "text", editable: false },
      { key: "gross_aed", label: "Gross", type: "currency", editable: false },
      { key: "net_aed", label: "Net", type: "currency", editable: false },
      { key: "tax_aed", label: "Tax", type: "currency", editable: false },
      { key: "card_aed", label: "Card", type: "currency", editable: false },
      { key: "cash_aed", label: "Cash", type: "currency", editable: false },
      { key: "seasonality_pct", label: "Seasonality %", type: "percent", editable: false },
    ],
  },
  {
    id: "pos-accounting-groups",
    label: "POS Accounting Groups (Revenue Mix)",
    group: "financial",
    jsonPath: "pos_accounting_groups",
    listOf: "accounting_group",
    fields: [
      { key: "group", label: "Group", type: "text", editable: false },
      { key: "sales_inc_tax", label: "Sales (inc. tax)", type: "currency", editable: false },
      { key: "items", label: "Items Sold", type: "number", editable: false },
      { key: "pct", label: "% of Total", type: "percent", editable: false },
    ],
  },

  // ────────────────────────────────────────────────────────────────────
  // ANALYSIS & OUTPUT
  // ────────────────────────────────────────────────────────────────────
  {
    id: "cross-checks",
    label: "Cross-Checks",
    group: "analysis",
    jsonPath: "cross_checks",
    fields: [
      { key: "vat_correlation_pct", label: "VAT vs POS Correlation %", type: "percent", editable: false, required: true, mirroredFrom: "vat.vat_vs_pos_correlation_pct" },
      { key: "vat_verdict", label: "VAT Verdict", type: "text", editable: false, required: true },
      { key: "tl_status", label: "Trade Licence Status", type: "text", editable: false, required: true, mirroredFrom: "trade_licence.status" },
      { key: "tl_days_expired", label: "Days Expired", type: "number", editable: false, required: false },
      { key: "tl_flag", label: "Trade Licence Flag", type: "text", editable: false, required: false },
    ],
  },
  {
    id: "cross-checks-affiliated",
    label: "Affiliated Parties",
    group: "analysis",
    jsonPath: "cross_checks.affiliated_parties",
    fields: [
      { key: "operator_group", label: "Operator Group", type: "text", editable: false, required: false },
      { key: "group_venues_in_library", label: "Group Venues in Library", type: "number", editable: false, required: false },
      { key: "concentration_risk", label: "Concentration Risk", type: "text", editable: false, required: false },
    ],
  },
  {
    id: "cross-checks-closure",
    label: "March 2025 Closure",
    group: "analysis",
    jsonPath: "cross_checks.march_2025_closure",
    fields: [
      { key: "actual_revenue_aed", label: "Actual Revenue", type: "currency", editable: false, required: false },
      { key: "modelled_expected_aed", label: "Modelled Expected", type: "currency", editable: false, required: false },
      { key: "reduction_pct", label: "Reduction %", type: "percent", editable: false, required: false },
      { key: "verdict", label: "Verdict", type: "text", editable: false, required: false },
    ],
  },
  {
    id: "cross-checks-pos-mismatch",
    label: "POS System Mismatch",
    group: "analysis",
    jsonPath: "cross_checks.pos_system_mismatch",
    fields: [
      { key: "original_sheet_entry", label: "Sheet Entry", type: "text", editable: false, required: false },
      { key: "pdf_format_detected", label: "PDF Format Detected", type: "text", editable: false, required: false },
      { key: "verdict", label: "Verdict", type: "text", editable: false, required: false },
    ],
  },
  {
    id: "decisioning-inputs",
    label: "Decisioning Inputs",
    group: "analysis",
    jsonPath: "credit_score",
    fields: [
      { key: "grade", label: "Mezza Grade", type: "text", editable: false, required: true },
      { key: "grade_label", label: "Grade Label", type: "text", editable: false, required: false },
      { key: "total_score", label: "Total Score", type: "number", editable: false, required: true },
      { key: "financial_health_grade", label: "Financial Health Grade", type: "text", editable: false, required: true },
      { key: "financial_health_score", label: "Financial Health Score", type: "number", editable: false, required: true },
      { key: "restaurant_profile_grade", label: "Restaurant Profile Grade", type: "text", editable: false, required: true },
      { key: "restaurant_profile_score", label: "Restaurant Profile Score", type: "number", editable: false, required: true },
      { key: "auto_approve_count", label: "Auto-Approve Triggers", type: "number", editable: false, required: false },
      { key: "auto_reject_count", label: "Auto-Reject Triggers", type: "number", editable: false, required: false },
      { key: "green_flags", label: "Green Flags", type: "number", editable: false, required: false },
      { key: "red_flags", label: "Red Flags", type: "number", editable: false, required: false },
      { key: "ltm_revenue_aed", label: "LTM Revenue", type: "currency", editable: false, required: true },
      { key: "rent_to_revenue_pct", label: "Rent / Revenue %", type: "percent", editable: false, required: false },
      { key: "salary_to_revenue_pct", label: "Salary / Revenue %", type: "percent", editable: false, required: false },
      { key: "card_share_pct", label: "Card Share %", type: "percent", editable: false, required: false },
      { key: "avg_spt_aed", label: "Avg SPT", type: "currency", editable: false, required: false },
      { key: "next_12m_ebit_pct", label: "Next 12m EBIT %", type: "percent", editable: false, required: false },
      { key: "years_operational", label: "Years Operational", type: "number", editable: false, required: false },
      { key: "facility_type", label: "Facility Type", type: "text", editable: false, required: true },
      { key: "ceiling_basis", label: "Ceiling Basis", type: "text", editable: false, required: true },
      { key: "ceiling_used_aed", label: "Ceiling (Used)", type: "currency", editable: false, required: true },
      { key: "ceiling_risk_category_aed", label: "Ceiling (Risk Category)", type: "currency", editable: false, required: false },
      { key: "ceiling_conservative_aed", label: "Ceiling — Conservative", type: "currency", editable: false, required: false },
      { key: "ceiling_pilot_aed", label: "Ceiling — Pilot (20%)", type: "currency", editable: false, required: false, computedNote: "20% of risk category — confirm intentional" },
      { key: "ceiling_moderate_aed", label: "Ceiling — Moderate", type: "currency", editable: false, required: false },
      { key: "ceiling_aggressive_aed", label: "Ceiling — Aggressive", type: "currency", editable: false, required: false },
    ],
  },
  {
    id: "decisioning-score-breakdown",
    label: "Score Breakdown",
    group: "analysis",
    jsonPath: "credit_score.score_breakdown",
    listOf: "score_line",
    fields: [
      { key: "category", label: "Category", type: "text", editable: false },
      { key: "score", label: "Score", type: "number", editable: false },
      { key: "max", label: "Max", type: "number", editable: false },
      { key: "note", label: "Note", type: "text", editable: false },
    ],
  },
  {
    id: "decisioning-queries",
    label: "Outstanding Queries",
    group: "analysis",
    jsonPath: "credit_score.outstanding_queries",
    listOf: "query",
    fields: [
      { key: "priority", label: "Priority", type: "text", editable: false },
      { key: "query", label: "Query", type: "text", editable: false },
    ],
  },
  {
    id: "extraction-meta",
    label: "Extraction Provenance",
    group: "analysis",
    jsonPath: "extraction_meta",
    fields: [
      { key: "source_file", label: "Source File", type: "text", editable: false, required: false },
      { key: "pos_system", label: "POS System", type: "text", editable: false, required: false },
      { key: "analysis_date", label: "Analysis Date", type: "date", editable: false, required: false },
      { key: "extracted_date", label: "Extracted Date", type: "date", editable: false, required: false },
      { key: "data_bank_version", label: "Data Bank Version", type: "text", editable: false, required: false },
      { key: "pos_exports_are_monthly", label: "POS Exports Monthly", type: "boolean", editable: false, required: false },
      { key: "seasonality_source", label: "Seasonality Source", type: "text", editable: false, required: false },
      { key: "seasonality_region", label: "Seasonality Region", type: "text", editable: false, required: false },
      { key: "seasonality_pattern", label: "Seasonality Pattern", type: "text", editable: false, required: false, computedNote: "Derived from closest-match library (month-level POS not always available)" },
      { key: "seasonality_data_bank_version", label: "Seasonality Bank Version", type: "text", editable: false, required: false },
      { key: "seasonality_monthly_rows", label: "Seasonality Monthly Rows", type: "number", editable: false, required: false },
    ],
  },
];

// ────────────────────────────────────────────────────────────────────
// Helpers — used by Data Bank UI to walk the schema generically.
// ────────────────────────────────────────────────────────────────────

export function getSection(id) {
  return DATA_BANK_SECTIONS.find((s) => s.id === id);
}

export function getSectionsByGroup(groupId) {
  return DATA_BANK_SECTIONS.filter((s) => s.group === groupId);
}

export function getValueAtPath(extractedJson, dottedPath) {
  if (!dottedPath) return extractedJson;
  return dottedPath.split(".").reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, extractedJson);
}

export function computeSectionStatus(extractedJson, section) {
  const data = getValueAtPath(extractedJson, section.jsonPath);
  if (data == null) return "missing";
  if (section.listOf) {
    if (!Array.isArray(data) || data.length === 0) return "missing";
    return "complete";
  }
  const required = section.fields.filter((f) => f.required);
  if (required.length === 0) return "complete";
  const present = required.filter((f) => {
    const v = data[f.key];
    return v != null && v !== "";
  });
  if (present.length === required.length) return "complete";
  if (present.length === 0) return "missing";
  return "partial";
}


// Section lookup map - used by the page for hash-based navigation and mirrors
export const SECTIONS_BY_ID = Object.fromEntries(
  DATA_BANK_SECTIONS.map((s) => [s.id, s]),
);
