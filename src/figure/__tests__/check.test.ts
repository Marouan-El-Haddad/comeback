// The figure checks (docs/SPEC.md 9.1, DECISIONS.md D48) on the reference figures in content/figures
// and on broken copies of them: the contacts in the explanation fit the floor, the wall and the chair;
// nothing touches that the position does not name; nothing goes into a surface; planted hands and
// feet do not slide (on a wall they may); a hand reaches its point.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type {
  Contact,
  ExplainFile,
  FigureFile,
  FigureItem,
  IkLimb,
  OwnMovement,
  Pose,
} from '../../content/types.ts';
import {
  checkFigure,
  checkFigureFile,
  evaluatePose,
  movementFor,
  straightInText,
} from '../check.ts';

function read<T>(dir: string, subject: string): T {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'content', dir, `${subject}.json`), 'utf8'),
  ) as T;
}

function reference(subject: string, id: string): { figure: FigureItem; movement: OwnMovement } {
  const figures = read<FigureFile>('figures', subject);
  const explain = read<ExplainFile>('explain', subject);
  const figure = figures.figures.find((f) => f.id === id);
  const movement = movementFor(explain, id, undefined);
  if (!figure || 'like' in figure || !movement) throw new Error(`${id} mangler`);
  return { figure: structuredClone(figure), movement: structuredClone(movement) };
}

const messages = (figure: FigureItem, movement: OwnMovement) =>
  checkFigure(figure, movement, figure.id).map((p) => `${p.where}: ${p.message}`);

describe('referencefigurerne består', () => {
  test.each(['press', 'wallsit', 'pull'])('%s', (subject) => {
    expect(
      checkFigureFile(read<FigureFile>('figures', subject), read<ExplainFile>('explain', subject)),
    ).toEqual([]);
  });
});

describe('kontakt med gulvet (push-up)', () => {
  test('en hånd, der svæver over gulvet, fanges', () => {
    const { figure, movement } = reference('press', 'press.1');
    const top = figure.keyframes.top as Pose;
    (top.arms.near as IkLimb).to = [69.2, 6];
    (top.arms.far as IkLimb).to = [70.6, 6];
    // Each hand that does not touch, with its own distance above its resting height (L3).
    const all = messages(figure, movement).join('\n');
    expect(all).toContain('press.1 › top: near.hand skal røre gulvet, men er 6 over (0 af 2 gør)');
    expect(all).toContain('press.1 › top: far.hand skal røre gulvet, men er 6 over (0 af 2 gør)');
  });

  test('knæ i gulvet, som positionen ikke nævner, fanges', () => {
    const { figure, movement } = reference('press', 'press.1');
    // A knee push-up: the knees down on the floor.
    const bottom = figure.keyframes.bottom as Pose;
    bottom.legs.near = { joint: [24, 2], end: [2, 6], tip: [3.4, 0.3] };
    expect(messages(figure, movement).join('\n')).toMatch(
      /press\.1 › bottom: near\.knee rører gulvet \(2 fra\), men positionen siger det ikke/,
    );
  });

  test('en hånd, der går ind i gulvet, fanges', () => {
    const { figure, movement } = reference('press', 'press.1');
    const pose = figure.keyframes.bottom as Pose;
    const report = evaluatePose(
      figure,
      { ...pose, arms: { ...pose.arms, far: { to: [70.6, -3] } } },
      movement.positions[1]?.contacts ?? [],
    );
    expect(report.problems.join('\n')).toContain('far.hand går 3 ind i gulvet');
  });

  test('en hånd, der flytter sig mellem oppe og nede, glider og fanges', () => {
    const { figure, movement } = reference('press', 'press.1');
    (figure.keyframes.bottom as Pose).arms.near = { to: [73, 0], upper: 12.5 };
    expect(messages(figure, movement).join('\n')).toContain(
      'press.1 › bottom → top: near.hand glider 3,8 på gulvet; giv den samme punkt i begge positioner',
    );
  });

  test('en hånd, der ikke kan nå sit punkt, fanges med et råd', () => {
    const { figure, movement } = reference('press', 'press.1');
    (figure.keyframes.top as Pose).arms.far = { to: [70.6, -4] };
    expect(messages(figure, movement).join('\n')).toContain(
      'press.1 › top: far.arms når ikke sit punkt',
    );
  });
});

