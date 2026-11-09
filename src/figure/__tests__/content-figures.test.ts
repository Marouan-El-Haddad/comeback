// Every figure in content/figures passes the figure system's checks (docs/SPEC.md 9.1, PLAN M6,
// DECISIONS.md D56): the joints bend the right way, the contacts fit, nothing slides, between the
// keyframes no joint bends more than in the keyframes beside it, nothing goes into a surface and the
// segments keep their length, and the animation's phases last as long as the tempo in the dose. The
// figure agents check one file with `node scripts/check-explain.ts content/figures/<spor>.json`; this
// test checks them all. The figures that wait for P2 are named in src/figure/waiting.ts.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  isFigureLike,
  type ExplainFile,
  type FigureFile,
  type FigureItem,
} from '../../content/types.ts';
import { programItem, statedSeconds } from '../../content/validate.ts';
import { PROGRAM } from '../../engine/program.ts';
import { checkFigureFile, movementFor } from '../check.ts';
import { distance, solve, turn } from '../geometry.ts';
import { buildModel, movePose, phaseSeconds, poseAt, timeline } from '../motion.ts';
import { solids, TOUCH } from '../surfaces.ts';
import { figureKeyOf, WAITING_FOR_P2 } from '../waiting.ts';

const CONTENT = join(process.cwd(), 'content');
const files = existsSync(join(CONTENT, 'figures'))
  ? readdirSync(join(CONTENT, 'figures')).filter((f) => f.endsWith('.json'))
  : [];

function load(file: string): { figures: FigureFile; explain: ExplainFile } {
  const read = (dir: string) =>
    JSON.parse(readFileSync(join(CONTENT, dir, file), 'utf8')) as unknown;
  return { figures: read('figures') as FigureFile, explain: read('explain') as ExplainFile };
}

