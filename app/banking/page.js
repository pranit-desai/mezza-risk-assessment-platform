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
  ] = await Promise.all([
    supabaseAdmin.from('cases').select('*'),
    supabaseAdmin.from('connections').select('*'),
    supabaseAdmin.from('fc_accounts').select('*'),
    supabaseAdmin
      .from('fc_transactions')
      .select('*')
      .order('transacted_at', { ascending: false })
      .limit(500),
  ]);

  if (casesResult.error) logSupabaseError('Banking cases lookup failed', casesResult.error);
  if (connectionsResult.error) logSupabaseError('Banking connections lookup failed', connectionsResult.error);
  if (accountsResult.error) logSupabaseError('Banking accounts lookup failed', accountsResult.error);
  if (txnsResult.error) logSupabaseError('Banking transactions lookup failed', txnsResult.error);

  return (
    <BankingPageClient
      cases={casesResult.data ?? []}
      connections={connectionsResult.data ?? []}
      accounts={accountsResult.data ?? []}
      transactions={txnsResult.data ?? []}
      error={casesResult.error?.message || connectionsResult.error?.message || accountsResult.error?.message || txnsResult.error?.message || ''}
    />
  );
}