describe('kontakt med væggen (wall sit)', () => {
  test('ryggen væk fra væggen fanges', () => {
    const { figure, movement } = reference('wallsit', 'wallsit.W1');
    const sit = figure.keyframes.sit as Pose;
    sit.hip = [16, sit.hip[1]];
    expect(messages(figure, movement).join('\n')).toContain(
      'wallsit.W1 › sit: ryggen skal røre væggen',
    );
  });

  test('ryggen glider op og ned ad væggen; det er bevægelsen og ingen fejl', () => {
    const { figure, movement } = reference('wallsit', 'wallsit.W1');
    expect((figure.keyframes.stand as Pose).hip[1]).not.toBe((figure.keyframes.sit as Pose).hip[1]);
    expect(messages(figure, movement)).toEqual([]);
  });

  test('hovedet mod væggen, som positionen ikke nævner, fanges', () => {
    const { figure, movement } = reference('wallsit', 'wallsit.W1');
    (figure.keyframes.sit as Pose).head = 0;
    (figure.keyframes.sit as Pose).hip = [4.6, 26.6];
    expect(messages(figure, movement).join('\n')).toContain('wallsit.W1 › sit: hoved rører væggen');
  });

  test('hovedet ind i væggen måles fra hovedets kant', () => {
    const { figure, movement } = reference('wallsit', 'wallsit.W1');
    const sit = figure.keyframes.sit as Pose;
    sit.hip = [1, sit.hip[1]];
    sit.head = 0;
    expect(messages(figure, movement).join('\n')).toContain('sit: hoved går 5,4 ind i væggen');
  });

  test('en figur bag væggen går ind i den', () => {
    const { figure, movement } = reference('wallsit', 'wallsit.W1');
    (figure.keyframes.stand as Pose).hip = [-3, (figure.keyframes.stand as Pose).hip[1]];
    expect(messages(figure, movement).join('\n')).toContain('går 3 ind i væggen');
  });
});

describe('kontakt med stolen (rygsæk-row med én arm)', () => {
  test('én hånd på stolen: den anden må gerne være fri', () => {
    const { figure, movement } = reference('pull', 'pull.1');
    const report = evaluatePose(
      figure,
      figure.keyframes.bottom as Pose,
      movement.positions[0]?.contacts ?? [],
    );
    expect(report.problems).toEqual([]);
    const onChair = report.contacts.find((c) => c.contact.on === 'chair');
    expect(onChair?.ok).toBe(true);
    // Only the hand on the chair is ringed on the contact sheet.
    expect(onChair?.points).toHaveLength(1);
  });

  test('begge hænder på stolen, når positionen siger én, fanges', () => {
    const { figure, movement } = reference('pull', 'pull.1');
    (figure.keyframes.bottom as Pose).arms.near = { to: [67, 24.2] };
    expect(messages(figure, movement).join('\n')).toContain(
      'pull.1 › bottom: begge hænder rører stolen, men positionen siger én',
    );
  });

  test('støttehånden løftet fra stolen fanges', () => {
    const { figure, movement } = reference('pull', 'pull.1');
    (figure.keyframes.top as Pose).arms.far = { to: [69.5, 30] };
    expect(messages(figure, movement).join('\n')).toContain(
      'pull.1 › top: hånden (én) skal røre stolen, men far.hand er 6 fra og near.hand er 35,5 fra',
    );
  });

  test('et håndklæde under hånden må glide med den', () => {
    const { figure, movement } = reference('press', 'press.1');
    (figure.keyframes.bottom as Pose).arms.near = { to: [73, 0], upper: 12.5 };
    figure.props = [{ type: 'towel', attach: 'near.hand', width: 10 }];
    const slides = messages(figure, movement).filter((m) => m.includes('glider'));
    expect(slides).toEqual([]);
  });
});

