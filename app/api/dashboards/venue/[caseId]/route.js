import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';
import {
  dashboardHtmlResponse,
  renderVenueDashboard,
} from '@/app/_lib/dashboardTemplates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function fetchCase(caseId) {
  const query = supabaseAdmin.from('cases').select('*');
  const { data, error } = UUID_RE.test(caseId)
    ? await query.eq('id', caseId).maybeSingle()
    : await query.eq('case_ref', caseId).maybeSingle();

  if (error) return { error };
  return { caseData: data };
}

async function fetchDocuments(caseId) {
  const [documentsResult, requestsResult] = await Promise.all([
    supabaseAdmin
      .from('documents')
      .select('*')
      .eq('case_id', caseId)
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('document_requests')
      .select('*')
      .eq('case_id', caseId)
      .order('requested_at', { ascending: false }),
  ]);

  return {
    documents: documentsResult.data || [],
    requests: requestsResult.data || [],
    error: documentsResult.error || requestsResult.error,
  };
}

export async function GET(_request, { params }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { caseId } = await params;
  const { caseData, error } = await fetchCase(caseId);
  if (error) {
    logSupabaseError('Venue dashboard case lookup failed', error, { caseId, authUserId: user.id });
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
  if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  const bundle = await fetchDocuments(caseData.id);
  if (bundle.error) {
    logSupabaseError('Venue dashboard document lookup failed', bundle.error, {
      caseId: caseData.id,
      authUserId: user.id,
    });
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }

  return dashboardHtmlResponse(await renderVenueDashboard(caseData, bundle.documents, bundle.requests));
}
