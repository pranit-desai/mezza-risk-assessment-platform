BEGIN;

-- Track which scoring policy version was active when a case was scored.
-- This ensures editing bands later does not silently change historical scores.
-- Set at scoring time by the app layer; never updated automatically.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS scoring_policy_version text;

COMMIT;
