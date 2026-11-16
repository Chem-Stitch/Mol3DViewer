import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function build() {
  const source = resolve(root, 'src/index.html');
  let html = await readFile(source, 'utf8');
  // Replace by offsets, not replacement strings: JS can contain literal $ tokens.
  const pattern = /<link rel="stylesheet" href="([^"]+)">|<script src="([^"]+)"><\/script>/g;
  const matches = [...html.matchAll(pattern)];
  for (const match of matches.reverse()) {
    const content = await readFile(resolve(dirname(source), match[1] || match[2]), 'utf8');
    const tag = match[1] ? 'style' : 'script';
    if (new RegExp(`</${tag}`, 'i').test(content)) throw new Error(`Unsafe inline closing tag in ${match[1] || match[2]}`);
    html = html.slice(0, match.index) + `<${tag}>${content}</${tag}>` + html.slice(match.index + match[0].length);
  }
  await mkdir(resolve(root, 'dist'), { recursive: true });
  for (const target of ['index.html', 'dist/index.html', 'dist/Mol3DViewer.html']) {
    await writeFile(resolve(root, target), html);
  }
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
  console.log('Built index.html and dist/{index.html,Mol3DViewer.html}');
}
