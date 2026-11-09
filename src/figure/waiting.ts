// Figures that fail a check added to the figure system before the figure agents have drawn them
// again (DECISIONS.md D56, D58 and D60): docs/runs/NAT-3-FIGURES.md says what each needs. The
// checks are not loosened; Vitest (src/figure/__tests__/content-figures.test.ts) and
// `check-explain` without a file know these figures by name and still print their problems, and a
// figure checked on its own (`node scripts/check-explain.ts content/figures/<spor>.json`) fails as
// before. Remove a figure from the list when it passes: the test says which ones do. Empty since
// the figure agents' drawings from NAT-3 P2 were merged. Never imported by the app.
import type { FigureFile } from '../content/types.ts';

/** A figure's name in the list: its item, and its movement when the item has several. */
export const WAITING_FOR_P2: readonly string[] = [];

/** The figure a problem's place (»press.1 › top: …«) belongs to, as named in the list. */
export function figureKeyOf(file: FigureFile, where: string): string {
  let best = where.split(' › ')[0] ?? where;
  for (const entry of file.figures) {
    const key = entry.movement ? `${entry.id} › ${entry.movement}` : entry.id;
    if ((where === key || where.startsWith(`${key} › `)) && key.length > best.length) best = key;
  }
  return best;
}
