-- ============================================================
-- Phase 1: groups, venues, disbursements, documents tables;
--           cases additions + status constraint update;
--           group_lending_settings custom_amount column.
--
-- Apply to a branch DB and verify Hikari loads before
-- promoting to production.  Do NOT run directly on production.
-- ============================================================


-- ── 1. groups ───────────────────────────────────────────────

CREATE TABLE public.groups (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key      text        NOT NULL UNIQUE,
  group_name     text        NOT NULL,
  region         text        NOT NULL CHECK (region IN ('UAE', 'USA')),
  commercial_poc text,
  status         text        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'inactive')),
  created_by     uuid        REFERENCES public.users(id),
  updated_by     uuid        REFERENCES public.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Composite unique exposes (id, region) to the FK system so
  -- venues can enforce region consistency without triggers.
  CONSTRAINT groups_id_region_key UNIQUE (id, region)
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;


-- ── 2. venues ───────────────────────────────────────────────
-- venues.region is kept as an explicit column for query
-- performance.  The composite FK (group_id, region) →
-- groups(id, region) enforces at the engine level that a
-- venue's region must match its parent group's region.

CREATE TABLE public.venues (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid        NOT NULL REFERENCES public.groups(id),
  venue_name   text        NOT NULL,
  location     text,
  concept      text,
  lettable_sqm numeric,
  region       text        NOT NULL CHECK (region IN ('UAE', 'USA')),
  status       text        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'inactive')),
  created_by   uuid        REFERENCES public.users(id),
  updated_by   uuid        REFERENCES public.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Enforces venues.region == groups.region for the same group.
  CONSTRAINT venues_group_region_fk
    FOREIGN KEY (group_id, region) REFERENCES public.groups(id, region)
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_venues_group_id ON public.venues (group_id);


-- ── 3. cases: add new columns ────────────────────────────────
-- venue_id is nullable so existing rows (Hikari) are preserved.

ALTER TABLE public.cases
  ADD COLUMN venue_id                  uuid REFERENCES public.venues(id),
  ADD COLUMN submission_date           date,
  ADD COLUMN first_response_date       date,
  ADD COLUMN verdict_date              date,
  ADD COLUMN risk_committee_rationale  text;

CREATE INDEX idx_cases_venue_id ON public.cases (venue_id);


-- ── 4. cases: expand status constraint ──────────────────────

ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_status_check;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_status_check CHECK (
    status = ANY (ARRAY[
      'new',
      'uploading',
      'extracting',
      'data_bank_ready',
      'under_review',
      'additional_documents_requested',
      'approved',
      'declined',
      'rejected',
      'expired'
    ])
  );


-- ── 5. disbursements ────────────────────────────────────────

CREATE TABLE public.disbursements (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           uuid          NOT NULL REFERENCES public.cases(id),
  disbursement_date date          NOT NULL,
  amount            numeric(14,2) NOT NULL CHECK (amount > 0),
  currency          text          NOT NULL CHECK (currency IN ('USD', 'AED')),
  status            text          NOT NULL DEFAULT 'scheduled'
                                  CHECK (status IN ('scheduled', 'disbursed', 'cancelled')),
  notes             text,
  created_by        uuid          REFERENCES public.users(id),
  updated_by        uuid          REFERENCES public.users(id),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_disbursements_case_id     ON public.disbursements (case_id);
CREATE INDEX idx_disbursements_date_status ON public.disbursements (disbursement_date, status);


-- ── 6. documents ────────────────────────────────────────────
-- document_type is free-text, validated at the app layer.
-- Known UAE types : trade_licence, ejari_lease
-- Known USA types : sunbiz_registration, dbpr_licence,
--                   florida_abt_licence, business_lease
-- Generic types   : pos_export, bank_statement,
--                   financial_statement, extracted_databank,
--                   generated_report, other
--
-- storage_path convention:
--   originals/{case_id}/{filename}
--   outputs/{case_id}/{filename}

CREATE TABLE public.documents (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           uuid        NOT NULL REFERENCES public.cases(id),
  document_type     text        NOT NULL,
  document_category text        NOT NULL DEFAULT 'original'
                                CHECK (document_category IN ('original', 'output')),
  storage_path      text        NOT NULL,
  filename          text        NOT NULL,
  file_size_bytes   bigint,
  expiry_date       date,
  renewal_status    text        CHECK (renewal_status IN ('pending', 'received')),
  notes             text,
  created_by        uuid        REFERENCES public.users(id),
  updated_by        uuid        REFERENCES public.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_documents_case_id ON public.documents (case_id);
CREATE INDEX idx_documents_expiry  ON public.documents (expiry_date)
  WHERE expiry_date IS NOT NULL;


-- ── 7. group_lending_settings: add custom_amount ─────────────

ALTER TABLE public.group_lending_settings
  ADD COLUMN IF NOT EXISTS custom_amount numeric(14,2) NOT NULL DEFAULT 0;


-- ── 8. updated_at trigger ────────────────────────────────────
-- Only stamps updated_at.  Populating updated_by is the app
-- layer's responsibility (passed from the authenticated session).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_disbursements_updated_at
  BEFORE UPDATE ON public.disbursements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
