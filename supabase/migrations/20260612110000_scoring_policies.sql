BEGIN;

CREATE TABLE IF NOT EXISTS public.scoring_policies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region           text NOT NULL UNIQUE CHECK (region IN ('UAE', 'USA')),
  version_label    text NOT NULL,
  policy_json      jsonb NOT NULL,
  locked           boolean NOT NULL DEFAULT true,
  created_by       uuid REFERENCES public.users(id),
  updated_by       uuid REFERENCES public.users(id),
  updated_by_email text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scoring_policies_region
  ON public.scoring_policies (region);

DROP TRIGGER IF EXISTS trg_scoring_policies_updated_at ON public.scoring_policies;
CREATE TRIGGER trg_scoring_policies_updated_at
  BEFORE UPDATE ON public.scoring_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.scoring_policies ENABLE ROW LEVEL SECURITY;

COMMIT;
