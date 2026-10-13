import { createHash, timingSafeEqual } from 'node:crypto';

const DEFAULT_ORIGINS = [
  'https://expercodevaibhav.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(','))
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || allowedOrigins().includes(origin);
}

export function responseHeaders(request, extra = {}) {
  const origin = request.headers.get('origin');
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0],
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    ...extra,
  };
}

export function json(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders(request, extraHeaders) });
}

export function options(request) {
  return new Response(null, { status: 204, headers: responseHeaders(request) });
}

export function requireOrigin(request) {
  if (!isAllowedOrigin(request)) throw Object.assign(new Error('Origin is not allowed.'), { status: 403 });
}

export function requireAdmin(request) {
  const expected = process.env.ADMIN_KEY || '';
  const supplied = request.headers.get('x-admin-key') || '';
  if (expected.length < 20 || supplied.length < 20) throw Object.assign(new Error('Unauthorized.'), { status: 401 });
  const expectedHash = createHash('sha256').update(expected).digest();
  const suppliedHash = createHash('sha256').update(supplied).digest();
  if (!timingSafeEqual(expectedHash, suppliedHash)) throw Object.assign(new Error('Unauthorized.'), { status: 401 });
}

export async function readJson(request, maxBytes = 64_000) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  const raw = await request.text();
  if (raw.length > maxBytes) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON.'), { status: 400 });
  }
}

export function errorResponse(request, error) {
  const status = Number(error?.status) || 500;
  if (status >= 500) console.error('CMS API error', error);
  return json(request, { error: status >= 500 ? 'The service could not complete the request.' : error.message }, status);
}
