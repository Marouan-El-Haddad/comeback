// Prints the gzip size of everything the build produced and fails when the app exceeds the
// budget in CLAUDE.md (150 kB JavaScript, 30 kB CSS). The explanations and figures (content/) are
// JSON files, not JavaScript: they get their own line, and the build fails when a start file refers
// to them or the service worker does not precache them (docs/SPEC.md 7). Run by `npm run build`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGET = { js: 150_000, css: 30_000 };

type Group = 'app-js' | 'app-css' | 'content-json' | 'service-worker' | 'probe-js' | 'probe-css';
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
  if (/^assets\/[^/]+\.json$/.test(file)) return 'content-json';
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
  'content-json': 'Content JSON',
  'service-worker': 'Service workers',
  'probe-js': 'Probe JavaScript',
  'probe-css': 'Probe CSS',
};
const limits: Partial<Record<Group, number>> = { 'app-js': BUDGET.js, 'app-css': BUDGET.css };
/** Groups with many files print one summary line instead of a line per file. */
const summarised = new Set<Group>(['content-json']);

console.log('\nBundle sizes (gzip)');
for (const group of Object.keys(labels) as Group[]) {
  const limit = limits[group];
  const files = entries.filter((e) => e.group === group);
  if (!limit && files.length === 0 && group !== 'content-json') continue;
  const note = summarised.has(group)
    ? ` (${files.length} files, not JavaScript and not in the budget)`
    : '';
  console.log(
    `  ${labels[group].padEnd(18)} ${kB(sum(group)).padStart(9)}${limit ? ` / ${kB(limit)}` : ''}${note}`,
  );
  if (summarised.has(group)) continue;
  for (const e of files) console.log(`    ${e.file.padEnd(40)} ${kB(e.gzip).padStart(9)}`);
}

const problems: string[] = [];
const over = (Object.keys(limits) as Group[]).filter((g) => sum(g) > (limits[g] ?? Infinity));
if (over.length > 0) problems.push(`Over budget: ${over.map((g) => labels[g]).join(', ')}`);

// The content must stay out of the start files: the files index.html loads before I dag is drawn.
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const startFiles = [...html.matchAll(/(?:src|href)="[^"]*\/(assets\/[^"]+\.js)"/g)].map(
  (m) => m[1] ?? '',
);
const content = entries.filter((e) => e.group === 'content-json').map((e) => e.file);
const names = content.map((file) => file.slice('assets/'.length));
let startClean = true;
for (const start of startFiles) {
  const code = readFileSync(join(DIST, start), 'utf8');
  const named = names.filter((name) => code.includes(name));
  if (named.length > 0) {
    startClean = false;
    problems.push(
      `${start} is a start file and refers to content (${named.join(', ')}): import src/content/load.ts only from code loaded with lazy()`,
    );
  }
}
console.log(`  Start files: ${startFiles.join(', ')}${startClean ? ' (no content)' : ''}`);

// Every content file must be precached, so the cards also work without a network.
const sw = existsSync(join(DIST, 'sw.js')) ? readFileSync(join(DIST, 'sw.js'), 'utf8') : '';
const missing = content.filter((file) => !sw.includes(`"${file}"`));
if (missing.length > 0) problems.push(`Not precached by sw.js: ${missing.join(', ')}`);

if (problems.length > 0) {
  for (const p of problems) console.error(`\n${p}`);
  process.exitCode = 1;
}
