import { del, get, list, put } from '@vercel/blob';

const ACCESS = 'private';
export const PORTFOLIO_PATH = 'cms/portfolio.json';
export const INQUIRY_PREFIX = 'cms/inquiries/';

export async function readRecord(pathname) {
  const result = await get(pathname, { access: ACCESS, useCache: false });
  if (!result || result.statusCode === 404) return null;
  if (result.statusCode !== 200) throw new Error(`Blob read failed with ${result.statusCode}`);
  return new Response(result.stream).json();
}

export async function writeRecord(pathname, value) {
  await put(pathname, JSON.stringify(value, null, 2), {
    access: ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return value;
}

export async function listInquiries() {
  const { blobs } = await list({ prefix: INQUIRY_PREFIX, limit: 1000 });
  const records = await Promise.all(blobs.map(blob => readRecord(blob.pathname)));
  return records.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function deleteInquiry(id) {
  await del(inquiryPath(id));
}

export function inquiryPath(id) {
  if (!/^[a-f0-9-]{20,64}$/i.test(id)) throw Object.assign(new Error('Invalid inquiry id.'), { status: 400 });
  return `${INQUIRY_PREFIX}${id}.json`;
}
