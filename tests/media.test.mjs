import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundle = await readFile(new URL('../lusion.co/_astro/hoisted.CUO_IjfL.js', import.meta.url), 'utf8');

test('interrupted playback is handled and simultaneous play requests are coalesced', async () => {
  const start = bundle.indexOf('const pendingMediaPlays=');
  const end = bundle.indexOf('class AudioItem{', start);
  const sandbox = { console, WeakSet, Promise };
  vm.runInNewContext(bundle.slice(start, end), sandbox);
  let reject, calls = 0;
  const media = { play() { calls++; return new Promise((_, fail) => { reject = fail; }); } };
  sandbox.playMedia(media);
  sandbox.playMedia(media);
  assert.equal(calls, 1);
  reject(Object.assign(new Error('paused'), { name: 'AbortError' }));
  await new Promise(resolve => setImmediate(resolve));
  sandbox.playMedia(media);
  assert.equal(calls, 2);
  reject(Object.assign(new Error('autoplay blocked'), { name: 'NotAllowedError' }));
  await new Promise(resolve => setImmediate(resolve));
});

test('a late image cannot overwrite the current project card and repeated activation reuses it', () => {
  const start = bundle.indexOf('_initImage(){');
  const end = bundle.indexOf('_initText(){', start);
  const requests = [];
  const sandbox = {
    browser$1: { isMobile: false }, settings: { CDN_PATH: '', USE_WEBGL2: true },
    textureHelper: { blackTexture: {} }, LinearMipmapLinearFilter: 1, LinearFilter: 2,
    Image: class {}, Texture: class { dispose() { this.disposed = true; } },
    properties: { loader: { load(url, options) { requests.push({ url, ...options }); } } },
  };
  const init = vm.runInNewContext(`({${bundle.slice(start, end)}})._initImage`, sandbox);
  const card = { imgVersion: 0, texture: null, data: { filename: '/old', width: 100, height: 50 },
    uniforms: { u_texture: { value: null }, u_textureSize: { value: { set() {} } } } };
  init.call(card);
  card.data.filename = '/current';
  init.call(card);
  requests[1].onLoad(requests[1].content);
  requests[0].onLoad(requests[0].content);
  assert.equal(card.texture.__url, '/current.webp');
  assert.equal(card.uniforms.u_texture.value, requests[1].content);
  assert.equal(requests[0].content.disposed, undefined);
  init.call(card);
  assert.equal(requests.length, 2);
  // The global loader returns its cached texture on a later visit. Its original
  // version belongs to the old request, so freshness must use the callback scope.
  card.data.filename = '/old';
  init.call(card);
  requests[2].onLoad(requests[0].content);
  assert.equal(card.texture.__url, '/old.webp');
  assert.equal(card.texture.needsUpdate, true);
});
