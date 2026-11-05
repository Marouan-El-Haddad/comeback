// Loads the explanations and figures in content/ when a screen needs them (docs/SPEC.md 7 and 9.1,
// docs/DECISIONS.md D37). Vite publishes every file as its own JSON file – not JavaScript and not in
// the start files – and the service worker precaches them, so they also load without a network.
// Import this module only from code that is loaded with lazy() (src/ui/lazy.tsx): `npm run build`
// fails when a start file refers to the content.
import { CONTENT_FORMAT, type ExplainFile, type FigureFile } from './types.ts';

type Urls = Record<string, string>;

const EXPLAIN: Urls = import.meta.glob<string>('/content/explain/*.json', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
});
const FIGURES: Urls = import.meta.glob<string>('/content/figures/*.json', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
});

const loaded = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

function load(urls: Urls, dir: 'explain' | 'figures', subject: string): Promise<unknown> {
  const url = urls[`/content/${dir}/${subject}.json`];
  if (!url) return Promise.resolve(null);
  if (loaded.has(url)) return Promise.resolve(loaded.get(url));
  let request = pending.get(url);
  if (!request) {
    request = fetch(url)
      .then((response) => (response.ok ? (response.json() as Promise<unknown>) : null))
      .then((data) => {
        const valid =
          typeof data === 'object' && data !== null && 'format' in data
            ? data.format === CONTENT_FORMAT
            : false;
        loaded.set(url, valid ? data : null);
        return valid ? data : null;
      })
      .catch(() => null) // tried again next time
      .finally(() => pending.delete(url));
    pending.set(url, request);
  }
  return request;
}

/** The explanation file of a track or routine, or null when it is not written yet. */
export function loadExplain(subject: string): Promise<ExplainFile | null> {
  return load(EXPLAIN, 'explain', subject) as Promise<ExplainFile | null>;
}

/** The figure file of a track or routine, or null when it is not drawn yet. */
export function loadFigures(subject: string): Promise<FigureFile | null> {
  return load(FIGURES, 'figures', subject) as Promise<FigureFile | null>;
}

/** An explanation that is already loaded, so a screen can draw it without waiting. */
export function loadedExplain(subject: string): ExplainFile | null | undefined {
  const url = EXPLAIN[`/content/explain/${subject}.json`];
  if (!url) return null;
  return loaded.get(url) as ExplainFile | null | undefined;
}
