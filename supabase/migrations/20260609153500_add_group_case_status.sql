BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'groups'
       AND column_name = 'case_status'
  ) THEN
    ALTER TABLE public.groups
      ADD COLUMN case_status text NOT NULL DEFAULT 'under_review';

    WITH mapped_cases AS (
      SELECT
        g.id AS group_id,
        CASE
          WHEN lower(c.status) = 'accepted' THEN 'approved'
          WHEN lower(c.status) IN (
            'under_review',
            'approved',
            'rejected',
            'on_hold',
            'additional_documents_requested'
          )
            THEN lower(c.status)
          ELSE 'under_review'
        END AS case_status
      FROM public.groups AS g
      JOIN public.cases AS c
        ON lower(trim(c.group_name)) = lower(trim(g.group_name))
       AND upper(coalesce(c.region, '')) = upper(coalesce(g.region, ''))
    ),
    rollup AS (
      SELECT
        group_id,
        CASE
          WHEN count(DISTINCT case_status) = 1 THEN max(case_status)
          WHEN bool_or(case_status = 'approved') THEN 'approved'
          WHEN bool_or(case_status = 'under_review') THEN 'under_review'
          WHEN bool_or(case_status = 'additional_documents_requested') THEN 'additional_documents_requested'
          WHEN bool_or(case_status = 'on_hold') THEN 'on_hold'
          ELSE 'rejected'
        END AS case_status
      FROM mapped_cases
      GROUP BY group_id
    )
    UPDATE public.groups AS g
       SET case_status = rollup.case_status
      FROM rollup
     WHERE g.id = rollup.group_id;
  END IF;
END $$;

ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_case_status_check;

ALTER TABLE public.groups
  ADD CONSTRAINT groups_case_status_check CHECK (
    case_status = ANY (ARRAY[
      'under_review',
      'approved',
      'rejected',
      'on_hold',
      'additional_documents_requested'
    ])
  );

COMMIT;