describe('tip i alle positioner eller ingen', () => {
  test('en fod, der kun findes i den ene position, fanges', () => {
    const { figure, movement } = reference('press', 'press.1');
    delete ((figure.keyframes.top as Pose).legs.near as IkLimb).tip;
    expect(messages(figure, movement).join('\n')).toContain(
      'press.1: near.legs har »tip« i nogle positioner og ikke i andre',
    );
  });

  test('en rød del af et skjult lem fanges', () => {
    const { figure, movement } = reference('press', 'press.1');
    for (const pose of Object.values(figure.keyframes)) pose.arms.far = null;
    figure.highlight = ['far.upperArm'];
    expect(messages(figure, movement).join('\n')).toContain(
      '»far.upperArm« er rød, men far.arms er skjult',
    );
  });
});

describe('M1: forkert facing fanges, også uden fødder og med spejlede fødder', () => {
  test('pull.1 med facing -1 og uden »tip«: benene mangler fødder, og hoften kan ikke bøje så langt bagud', () => {
    const { figure, movement } = reference('pull', 'pull.1');
    (figure as { facing: number }).facing = -1;
    for (const pose of Object.values(figure.keyframes)) {
      for (const leg of [pose.legs.near, pose.legs.far]) if (leg) delete leg.tip;
    }
    const all = messages(figure, movement).join('\n');
    expect(all).toContain('near.legs mangler »tip«');
    expect(all).toMatch(
      /far\.legs: låret står \d+° bag kroppen, mere end en hofte kan; tjek »facing«/,
    );
  });

  test('pull.1 med facing -1 og spejlede fødder fanges af hoften', () => {
    const { figure, movement } = reference('pull', 'pull.1');
    (figure as { facing: number }).facing = -1;
    for (const pose of Object.values(figure.keyframes)) {
      for (const leg of [pose.legs.near, pose.legs.far]) {
        if (leg && 'to' in leg && Array.isArray(leg.tip)) {
          leg.tip = [2 * leg.to[0] - leg.tip[0], leg.tip[1]];
        }
      }
    }
    expect(messages(figure, movement).join('\n')).toMatch(/låret står \d+° bag kroppen/);
  });

  test('en rygsæk i gulvet fanges', () => {
    const { figure, movement } = reference('pull', 'pull.1');
    figure.props = [
      ...figure.props.filter((p) => p.type !== 'backpack'),
      { type: 'backpack', at: [20, -5.6] },
    ];
    expect(messages(figure, movement).join('\n')).toContain('rygsækken går 5,6 ind i gulvet');
  });

  test('et knæ, der bøjer til hver sin side i to positioner, fanges (forfra)', () => {
    const standing = (bend: 1 | -1): Pose => ({
      hip: [0, 46],
      torso: 90,
      arms: { near: { to: [16, 62], bend: 1 }, far: { to: [-16, 62], bend: -1 } },
      legs: { near: { to: [12, 3.6], bend }, far: { to: [-12, 3.6], bend: -1 } },
    });
    const figure: FigureItem = {
      id: 'warmup.2',
      view: 'front',
      props: [],
      highlight: ['torso'],
      keyframes: { a: standing(1), b: standing(-1) },
    };
    const movement: OwnMovement = {
      positions: [
        { id: 'a', name: 'A', text: 'A.', contacts: [{ part: 'foot', on: 'floor' }] },
        { id: 'b', name: 'B', text: 'B.', contacts: [{ part: 'foot', on: 'floor' }] },
      ],
      phases: [{ to: 'b', seconds: 1, label: 'Skift' }],
    };
    expect(messages(figure, movement).join('\n')).toContain(
      'near.legs: knæet bøjer til hver sin side i de to positioner og skifter side undervejs',
    );
  });
});

