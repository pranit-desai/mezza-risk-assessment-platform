BEGIN;

CREATE TABLE IF NOT EXISTS public.document_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_type        text NOT NULL,
  region               text NOT NULL CHECK (region IN ('UAE', 'USA')),
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'provided', 'closed', 'not_needed')),
  requested_at         timestamptz NOT NULL DEFAULT now(),
  requested_by         uuid REFERENCES public.users(id),
  requested_by_email   text,
  due_date             date,
  email_subject        text,
  email_body           text,
  provided_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  provided_at          timestamptz,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_requests_case_id
  ON public.document_requests (case_id);

CREATE INDEX IF NOT EXISTS idx_document_requests_status
  ON public.document_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_requests_provided_at
  ON public.document_requests (provided_at)
  WHERE provided_at IS NOT NULL;

DROP TRIGGER IF EXISTS trg_document_requests_updated_at ON public.document_requests;
CREATE TRIGGER trg_document_requests_updated_at
  BEFORE UPDATE ON public.document_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
