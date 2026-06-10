import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';
import BankingPageClient from './BankingPageClient';

export const dynamic = 'force-dynamic';

export default async function BankingPage() {
  const [
    casesResult,
    connectionsResult,
    accountsResult,
    txnsResult,
    documentsResult,
    documentRequestsResult,
  ] = await Promise.all([
    supabaseAdmin.from('cases').select('*'),
    supabaseAdmin.from('connections').select('*'),
    supabaseAdmin.from('fc_accounts').select('*'),
    supabaseAdmin
      .from('fc_transactions')
      .select('*')
      .order('transacted_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('documents')
      .select('*')
      .order('expiry_date', { ascending: true, nullsFirst: false }),
    supabaseAdmin
      .from('document_requests')
      .select('*')
      .order('requested_at', { ascending: false }),
  ]);

  if (casesResult.error) logSupabaseError('Banking cases lookup failed', casesResult.error);
  if (connectionsResult.error) logSupabaseError('Banking connections lookup failed', connectionsResult.error);
  if (accountsResult.error) logSupabaseError('Banking accounts lookup failed', accountsResult.error);
  if (txnsResult.error) logSupabaseError('Banking transactions lookup failed', txnsResult.error);
  if (documentsResult.error) logSupabaseError('Banking documents lookup failed', documentsResult.error);
  if (documentRequestsResult.error) logSupabaseError('Banking document requests lookup failed', documentRequestsResult.error);

  return (
    <BankingPageClient
      cases={casesResult.data ?? []}
      connections={connectionsResult.data ?? []}
      accounts={accountsResult.data ?? []}
      transactions={txnsResult.data ?? []}
      documents={documentsResult.data ?? []}
      documentRequests={documentRequestsResult.data ?? []}
      error={casesResult.error?.message || connectionsResult.error?.message || accountsResult.error?.message || txnsResult.error?.message || ''}
      documentError={documentsResult.error?.message || documentRequestsResult.error?.message || ''}
    />
  );
}
