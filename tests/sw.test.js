import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const assets = [...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((f) => {
    const rel = `${dir}/${f}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

test('Service Worker speichert alle App-Dateien für den Offline-Betrieb', () => {
  const needed = ['index.html', 'manifest.webmanifest', ...walk('css'), ...walk('js'), ...walk('data'), ...walk('assets')];
  for (const f of needed) assert.ok(assets.includes(f), `${f} fehlt in sw.js`);
  for (const f of assets) if (f !== './') assert.ok(existsSync(join(root, f)), `${f} gibt es nicht`);
});

test('Manifest verweist auf vorhandene Icons', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.ok(manifest.icons.some((i) => i.sizes === '192x192'));
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512'));
  for (const i of manifest.icons) assert.ok(existsSync(join(root, i.src)), i.src);
});
