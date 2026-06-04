import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const { token } = await req.json();

    const { data: conn, error: connError } = await supabaseAdmin
      .from('connections').select('*, cases(*)').eq('link_token', token).maybeSingle();
    if (connError) throw connError;
    if (!conn) return NextResponse.json({ error: 'invalid link' }, { status: 404 });
    if (conn.cases?.region !== 'USA')
      return NextResponse.json({ error: 'not a USA case' }, { status: 400 });

    let customerId = conn.stripe_customer;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: conn.cases?.venue ?? conn.cases?.venue_name ?? conn.cases?.name ?? 'Mezza venue',
        metadata: { case_id: conn.case_id, connection_id: conn.id },
      });
      customerId = customer.id;
    }

    const session = await stripe.financialConnections.sessions.create({
      account_holder: { type: 'customer', customer: customerId },
      permissions: ['balances', 'transactions', 'ownership'],
      prefetch: ['balances', 'ownership'],
    });

    const { error: updateError } = await supabaseAdmin.from('connections')
      .update({ stripe_customer: customerId, fc_session_id: session.id })
      .eq('id', conn.id);
    if (updateError) throw updateError;

    return NextResponse.json({
      clientSecret: session.client_secret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    });
  } catch (e) {
    console.error('Financial Connections session failed', {
      message: e?.message,
      type: e?.type,
      code: e?.code,
    });
    return NextResponse.json(
      { error: e?.message || 'Financial Connections session failed' },
      { status: 500 }
    );
  }
}
