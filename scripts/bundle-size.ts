// Prints the gzip size of everything the build produced and fails when the app exceeds the
// budget in CLAUDE.md (150 kB JavaScript, 30 kB CSS). Run by `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGET = { js: 150_000, css: 30_000 };

type Group = 'app-js' | 'app-css' | 'service-worker' | 'probe-js' | 'probe-css';
type Entry = { file: string; group: Group; gzip: number };

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

function groupOf(file: string): Group | null {
  const isProbe = file.startsWith('probe/');
  const name = file.split('/').pop() ?? '';
  const isServiceWorker = name === 'sw.js' || /^workbox-[\w-]+\.js$/.test(name);
  if (file.endsWith('.css')) return isProbe ? 'probe-css' : 'app-css';
  if (!file.endsWith('.js')) return null;
  if (isServiceWorker) return 'service-worker';
  return isProbe ? 'probe-js' : 'app-js';
}

const entries: Entry[] = [];
for (const path of walk(DIST)) {
  const file = relative(DIST, path).split('\\').join('/');
  const group = groupOf(file);
  if (group) entries.push({ file, group, gzip: gzipSync(readFileSync(path), { level: 9 }).length });
}

const kB = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`;
const sum = (group: Group) =>
  entries.filter((e) => e.group === group).reduce((total, e) => total + e.gzip, 0);

const labels: Record<Group, string> = {
  'app-js': 'App JavaScript',
  'app-css': 'App CSS',
  'service-worker': 'Service workers',
  'probe-js': 'Probe JavaScript',
  'probe-css': 'Probe CSS',
};
const limits: Partial<Record<Group, number>> = { 'app-js': BUDGET.js, 'app-css': BUDGET.css };

console.log('\nBundle sizes (gzip)');
for (const group of Object.keys(labels) as Group[]) {
  const limit = limits[group];
  if (!limit && !entries.some((e) => e.group === group)) continue;
  console.log(
    `  ${labels[group].padEnd(18)} ${kB(sum(group)).padStart(9)}${limit ? ` / ${kB(limit)}` : ''}`,
  );
  for (const e of entries.filter((x) => x.group === group)) {
    console.log(`    ${e.file.padEnd(40)} ${kB(e.gzip).padStart(9)}`);
  }
}

const over = (Object.keys(limits) as Group[]).filter((g) => sum(g) > (limits[g] ?? Infinity));
if (over.length > 0) {
  console.error(`\nOver budget: ${over.map((g) => labels[g]).join(', ')}`);
  process.exitCode = 1;
}
