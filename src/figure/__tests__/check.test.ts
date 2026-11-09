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
  Point,
  Pose,
} from '../../content/types.ts';
import {
  checkFigure,
  checkFigureFile,
  evaluatePose,
  frameJump,
  jumpProblems,
  movementFor,
  straightInText,
} from '../check.ts';
import { bodyPrims } from '../draw.ts';
import { solve } from '../geometry.ts';
import { buildModel, shiftPose } from '../motion.ts';

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

  test('vendt facing med spejlede fødder fanges: brystet vender mod væggen (L1 i P1a-reviewet)', () => {
    // Before, the knee turned round, the thigh hung straight down, and nothing was caught.
    const { figure, movement } = reference('wallsit', 'wallsit.W1');
    (figure as { facing: number }).facing = -1;
    const sit = figure.keyframes.sit as Pose;
    sit.hip = [sit.hip[0], sit.hip[1] + 4];
    for (const pose of [figure.keyframes.stand as Pose, sit]) {
      for (const leg of [pose.legs.near, pose.legs.far] as IkLimb[]) {
        leg.tip = [leg.to[0] - 7.2, 0.3];
      }
    }
    expect(messages(figure, movement).join('\n')).toContain(
      'wallsit.W1 › sit: ryggen skal røre væggen, men brystet vender mod væggen',
    );
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
      'pull.1 › top: hånden (én) skal røre stolen, men far.hand er 6 fra og near.hand er 30,4 fra',
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
      /far\.legs: låret står [\d,]+° bag kroppen, mere end en hofte kan; tjek »facing«/,
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
    expect(messages(figure, movement).join('\n')).toMatch(/låret står [\d,]+° bag kroppen/);
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

describe('spring (H1 og L2 i P1a-reviewet)', () => {
  test('to bevægelser, der ikke mødes, fanges: figuren må ikke springe mellem dem', () => {
    const { figure, movement } = reference('press', 'press.1');
    const model = buildModel(figure, movement);
    expect(jumpProblems(model)).toEqual([]);
    // A hold that stands 20 further along than the move before it ended.
    const hold = model.timeline.moves.find((m) => m.from === m.to);
    if (!hold) throw new Error('intet hold');
    hold.shift = [20, 20];
    expect(
      jumpProblems(model)
        .map((p) => `${p.where}: ${p.message}`)
        .join('\n'),
    ).toMatch(/top → bottom: figuren springer 20 mellem »3 sek ned« og »1 sek stille«/);
  });

  test('et spring mellem to billeder i en bevægelse fanges; en jævn bevægelse gør ikke', () => {
    const smooth = Array.from({ length: 17 }, (_, k): Point[] => [
      [k, 0],
      [k, 10],
    ]);
    expect(frameJump(smooth)).toBeNull();
    // Halfway the figure is 20 further along from one frame to the next.
    const jumpy = smooth.map((f, k) => (k >= 9 ? f.map(([x, y]): Point => [x + 20, y]) : f));
    expect(frameJump(jumpy)).toBeCloseTo(21, 5);
  });
});

describe('»via« tjekkes som en position (H2 i P1a-reviewet)', () => {
  test('burpee E1 består med sine to via-poser, hvor hoften går højt', () => {
    const { figure, movement } = reference('burpee_emom', 'burpee_emom.E1');
    expect(figure.transitions?.filter((t) => t.via)).toHaveLength(2);
    expect(messages(figure, movement)).toEqual([]);
  });

  test('det, begge positioner rører, holder via-posen: en løftet hånd fanges', () => {
    const { figure, movement } = reference('burpee_emom', 'burpee_emom.E1');
    const via = figure.transitions?.find((t) => t.from === 'squat')?.via;
    if (!via) throw new Error('ingen via');
    via.arms.near = { to: [69.04, 6] };
    expect(messages(figure, movement).join('\n')).toContain(
      'burpee_emom.E1 › via squat–chest: near.hand skal røre gulvet, men er 6 over',
    );
  });

  test('en via-pose med hoften for lavt sender knæene i gulvet, og det fanges', () => {
    const { figure, movement } = reference('burpee_emom', 'burpee_emom.E1');
    const via = figure.transitions?.find((t) => t.from === 'squat')?.via;
    if (!via) throw new Error('ingen via');
    via.hip = [39.6, 14];
    const all = messages(figure, movement).join('\n');
    expect(all).toContain('via squat–chest: far.knee rører gulvet');
    expect(all).toMatch(
      /via squat–chest → chest: undervejs: (near|far)\.knee går [\d,]+ ind i gulvet/,
    );
  });
});

describe('H3: en via måles mod de to rigtige positioner (opfølgningen på P1a-reviewet)', () => {
  const explain = read<ExplainFile>('explain', 'warmup');
  const spiderman = movementFor(explain, 'warmup.2', 'spiderman');
  /** The spiderman of the instruction to P2 as it was before H3: its via bends both arms 39°. */
  const before = (
    JSON.parse(
      readFileSync(
        join(process.cwd(), 'src', 'figure', '__tests__', 'fixtures', 'spiderman-before-h3.json'),
        'utf8',
      ),
    ) as { figure: FigureItem }
  ).figure;
  const check = (figure: FigureItem) => {
    if (!spiderman) throw new Error('warmup.2 › spiderman mangler');
    return checkFigure(figure, spiderman, 'warmup.2 › spiderman').map(
      (p) => `${p.where}: ${p.message}`,
    );
  };

  test('spidermanen fra anvisningen til P2 før H3: albuerne bøjer i via’en og undervejs, selv om armene er strakte i planke og udfald', () => {
    const all = check(before).join('\n');
    expect(all).toMatch(
      /warmup\.2 › spiderman › via planke–udfald: (near|far)\.arms: albuen bøjer [\d,]+° mellem to strakte positioner/,
    );
    expect(all).toMatch(
      /via planke–udfald → udfald: undervejs: (near|far)\.arms: albuen bøjer [\d,]+° mellem to strakte positioner/,
    );
    expect(all).toMatch(/planke → via planke–udfald: undervejs: (near|far)\.arms: albuen bøjer/);
  });

  test('med via-hoften i [44; 24], »torso« 14 og det bageste ben som i udfald består den', () => {
    const fixed = structuredClone(before);
    for (const t of fixed.transitions ?? []) {
      if (!t.via) continue;
      t.via.hip = [44, 24];
      t.via.torso = 14;
      t.via.legs.far = { to: [0.38, 4.9], tip: [2.78, 0.3] };
    }
    expect(check(fixed)).toEqual([]);
  });

  test('et løftet lem må folde sig i via’en: det løftede ben bøjer mere end i positionerne', () => {
    // The near leg is lifted on both ways (»lift«) and folds high in the via; that is not a problem.
    const fixed = structuredClone(before);
    for (const t of fixed.transitions ?? []) {
      if (!t.via) continue;
      t.via.hip = [44, 24];
      t.via.torso = 14;
      t.via.legs.far = { to: [0.38, 4.9], tip: [2.78, 0.3] };
    }
    expect(check(fixed).join('\n')).not.toContain('near.legs');
  });

  test('et led, teksten kalder strakt i begge positioner, er strakt i via’en (højst 5°)', () => {
    // Two plank positions whose texts both say »Strakte arme«, and a via that bends the elbows
    // 6–7°: within 8° of the positions, but not straight.
    const { figure } = reference('press', 'press.1');
    const plank = structuredClone(figure.keyframes.top as Pose);
    const text = 'Strakte arme med hænderne under skuldrene. Kroppen er lige fra hæl til hoved.';
    const contacts: Contact[] = [
      { part: 'hand', on: 'floor' },
      { part: 'toes', on: 'floor' },
    ];
    const movement: OwnMovement = {
      positions: [
        { id: 'a', name: 'Planke', text, contacts },
        { id: 'b', name: 'Planke igen', text, contacts },
      ],
      phases: [
        { to: 'b', seconds: 1, label: 'Frem' },
        { to: 'a', seconds: 1, label: 'Tilbage' },
      ],
    };
    const via = structuredClone(plank);
    const shoulder: Point = [
      plank.hip[0] + 30 * Math.cos((plank.torso * Math.PI) / 180),
      plank.hip[1] + 30 * Math.sin((plank.torso * Math.PI) / 180),
    ];
    for (const side of ['near', 'far'] as const) {
      const hand = (plank.arms[side] as IkLimb).to;
      const d = Math.hypot(hand[0] - shoulder[0], hand[1] - shoulder[1]);
      // 30,95 from the shoulder: the elbow bends about 6,5°.
      const k = 30.95 / d;
      (via.arms[side] as IkLimb).to = [
        shoulder[0] + (hand[0] - shoulder[0]) * k,
        shoulder[1] + (hand[1] - shoulder[1]) * k,
      ];
    }
    const twoPlanks: FigureItem = {
      ...figure,
      keyframes: { a: plank, b: structuredClone(plank) },
      transitions: [{ from: 'a', to: 'b', via }],
    };
    const all = checkFigure(twoPlanks, movement, 'press.1')
      .map((p) => `${p.where}: ${p.message}`)
      .join('\n');
    expect(all).toMatch(
      /press\.1 › via a–b: teksten siger »strakte arme« i begge positioner, men (near|far)\.arms er bøjet [67],\d° i via-posen/,
    );
    expect(all).not.toContain('mellem to strakte positioner');
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

  test('»knæ« med æ læses, også før punktum og komma (M2 i P1a-reviewet)', () => {
    const kinds = (text: string) => straightInText(text).map((x) => `${x.kind}:${x.both}`);
    expect(kinds('Stående på ét ben med strakt knæ.')).toEqual(['leg:false']);
    expect(kinds('Stående oprejst med fødderne i hoftebredde og strakte knæ,')).toEqual([
      'leg:true',
    ]);
    expect(kinds('Afsæt: knæ og ankler strakte')).toEqual(['leg:true']);
    expect(kinds('På ryggen med den ene hånd om kanten og armen strakt.')).toEqual(['arm:false']);
    expect(kinds('Det nederste ben hænger strakt lige over gulvet.')).toEqual(['leg:false']);
    expect(kinds('Det øverste ben sparket strakt frem.')).toEqual(['leg:false']);
    expect(kinds('Den øverste arm er ført strakt i en bue.')).toEqual(['arm:false']);
    expect(kinds('Kroppen falder med strakt standben.')).toEqual(['leg:false']);
    expect(kinds('Et par centimeter over gulvet med næsten strakte knæ.')).toEqual([]);
    expect(kinds('Knæene er stadig næsten strakte.')).toEqual([]);
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
    // The contact is the point; the figure has one position and stands still on purpose (D58).
    expect(messages(figure, movement).filter((m) => !m.includes('står næsten stille'))).toEqual([]);
  });

  test('på ryggen: en overkrop, der slet ikke rører gulvet, fanges', () => {
    const { figure, movement } = onBack(lying([0, 16], 175));
    expect(messages(figure, movement).join('\n')).toContain('ryggen skal røre gulvet');
  });

  test('på ryggen vender brystet væk fra gulvet, på maven mod det (L1 i P1a-reviewet)', () => {
    const back = onBack(lying([0, 5], 162));
    (back.figure as { facing: number }).facing = -1;
    expect(messages(back.figure, back.movement).join('\n')).toContain(
      'hold: ryggen skal røre gulvet, men brystet vender mod gulvet',
    );
    const belly = onBack(lying([0, 5], 162));
    const position = belly.movement.positions[0];
    if (position) position.contacts[0] = { part: 'belly', on: 'floor' };
    expect(messages(belly.figure, belly.movement).join('\n')).toContain(
      'hold: maven skal røre gulvet, men brystet vender væk fra gulvet',
    );
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

describe('D58: stilstand, markeringer, fejlpar og den anden vinkel i tjekket', () => {
  test('en figur, der næsten står stille, afvises; en fase uden synlig bevægelse også', () => {
    const { figure, movement } = reference('press', 'press.1');
    // The bottom drawn like the top: nothing moves.
    const still = structuredClone(figure);
    still.keyframes.bottom = structuredClone(still.keyframes.top as Pose);
    const all = messages(still, movement).join('\n');
    expect(all).toMatch(
      /press\.1: figuren står næsten stille: intet punkt flytter sig mere end 0 enheder i hele bevægelsen \(mindst 3\)/,
    );
    expect(all).toContain(
      'press.1 › top → bottom: »3 sek ned« flytter figuren højst 0 enheder fra »Oppe« til »Nede« (mindst 2)',
    );
    // The push-up as drawn moves plenty.
    expect(messages(figure, movement).join('\n')).not.toContain('står næsten stille');
  });

  test('en markering, der kun ses et øjeblik, eller to på samme tid, afvises', () => {
    const { figure, movement } = reference('press', 'press.1');
    // The top has no hold: an angle there is never shown in the animation.
    figure.marks = [
      { angle: 'near.elbow', at: 'top' },
      { arrow: 'chest', phase: 1 },
      { cue: 'Ned', phase: 1 },
    ];
    const all = messages(figure, movement).join('\n');
    expect(all).toContain(
      'press.1 › marks[0]: markeringen ved »Oppe« ses ikke i animationen: figuren holder ikke stille dér; knyt den til en fase (»phase«)',
    );
    expect(all).toContain(
      'press.1 › marks[2]: marks[1] og marks[2] står på samme tid (0–3 sek i kortet); én markering ad gangen',
    );
  });

  test('gradtallet skal passe med vinklen i figuren, og en pil skal være lang nok', () => {
    const { figure, movement } = reference('press', 'press.1');
    figure.marks = [
      { angle: 'near.elbow', at: 'bottom', degrees: 150 },
      { arrow: 'near.hand', phase: 3 },
    ];
    const all = messages(figure, movement).join('\n');
    expect(all).toMatch(
      /press\.1 › marks\[0\]: vinklen er \d+° i figuren, men markeringen siger 150°: ret posen eller »degrees«/,
    );
    expect(all).toMatch(
      /press\.1 › marks\[1\]: pilen er kun [\d,]+ enheder lang \(mindst 4\): vælg en del af kroppen, der flytter sig i fasen/,
    );
  });

  test('referencefiguren med pile, vinkel og fejlpar består', () => {
    const { figure, movement } = reference('press', 'press.1');
    figure.marks = [
      { arrow: 'chest', phase: 1, offset: [2, -4] },
      { angle: 'near.elbow', at: 'bottom' },
      { arrow: 'chest', phase: 3, offset: [2, -4] },
    ];
    figure.faults = [{ mistake: 1, at: 'top', wrong: { hip: [44.4, 14.5], torso: 31.5 } }];
    expect(messages(figure, movement)).toEqual([]);
  });

  test('en forkert stilling, der ligner den rigtige, eller som går i gulvet, afvises', () => {
    const { figure, movement } = reference('press', 'press.1');
    // The head turned 2°: the face mark moves well under 3.
    figure.faults = [{ mistake: 1, at: 'top', wrong: { head: -2 } }];
    expect(messages(figure, movement).join('\n')).toMatch(
      /press\.1 › fejl 1: den forkerte stilling ligner den rigtige: intet punkt flytter sig mere end [\d,]+ enheder \(mindst 3\)/,
    );
    figure.faults = [{ mistake: 1, at: 'top', wrong: { hip: [44, -3], torso: 40 } }];
    expect(messages(figure, movement).join('\n')).toMatch(
      /press\.1 › fejl 1: hofte går [\d,]+ ind i gulvet/,
    );
    // The hands stay on the floor unless the mistake says otherwise (»contacts«).
    figure.faults = [{ mistake: 1, at: 'top', wrong: { arms: { near: { to: [69.2, 8] } } } }];
    expect(messages(figure, movement).join('\n')).toContain(
      'press.1 › fejl 1: near.hand skal røre gulvet, men er 8 over',
    );
  });

  test('den anden vinkel tjekkes som en figur for sig: led, kontakter og bevægelse', () => {
    const { figure, movement } = reference('press', 'press.1');
    figure.second = {
      view: 'front',
      props: [],
      keyframes: {
        top: {
          hip: [0, 20],
          torso: 90,
          arms: { near: { to: [9, 0], bend: 1 }, far: { to: [-9, 0], bend: -1 } },
          legs: { near: { to: [4, 3.6], bend: 1 }, far: { to: [-4, 3.6], bend: -1 } },
        },
        bottom: {
          hip: [0, 20],
          torso: 90,
          arms: { near: { to: [9, 0], bend: 1 }, far: { to: [-9, 0], bend: -1 } },
          legs: { near: { to: [4, 3.6], bend: 1 }, far: { to: [-4, 3.6], bend: -1 } },
        },
      },
    };
    const all = messages(figure, movement).join('\n');
    // Standing upright on its hands is nonsense, but the check finds what it can: the hands do not
    // reach, and nothing moves in the front view.
    expect(all).toContain('press.1 › forfra › top: near.arms når ikke sit punkt');
    expect(all).toContain('press.1 › forfra: figuren står næsten stille');
  });

  test('en sideplanke forfra: kroppen skråt med albuen under skulderen og en ryg, der hænger', () => {
    // core_side.S1 seen from the front: the forearm on the floor under the lower shoulder, the feet
    // on top of each other; in »down« the side rests on the floor, in »up« the body is one line.
    const explain = read<ExplainFile>('explain', 'core_side');
    const movement = movementFor(explain, 'core_side.S1', undefined);
    if (!movement) throw new Error('core_side.S1 mangler');
    // The elbow at x 70 under the lower shoulder (16 below it), the lower foot at [−4,43; 3,6] in
    // both positions; the near side is the lower side, the far hand rests on the upper hip.
    const elbow = { joint: [70, 2.5] as Point, end: [78, 1.2] as Point };
    const down: Pose = {
      hip: [39.24, 9.87],
      torso: 35.81,
      arms: { near: elbow, far: { to: [43.02, 20], bend: 1 } },
      legs: { near: { to: [-4.43, 3.6], bend: 1 }, far: { to: [-11.45, 13.33], bend: 1 } },
    };
    const up: Pose = {
      hip: [39.05, 26.44],
      torso: 5.75,
      arms: { near: elbow, far: { to: [47.4, 33.31], bend: 1 } },
      legs: { near: { to: [-4.43, 3.6], bend: 1 }, far: { to: [-5.64, 15.54], bend: 1 } },
    };
    const figure: FigureItem = {
      id: 'core_side.S1',
      view: 'front',
      props: [],
      highlight: ['torso'],
      keyframes: { down, up },
    };
    expect(messages(figure, movement)).toEqual([]);
    // The elbow stands under the lower shoulder, the forearm along the floor.
    for (const pose of [down, up]) {
      const s = solve({ view: 'front', facing: null }, pose);
      const arm = s.bones.find((b) => b.side === 'near' && b.kind === 'arm');
      expect(Math.abs((arm?.root[0] ?? 0) - (arm?.joint[0] ?? 9))).toBeLessThan(0.5);
    }
    // In »down« the side rests on the floor: the torso's lower long side, not its middle line.
    expect(solve({ view: 'front', facing: null }, down).hip[1]).toBeGreaterThan(8);
    // A hanging hip as the back's curve from the front: still on its forearm and feet.
    const sagging: FigureItem = { ...figure, keyframes: { down, up: { ...up, spine: 3 } } };
    expect(messages(sagging, movement)).toEqual([]);
    const torso = bodyPrims(sagging, solve({ view: 'front', facing: null }, { ...up, spine: 3 }));
    expect(torso.find((p) => p.key === 'torso')?.t).toBe('poly');
  });
});

describe('D60: tjekket læser landingen, og et led kan forkortes mere (reviewet af P1b)', () => {
  /** The bounds as the figure agents drew them in P2: keyframes on the spot, 64 forward. */
  const bounds = (): { figure: FigureItem; movement: OwnMovement } => {
    const figure = read<FigureFile>('figures', 'power_legs').figures.find(
      (f) => f.id === 'power_legs.6' && f.movement === 'bounds',
    );
    const movement = movementFor(
      read<ExplainFile>('explain', 'power_legs'),
      'power_legs.6',
      'bounds',
    );
    if (!figure || 'like' in figure || !movement) throw new Error('bounds mangler');
    return { figure: structuredClone(figure), movement: structuredClone(movement) };
  };

  test('M2: bounds, der lander på stedet, selv om teksten siger 1–1,5 m frem, fanges', () => {
    const { figure, movement } = bounds();
    expect(messages(figure, movement)).toEqual([]);
    // Without its `advance` the standing foot lands where it pushed off.
    delete figure.transitions;
    expect(messages(figure, movement).join('\n')).toMatch(
      /power_legs\.6 › land: »Landing« lander -?0 enheder foran afsættet, men teksten siger »Ca\. 1–1,5 m foran afsættet« \(mindst 30\)/,
    );
  });

  test('M2: et længdespring, der lander 80 fremme i sine keyframes, består; en landing uden hop før tjekkes ikke', () => {
    const { figure, movement } = reference('power_legs', 'power_legs.2');
    const land = figure.keyframes.land as Pose;
    const ahead = (all: string) => all.includes('foran stregen« (mindst 30)');
    expect(ahead(messages(figure, movement).join('\n'))).toBe(false);
    // The landing drawn 25 further back: still more than 30 in front of the take-off.
    figure.keyframes.land = shiftPose(land, -25);
    expect(ahead(messages(figure, movement).join('\n'))).toBe(false);
    // 70 further back: about 10 in front of the take-off, less than the text's 1,5–2 m.
    figure.keyframes.land = shiftPose(land, -70);
    expect(messages(figure, movement).join('\n')).toMatch(
      /power_legs\.2 › land: »Landing« lander \d+(,\d)? enheder foran afsættet, men teksten siger »Ca\. 1,5–2 m foran stregen« \(mindst 30\)/,
    );
    // The take-off is the last position on the floor before the jump, not the jump itself: the
    // flight (»I luften«) has no contacts, and a text without »foran« is not read.
    expect(messages(figure, movement).join('\n')).not.toContain('› air: »I luften« lander');
  });

  test('et led givet som punkter forkortes til en fjerdedel forfra og ovenfra, til det halve fra siden (L5)', () => {
    const { figure, movement } = reference('press', 'press.1');
    const top = figure.keyframes.top as Pose;
    const shoulder = solve({ view: 'side', facing: 1 }, top).shoulder;
    const arm = (length: number) => ({
      joint: [shoulder[0], shoulder[1] - length] as Point,
      end: [shoulder[0] + 2, shoulder[1] - length - 14.8] as Point,
    });
    // From the side an upper arm of 5,5 (a third of 16) is too short: the limb lies in the plane.
    figure.keyframes.top = { ...top, arms: { ...top.arms, far: arm(5.5) } };
    expect(messages(figure, movement).join('\n')).toContain(
      'press.1 › top: far.arms: overarm/lår er 5,5 lang (normalt 16); flyt »joint« eller »end«',
    );
    // From the front a third passes and under a quarter does not: a segment toward the viewer.
    const front = (length: number): FigureItem => ({
      id: 'press.1',
      view: 'front',
      props: [],
      highlight: ['torso'],
      keyframes: {
        top: {
          hip: [0, 49],
          torso: 90,
          arms: {
            near: { joint: [11, 79 - length], end: [11, 64 - length] },
            far: { to: [-11, 50], bend: -1 },
          },
          legs: { near: { to: [5, 3.6], bend: 1 }, far: { to: [-5, 3.6], bend: -1 } },
        },
      },
    });
    const still: OwnMovement = {
      positions: [{ id: 'top', name: 'Oppe', text: 'Oppe.', contacts: [] }],
      phases: [{ to: 'top', seconds: 1, label: 'Hold' }],
    };
    const said = (length: number) =>
      checkFigure(front(length), still, 'press.1')
        .map((p) => p.message)
        .join('\n');
    expect(said(5.5)).not.toContain('overarm/lår er');
    expect(said(3)).toContain('near.arms: overarm/lår er 3 lang (normalt 16)');
  });
});

describe('D62: bredden ovenfra og et nik i tjekket (figur-reviewene af P2)', () => {
  test('ovenfra har alle positioner »width« eller ingen', () => {
    const above = (width?: { shoulders: number; hips: number }): Pose => ({
      hip: [0, 0],
      torso: 0,
      ...(width ? { width } : {}),
      arms: { near: { to: [30, -20], bend: 1 }, far: { to: [30, 20], bend: -1 } },
      legs: { near: { to: [-45, -6], bend: 1 }, far: { to: [-45, 6], bend: -1 } },
    });
    const movement: OwnMovement = {
      positions: [
        { id: 'a', name: 'A', text: 'A.', contacts: [] },
        { id: 'b', name: 'B', text: 'B.', contacts: [] },
      ],
      phases: [{ to: 'b', seconds: 1, label: 'Drej' }],
    };
    const figure = (a: Pose, b: Pose): FigureItem => ({
      id: 'club_sequence.C6',
      view: 'top',
      props: [],
      highlight: ['torso'],
      keyframes: { a, b },
    });
    const wide = { shoulders: 22, hips: 12 };
    const turned = { shoulders: 8, hips: 12 };
    expect(messages(figure(above(wide), above(turned)), movement).join('\n')).not.toContain(
      '»width«',
    );
    expect(messages(figure(above(wide), above()), movement).join('\n')).toContain(
      'ovenfra har alle positioner og via-poser »width«, eller ingen af dem har',
    );
  });

  test('et nik med baghovedet i gulvet holder hovedets kontakt, og skuldrene ligger stille', () => {
    // On the back with the head to the left (facing 1): the back of the head on the floor. The
    // chin to the chest is the face turned 20° toward the feet: the neck tips down about the
    // shoulders (`head`) and the head turns the other way about the top of the neck (`nod`).
    const lying = (head: number, nod: number): Pose => ({
      hip: [40, 5.2],
      torso: 181.3,
      head,
      nod,
      arms: { near: { to: [26, 0.6], tip: [20, 0.3] }, far: { to: [27, 0.6], tip: [21, 0.3] } },
      legs: {
        near: { to: [86.8, 3.6], tip: [87, 10.8] },
        far: { to: [86, 3.6], tip: [86.2, 10.8] },
      },
    });
    const rest = solve({ view: 'side', facing: 1 }, lying(0, 0));
    const tuck = solve({ view: 'side', facing: 1 }, lying(28.7, -48.7));
    expect(tuck.shoulder).toEqual(rest.shoulder);
    expect(tuck.face).toBeCloseTo((rest.face ?? 0) - 20, 6);
    // The head stays on the floor within a unit: it rolls on the top of the neck.
    const lowest = (s: typeof rest) => s.head[1] - BODY_HEAD;
    expect(Math.abs(lowest(tuck) - lowest(rest))).toBeLessThan(1);
  });
});

const BODY_HEAD = 6.4;
