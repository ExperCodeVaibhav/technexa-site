import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(workspace, 'lusion.co');
const output = path.join(workspace, '_site');
const base = (process.env.PAGES_BASE_PATH || '/sitaram').replace(/\/$/, '');
if (!/^\/[a-zA-Z0-9_-]+$/.test(base)) throw new Error('PAGES_BASE_PATH must be one repository path, such as /sitaram');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

function replaceOnce(text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`Expected one occurrence of: ${from}`);
  return text.replace(from, to);
}

for (const relative of await readdir(output, { recursive: true })) {
  const file = path.join(output, relative);
  if (!/\.(html|css|js)$/.test(relative)) continue;
  let text = await readFile(file, 'utf8');
  if (relative.endsWith('.html')) {
    // Leave data-path values as logical routes; the router applies the base.
    text = text.replace(/\b(href|src|data-filename)="\/(?!\/)([^"]*)"/g,
      (_, attribute, value) => `${attribute}="${base}/${value}"`);
  } else if (relative.endsWith('.css')) {
    text = text.replace(/url\((['"]?)\/(?!\/)/g, `url($1${base}/`);
  } else if (relative.endsWith('hoisted.CUO_IjfL.js')) {
    text = text.replaceAll('"/assets/', `"${base}/assets/`);
    text = replaceOnce(text, 'class RouteManager{', `const PAGES_BASE=${JSON.stringify(base)};class RouteManager{`);
    text = replaceOnce(text, 'parsePath(e){return e=',
      'parsePath(e){if(e===PAGES_BASE)e="";else if(e.startsWith(PAGES_BASE+"/"))e=e.slice(PAGES_BASE.length);return e=');
    text = replaceOnce(text, 'properties.loader.load("/"+e,{type:"text"',
      'properties.loader.load(PAGES_BASE+"/"+(e?e+"/":"")+"index.html",{type:"text"');
    text = replaceOnce(text, 'history.pushState(null,null,("/"+e)',
      'history.pushState(null,null,(PAGES_BASE+"/"+(e?e+"/":""))');
    text = text.replaceAll('window.location.href=window.location.origin)',
      'window.location.href=window.location.origin+PAGES_BASE+"/")');
  }
  await writeFile(file, text);
}
await writeFile(path.join(output, '.nojekyll'), '');
console.log(`Built GitHub Pages site in _site with base ${base}/`);
