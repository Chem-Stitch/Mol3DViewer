import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from '../scripts/build.mjs';

test('portable build embeds assets in source order and preserves license notices', async () => {
  const html = await build();
  assert.doesNotMatch(html, /<script src=|<link rel="stylesheet"/);
  assert.match(html, /id="third-party-licenses"/);
  const template = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  let previous = -1;
  for (const match of template.matchAll(/<script src="([^"]+)"><\/script>/g)) {
    const content = await readFile(new URL(`../src/${match[1]}`, import.meta.url), 'utf8');
    const position = html.indexOf(`<script>${content}</script>`);
    assert.ok(position > previous, `${match[1]} must appear unchanged and in order`);
    previous = position;
  }
  for (const file of ['index.html', 'dist/index.html', 'dist/Mol3DViewer.html']) {
    assert.equal(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'), html);
  }
  assert.equal(await build(), html, 'build must be deterministic');
});
