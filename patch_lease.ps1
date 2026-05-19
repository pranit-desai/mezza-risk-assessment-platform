# =============================================================================
# Lease section patch for app/_lib/dataBankSchema.js
# =============================================================================
# Replaces the 15-field lease block (containing landlord, ejari, etc.) with
# the 8-field version per Pranit's decision: expiry_date, lettable_sqm,
# annual_rent_aed (renamed to "Annual Fixed Rent"), plus rent_type enum and
# variable_rent_pct for sub-clause logic.
#
# Approach: read file, do an exact-string replace on the lease `fields: [...]`
# block, write file back. Idempotent — running twice on an already-patched
# file is a no-op (with a warning).
# =============================================================================

$schemaPath = "C:\Users\prani\OneDrive\Documents\mezza-risk-assessment-platform\app\_lib\dataBankSchema.js"

if (-not (Test-Path -LiteralPath $schemaPath)) {
    Write-Host "ERROR: Schema file not found at $schemaPath" -ForegroundColor Red
    exit 1
}

# Backup first
$backupPath = "$schemaPath.pre-lease-patch-$(Get-Date -Format yyyyMMdd-HHmm)"
Copy-Item -LiteralPath $schemaPath -Destination $backupPath
Write-Host "Backup created: $backupPath" -ForegroundColor DarkGray

# Read current content (UTF-8 no BOM)
$content = [System.IO.File]::ReadAllText($schemaPath, [System.Text.UTF8Encoding]::new($false))

# Define the exact original block to replace (15 field lines, matching what we
# verified is on disk). Using a here-string with single-quote delimiters means
# no variable interpolation, no escape headaches.
$oldBlock = @'
    fields: [
      // Real fields from the script
      { key: "annual_rent_aed", label: "Annual Rent", type: "currency", editable: true, required: true, policyRef: "2.4 Lease risk" },
      { key: "rent_as_pct_of_net_revenue", label: "Rent / Net Revenue %", type: "percent", editable: false, required: true, note: "Computed from POS. Flag if >25%." },
      { key: "source", label: "Source", type: "text", editable: true, required: false },
      { key: "note", label: "Analyst Note", type: "text", editable: true, required: false },
      // Manual-fill fields — analyst enters from lease document
      { key: "landlord", label: "Landlord", type: "text", editable: true, required: true, manualFill: true, policyRef: "2.2 Ejari/rent contracts required" },
      { key: "premises", label: "Premises", type: "text", editable: true, required: false, manualFill: true },
      { key: "term_years", label: "Term (Years)", type: "number", editable: true, required: true, manualFill: true },
      { key: "commencement_date", label: "Commencement Date", type: "date", editable: true, required: false, manualFill: true },
      { key: "expiry_date", label: "Expiry Date", type: "date", editable: true, required: true, manualFill: true, policyRef: "2.2 Up-to-date Ejari required" },
      { key: "annual_escalation_pct", label: "Annual Escalation %", type: "percent", editable: true, required: false, manualFill: true },
      { key: "security_deposit_aed", label: "Security Deposit", type: "currency", editable: true, required: false, manualFill: true },
      { key: "rent_free_months", label: "Rent-Free Period (Months)", type: "number", editable: true, required: false, manualFill: true },
      { key: "ejari_registered", label: "Ejari Registered", type: "boolean", editable: true, required: true, manualFill: true, policyRef: "2.2 Ejari required" },
      { key: "ejari_number", label: "Ejari Number", type: "text", editable: true, required: false, manualFill: true },
      { key: "ejari_expiry_date", label: "Ejari Expiry", type: "date", editable: true, required: false, manualFill: true },
    ],
'@

$newBlock = @'
    fields: [
      // Real fields from the script
      { key: "annual_rent_aed", label: "Annual Fixed Rent", type: "currency", editable: true, required: true, policyRef: "2.4 Lease risk" },
      { key: "rent_as_pct_of_net_revenue", label: "Rent / Net Revenue %", type: "percent", editable: false, required: true, note: "Computed: (annual_rent_aed + variable_rent_pct/100 × net_revenue) ÷ net_revenue. Flag if >25%." },
      { key: "source", label: "Source", type: "text", editable: true, required: false },
      { key: "note", label: "Analyst Note", type: "text", editable: true, required: false },
      // Sub-clause / variable rent — analyst sets type, engine bakes the maths in
      { key: "rent_type", label: "Rent Type", type: "text", editable: true, required: true, manualFill: true, note: "fixed | variable | hybrid. Drives whether variable_rent_pct is applied by the scoring engine." },
      { key: "variable_rent_pct", label: "Variable Rent (% of LTM Revenue)", type: "percent", editable: true, required: false, manualFill: true, note: "Only applied if rent_type is 'variable' or 'hybrid'. Engine adds this revenue-linked rent on top of annual_rent_aed before computing rent/revenue ratio." },
      // Manual-fill fields — minimum analyst entries from the lease document
      { key: "expiry_date", label: "Lease Expiry Date", type: "date", editable: true, required: true, manualFill: true, policyRef: "2.2 Up-to-date Ejari required" },
      { key: "lettable_sqm", label: "Lettable Sqm", type: "number", editable: false, required: true, mirroredFrom: "identity.lettable_sqm" },
    ],
'@

# Normalize line endings so the match works regardless of CRLF/LF
$contentNormalized = $content -replace "`r`n", "`n"
$oldBlockNormalized = $oldBlock -replace "`r`n", "`n"
$newBlockNormalized = $newBlock -replace "`r`n", "`n"

# Check idempotency: is the new block already present?
if ($contentNormalized.Contains($newBlockNormalized)) {
    Write-Host "WARN: lease patch already applied. No changes made." -ForegroundColor Yellow
    Remove-Item -LiteralPath $backupPath
    exit 0
}

# Check the old block exists
if (-not $contentNormalized.Contains($oldBlockNormalized)) {
    Write-Host "ERROR: original lease block not found in schema. File may have been edited since the diff was generated." -ForegroundColor Red
    Write-Host "Backup preserved at: $backupPath" -ForegroundColor Yellow
    exit 2
}

# Apply replacement
$patched = $contentNormalized.Replace($oldBlockNormalized, $newBlockNormalized)

# Write back as UTF-8 no BOM with CRLF (Windows default)
$patched = $patched -replace "`n", "`r`n"
[System.IO.File]::WriteAllText($schemaPath, $patched, [System.Text.UTF8Encoding]::new($false))

# Report deltas
$oldLines = ($oldBlockNormalized -split "`n").Count
$newLines = ($newBlockNormalized -split "`n").Count
Write-Host "Lease section patched: $oldLines lines -> $newLines lines" -ForegroundColor Green
Write-Host "File: $schemaPath" -ForegroundColor DarkGray
Write-Host "Backup: $backupPath" -ForegroundColor DarkGray
