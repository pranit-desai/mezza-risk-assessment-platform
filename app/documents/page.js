import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';
import DocumentsPageClient from './DocumentsPageClient';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const [casesResult, documentsResult, documentRequestsResult] = await Promise.all([
    supabaseAdmin.from('cases').select('*'),
    supabaseAdmin
      .from('documents')
      .select('*')
      .order('expiry_date', { ascending: true, nullsFirst: false }),
    supabaseAdmin
      .from('document_requests')
      .select('*')
      .order('requested_at', { ascending: false }),
  ]);

  if (casesResult.error) logSupabaseError('Documents page cases lookup failed', casesResult.error);
  if (documentsResult.error) logSupabaseError('Documents page documents lookup failed', documentsResult.error);
  if (documentRequestsResult.error) logSupabaseError('Documents page requests lookup failed', documentRequestsResult.error);

  return (
    <DocumentsPageClient
      cases={casesResult.data ?? []}
      documents={documentsResult.data ?? []}
      documentRequests={documentRequestsResult.data ?? []}
      documentError={
        casesResult.error?.message ||
        documentsResult.error?.message ||
        documentRequestsResult.error?.message ||
        ''
      }
    />
  );
}
