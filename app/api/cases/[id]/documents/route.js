import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { logSupabaseError } from '@/lib/supabaseDiagnostics';
import { resolvePublicUser } from '@/lib/publicUser';
import {
  actionableDocumentItems,
  buildDocumentItems,
  buildDocumentRequestEmail,
  canonicalDocumentType,
  normalizeDocumentRegion,
  requiredDocumentTypes,
} from '@/app/_lib/documentWorkflow';

export const runtime = 'nodejs';

const DOCUMENT_BUCKET = process.env.SUPABASE_DOCUMENT_BUCKET || 'documents';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function requirePublicUser() {
  const authUser = await requireUser();
  if (!authUser) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };

  const { publicUser, error } = await resolvePublicUser(authUser);
  if (error) {
    return { response: NextResponse.json({ error: 'Failed to resolve user profile' }, { status: 500 }) };
  }
  if (!publicUser) {
    return {
      response: NextResponse.json(
        { error: 'Your user profile is not configured. Ask an admin to add your account.' },
        { status: 403 }
      ),
    };
  }

  return { authUser, publicUser };
}

async function fetchCase(id) {
  const query = supabaseAdmin.from('cases').select('*');
  const { data, error } = UUID_RE.test(id)
    ? await query.eq('id', id).maybeSingle()
    : await query.eq('case_ref', id).maybeSingle();

  if (error) {
    logSupabaseError('Document workflow case lookup failed', error, { caseId: id });
    return { error: NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 }) };
  }
  if (!data) return { error: NextResponse.json({ error: 'Case not found' }, { status: 404 }) };
  return { caseData: data };
}

