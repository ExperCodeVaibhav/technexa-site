import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../lusion.co/', import.meta.url));
const headTag = '<link href="/assets/cms/site.css" rel="stylesheet"/>';
const scriptTag = '<script src="/assets/cms/site.js" type="module"></script>';

for (const relative of await readdir(root, { recursive: true })) {
  if (!relative.endsWith('.html') || relative.startsWith(`admin${path.sep}`)) continue;
  const file = path.join(root, relative);
  let html = await readFile(file, 'utf8');
  if (!html.includes(headTag)) html = html.replace('</head>', `${headTag}</head>`);
  if (!html.includes(scriptTag)) html = html.replace('</body>', `${scriptTag}</body>`);
  await writeFile(file, html);
}

console.log('Injected CMS portfolio and inquiry enhancements into site pages.');
