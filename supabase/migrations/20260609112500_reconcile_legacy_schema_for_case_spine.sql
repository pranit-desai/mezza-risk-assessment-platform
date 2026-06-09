-- ============================================================
-- Reconcile the legacy Supabase schema with the app case spine.
--
-- Current linked project baseline before this migration:
--   public.groups  (integer id, name)
--   public.venues  (integer id, group_name, scoring/case fields)
--   public.tracker
--   public.profiles
--
-- This migration preserves those tables as legacy_* and creates
-- the contract used by the deployed Next.js app:
--   users, groups, venues, cases, documents, disbursements,
--   group_lending_settings, Financial Connections tables, audit_log.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.cases') IS NULL
     AND to_regclass('public.groups') IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'groups'
          AND column_name = 'name'
     )
  THEN
    IF to_regclass('public.legacy_tracker') IS NULL
       AND to_regclass('public.tracker') IS NOT NULL
    THEN
      ALTER TABLE public.tracker RENAME TO legacy_tracker;
    END IF;

    IF to_regclass('public.legacy_venues') IS NULL
       AND to_regclass('public.venues') IS NOT NULL
    THEN
      ALTER TABLE public.venues RENAME TO legacy_venues;
    END IF;

    IF to_regclass('public.legacy_groups') IS NULL
       AND to_regclass('public.groups') IS NOT NULL
    THEN
      ALTER TABLE public.groups RENAME TO legacy_groups;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.slugify_group_key(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      trim(both '-' from regexp_replace(lower(coalesce(input_text, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'ungrouped'
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_case_status(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(input_text, ''))) IN (
      'new',
      'uploading',
      'extracting',
      'data_bank_ready',
      'under_review',
      'on_hold',
      'additional_documents_requested',
      'approved',
      'declined',
      'rejected',
      'expired'
    )
      THEN lower(trim(input_text))
    WHEN lower(coalesce(input_text, '')) LIKE '%additional%' THEN 'additional_documents_requested'
    WHEN lower(coalesce(input_text, '')) LIKE '%document%' THEN 'additional_documents_requested'
    WHEN lower(coalesce(input_text, '')) LIKE '%hold%' THEN 'on_hold'
    WHEN lower(coalesce(input_text, '')) LIKE '%approve%' THEN 'approved'
    WHEN lower(coalesce(input_text, '')) LIKE '%declin%' THEN 'declined'
    WHEN lower(coalesce(input_text, '')) LIKE '%reject%' THEN 'rejected'
    WHEN lower(coalesce(input_text, '')) LIKE '%review%' THEN 'under_review'
    ELSE 'under_review'
  END;
$$;

CREATE OR REPLACE FUNCTION public.grade_for_score(input_score numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN input_score IS NULL THEN NULL
    WHEN input_score >= 80 THEN 'A'
    WHEN input_score >= 75 THEN 'B+'
    WHEN input_score >= 70 THEN 'B'
    WHEN input_score >= 65 THEN 'C+'
    ELSE 'NM'
  END;
$$;

CREATE TABLE IF NOT EXISTS public.users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL UNIQUE,
  full_name  text,
  role       text NOT NULL DEFAULT 'risk' CHECK (role IN ('risk', 'commercial', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
SELECT
  au.id,
  COALESCE(NULLIF(au.email, ''), au.id::text || '@supabase.local') AS email,
  COALESCE(
    NULLIF(au.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(au.raw_user_meta_data ->> 'name', ''),
    au.email
  ) AS full_name,
  'admin' AS role,
  COALESCE(au.created_at, now()) AS created_at,
  now() AS updated_at
FROM auth.users au
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key       text NOT NULL UNIQUE,
  group_name      text NOT NULL,
  region          text NOT NULL CHECK (region IN ('UAE', 'USA')),
  commercial_poc  text,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  legacy_group_id integer UNIQUE,
  created_by      uuid REFERENCES public.users(id),
  updated_by      uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT groups_id_region_key UNIQUE (id, region)
);

CREATE TABLE IF NOT EXISTS public.venues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL,
  venue_name      text NOT NULL,
  location        text,
  concept         text,
  lettable_sqm    numeric,
  region          text NOT NULL CHECK (region IN ('UAE', 'USA')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  legacy_venue_id integer UNIQUE,
  created_by      uuid REFERENCES public.users(id),
  updated_by      uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venues_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE,
  CONSTRAINT venues_group_region_fk
    FOREIGN KEY (group_id, region) REFERENCES public.groups(id, region)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE IF NOT EXISTS public.cases (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_ref                         text UNIQUE,
  group_id                         uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  venue_id                         uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  group_name                       text NOT NULL,
  venue_name                       text NOT NULL,
  region                           text NOT NULL DEFAULT 'UAE' CHECK (region IN ('UAE', 'USA')),
  location                         text,
  concept                          text,
  score                            numeric,
  grade                            text,
  status                           text NOT NULL DEFAULT 'under_review',
  ceiling_aed                      numeric(14, 2) NOT NULL DEFAULT 0,
  ltm_revenue_aed                  numeric(14, 2) NOT NULL DEFAULT 0,
  recommended_lending_amount       numeric(14, 2) NOT NULL DEFAULT 0,
  recommended_lending_amount_aed   numeric(14, 2) NOT NULL DEFAULT 0,
  recommended_lending_amount_usd   numeric(14, 2) NOT NULL DEFAULT 0,
  final_lending_amount             numeric(14, 2) NOT NULL DEFAULT 0,
  submission_date                  date,
  first_response_date              date,
  verdict_date                     date,
  risk_committee_rationale         text,
  decision                         text,
  rationale                        text,
  extracted_json                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_venue_id                  integer UNIQUE,
  created_by                       uuid REFERENCES public.users(id),
  updated_by                       uuid REFERENCES public.users(id),
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cases_status_check CHECK (
    status = ANY (ARRAY[
      'new',
      'uploading',
      'extracting',
      'data_bank_ready',
      'under_review',
      'on_hold',
      'additional_documents_requested',
      'approved',
      'declined',
      'rejected',
      'expired'
    ])
  )
);

CREATE INDEX IF NOT EXISTS idx_groups_region ON public.groups (region);
CREATE INDEX IF NOT EXISTS idx_venues_group_id ON public.venues (group_id);
CREATE INDEX IF NOT EXISTS idx_cases_group_id ON public.cases (group_id);
CREATE INDEX IF NOT EXISTS idx_cases_venue_id ON public.cases (venue_id);
CREATE INDEX IF NOT EXISTS idx_cases_region_status ON public.cases (region, status);

INSERT INTO public.groups (
  group_key,
  group_name,
  region,
  commercial_poc,
  legacy_group_id,
  created_at,
  updated_at
)
SELECT
  public.slugify_group_key(lg.name) AS group_key,
  lg.name AS group_name,
  COALESCE(
    (
      array_agg(upper(lv.region) ORDER BY lv.id)
      FILTER (WHERE upper(coalesce(lv.region, '')) IN ('UAE', 'USA'))
    )[1],
    'UAE'
  ) AS region,
  NULLIF(max(nullif(lv.poc, '')), '') AS commercial_poc,
  lg.id AS legacy_group_id,
  COALESCE(lg.created_at, now()) AS created_at,
  COALESCE(lg.updated_at, now()) AS updated_at
FROM public.legacy_groups lg
LEFT JOIN public.legacy_venues lv ON lv.group_name = lg.name
WHERE to_regclass('public.legacy_groups') IS NOT NULL
GROUP BY lg.id, lg.name, lg.created_at, lg.updated_at
ON CONFLICT (group_key) DO UPDATE
SET group_name = EXCLUDED.group_name,
    region = EXCLUDED.region,
    commercial_poc = COALESCE(public.groups.commercial_poc, EXCLUDED.commercial_poc),
    legacy_group_id = COALESCE(public.groups.legacy_group_id, EXCLUDED.legacy_group_id),
    updated_at = now();

INSERT INTO public.venues (
  group_id,
  venue_name,
  location,
  concept,
  region,
  legacy_venue_id,
  created_at,
  updated_at
)
SELECT
  g.id AS group_id,
  lv.venue_name,
  NULLIF(lv.location, '') AS location,
  NULL AS concept,
  CASE WHEN upper(coalesce(lv.region, '')) IN ('UAE', 'USA') THEN upper(lv.region) ELSE g.region END AS region,
  lv.id AS legacy_venue_id,
  COALESCE(lv.created_at, now()) AS created_at,
  COALESCE(lv.updated_at, now()) AS updated_at
FROM public.legacy_venues lv
JOIN public.groups g ON g.legacy_group_id = (
  SELECT lg.id FROM public.legacy_groups lg WHERE lg.name = lv.group_name
)
WHERE to_regclass('public.legacy_venues') IS NOT NULL
ON CONFLICT (legacy_venue_id) DO UPDATE
SET group_id = EXCLUDED.group_id,
    venue_name = EXCLUDED.venue_name,
    location = EXCLUDED.location,
    region = EXCLUDED.region,
    updated_at = now();

INSERT INTO public.cases (
  case_ref,
  group_id,
  venue_id,
  group_name,
  venue_name,
  region,
  location,
  score,
  grade,
  status,
  ceiling_aed,
  ltm_revenue_aed,
  recommended_lending_amount,
  recommended_lending_amount_aed,
  recommended_lending_amount_usd,
  final_lending_amount,
  submission_date,
  verdict_date,
  risk_committee_rationale,
  decision,
  rationale,
  extracted_json,
  legacy_venue_id,
  created_at,
  updated_at
)
SELECT
  'MZA-LEGACY-' || lpad(lv.id::text, 3, '0') AS case_ref,
  g.id AS group_id,
  v.id AS venue_id,
  g.group_name,
  lv.venue_name,
  v.region,
  NULLIF(lv.location, '') AS location,
  NULLIF(lv.mezza_score, 0) AS score,
  public.grade_for_score(NULLIF(lv.mezza_score, 0)) AS grade,
  public.normalize_case_status(COALESCE(NULLIF(lv.decision, ''), NULLIF(lg.decision, ''), 'under_review')) AS status,
  COALESCE(lv.lending_amt, 0) AS ceiling_aed,
  COALESCE(lv.revenue, 0) AS ltm_revenue_aed,
  COALESCE(lv.lending_amt, 0) AS recommended_lending_amount,
  CASE WHEN v.region = 'UAE' THEN COALESCE(lv.lending_amt, 0) ELSE 0 END AS recommended_lending_amount_aed,
  CASE WHEN v.region = 'USA' THEN COALESCE(lv.lending_amt, 0) ELSE 0 END AS recommended_lending_amount_usd,
  COALESCE(lv.lending_amt, 0) AS final_lending_amount,
  lv.case_date AS submission_date,
  CASE
    WHEN public.normalize_case_status(COALESCE(NULLIF(lv.decision, ''), NULLIF(lg.decision, ''))) IN ('approved', 'declined', 'rejected')
      THEN lv.case_date
    ELSE NULL
  END AS verdict_date,
  NULLIF(lv.rationale, '') AS risk_committee_rationale,
  NULLIF(lv.decision, '') AS decision,
  NULLIF(lv.rationale, '') AS rationale,
  jsonb_build_object(
    'legacy_source', 'public.legacy_venues',
    'legacy_venue_id', lv.id,
    'pos_headline', jsonb_build_object(
      'net_revenue_ex_tax', COALESCE(lv.revenue, 0)
    ),
    'credit_score', jsonb_build_object(
      'ltm_revenue_aed', COALESCE(lv.revenue, 0),
      'ceiling_used_aed', COALESCE(lv.lending_amt, 0),
      'financial_health_score', lv.fin_score,
      'restaurant_profile_score', lv.red_score,
      'composite_score', lv.mezza_score
    ),
    'risk_committee', jsonb_build_object(
      'decision', NULLIF(lv.decision, ''),
      'rationale', NULLIF(lv.rationale, '')
    ),
    'strengths', to_jsonb(COALESCE(lv.strengths, ARRAY[]::text[])),
    'weaknesses', to_jsonb(COALESCE(lv.weaknesses, ARRAY[]::text[]))
  ) AS extracted_json,
  lv.id AS legacy_venue_id,
  COALESCE(lv.created_at, now()) AS created_at,
  COALESCE(lv.updated_at, now()) AS updated_at
FROM public.legacy_venues lv
JOIN public.legacy_groups lg ON lg.name = lv.group_name
JOIN public.groups g ON g.legacy_group_id = lg.id
JOIN public.venues v ON v.legacy_venue_id = lv.id
WHERE to_regclass('public.legacy_venues') IS NOT NULL
ON CONFLICT (legacy_venue_id) DO UPDATE
SET group_id = EXCLUDED.group_id,
    venue_id = EXCLUDED.venue_id,
    group_name = EXCLUDED.group_name,
    venue_name = EXCLUDED.venue_name,
    region = EXCLUDED.region,
    location = EXCLUDED.location,
    score = EXCLUDED.score,
    grade = EXCLUDED.grade,
    status = EXCLUDED.status,
    ceiling_aed = EXCLUDED.ceiling_aed,
    ltm_revenue_aed = EXCLUDED.ltm_revenue_aed,
    recommended_lending_amount = EXCLUDED.recommended_lending_amount,
    recommended_lending_amount_aed = EXCLUDED.recommended_lending_amount_aed,
    recommended_lending_amount_usd = EXCLUDED.recommended_lending_amount_usd,
    final_lending_amount = EXCLUDED.final_lending_amount,
    extracted_json = EXCLUDED.extracted_json,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.disbursements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  disbursement_date date NOT NULL,
  amount            numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency          text NOT NULL CHECK (currency IN ('USD', 'AED')),
  status            text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'disbursed', 'cancelled')),
  notes             text,
  created_by        uuid REFERENCES public.users(id),
  updated_by        uuid REFERENCES public.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_type     text NOT NULL,
  document_category text NOT NULL DEFAULT 'original' CHECK (document_category IN ('original', 'output')),
  storage_path      text NOT NULL,
  filename          text NOT NULL,
  file_size_bytes   bigint,
  expiry_date       date,
  renewal_status    text CHECK (renewal_status IN ('pending', 'received')),
  notes             text,
  created_by        uuid REFERENCES public.users(id),
  updated_by        uuid REFERENCES public.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_lending_settings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key          text NOT NULL,
  group_name         text NOT NULL,
  region             text NOT NULL CHECK (region IN ('USA', 'UAE')),
  currency           text NOT NULL CHECK (currency IN ('USD', 'AED')),
  recommended_amount numeric(14, 2) NOT NULL DEFAULT 0,
  final_amount       numeric(14, 2) NOT NULL DEFAULT 0,
  custom_amount      numeric(14, 2) NOT NULL DEFAULT 0,
  effective_amount   numeric(14, 2) NOT NULL DEFAULT 0,
  pilot_percent      numeric(5, 2) NOT NULL DEFAULT 20,
  pilot_amount       numeric(14, 2) GENERATED ALWAYS AS (
    round((CASE WHEN custom_amount > 0 THEN custom_amount ELSE final_amount END) * pilot_percent / 100, 2)
  ) STORED,
  quarterly_capacity numeric(14, 2) GENERATED ALWAYS AS (
    greatest((CASE WHEN custom_amount > 0 THEN custom_amount ELSE final_amount END) - round((CASE WHEN custom_amount > 0 THEN custom_amount ELSE final_amount END) * pilot_percent / 100, 2), 0)
  ) STORED,
  notes              text,
  updated_by         uuid REFERENCES public.users(id),
  updated_by_email   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_key, region)
);

INSERT INTO public.group_lending_settings (
  group_key,
  group_name,
  region,
  currency,
  recommended_amount,
  final_amount,
  custom_amount,
  effective_amount,
  notes,
  created_at,
  updated_at
)
SELECT
  g.group_key,
  g.group_name,
  g.region,
  CASE WHEN g.region = 'USA' THEN 'USD' ELSE 'AED' END AS currency,
  COALESCE(sum(c.recommended_lending_amount), 0) AS recommended_amount,
  CASE
    WHEN COALESCE(lg.custom_amt, 0) > 0 THEN COALESCE(lg.custom_amt, 0)
    ELSE COALESCE(sum(c.recommended_lending_amount), 0)
  END AS final_amount,
  COALESCE(lg.custom_amt, 0) AS custom_amount,
  CASE
    WHEN COALESCE(lg.custom_amt, 0) > 0 THEN COALESCE(lg.custom_amt, 0)
    ELSE COALESCE(sum(c.recommended_lending_amount), 0)
  END AS effective_amount,
  NULLIF(lg.rationale, '') AS notes,
  COALESCE(lg.created_at, now()) AS created_at,
  COALESCE(lg.updated_at, now()) AS updated_at
FROM public.groups g
LEFT JOIN public.legacy_groups lg ON lg.id = g.legacy_group_id
LEFT JOIN public.cases c ON c.group_id = g.id
GROUP BY g.group_key, g.group_name, g.region, lg.custom_amt, lg.rationale, lg.created_at, lg.updated_at
ON CONFLICT (group_key, region) DO UPDATE
SET group_name = EXCLUDED.group_name,
    recommended_amount = EXCLUDED.recommended_amount,
    final_amount = EXCLUDED.final_amount,
    custom_amount = EXCLUDED.custom_amount,
    effective_amount = EXCLUDED.effective_amount,
    notes = COALESCE(public.group_lending_settings.notes, EXCLUDED.notes),
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  link_token      text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'pending',
  stripe_customer text,
  fc_session_id   text,
  connected_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fc_accounts (
  id               text PRIMARY KEY,
  connection_id    uuid REFERENCES public.connections(id) ON DELETE SET NULL,
  case_id          uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  institution_name text,
  display_name     text,
  last4            text,
  category         text,
  status           text,
  balance          jsonb,
  ownership        jsonb,
  last_txn_refresh text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fc_transactions (
  id            text PRIMARY KEY,
  account_id    text REFERENCES public.fc_accounts(id) ON DELETE CASCADE,
  amount        numeric,
  currency      text,
  description   text,
  status        text,
  transacted_at text,
  raw           jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id         text PRIMARY KEY,
  type       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  field_name       text NOT NULL,
  old_value        text,
  new_value        text,
  value_type       text NOT NULL DEFAULT 'top_level' CHECK (value_type IN ('top_level', 'extracted_field')),
  changed_by       text,
  changed_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disbursements_case_id ON public.disbursements (case_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents (case_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON public.documents (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_lending_settings_region ON public.group_lending_settings (region);
CREATE INDEX IF NOT EXISTS idx_connections_case_id ON public.connections (case_id);
CREATE INDEX IF NOT EXISTS idx_fc_accounts_case_id ON public.fc_accounts (case_id);
CREATE INDEX IF NOT EXISTS idx_fc_transactions_account_id ON public.fc_transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_case_id ON public.audit_log (case_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_groups_updated_at ON public.groups;
CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_venues_updated_at ON public.venues;
CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cases_updated_at ON public.cases;
CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_disbursements_updated_at ON public.disbursements;
CREATE TRIGGER trg_disbursements_updated_at
  BEFORE UPDATE ON public.disbursements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_group_lending_settings_updated_at ON public.group_lending_settings;
CREATE TRIGGER trg_group_lending_settings_updated_at
  BEFORE UPDATE ON public.group_lending_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_connections_updated_at ON public.connections;
CREATE TRIGGER trg_connections_updated_at
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fc_accounts_updated_at ON public.fc_accounts;
CREATE TRIGGER trg_fc_accounts_updated_at
  BEFORE UPDATE ON public.fc_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fc_transactions_updated_at ON public.fc_transactions;
CREATE TRIGGER trg_fc_transactions_updated_at
  BEFORE UPDATE ON public.fc_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.update_group_region(
  p_group_id uuid,
  p_region text,
  p_updated_by uuid DEFAULT NULL
)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_group public.groups;
BEGIN
  IF p_region NOT IN ('UAE', 'USA') THEN
    RAISE EXCEPTION 'region must be UAE or USA' USING ERRCODE = '22023';
  END IF;

  SET CONSTRAINTS venues_group_region_fk DEFERRED;

  UPDATE public.groups
     SET region = p_region,
         updated_by = p_updated_by
   WHERE id = p_group_id
   RETURNING * INTO updated_group;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.venues
     SET region = p_region,
         updated_by = p_updated_by
   WHERE group_id = p_group_id;

  UPDATE public.cases
     SET region = p_region,
         updated_by = p_updated_by
   WHERE group_id = p_group_id;

  RETURN updated_group;
END;
$$;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_lending_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fc_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fc_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

GRANT EXECUTE ON FUNCTION public.update_group_region(uuid, text, uuid) TO service_role;

COMMIT;
