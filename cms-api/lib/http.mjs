import { createHash, timingSafeEqual } from 'node:crypto';

const DEFAULT_ORIGINS = [
  'https://expercodevaibhav.github.io',
  'https://technexasolutions.in',
  'https://www.technexasolutions.in',
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
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Username, X-Admin-Password',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
    ...extra,
  };
  if (origin && allowedOrigins().includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
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
  const expectedUsername = process.env.ADMIN_USERNAME || '';
  const expectedPassword = process.env.ADMIN_PASSWORD || '';
  const suppliedUsername = request.headers.get('x-admin-username') || '';
  const suppliedPassword = request.headers.get('x-admin-password') || '';
  if (!expectedUsername || !expectedPassword
    || !credentialsMatch(expectedUsername, suppliedUsername)
    || !credentialsMatch(expectedPassword, suppliedPassword)) {
    throw Object.assign(new Error('Invalid username or password.'), { status: 401 });
  }
}

function credentialsMatch(expected, supplied) {
  const expectedHash = createHash('sha256').update(expected).digest();
  const suppliedHash = createHash('sha256').update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
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
