import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  assert.match(home, /assets\/cms\/site\.js/);
  assert.match(home, /assets\/cms\/site\.css/);
  assert.match(admin, /Technexa Admin/);
});