async function fetchBundle(caseData) {
  const [documentsResult, requestsResult, auditResult] = await Promise.all([
    supabaseAdmin
      .from('documents')
      .select('*')
      .eq('case_id', caseData.id)
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('document_requests')
      .select('*')
      .eq('case_id', caseData.id)
      .order('requested_at', { ascending: false }),
    supabaseAdmin
      .from('audit_log')
      .select('*')
      .eq('case_id', caseData.id)
      .like('field_name', 'documents.%')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (documentsResult.error) {
    logSupabaseError('Document workflow documents lookup failed', documentsResult.error, { caseId: caseData.id });
    throw new Error('Failed to fetch documents');
  }
  if (requestsResult.error) {
    logSupabaseError('Document workflow requests lookup failed', requestsResult.error, { caseId: caseData.id });
    throw new Error('Failed to fetch document requests');
  }
  if (auditResult.error) {
    logSupabaseError('Document workflow audit lookup failed', auditResult.error, { caseId: caseData.id });
  }

  const documents = documentsResult.data || [];
  const requests = requestsResult.data || [];
  return {
    case: caseData,
    documents,
    requests,
    auditLog: auditResult.data || [],
    items: buildDocumentItems(caseData, documents, requests),
  };
}

export async function GET(_request, { params }) {
  const { response } = await requirePublicUser();
  if (response) return response;

  const { id } = await params;
  const { caseData, error } = await fetchCase(id);
  if (error) return error;

  try {
    return NextResponse.json(await fetchBundle(caseData));
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to load document workflow' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { response, authUser, publicUser } = await requirePublicUser();
  if (response) return response;

  const { id } = await params;
  const { caseData, error } = await fetchCase(id);
  if (error) return error;

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    return uploadProvidedDocument(request, caseData, authUser, publicUser);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body?.action === 'request_documents') {
    return requestDocuments(caseData, body, authUser, publicUser);
  }

  return NextResponse.json({ error: 'Unsupported document action' }, { status: 400 });
}

async function requestDocuments(caseData, body, authUser, publicUser) {
  let bundle;
  try {
    bundle = await fetchBundle(caseData);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to load document workflow' }, { status: 500 });
  }

  const region = normalizeDocumentRegion(caseData.region);
  const requiredTypes = new Set(requiredDocumentTypes(region));
  const selectedTypes = Array.isArray(body?.document_types)
    ? body.document_types.map((type) => canonicalDocumentType(type, region)).filter((type) => requiredTypes.has(type))
    : actionableDocumentItems(bundle.items).map((item) => item.documentType);
  const uniqueTypes = [...new Set(selectedTypes)];

  if (!uniqueTypes.length) {
    return NextResponse.json({ error: 'No actionable documents selected' }, { status: 400 });
  }

  const selectedItems = bundle.items.filter((item) => uniqueTypes.includes(item.documentType));
  const draft = buildDocumentRequestEmail(caseData, selectedItems);
  const existingPending = new Set(
    bundle.requests
      .filter((request) => request.status === 'pending')
      .map((request) => canonicalDocumentType(request.document_type, region))
  );
  const now = new Date();
  const rows = selectedItems
    .filter((item) => !existingPending.has(item.documentType))
    .map((item) => ({
      case_id: caseData.id,
      document_type: item.documentType,
      region,
      status: 'pending',
      requested_at: now.toISOString(),
      requested_by: publicUser.id,
      requested_by_email: publicUser.email || authUser.email || null,
      due_date: dueDateForItem(item, now),
      email_subject: draft.subject,
      email_body: draft.body,
      notes: item.expiryDate
        ? `${item.label} ${item.daysToExpiry < 0 ? 'expired' : 'expires'} ${item.expiryDate}.`
        : `${item.label} expiry date missing.`,
    }));

  if (rows.length) {
    const { error: insertError } = await supabaseAdmin.from('document_requests').insert(rows);
    if (insertError) {
      logSupabaseError('Document request insert failed', insertError, {
        caseId: caseData.id,
        documentTypes: uniqueTypes,
        authUserId: authUser.id,
        publicUserId: publicUser.id,
      });
      return NextResponse.json({ error: 'Failed to request documents' }, { status: 500 });
    }
  }

  const documentIdsToMark = selectedItems
    .map((item) => item.latestDocument?.id)
    .filter(Boolean);
  if (documentIdsToMark.length) {
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({ renewal_status: 'pending', updated_by: publicUser.id })
      .in('id', documentIdsToMark);

    if (updateError) {
      logSupabaseError('Document renewal status update failed', updateError, {
        caseId: caseData.id,
        documentIds: documentIdsToMark,
        authUserId: authUser.id,
        publicUserId: publicUser.id,
      });
    }
  }

  await insertDocumentAuditRows({
    caseId: caseData.id,
    items: selectedItems,
    fieldSuffix: 'requested',
    oldValue: null,
    newValue: {
      email_subject: draft.subject,
      document_types: uniqueTypes,
    },
    changedBy: publicUser.email || publicUser.id,
  });

  try {
    const updatedBundle = await fetchBundle(caseData);
    return NextResponse.json({ ...updatedBundle, draft });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Documents requested but refresh failed', draft }, { status: 500 });
  }
}

async function uploadProvidedDocument(request, caseData, authUser, publicUser) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const region = normalizeDocumentRegion(caseData.region);
  const requiredTypes = new Set(requiredDocumentTypes(region));
  const documentType = canonicalDocumentType(formData.get('document_type'), region);
  if (!requiredTypes.has(documentType)) {
    return NextResponse.json({ error: 'Unsupported document type for this region' }, { status: 400 });
  }

  const expiryDate = normalizeDate(formData.get('expiry_date'));
  if (!expiryDate) {
    return NextResponse.json({ error: 'expiry_date is required' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.name) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length) {
    return NextResponse.json({ error: 'file is empty' }, { status: 400 });
  }

  const safeName = safeFilename(file.name);
  const storagePath = `originals/${caseData.id}/${Date.now()}-${documentType}-${safeName}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    logSupabaseError('Document proof upload failed', uploadError, {
      caseId: caseData.id,
      documentType,
      authUserId: authUser.id,
      publicUserId: publicUser.id,
      bucket: DOCUMENT_BUCKET,
    });
    return NextResponse.json({ error: 'Failed to upload proof document' }, { status: 500 });
  }

  const notes = String(formData.get('notes') || '').trim() || null;
  const { data: insertedDocument, error: insertError } = await supabaseAdmin
    .from('documents')
    .insert({
      case_id: caseData.id,
      document_type: documentType,
      document_category: 'original',
      storage_path: storagePath,
      filename: file.name,
      file_size_bytes: bytes.length,
      expiry_date: expiryDate,
      renewal_status: 'received',
      notes,
      created_by: publicUser.id,
      updated_by: publicUser.id,
    })
    .select()
    .single();

  if (insertError || !insertedDocument) {
    logSupabaseError('Document record insert failed', insertError, {
      caseId: caseData.id,
      documentType,
      storagePath,
      authUserId: authUser.id,
      publicUserId: publicUser.id,
    });
    return NextResponse.json({ error: 'Uploaded proof but failed to save document record' }, { status: 500 });
  }

  const requestId = String(formData.get('request_id') || '').trim();
  const pendingRequest = requestId
    ? { id: requestId }
    : await latestPendingRequest(caseData.id, documentType);

  if (pendingRequest?.id) {
    const { error: updateRequestError } = await supabaseAdmin
      .from('document_requests')
      .update({
        status: 'provided',
        provided_document_id: insertedDocument.id,
        provided_at: new Date().toISOString(),
      })
      .eq('id', pendingRequest.id)
      .eq('case_id', caseData.id);

    if (updateRequestError) {
      logSupabaseError('Document request provided update failed', updateRequestError, {
        caseId: caseData.id,
        documentType,
        requestId: pendingRequest.id,
        authUserId: authUser.id,
        publicUserId: publicUser.id,
      });
    }
  }

  await insertDocumentAuditRows({
    caseId: caseData.id,
    items: [{ documentType }],
    fieldSuffix: 'provided',
    oldValue: null,
    newValue: {
      document_id: insertedDocument.id,
      filename: insertedDocument.filename,
      expiry_date: insertedDocument.expiry_date,
      storage_path: insertedDocument.storage_path,
    },
    changedBy: publicUser.email || publicUser.id,
  });

  try {
    return NextResponse.json(await fetchBundle(caseData));
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Document uploaded but refresh failed' }, { status: 500 });
  }
}

async function latestPendingRequest(caseId, documentType) {
  const { data, error } = await supabaseAdmin
    .from('document_requests')
    .select('id')
    .eq('case_id', caseId)
    .eq('document_type', documentType)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logSupabaseError('Latest pending document request lookup failed', error, { caseId, documentType });
  }
  return data || null;
}

async function insertDocumentAuditRows({ caseId, items, fieldSuffix, oldValue, newValue, changedBy }) {
  const now = new Date().toISOString();
  const rows = items.map((item) => ({
    case_id: caseId,
    field_name: `documents.${item.documentType}.${fieldSuffix}`,
    old_value: oldValue == null ? null : JSON.stringify(oldValue),
    new_value: JSON.stringify(newValue ?? null),
    value_type: 'top_level',
    changed_by: changedBy,
    changed_at: now,
  }));

  if (!rows.length) return;

  const { error } = await supabaseAdmin.from('audit_log').insert(rows);
  if (error) {
    logSupabaseError('Document workflow audit insert failed', error, { caseId, fieldSuffix });
  }
}

function dueDateForItem(item, now) {
  if (item.daysToExpiry !== null && item.daysToExpiry < 0) return formatDateOnly(now);
  if (item.daysToExpiry !== null && item.daysToExpiry <= 7) {
    return formatDateOnly(addDays(now, Math.max(item.daysToExpiry - 1, 0)));
  }
  return formatDateOnly(addDays(now, 7));
}

function addDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function formatDateOnly(value) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

function safeFilename(filename) {
  const cleaned = String(filename || 'document')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'document';
}