describe('H1: mellem positionerne', () => {
  test('to strakte positioner, hvor knæet må bøje undervejs, fanges', () => {
    // The shoulders stand still, so the hip turns about them; the foot stands still too, so the
    // straight leg cannot stay straight halfway.
    const shoulder: [number, number] = [0, 40];
    const hipA: [number, number] = [30, 40];
    const hipB: [number, number] = [25.98, 55];
    const mid: [number, number] = [(hipA[0] + hipB[0]) / 2, (hipA[1] + hipB[1]) / 2];
    const chord = Math.hypot(hipB[0] - hipA[0], hipB[1] - hipA[1]);
    const across = [(hipB[1] - hipA[1]) / chord, -(hipB[0] - hipA[0]) / chord];
    const reach = Math.sqrt(47 * 47 - (chord / 2) ** 2);
    const foot: [number, number] = [
      mid[0] + reach * (across[0] ?? 0),
      mid[1] + reach * (across[1] ?? 0),
    ];
    const pose = (hip: [number, number]): Pose => ({
      hip,
      torso: (Math.atan2(shoulder[1] - hip[1], shoulder[0] - hip[0]) * 180) / Math.PI,
      arms: { near: null, far: null },
      legs: { near: { to: foot, tip: 110 }, far: null },
    });
    const figure: FigureItem = {
      id: 'posterior.1',
      view: 'side',
      facing: 1,
      props: [],
      highlight: ['near.thigh'],
      keyframes: { a: pose(hipA), b: pose(hipB) },
    };
    const movement: OwnMovement = {
      positions: [
        { id: 'a', name: 'A', text: 'A.', contacts: [] },
        { id: 'b', name: 'B', text: 'B.', contacts: [] },
      ],
      phases: [{ to: 'b', seconds: 1, label: 'Op' }],
    };
    expect(messages(figure, movement).join('\n')).toMatch(
      /a → b: undervejs: near\.legs: knæet bøjer \d+(,\d)?° mellem to strakte positioner/,
    );
  });

  test('en rygsæk, der går i gulvet undervejs, fanges, også når den ikke gør det i positionerne', () => {
    // Seated; a straight arm with a backpack swings from forward to backward under the shoulder.
    const arm = (angle: number): [number, number] => [
      31 * Math.cos((angle * Math.PI) / 180),
      35 + 31 * Math.sin((angle * Math.PI) / 180),
    ];
    const pose = (angle: number): Pose => ({
      hip: [0, 5],
      torso: 90,
      arms: { near: { to: arm(angle) }, far: null },
      legs: { near: { to: [46.9, 3.6], tip: 90 }, far: null },
    });
    const figure: FigureItem = {
      id: 'backpack_row.1',
      view: 'side',
      facing: 1,
      props: [{ type: 'backpack', attach: 'near.hand' }],
      highlight: ['near.upperArm'],
      keyframes: { front: pose(-45), back: pose(-135) },
    };
    const contacts: Contact[] = [
      { part: 'hip', on: 'floor' },
      { part: 'heel', on: 'floor' },
    ];
    const movement: OwnMovement = {
      positions: [
        { id: 'front', name: 'Frem', text: 'Frem.', contacts },
        { id: 'back', name: 'Bag', text: 'Bag.', contacts },
      ],
      phases: [{ to: 'back', seconds: 1, label: 'Sving' }],
    };
    const all = messages(figure, movement);
    expect(all.filter((m) => !m.includes('undervejs'))).toEqual([]);
    expect(all.join('\n')).toMatch(/front → back: undervejs: rygsækken går \d+(,\d)? ind i gulvet/);
  });
});

