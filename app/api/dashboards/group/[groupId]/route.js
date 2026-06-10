import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';
import {
  dashboardHtmlResponse,
  renderGroupDashboard,
} from '@/app/_lib/dashboardTemplates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function fetchRegisteredGroup(identifier) {
  if (UUID_RE.test(identifier)) {
    const { data, error } = await supabaseAdmin
      .from('groups')
      .select('*')
      .eq('id', identifier)
      .maybeSingle();
    return { groupData: data, error };
  }

  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('*')
    .eq('group_key', identifier)
    .maybeSingle();
  return { groupData: data, error };
}

function parseLooseGroup(identifier) {
  const match = String(identifier || '').match(/^(UAE|USA):(.*)$/i);
  if (!match) return null;
  return {
    region: match[1].toUpperCase(),
    group_name: match[2] || 'Ungrouped',
    group_key: '',
  };
}

async function fetchCasesForGroup(groupData) {
  if (groupData?.id) {
    const byId = await supabaseAdmin
      .from('cases')
      .select('*')
      .eq('group_id', groupData.id)
      .order('created_at', { ascending: false });
    if (byId.error) return { error: byId.error };
    if (byId.data?.length) return { cases: byId.data };
  }

  const query = supabaseAdmin
    .from('cases')
    .select('*')
    .eq('group_name', groupData.group_name)
    .order('created_at', { ascending: false });

  const { data, error } = groupData.region
    ? await query.eq('region', groupData.region)
    : await query;
  return { cases: data || [], error };
}

async function fetchDocumentRows(caseIds) {
  if (!caseIds.length) return { documents: [], requests: [] };

  const [documentsResult, requestsResult] = await Promise.all([
    supabaseAdmin
      .from('documents')
      .select('*')
      .in('case_id', caseIds)
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('document_requests')
      .select('*')
      .in('case_id', caseIds)
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

  const { groupId } = await params;
  const identifier = decodeURIComponent(groupId);
  let { groupData, error } = await fetchRegisteredGroup(identifier);

  if (error) {
    logSupabaseError('Group dashboard registered group lookup failed', error, {
      groupId: identifier,
      authUserId: user.id,
    });
    return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 });
  }

  if (!groupData) {
    groupData = parseLooseGroup(identifier);
  }
  if (!groupData) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const casesResult = await fetchCasesForGroup(groupData);
  if (casesResult.error) {
    logSupabaseError('Group dashboard cases lookup failed', casesResult.error, {
      groupId: identifier,
      authUserId: user.id,
    });
    return NextResponse.json({ error: 'Failed to fetch group cases' }, { status: 500 });
  }

  const caseIds = (casesResult.cases || []).map((row) => row.id).filter(Boolean);
  const documentRows = await fetchDocumentRows(caseIds);
  if (documentRows.error) {
    logSupabaseError('Group dashboard document lookup failed', documentRows.error, {
      groupId: identifier,
      authUserId: user.id,
    });
    return NextResponse.json({ error: 'Failed to fetch group documents' }, { status: 500 });
  }

  return dashboardHtmlResponse(
    await renderGroupDashboard(groupData, casesResult.cases || [], documentRows.documents, documentRows.requests)
  );
}
