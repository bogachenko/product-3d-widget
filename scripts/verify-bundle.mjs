import { readdir, readFile } from 'node:fs/promises';

const { default: viteConfig } = await import('../vite.config.ts');
if (viteConfig.build?.rolldownOptions?.output?.minify !== true) {
  throw new Error('Full production minification must remain enabled through build.rolldownOptions.output.minify.');
}

const files = await readdir('dist');
const mapFiles = files.filter((name) => name.endsWith('.js.map'));
const jsFiles = files.filter((name) => name.endsWith('.js'));
if (mapFiles.length === 0 || jsFiles.length === 0) throw new Error('Production JavaScript and source maps are missing.');

const packageRoots = new Set();
let threeSources = 0;
for (const file of mapFiles) {
  const map = JSON.parse(await readFile(`dist/${file}`, 'utf8'));
  for (const source of map.sources) {
    const marker = '/node_modules/three/';
    const index = source.indexOf(marker);
    if (index < 0) continue;
    threeSources += 1;
    packageRoots.add(source.slice(0, index + '/node_modules/three'.length));
  }
}
for (const file of jsFiles) {
  const bundle = await readFile(`dist/${file}`, 'utf8');
  if (/\bfrom\s*["']three(?:\/|["'])/.test(bundle) || /\bimport\s*\(["']three(?:\/|["'])/.test(bundle)) {
    throw new Error(`Production chunk ${file} still contains an external Three.js import.`);
  }
}
if (packageRoots.size !== 1) {
  throw new Error(`Expected one bundled Three.js package root, found ${packageRoots.size}: ${[...packageRoots].join(', ')}`);
}
console.log('PASS full production minification enabled');
console.log(`PASS single bundled Three.js root (${threeSources} source modules across ${mapFiles.length} chunks)`);