describe('M2: et led, teksten kalder strakt, er strakt', () => {
  test('»Strakte arme« med albuer bøjet 20° fanges med et råd', () => {
    const { figure, movement } = reference('press', 'press.1');
    (movement.positions[0] as { text: string }).text = 'Strakte arme med hænderne under skuldrene.';
    const top = figure.keyframes.top as Pose;
    (top.arms.near as IkLimb).to = [67.6, 1];
    expect(messages(figure, movement).join('\n')).toMatch(
      /press\.1 › top: teksten siger »strakte arme«, men near\.arms er bøjet \d+(,\d)?°: læg »to« på fuld længde \(arm 31 fra skulderen, op til 1 over\)/,
    );
  });

  test('et punkt op til 1 over fuld længde tegner leddet strakt og godtages', () => {
    const { figure, movement } = reference('press', 'press.1');
    (movement.positions[0] as { text: string }).text = 'Strakte arme med hænderne under skuldrene.';
    expect(messages(figure, movement)).toEqual([]);
  });

  test('teksten læses forsigtigt: »næsten strakt« og »let bøjede« kræver ingenting', () => {
    expect(straightInText('Forreste ben næsten strakt og knæene let bøjede.')).toEqual([]);
    expect(straightInText('Benene er strakte og armene langs siden.')).toEqual([
      { kind: 'leg', both: true, words: 'benene er strakte' },
    ]);
    expect(straightInText('Venstre arm strakt frem og højre ben strakt bagud.')).toEqual([
      { kind: 'arm', both: false, words: 'arm strakt' },
      { kind: 'leg', both: false, words: 'ben strakt' },
    ]);
  });
});

describe('grænserne fra figurerne i P3 (D56)', () => {
  const lying = (hip: [number, number], torso: number): Pose => ({
    hip,
    torso,
    arms: { near: { to: [hip[0] - 40, hip[1] + 8] }, far: null },
    legs: { near: { to: [hip[0] + 46.9, 3.6], tip: 90 }, far: null },
  });
  const onBack = (pose: Pose): { figure: FigureItem; movement: OwnMovement } => ({
    figure: {
      id: 'core_front.2',
      view: 'side',
      facing: 1,
      props: [],
      highlight: ['torso'],
      keyframes: { hold: pose },
    },
    movement: {
      positions: [
        {
          id: 'hold',
          name: 'Hold',
          text: 'Hold.',
          contacts: [
            { part: 'back', on: 'floor' },
            { part: 'heel', on: 'floor' },
          ],
        },
      ],
      phases: [{ to: 'hold', seconds: 'dose', label: 'Hold' }],
    },
  });

  test('på ryggen: ryggen rører gulvet, og skuldrene må løftes (hollow hold)', () => {
    // The hip on the floor, the shoulders 14 up: before D56 the shoulders had to stay within 8.
    const { figure, movement } = onBack(lying([0, 5], 162));
    expect(messages(figure, movement)).toEqual([]);
  });

  test('på ryggen: en overkrop, der slet ikke rører gulvet, fanges', () => {
    const { figure, movement } = onBack(lying([0, 16], 175));
    expect(messages(figure, movement).join('\n')).toContain('ryggen skal røre gulvet');
  });

  test('en fod, der flytter sig på gulvet, glider; med »lift« i en overgang er det et skridt', () => {
    const { figure, movement } = reference('press', 'press.1');
    const bottom = figure.keyframes.bottom as Pose;
    bottom.legs.near = { to: [10, 3.6], tip: [13.4, 0.3] };
    expect(messages(figure, movement).join('\n')).toMatch(/near\.foot glider \d+(,\d)? på gulvet/);
    figure.transitions = [
      { from: 'top', to: 'bottom', lift: ['near.foot'] },
      { from: 'bottom', to: 'top', lift: ['near.foot'] },
    ];
    expect(messages(figure, movement).join('\n')).not.toContain('glider');
  });

  test('armens »bend« i sidebilledet kun med armen over hovedet', () => {
    const { figure, movement } = reference('press', 'press.1');
    (figure.keyframes.top as Pose).arms.near = { to: [69.2, 0], bend: 1 };
    expect(messages(figure, movement).join('\n')).toContain(
      'press.1 › top: near.arms: »bend« i sidebilledet kun med armen over hovedet',
    );
  });
});
