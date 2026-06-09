-- ============================================================
-- Add on_hold case status and safe registry group region updates.
--
-- groups.region and venues.region are coupled by a composite FK.
-- Make that FK deferrable and expose a transactional RPC so the
-- application can update both sides together.
-- ============================================================

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
      'on_hold',
      'additional_documents_requested',
      'approved',
      'declined',
      'rejected',
      'expired'
    ])
  );

ALTER TABLE public.venues
  DROP CONSTRAINT IF EXISTS venues_group_region_fk;

ALTER TABLE public.venues
  ADD CONSTRAINT venues_group_region_fk
  FOREIGN KEY (group_id, region)
  REFERENCES public.groups(id, region)
  DEFERRABLE INITIALLY IMMEDIATE;

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

  RETURN updated_group;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_group_region(uuid, text, uuid) TO service_role;