describe('figurerne i content/figures', () => {
  test('der er figurer at tjekke', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // Every problem, with the figure it belongs to.
  const problems = files.flatMap((file) => {
    const { figures, explain } = load(file);
    return checkFigureFile(figures, explain).map((p) => ({
      key: figureKeyOf(figures, p.where),
      text: `figures/${file} › ${p.where}: ${p.message}`,
    }));
  });

  test('består figursystemets tjek: led, kontakter, glidning og rækkevidde, også undervejs', () => {
    // The figures that wait for P2 keep their problems; every other figure has none.
    expect(problems.filter((p) => !WAITING_FOR_P2.includes(p.key)).map((p) => p.text)).toEqual([]);
  });

  test('listen over figurer, der venter på P2, er ajour: en figur, der består, fjernes', () => {
    const failing = new Set(problems.map((p) => p.key));
    expect(
      WAITING_FOR_P2.filter((key) => !failing.has(key)),
      'består nu: fjern dem fra src/figure/waiting.ts',
    ).toEqual([]);
  });

  test('fasernes varighed i animationen passer til tempoet i dosis', () => {
    const problems: string[] = [];
    for (const file of files) {
      const { figures, explain } = load(file);
      for (const entry of figures.figures) {
        if (isFigureLike(entry)) continue;
        const movement = movementFor(explain, entry.id, entry.movement);
        const item = programItem(PROGRAM, entry.id);
        if (!movement || !item) continue;
        const where = `${basename(file, '.json')} › ${entry.id}`;
        const line = timeline(movement);
        // Each phase's moves follow each other without a gap and last the phase's seconds.
        movement.phases.forEach((phase, i) => {
          const moves = line.moves.filter((m) => m.phase === i);
          const sum = moves.reduce((n, m) => n + m.seconds, 0);
          if (Math.abs(sum - phaseSeconds(phase)) > 1e-9) {
            problems.push(`${where} › fase ${i}: varer ${sum} sek, ikke ${phaseSeconds(phase)}`);
          }
        });
        line.moves.forEach((m, i) => {
          const next = line.moves[i + 1];
          if (next && Math.abs(m.start + m.seconds - next.start) > 1e-9) {
            problems.push(`${where}: hul i tidslinjen ved ${m.start + m.seconds} sek`);
          }
        });
        // Every time the programme states for the step (up to 10 sek) is a phase that long.
        const lengths = movement.phases.flatMap((p) =>
          p.seconds === 'dose' ? [] : [p.seconds, phaseSeconds(p)],
        );
        for (const [min, max, words] of statedSeconds(item.texts)) {
          if (min > 10) continue; // a hold's time is its "dose" phase
          if (!lengths.some((s) => s >= min - 1e-9 && s <= max + 1e-9)) {
            problems.push(`${where}: programmet siger »${words}«, men ingen fase varer så længe`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

/** Every drawn figure with its movement and its name in the waiting list. */
function allFigures(): Array<{
  key: string;
  figure: FigureItem;
  model: ReturnType<typeof buildModel>;
}> {
  return files.flatMap((file) => {
    const { figures, explain } = load(file);
    return figures.figures.flatMap((entry) => {
      if (isFigureLike(entry)) return [];
      const movement = movementFor(explain, entry.id, entry.movement);
      if (!movement) return [];
      const key = entry.movement ? `${entry.id} › ${entry.movement}` : entry.id;
      return [{ key, figure: entry, model: buildModel(entry, movement) }];
    });
  });
}

describe('mellem positionerne i alle figurer (H1, D56)', () => {
  const figures = allFigures().filter((f) => !WAITING_FOR_P2.includes(f.key));
  /** Every move between two different positions, sampled at eighths. */
  const frames = figures.flatMap(({ key, figure, model }) =>
    model.timeline.moves
      .filter((m) => m.from !== m.to && model.steps.has(m))
      .flatMap((move) =>
        [1, 2, 3, 4, 5, 6, 7].map((k) => ({
          key,
          figure,
          where: `${key} › ${move.from} → ${move.to}`,
          a: model.solved[move.from],
          b: model.solved[move.to],
          s: solve(model.frame, movePose(model, move, k / 8)),
        })),
      ),
  );
  test('der er bevægelser at tjekke', () => {
    expect(frames.length).toBeGreaterThan(500);
  });

  test('intet led bøjer mere end i nabopositionerne (højst 8° mere)', () => {
    const wrong = new Set<string>();
    for (const { where, a, b, s } of frames) {
      for (const bone of s.bones) {
        const ka = a?.bones.find((x) => x.side === bone.side && x.kind === bone.kind);
        const kb = b?.bones.find((x) => x.side === bone.side && x.kind === bone.kind);
        if (ka && kb && bend(bone) > Math.max(bend(ka), bend(kb)) + 8) {
          wrong.add(`${where}: ${bone.side}.${bone.kind}`);
        }
      }
    }
    expect([...wrong]).toEqual([]);
  });

  test('segmenterne holder længden (højst 0,5 fra længden i nabopositionerne)', () => {
    const wrong = new Set<string>();
    for (const { where, a, b, s } of frames) {
      for (const bone of s.bones) {
        const ka = a?.bones.find((x) => x.side === bone.side && x.kind === bone.kind);
        const kb = b?.bones.find((x) => x.side === bone.side && x.kind === bone.kind);
        if (!ka || !kb) continue;
        const pairs: Array<[number, number, number]> = [
          [
            distance(bone.root, bone.joint),
            distance(ka.root, ka.joint),
            distance(kb.root, kb.joint),
          ],
          [distance(bone.joint, bone.end), distance(ka.joint, ka.end), distance(kb.joint, kb.end)],
        ];
        for (const [now, la, lb] of pairs) {
          if (now < Math.min(la, lb) - 0.5 || now > Math.max(la, lb) + 0.5) {
            wrong.add(`${where}: ${bone.side}.${bone.kind}`);
          }
        }
      }
    }
    expect([...wrong]).toEqual([]);
  });

  test('intet går gennem en flade midt i en fase (højst 1,5 ind, som i positionerne)', () => {
    const wrong = new Set<string>();
    for (const { where, figure, s } of frames) {
      if (figure.view === 'top') continue;
      const points: Array<[string, [number, number], number]> = [
        ['hofte', s.hip, TOUCH.hip[0]],
        ['skulder', s.shoulder, TOUCH.shoulder[0]],
        ['hoved', s.head, TOUCH.head[0]],
        ...s.bones.flatMap((b): Array<[string, [number, number], number]> => [
          [`${b.side}.${b.kind} led`, b.joint, TOUCH.knee[0]],
          [`${b.side}.${b.kind} ende`, b.end, TOUCH.hand[0]],
          ...(b.tip
            ? [
                [`${b.side}.${b.kind} tå`, b.tip, TOUCH.toe[0]] as [
                  string,
                  [number, number],
                  number,
                ],
              ]
            : []),
        ]),
      ];
      for (const solid of solids(figure, s)) {
        for (const [name, p, lowest] of points) {
          if (solid.sdf(p) < lowest - 1e-9) wrong.add(`${where}: ${name} i ${solid.on}`);
        }
      }
    }
    expect([...wrong]).toEqual([]);
  });
});

describe('referencefigurerne undervejs (H1)', () => {
  const reference = (subject: string, id: string) => {
    const { figures, explain } = load(`${subject}.json`);
    const figure = figures.figures.find((f) => f.id === id);
    const movement = movementFor(explain, id, undefined);
    if (!figure || isFigureLike(figure) || !movement) throw new Error(`${id} mangler`);
    return buildModel(figure, movement);
  };

  test('press.1 hvert 0,1 sek: begge knæ mindst 175°, og hoften højst 0,5 fra linjen fra ankel til skulder', () => {
    const model = reference('press', 'press.1');
    for (let t = 0; t <= model.timeline.total; t += 0.1) {
      const s = solve(model.frame, poseAt(model, t));
      const legs = s.bones.filter((b) => b.kind === 'leg');
      expect(legs).toHaveLength(2);
      for (const leg of legs) expect(180 - bend(leg)).toBeGreaterThanOrEqual(175);
      const ankle = legs.find((b) => b.side === 'near')?.end ?? [0, 0];
      const line = [s.shoulder[0] - ankle[0], s.shoulder[1] - ankle[1]];
      const length = Math.hypot(line[0] ?? 0, line[1] ?? 0);
      const off =
        Math.abs((line[0] ?? 0) * (s.hip[1] - ankle[1]) - (line[1] ?? 0) * (s.hip[0] - ankle[0])) /
        length;
      expect(off).toBeLessThanOrEqual(0.5);
    }
  });

  test('wallsit.W1: hoften er højst 7,5 fra væggen hele vejen', () => {
    const model = reference('wallsit', 'wallsit.W1');
    const wall = model.figure.props.find((p) => p.type === 'wall');
    if (!wall || wall.type !== 'wall') throw new Error('ingen væg');
    for (let t = 0; t <= model.timeline.total; t += 0.1) {
      const s = solve(model.frame, poseAt(model, t));
      expect((s.hip[0] - wall.x) * -wall.side).toBeLessThanOrEqual(7.5);
      expect((s.hip[0] - wall.x) * -wall.side).toBeGreaterThan(0);
    }
  });
});

function bend(x: {
  root: [number, number];
  joint: [number, number];
  end: [number, number];
}): number {
  return Math.abs(turn(x.root, x.joint, x.end));
}
