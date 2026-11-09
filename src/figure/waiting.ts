// Figures that fail the checks added to the figure system in NAT-3 P1a (DECISIONS.md D56) and P1b
// (D58: a figure that does not move visibly; D60: a landing the text puts in front of the take-off)
// and wait for the figure agents in P2: docs/runs/NAT-3-FIGURES.md says what each needs. The checks
// are not loosened; Vitest (src/figure/__tests__/content-figures.test.ts) and `check-explain`
// without a file know these figures by name and still print their problems, and a figure checked on
// its own (`node scripts/check-explain.ts content/figures/<spor>.json`) fails as before. Remove a
// figure from the list when it passes: the test says which ones do. Never imported by the app.
import type { FigureFile } from '../content/types.ts';

/** A figure's name in the list: its item, and its movement when the item has several. */
export const WAITING_FOR_P2: readonly string[] = [
  'burpee_skill.V1',
  'burpee_skill.V2',
  'burpee_skill.V3',
  'burpee_skill.V4 › tuck',
  'burpee_skill.V4 › clap',
  'burpee_skill.V5',
  'core_side.S4',
  'groin.5',
  'measures.burpee_3min',
  'neck.N1',
  'neck.N2',
  'neck.N5 › mave',
  'neck.N5 › side',
  'power_legs.6 › bounds',
  'shoulder.3',
  'warmup.2 › spiderman',
];

/** The figure a problem's place (»press.1 › top: …«) belongs to, as named in the list. */
export function figureKeyOf(file: FigureFile, where: string): string {
  let best = where.split(' › ')[0] ?? where;
  for (const entry of file.figures) {
    const key = entry.movement ? `${entry.id} › ${entry.movement}` : entry.id;
    if ((where === key || where.startsWith(`${key} › `)) && key.length > best.length) best = key;
  }
  return best;
}
