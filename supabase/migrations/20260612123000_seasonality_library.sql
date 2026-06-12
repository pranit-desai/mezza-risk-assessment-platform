BEGIN;

CREATE TABLE IF NOT EXISTS public.seasonality_patterns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region             text NOT NULL CHECK (region IN ('UAE', 'USA')),
  pattern_id         text NOT NULL,
  format             text,
  location           text,
  n_venues           integer NOT NULL DEFAULT 0,
  confidence         text,
  month_weights      jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_venues      text,
  notes              text,
  pattern_use_status text,
  is_default         boolean NOT NULL DEFAULT false,
  source_version     text,
  created_by         uuid REFERENCES public.users(id),
  updated_by         uuid REFERENCES public.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasonality_patterns_region_pattern_key UNIQUE (region, pattern_id)
);

CREATE INDEX IF NOT EXISTS idx_seasonality_patterns_region
  ON public.seasonality_patterns (region, is_default DESC, pattern_id);

CREATE TABLE IF NOT EXISTS public.seasonality_venues (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region                   text NOT NULL CHECK (region IN ('UAE', 'USA')),
  venue_name               text NOT NULL,
  legal_entity             text,
  source_group             text,
  city                     text,
  location                 text,
  venue_format             text,
  location_type            text,
  data_coverage            text,
  months_loaded            integer NOT NULL DEFAULT 0,
  pattern_status           text,
  revenue_basis            text,
  primary_source           text,
  secondary_source         text,
  notes                    text,
  concept_type             text,
  closest_pattern_id       text,
  concept_match_confidence text,
  concept_match_notes      text,
  source_version           text,
  created_by               uuid REFERENCES public.users(id),
  updated_by               uuid REFERENCES public.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasonality_venues_unique_ref UNIQUE (region, venue_name, legal_entity)
);

CREATE INDEX IF NOT EXISTS idx_seasonality_venues_region
  ON public.seasonality_venues (region, source_group, venue_name);

CREATE TABLE IF NOT EXISTS public.seasonality_venue_months (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region                   text NOT NULL CHECK (region IN ('UAE', 'USA')),
  group_id                 uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  venue_id                 uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  case_id                  uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  venue_name               text NOT NULL,
  legal_entity             text,
  source_group             text,
  city                     text,
  location                 text,
  venue_format             text,
  location_type            text,
  month_start              date NOT NULL,
  month_label              text,
  reported_revenue         numeric(14,2),
  transactions             integer,
  avg_sales_per_transaction numeric(14,2),
  currency                 text NOT NULL DEFAULT 'AED',
  revenue_basis            text,
  source_type              text,
  source_reference         text NOT NULL,
  notes                    text,
  pattern_eligibility      text,
  concept_type             text,
  closest_pattern_id       text,
  concept_match_confidence text,
  concept_match_notes      text,
  include_in_aggregate     boolean NOT NULL DEFAULT false,
  source_version           text,
  created_by               uuid REFERENCES public.users(id),
  updated_by               uuid REFERENCES public.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasonality_venue_months_unique_source UNIQUE (region, venue_name, month_start, source_reference)
);

CREATE INDEX IF NOT EXISTS idx_seasonality_venue_months_region_month
  ON public.seasonality_venue_months (region, month_start DESC);

CREATE INDEX IF NOT EXISTS idx_seasonality_venue_months_case_id
  ON public.seasonality_venue_months (case_id)
  WHERE case_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_seasonality_patterns_updated_at ON public.seasonality_patterns;
CREATE TRIGGER trg_seasonality_patterns_updated_at
  BEFORE UPDATE ON public.seasonality_patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_seasonality_venues_updated_at ON public.seasonality_venues;
CREATE TRIGGER trg_seasonality_venues_updated_at
  BEFORE UPDATE ON public.seasonality_venues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_seasonality_venue_months_updated_at ON public.seasonality_venue_months;
CREATE TRIGGER trg_seasonality_venue_months_updated_at
  BEFORE UPDATE ON public.seasonality_venue_months
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.seasonality_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonality_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonality_venue_months ENABLE ROW LEVEL SECURITY;

COMMIT;
