import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from '../server.mjs';

let server, origin;
before(async () => {
  server = createServer({ recover: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('every downloaded page works at its clean URL with resolvable local links', async () => {
  const files = await readdir(new URL('../lusion.co/', import.meta.url), { recursive: true });
  const pages = files.filter(file => /(^|[\\/])index\.html$/.test(file) && !/^admin[\\/]/.test(file));
  assert.ok(pages.length >= 20);
  for (const file of pages) {
    const route = '/' + file.replaceAll('\\', '/').replace(/(^|\/)index\.html$/, '');
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.match(html, /class="page/);
    for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
      assert.equal((await fetch(origin + match[1], { method: 'HEAD' })).status, 200, `${route}: ${match[1]}`);
    }
  }
});

test('legacy and trailing-slash URLs redirect to the canonical route', async () => {
  for (const [from, to] of [['/index.html', '/'], ['/about/', '/about'], ['/lusion.co/projects/worldcoin/index.html', '/projects/worldcoin']]) {
    const response = await fetch(origin + from + '?test=1', { redirect: 'manual' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), to + '?test=1');
  }
});

test('range requests return the correct bytes for media seeking', async () => {
  const content = await readFile(new URL('../lusion.co/assets/meta/favicon.ico', import.meta.url));
  const response = await fetch(origin + '/assets/meta/favicon.ico', { headers: { Range: 'bytes=2-9' } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), `bytes 2-9/${content.length}`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), content.subarray(2, 10));
  const suffix = await fetch(origin + '/assets/meta/favicon.ico', { headers: { Range: 'bytes=-4' } });
  assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), content.subarray(-4));
  assert.equal((await fetch(origin + '/assets/meta/favicon.ico', { headers: { Range: 'bytes=999999999-' } })).status, 416);
});

test('server returns real 404s and keeps workspace files private', async () => {
  for (const route of ['/missing', '/hts-log.txt', '/package.json', '/assets/missing.png']) {
    assert.equal((await fetch(origin + route)).status, 404, route);
  }
  assert.equal((await fetch(origin + '/%E0%A4%A')).status, 400);
  assert.equal((await fetch(origin + '/assets/%5C..%5Cpackage.json')).status, 400);
  assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
});
