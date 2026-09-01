import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const watch = process.argv.includes('--watch');

function prepareStatic() {
  if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, 'popup'), { recursive: true });
  mkdirSync(join(dist, 'options'), { recursive: true });
  mkdirSync(join(dist, 'background'), { recursive: true });
  mkdirSync(join(dist, 'content'), { recursive: true });
  mkdirSync(join(dist, 'mock'), { recursive: true });
  mkdirSync(join(dist, 'assets', 'icons'), { recursive: true });

  cpSync(join(root, 'manifest.json'), join(dist, 'manifest.json'));
  cpSync(join(root, 'src/popup/popup.html'), join(dist, 'popup/popup.html'));
  cpSync(join(root, 'src/popup/popup.css'), join(dist, 'popup/popup.css'));
  cpSync(join(root, 'src/options/options.html'), join(dist, 'options/options.html'));
  cpSync(join(root, 'src/options/options.css'), join(dist, 'options/options.css'));
  cpSync(join(root, 'src/mock'), join(dist, 'mock'), { recursive: true });
  cpSync(join(root, 'src/assets'), join(dist, 'assets'), { recursive: true });

  // Fix HTML script refs to compiled .js
  for (const page of ['popup', 'options']) {
    const htmlPath = join(dist, page, `${page}.html`);
    const html = readFileSync(htmlPath, 'utf8').replace(`${page}.ts`, `${page}.js`);
    writeFileSync(htmlPath, html);
  }
}

const entryPoints = [
  join(root, 'src/background/serviceWorker.ts'),
  join(root, 'src/content/contentScript.ts'),
  join(root, 'src/popup/popup.ts'),
  join(root, 'src/options/options.ts'),
];

prepareStatic();

const ctx = await esbuild.context({
  entryPoints,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['chrome120'],
  outdir: dist,
  outbase: join(root, 'src'),
  sourcemap: true,
  logLevel: 'info',
});

if (watch) {
  await ctx.watch();
  console.log('Watching extension sources…');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Built apps/plugthis-extension/dist');
}
