import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAllowedOrigin, responseHeaders } from '../cms-api/lib/http.mjs';
import { validateInquiry, validateInquiryStatus, validatePortfolio } from '../cms-api/lib/validate.mjs';

test('portfolio validation normalizes safe editable project records', () => {
  const result = validatePortfolio({ projects: [{
    id: 'New Project!', title: ' Launch ', category: 'Web', year: '2026',
    description: 'Details', image: '/assets/work.webp', url: 'https://example.com/work',
    featured: 1, published: true,
  }] });
  assert.equal(result.projects[0].id, 'new-project');
  assert.equal(result.projects[0].title, 'Launch');
  assert.equal(result.projects[0].url, 'https://example.com/work');
  assert.equal(result.projects[0].featured, true);
});

test('portfolio validation rejects unsafe URLs and duplicate ids', () => {
  assert.throws(() => validatePortfolio({ projects: [{ id: 'x', title: 'X', category: 'Web', year: '2026', image: 'javascript:alert(1)', url: '/', published: true }] }), /URLs/);
  assert.throws(() => validatePortfolio({ projects: [
    { id: 'x', title: 'X', category: 'Web', year: '2026', image: '/x', url: '/x' },
    { id: 'x', title: 'Y', category: 'Web', year: '2026', image: '/y', url: '/y' },
  ] }), /Duplicate/);
});

test('inquiry validation rejects bots and validates statuses', () => {
  const inquiry = validateInquiry({ name: 'A Client', email: 'CLIENT@example.com', message: 'A real project', service: 'Website' });
  assert.equal(inquiry.email, 'client@example.com');
  assert.equal(validateInquiryStatus('Contacted'), 'contacted');
  assert.throws(() => validateInquiry({ name: 'Bot', email: 'bot@example.com', message: 'spam', website: 'filled' }), /rejected/);
  assert.throws(() => validateInquiryStatus('deleted'), /Invalid/);
});

test('public pages include the CMS enhancement and admin entry point', async () => {
  const home = await readFile(new URL('../lusion.co/index.html', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../lusion.co/admin/index.html', import.meta.url), 'utf8');
  const adminScript = await readFile(new URL('../lusion.co/admin/admin.js', import.meta.url), 'utf8');
  const siteScript = await readFile(new URL('../lusion.co/assets/cms/site.js', import.meta.url), 'utf8');
  assert.match(home, /assets\/cms\/site\.js/);
  assert.match(home, /assets\/cms\/site\.css/);
  assert.match(admin, /Technexa Admin/);
  assert.match(admin, /id="inquiry-search"/);
  assert.match(adminScript, /method: 'DELETE'/);
  assert.match(siteScript, /AbortSignal\.timeout/);
});

test('CMS CORS allows every deployed site origin and does not reflect unknown origins', () => {
  for (const origin of ['https://expercodevaibhav.github.io', 'https://technexasolutions.in', 'https://www.technexasolutions.in', 'http://localhost:3000']) {
    const request = new Request('https://technexa-cms-api.vercel.app/api/portfolio', { headers: { origin } });
    assert.equal(isAllowedOrigin(request), true);
    assert.equal(responseHeaders(request)['Access-Control-Allow-Origin'], origin);
  }
  const unknown = new Request('https://technexa-cms-api.vercel.app/api/portfolio', { headers: { origin: 'https://attacker.example' } });
  assert.equal(isAllowedOrigin(unknown), false);
  assert.equal(responseHeaders(unknown)['Access-Control-Allow-Origin'], undefined);
});
