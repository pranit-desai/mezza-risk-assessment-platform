BEGIN;

WITH case_groups AS (
  SELECT
    trim(group_name) AS group_name,
    CASE
      WHEN upper(coalesce(region, '')) = 'USA' THEN 'USA'
      ELSE 'UAE'
    END AS region,
    NULLIF(max(nullif(commercial_poc, '')), '') AS commercial_poc,
    min(created_at) AS created_at,
    max(updated_at) AS updated_at
  FROM public.cases
  WHERE nullif(trim(group_name), '') IS NOT NULL
  GROUP BY
    trim(group_name),
    CASE
      WHEN upper(coalesce(region, '')) = 'USA' THEN 'USA'
      ELSE 'UAE'
    END
),
mapped_case_groups AS (
  SELECT
    cg.*,
    lower(
      trim(both '-' from regexp_replace(cg.group_name, '[^A-Za-z0-9]+', '-', 'g'))
    ) AS base_group_key
  FROM case_groups AS cg
),
status_rollup AS (
  SELECT
    mcg.group_name,
    mcg.region,
    CASE
      WHEN count(DISTINCT mapped_status) = 1 THEN max(mapped_status)
      WHEN bool_or(mapped_status = 'approved') THEN 'approved'
      WHEN bool_or(mapped_status = 'under_review') THEN 'under_review'
      WHEN bool_or(mapped_status = 'additional_documents_requested') THEN 'additional_documents_requested'
      WHEN bool_or(mapped_status = 'on_hold') THEN 'on_hold'
      ELSE 'rejected'
    END AS case_status
  FROM mapped_case_groups AS mcg
  JOIN LATERAL (
    SELECT
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
      END AS mapped_status
    FROM public.cases AS c
    WHERE lower(trim(c.group_name)) = lower(mcg.group_name)
      AND (
        CASE WHEN upper(coalesce(c.region, '')) = 'USA' THEN 'USA' ELSE 'UAE' END
      ) = mcg.region
  ) AS statuses ON true
  GROUP BY mcg.group_name, mcg.region
)
INSERT INTO public.groups (
  group_key,
  group_name,
  region,
  commercial_poc,
  case_status,
  created_at,
  updated_at
)
SELECT
  left(coalesce(nullif(mcg.base_group_key, ''), 'group'), 70) || '-' || lower(mcg.region) AS group_key,
  mcg.group_name,
  mcg.region,
  mcg.commercial_poc,
  coalesce(sr.case_status, 'under_review') AS case_status,
  coalesce(mcg.created_at, now()) AS created_at,
  coalesce(mcg.updated_at, now()) AS updated_at
FROM mapped_case_groups AS mcg
LEFT JOIN status_rollup AS sr
  ON sr.group_name = mcg.group_name
 AND sr.region = mcg.region
WHERE NOT EXISTS (
  SELECT 1
  FROM public.groups AS g
  WHERE lower(trim(g.group_name)) = lower(mcg.group_name)
    AND upper(g.region) = mcg.region
)
ON CONFLICT (group_key) DO NOTHING;

COMMIT;
