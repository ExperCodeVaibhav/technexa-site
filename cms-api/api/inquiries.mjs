import { randomUUID } from 'node:crypto';
import { errorResponse, json, options, readJson, requireAdmin, requireOrigin } from '../lib/http.mjs';
import { deleteInquiry, inquiryPath, listInquiries, readRecord, writeRecord } from '../lib/storage.mjs';
import { validateInquiry, validateInquiryStatus } from '../lib/validate.mjs';

export function OPTIONS(request) {
  return options(request);
}

export async function POST(request) {
  try {
    requireOrigin(request);
    const inquiry = validateInquiry(await readJson(request, 16_000));
    const id = randomUUID();
    const record = { id, ...inquiry, status: 'new', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await writeRecord(inquiryPath(id), record);
    return json(request, { ok: true, id }, 201, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function GET(request) {
  try {
    requireOrigin(request);
    requireAdmin(request);
    return json(request, { inquiries: await listInquiries() }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PATCH(request) {
  try {
    requireOrigin(request);
    requireAdmin(request);
    const input = await readJson(request, 4000);
    const pathname = inquiryPath(String(input.id || ''));
    const record = await readRecord(pathname);
    if (!record) throw Object.assign(new Error('Inquiry not found.'), { status: 404 });
    const updated = { ...record, status: validateInquiryStatus(input.status), updatedAt: new Date().toISOString() };
    await writeRecord(pathname, updated);
    return json(request, updated, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function DELETE(request) {
  try {
    requireOrigin(request);
    requireAdmin(request);
    const input = await readJson(request, 4000);
    const id = String(input.id || '');
    const record = await readRecord(inquiryPath(id));
    if (!record) throw Object.assign(new Error('Inquiry not found.'), { status: 404 });
    await deleteInquiry(id);
    return json(request, { ok: true, id }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(request, error);
  }
}
