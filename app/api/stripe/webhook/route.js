import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.text();               // RAW body — required for signature check
  const sig = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `bad signature: ${err.message}` }, { status: 400 });
  }

  // Skip if we've already processed this event
  const { error: dup } = await supabaseAdmin
    .from('webhook_events').insert({ id: event.id, type: event.type });
  if (dup) return NextResponse.json({ received: true });

  const acct = event.data.object;

  try {
    switch (event.type) {
      case 'financial_connections.account.created': {
        const customerId = acct.account_holder?.customer;
        const { data: conn } = await supabaseAdmin
          .from('connections').select('id, case_id').eq('stripe_customer', customerId).maybeSingle();

        await supabaseAdmin.from('fc_accounts').upsert({
          id: acct.id,
          connection_id: conn?.id,
          case_id: conn?.case_id,
          institution_name: acct.institution_name,
          display_name: acct.display_name,
          last4: acct.last4,
          category: acct.category,
          status: acct.status,
          updated_at: new Date().toISOString(),
        });

        if (conn) {
          await supabaseAdmin.from('connections')
            .update({ status: 'connected', connected_at: new Date().toISOString() })
            .eq('id', conn.id);
        }

        await stripe.financialConnections.accounts.subscribe(acct.id, { features: ['transactions'] });
        await stripe.financialConnections.accounts.refresh(acct.id, { features: ['transactions'] });
        break;
      }

      case 'financial_connections.account.refreshed_balance': {
        await supabaseAdmin.from('fc_accounts')
          .update({ balance: acct.balance, updated_at: new Date().toISOString() })
          .eq('id', acct.id);
        break;
      }

      case 'financial_connections.account.refreshed_ownership': {
        const owners = await stripe.financialConnections.accounts.owners.list(acct.id, {
          ownership: acct.ownership, limit: 10,
        });
        await supabaseAdmin.from('fc_accounts')
          .update({ ownership: owners.data, updated_at: new Date().toISOString() })
          .eq('id', acct.id);
        break;
      }

      case 'financial_connections.account.refreshed_transactions': {
        const { data: row } = await supabaseAdmin
          .from('fc_accounts').select('last_txn_refresh').eq('id', acct.id).maybeSingle();

        const txns = await stripe.financialConnections.transactions.list({
          account: acct.id,
          transaction_refresh: row?.last_txn_refresh ? { after: row.last_txn_refresh } : undefined,
          limit: 100,
        });

        for (const t of txns.data) {
          await supabaseAdmin.from('fc_transactions').upsert({
            id: t.id, account_id: acct.id, amount: t.amount, currency: t.currency,
            description: t.description, status: t.status, transacted_at: t.transacted_at, raw: t,
          });
        }
        await supabaseAdmin.from('fc_accounts')
          .update({ last_txn_refresh: acct.transaction_refresh?.id }).eq('id', acct.id);
        break;
      }

      case 'financial_connections.account.deactivated':
      case 'financial_connections.account.disconnected': {
        await supabaseAdmin.from('fc_accounts').update({ status: 'inactive' }).eq('id', acct.id);
        break;
      }
    }
  } catch (e) {
    // Let Stripe retry: remove the idempotency row so the retry reprocesses
    await supabaseAdmin.from('webhook_events').delete().eq('id', event.id);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
