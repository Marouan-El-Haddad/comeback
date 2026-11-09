// The figure system (docs/SPEC.md 5 and 9.1, DECISIONS.md D48 and D56): the port of picto.py's
// geometry, the anatomical bend from `facing`, the timeline in the dose's tempo, the frames between
// the keyframes (joint angles from the point that stands still), and the drawing with stable keys.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type {
  Contact,
  ExplainFile,
  FigureItem,
  OwnMovement,
  Point,
  Pose,
} from '../../content/types.ts';
import { bendProblems, jumpProblems, movementFor, turn } from '../check.ts';
import {
  bodyPrims,
  curvedBack,
  moving,
  propPrims,
  svgBody,
  track,
  emptyBox,
  type Box,
  type Prim,
} from '../draw.ts';
import { deviation, faultPair, wrongPose } from '../faults.ts';
import {
  directionText,
  followPrims,
  jointAngle,
  markAt,
  markPlans,
  placeLabel,
  stillMarks,
  viewsAndMarksText,
} from '../marks.ts';
import { drawnHeights, figureViews, stackViews, viewModels } from '../views.ts';
import { bendOf, distance, frameOf, ik, solve, type Frame } from '../geometry.ts';
import {
  buildModel,
  CARD_TIMING,
  frameBox,
  shiftAtTime,
  lerpAngle,
  moveAt,
  movePose,
  movingPrims,
  phaseAt,
  poseAt,
  timeline,
  viaId,
} from '../motion.ts';
import { swingDelta } from '../tween.ts';

const SIDE_RIGHT: Frame = { view: 'side', facing: 1 };
const SIDE_LEFT: Frame = { view: 'side', facing: -1 };

const near = (a: readonly number[], b: readonly number[], tolerance = 0.02) =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0)) <= tolerance;

/** Standing, chest to the right: arms hanging with a little bend, knees a little bent. */
function standing(): Pose {
  return {
    hip: [0, 49],
    torso: 90,
    arms: { near: { to: [2, 50] }, far: { to: [1, 50] } },
    legs: { near: { to: [1, 3.6], tip: [8.2, 0.3] }, far: { to: [-1, 3.6], tip: [6.2, 0.3] } },
  };
}

const PLANK: Contact[] = [
  { part: 'hand', on: 'floor' },
  { part: 'toes', on: 'floor' },
];

const PUSH_UP: OwnMovement = {
  positions: [
    { id: 'top', name: 'Oppe', text: 'Oppe.', contacts: PLANK },
    { id: 'bottom', name: 'Nede', text: 'Nede.', contacts: PLANK },
  ],
  phases: [
    { to: 'bottom', seconds: 3, label: '3 sek ned' },
    { to: 'bottom', seconds: 1, label: '1 sek stille' },
    { to: 'top', seconds: 1, label: 'Op' },
  ],
};

const plankFeet = {
  near: { to: [0, 3.6] as [number, number], tip: [3.4, 0.3] as [number, number] },
  far: { to: [-0.6, 3.6] as [number, number], tip: [2.8, 0.3] as [number, number] },
};

const PUSH_UP_FIGURE: FigureItem = {
  id: 'press.1',
  view: 'side',
  facing: 1,
  props: [],
  highlight: ['near.upperArm'],
  keyframes: {
    top: {
      hip: [44.04, 20.02],
      torso: 20.45,
      head: -4,
      arms: { near: { to: [69.2, 0] }, far: { to: [70.6, 0] } },
      legs: plankFeet,
    },
    bottom: {
      hip: [46.86, 7.2],
      torso: 4.39,
      head: -4,
      arms: { near: { to: [69.2, 0], upper: 12.5 }, far: { to: [70.6, 0], upper: 12.5 } },
      legs: plankFeet,
    },
  },
};

describe('geometrien er picto.py’s', () => {
  test('to-leds IK giver samme albue som piktogrammet push_up (nede)', () => {
    // poses.py push_up, bottom: shoulder (76.66, 10.80), hand (69.17, 0), upper arm 12.5, bend -1;
    // public/pictos/push_up.svg has the elbow at (64.67, 14.31) in y-up units.
    const { joint, end, short } = ik([76.66, 10.8], [69.17, 0], 12.5, 15, -1);
    expect(near(joint, [64.67, 14.31])).toBe(true);
    expect(near(end, [69.17, 0], 1e-6)).toBe(true);
    expect(short).toBe(0);
  });

  test('et punkt uden for rækkevidde giver et strakt lem mod punktet og måler afstanden', () => {
    const { joint, end, short } = ik([0, 0], [40, 0], 16, 15, 1);
    expect(near(joint, [16, 0], 1e-9)).toBe(true);
    expect(near(end, [31, 0], 1e-9)).toBe(true);
    expect(short).toBeCloseTo(9);
  });

  test('skulder, hoved og lemmernes rødder kommer fra hoften og vinklerne', () => {
    const s = solve(SIDE_RIGHT, { ...standing(), head: -10 });
    expect(near(s.shoulder, [0, 79], 1e-9)).toBe(true);
    // The head 11 from the shoulder, turned 10° clockwise from the torso: forward for facing 1.
    expect(s.head[0]).toBeCloseTo(11 * Math.sin((10 * Math.PI) / 180));
    expect(s.bones.map((b) => `${b.side}.${b.kind}`)).toEqual([
      'far.leg',
      'far.arm',
      'near.leg',
      'near.arm',
    ]);
  });

  test('frontbilledet: skulder- og bækkenbredde, near-siden til højre', () => {
    const s = solve(
      { view: 'front', facing: null },
      { ...standing(), width: { shoulders: 22, hips: 12 } },
    );
    expect(s.shoulders?.[1][0]).toBeCloseTo(11);
    expect(s.pelvis?.[0][0]).toBeCloseTo(-6);
    expect(s.bones.find((b) => b.side === 'near' && b.kind === 'arm')?.root[0]).toBeCloseTo(11);
  });
});

describe('leddene bøjer den rigtige vej ud fra facing', () => {
  test('stående med brystet mod højre: knæet frem, albuen tilbage', () => {
    const s = solve(SIDE_RIGHT, standing());
    const leg = s.bones.find((b) => b.side === 'near' && b.kind === 'leg');
    const arm = s.bones.find((b) => b.side === 'near' && b.kind === 'arm');
    expect(leg && leg.joint[0]).toBeGreaterThan(1); // the knee in front of the hip–ankle line
    expect(arm && arm.joint[0]).toBeLessThan(0); // the elbow behind the shoulder–hand line
    expect(bendProblems(SIDE_RIGHT, s)).toEqual([]);
  });

  test('spejlet (facing -1): knæet og albuen bøjer til den anden side', () => {
    const mirrored: Pose = {
      hip: [0, 49],
      torso: 90,
      arms: { near: { to: [-2, 50] }, far: { to: [-1, 50] } },
      legs: { near: { to: [-1, 3.6] }, far: { to: [1, 3.6] } },
    };
    const s = solve(SIDE_LEFT, mirrored);
    expect(s.bones.find((b) => b.side === 'near' && b.kind === 'leg')?.joint[0]).toBeLessThan(-1);
    expect(s.bones.find((b) => b.side === 'near' && b.kind === 'arm')?.joint[0]).toBeGreaterThan(0);
    expect(bendProblems(SIDE_LEFT, s)).toEqual([]);
  });

  test('i sidebilledet styrer facing bøjningen; »bend« gælder kun forfra og ovenfra', () => {
    expect(bendOf(SIDE_RIGHT, 'leg', { to: [0, 0], bend: -1 })).toBe(1);
    expect(bendOf(SIDE_RIGHT, 'arm', { to: [0, 0] })).toBe(-1);
    expect(bendOf(SIDE_LEFT, 'arm', { to: [0, 0] })).toBe(1);
    expect(bendOf({ view: 'front', facing: null }, 'arm', { to: [0, 0], bend: -1 })).toBe(-1);
  });

  test('squat jumps arme fra piktogrammet: picto.py bøjede albuerne forkert, figursystemet ikke', () => {
    // poses.py squat_jump: hip (-7, 23), torso 62°, hands behind and below the shoulders, bend 1.
    const pose: Pose = {
      hip: [-7, 23],
      torso: 62,
      head: -6,
      arms: { near: { to: [-1.92, 22.49] }, far: { to: [-2.92, 23.49] } },
      legs: { near: { to: [1.2, 3.6] }, far: { to: [-1.2, 3.6] } },
    };
    const right = solve(SIDE_RIGHT, pose);
    expect(bendProblems(SIDE_RIGHT, right)).toEqual([]);
    // With picto.py's bend (1) the elbow turns the wrong way, and the check says so.
    const shoulder = right.shoulder;
    const wrong = ik(shoulder, [-1.92, 22.49], 16, 15, 1);
    expect(turn(shoulder, wrong.joint, wrong.end)).toBeLessThan(-8);
    const s = {
      ...right,
      bones: right.bones.map((b) =>
        b.side === 'near' && b.kind === 'arm' ? { ...b, joint: wrong.joint, end: wrong.end } : b,
      ),
    };
    expect(bendProblems(SIDE_RIGHT, s).join('\n')).toContain(
      'near.arms: albuen bøjer den forkerte vej',
    );
  });

  test('et lem med givne led (»joint«) kan bøje forkert, og tjekket fanger det', () => {
    const pose: Pose = {
      ...standing(),
      legs: { near: { joint: [-8, 26], end: [1, 3.6] }, far: { to: [-1, 3.6] } },
    };
    expect(bendProblems(SIDE_RIGHT, solve(SIDE_RIGHT, pose)).join('\n')).toContain(
      'near.legs: knæet bøjer den forkerte vej',
    );
  });

  test('en fod, der peger bagud, fanges', () => {
    const pose: Pose = {
      ...standing(),
      legs: { near: { to: [1, 3.6], tip: [-6, 0.3] }, far: { to: [-1, 3.6] } },
    };
    expect(bendProblems(SIDE_RIGHT, solve(SIDE_RIGHT, pose)).join('\n')).toContain(
      'near.legs: foden peger bagud',
    );
  });
});

describe('tidslinjen følger tempoet i dosis', () => {
  test('push-up: 3 sek ned, 1 sek stille, op på 1 sek', () => {
    const line = timeline(PUSH_UP);
    expect(line.moves.map((m) => [m.from, m.to, m.start, m.seconds, m.phase])).toEqual([
      ['top', 'bottom', 0, 3, 0],
      ['bottom', 'bottom', 3, 1, 1],
      ['bottom', 'top', 4, 1, 2],
    ]);
    expect(line.total).toBe(5);
    expect(line.phases).toEqual([
      { start: 0, seconds: 3 },
      { start: 3, seconds: 1 },
      { start: 4, seconds: 1 },
    ]);
  });

  test('en "dose"-fase varer 2 sek i kortet, og "repeat": "dose" kører 3 gange (D45)', () => {
    const hold: OwnMovement = {
      positions: [
        { id: 'stand', name: 'Stående', text: 'Står.', contacts: [] },
        { id: 'sit', name: 'Wall sit', text: 'Sidder.', contacts: [] },
        { id: 'punch', name: 'Slag', text: 'Slår.', contacts: [] },
      ],
      phases: [
        { to: 'sit', seconds: 2, label: 'Glid ned' },
        { to: 'sit', seconds: 'dose', label: 'Hold' },
        { to: 'punch', seconds: 1, repeat: 'dose', label: 'Slå' },
        { to: 'stand', seconds: 2, label: 'Glid op' },
      ],
    };
    const line = timeline(hold);
    expect(line.phases.map((p) => p.seconds)).toEqual([2, CARD_TIMING.dose, 3, 2]);
    const punches = line.moves.filter((m) => m.phase === 2);
    expect(punches).toHaveLength(6);
    expect(punches.map((m) => m.to)).toEqual(['punch', 'sit', 'punch', 'sit', 'punch', 'sit']);
    expect(punches.every((m) => m.seconds === 0.5)).toBe(true);
    expect(line.total).toBe(9);
  });

  test('klubsekvensens pumps: »repeat« 10 à 0,8 sek frem og tilbage', () => {
    const pumps: OwnMovement = {
      positions: [
        { id: 'top', name: 'Oppe', text: 'Oppe.', contacts: [] },
        { id: 'pump', name: 'Pump', text: 'Lidt ned.', contacts: [] },
      ],
      phases: [{ to: 'pump', seconds: 0.8, repeat: 10, label: '10 mikro-pumps' }],
    };
    const line = timeline(pumps);
    expect(line.moves).toHaveLength(20);
    expect(line.total).toBeCloseTo(8);
    expect(line.moves.at(-1)?.to).toBe('top');
  });

  test('en bevægelse, der slutter et andet sted, går tilbage til start på 1 sek uden label', () => {
    const jump: OwnMovement = {
      positions: [
        { id: 'squat', name: 'Nede', text: 'Nede.', contacts: [] },
        { id: 'air', name: 'I luften', text: 'Oppe.', contacts: [] },
      ],
      phases: [{ to: 'air', seconds: 0.4, label: 'Hop' }],
    };
    const line = timeline(jump);
    expect(line.moves.at(-1)).toEqual({
      from: 'air',
      to: 'squat',
      start: 0.4,
      seconds: 1,
      phase: null,
    });
    expect(line.total).toBeCloseTo(1.4);
  });

  test('tiden løber i ring, og den aktuelle fase findes på hvert tidspunkt', () => {
    const line = timeline(PUSH_UP);
    expect(moveAt(line, 0)?.move.phase).toBe(0);
    expect(moveAt(line, 2.99)?.move.phase).toBe(0);
    expect(moveAt(line, 3.01)?.move.phase).toBe(1);
    expect(moveAt(line, 4.5)?.move.phase).toBe(2);
    expect(moveAt(line, 5.5)?.move.phase).toBe(0);
    expect(moveAt(line, 1.5)?.u).toBeCloseTo(0.5);
  });
});

describe('animationen mellem positionerne', () => {
  const model = buildModel(PUSH_UP_FIGURE, PUSH_UP);

  test('hænder og fødder med samme punkt i begge positioner står stille hele vejen', () => {
    for (let t = 0; t < 5; t += 0.1) {
      const s = solve(model.frame, poseAt(model, t));
      for (const b of s.bones) {
        if (b.kind === 'arm') expect(b.end[1]).toBeCloseTo(0, 1);
        else expect(b.tip).toEqual(b.side === 'near' ? [3.4, 0.3] : [2.8, 0.3]);
      }
    }
  });

  test('lemmerne holder længden, og albuerne bøjer rigtigt i hvert billede', () => {
    for (let t = 0; t < 5; t += 0.1) {
      const s = solve(model.frame, poseAt(model, t));
      expect(bendProblems(model.frame, s)).toEqual([]);
      const arm = s.bones.find((b) => b.side === 'near' && b.kind === 'arm');
      if (!arm) throw new Error('ingen arm');
      expect(Math.hypot(arm.end[0] - arm.joint[0], arm.end[1] - arm.joint[1])).toBeCloseTo(15, 5);
    }
  });

  test('H1: hoften drejer om fødderne, så benene er strakte og kroppen én linje hele vejen', () => {
    // Not the straight line between the two hips (the old interpolation): an arc about the ankle.
    for (let t = 0; t <= 3; t += 0.1) {
      const s = solve(model.frame, poseAt(model, t));
      for (const leg of s.bones.filter((b) => b.kind === 'leg')) {
        expect(180 - Math.abs(turn(leg.root, leg.joint, leg.end))).toBeGreaterThan(175);
      }
      const leg = s.bones.find((b) => b.side === 'near' && b.kind === 'leg');
      if (!leg) throw new Error('intet ben');
      expect(distance(s.hip, leg.end)).toBeCloseTo(47, 1);
    }
    expect(lerpAngle(170, -170, 0.5)).toBeCloseTo(180);
    expect(lerpAngle(10, 350, 0.25)).toBeCloseTo(5);
  });

  test('et led givet som punkter i den ene position og som IK i den anden glider jævnt', () => {
    const a = PUSH_UP_FIGURE.keyframes.top as Pose;
    const b: Pose = { ...a, arms: { ...a.arms, near: { joint: [70, 15.5], end: [69.2, 0] } } };
    const figure: FigureItem = { ...PUSH_UP_FIGURE, keyframes: { top: a, bottom: b } };
    const m = buildModel(figure, PUSH_UP);
    const move = m.timeline.moves[0];
    if (!move) throw new Error('ingen bevægelse');
    for (const u of [0.25, 0.5, 0.75]) {
      const arm = solve(m.frame, movePose(m, move, u)).bones.find(
        (x) => x.side === 'near' && x.kind === 'arm',
      );
      if (!arm) throw new Error('ingen arm');
      expect(arm.end[1]).toBeCloseTo(0, 1);
      expect(distance(arm.joint, arm.end)).toBeGreaterThan(15);
    }
  });

  test('fasen skifter, når tiden går: 3 sek ned, 1 sek stille, op', () => {
    expect([0, 2.9, 3.1, 3.9, 4.1, 4.9, 5.1].map((t) => phaseAt(model, t))).toEqual([
      0, 0, 1, 1, 2, 2, 0,
    ]);
  });

  test('kassen rummer hvert billede undervejs', () => {
    for (let t = 0; t < 5; t += 0.25) {
      const box = track(emptyBox(), movingPrims(model, poseAt(model, t)));
      expect(box.x0).toBeGreaterThanOrEqual(model.box.x0 - 1e-9);
      expect(box.x1).toBeLessThanOrEqual(model.box.x1 + 1e-9);
      expect(box.y1).toBeLessThanOrEqual(model.box.y1 + 1e-9);
    }
    expect(model.still.map((p) => p.key)).toEqual(['floor']);
  });
});

describe('tegningen', () => {
  const frame = frameOf(PUSH_UP_FIGURE);
  const top = solve(frame, PUSH_UP_FIGURE.keyframes.top as Pose);
  const bottom = solve(frame, PUSH_UP_FIGURE.keyframes.bottom as Pose);

  test('samme elementer med samme nøgler i hvert billede, så appen kan flytte dem', () => {
    const keys = (prims: ReturnType<typeof bodyPrims>) => prims.map((p) => p.key);
    expect(keys(bodyPrims(PUSH_UP_FIGURE, top))).toEqual(keys(bodyPrims(PUSH_UP_FIGURE, bottom)));
    expect(keys(bodyPrims(PUSH_UP_FIGURE, top))).toContain('near.arm.1');
  });

  test('farverne er designets CSS-variabler: navy nær, lys fjern, rød på det, der arbejder', () => {
    const svg = svgBody(bodyPrims(PUSH_UP_FIGURE, top));
    expect(svg).toContain('stroke="var(--c-picto-highlight)"');
    expect(svg).toContain('stroke="var(--c-picto-far)"');
    expect(svg).toContain('fill="var(--c-picto-near)"');
    expect(svg).not.toMatch(/#[0-9a-f]{6}/i);
    // The near upper arm is red; its forearm navy.
    const prims = bodyPrims(PUSH_UP_FIGURE, top);
    expect(prims.find((p) => p.key === 'near.arm.1')).toMatchObject({ s: 'hi' });
    expect(prims.find((p) => p.key === 'near.arm.2')).toMatchObject({ s: 'near' });
  });

  test('y vendes til SVG, og kun det, der flytter sig, sættes i hvert billede', () => {
    const line = bodyPrims(PUSH_UP_FIGURE, top).find((p) => p.key === 'torso');
    if (!line || line.t !== 'line') throw new Error('ingen overkrop');
    expect(moving(line)).toEqual([
      ['x1', '44.04'],
      ['y1', '-20.02'],
      ['x2', String(Math.round(line.b[0] * 100) / 100)],
      ['y2', String(Math.round(-line.b[1] * 100) / 100)],
    ]);
  });

  test('en rød nakke tegnes mellem skuldrene og hovedet', () => {
    const neck = bodyPrims({ ...PUSH_UP_FIGURE, highlight: ['neck'] }, top).find(
      (p) => p.key === 'neck',
    );
    expect(neck).toMatchObject({ t: 'line', s: 'hi' });
  });

  test('en rygsæk i hånden følger hånden', () => {
    const props = [{ type: 'backpack' as const, attach: 'near.hand' as const }];
    const extent = { x0: 0, x1: 0, top: 0 };
    const atTop = propPrims(props, top, extent, 1)[0];
    const atBottom = propPrims(props, bottom, extent, 1)[0];
    expect(atTop?.key).toBe('prop0.0');
    expect(atTop && atTop.t === 'rect' ? atTop.y + 11 : 0).toBeCloseTo(0);
    expect(atBottom?.key).toBe(atTop?.key);
  });

  test('stol, væg og gulv: væggen når over figuren og er skraveret på bagsiden', () => {
    const props = [
      { type: 'chair' as const, x: 66, width: 24, height: 24 },
      { type: 'wall' as const, x: 0, side: -1 as const },
    ];
    const prims = propPrims(props, null, { x0: 0, x1: 90, top: 60 }, 1);
    const chair = prims.filter((p) => p.key.startsWith('prop0.'));
    expect(chair.map((p) => p.t)).toEqual(['rect', 'line', 'line']);
    const wall = prims.filter((p) => p.key.startsWith('prop1.'));
    expect(wall[0]).toMatchObject({ t: 'line', a: [0, 0], b: [0, 64] });
    expect(wall[1]).toMatchObject({ t: 'line', b: [-4, 7] });
  });
});

describe('fremad-kinematik fra det, der står stille (D56)', () => {
  test('foden drejer om tæerne, når hælen løftes: tæerne står, og foden holder længden', () => {
    const calf: FigureItem = {
      id: 'calf.1',
      view: 'side',
      facing: 1,
      props: [],
      highlight: ['near.shin'],
      keyframes: {
        bottom: {
          hip: [0, 50.4],
          torso: 90,
          arms: { near: { to: [2, 52] }, far: { to: [1, 52] } },
          legs: {
            near: { to: [0, 3.6], tip: [7.2, 0.3] },
            far: { to: [-0.6, 3.6], tip: [6.6, 0.3] },
          },
        },
        top: {
          hip: [3.24, 54.16],
          torso: 90,
          arms: { near: { to: [5.2, 56] }, far: { to: [4.2, 56] } },
          legs: {
            // The heel lifted: the same foot, turned about the toes to 120°.
            near: { to: [3.24, 7.16], tip: [7.2, 0.3] },
            far: { to: [2.64, 7.16], tip: [6.6, 0.3] },
          },
        },
      },
    };
    const movement: OwnMovement = {
      positions: [
        { id: 'bottom', name: 'Nede', text: 'Nede.', contacts: [{ part: 'toes', on: 'floor' }] },
        { id: 'top', name: 'Oppe', text: 'Oppe.', contacts: [{ part: 'toes', on: 'floor' }] },
      ],
      phases: [{ to: 'top', seconds: 2, label: 'Op' }],
    };
    const m = buildModel(calf, movement);
    const move = m.timeline.moves[0];
    if (!move) throw new Error('ingen bevægelse');
    expect(m.steps.get(move)?.plan.anchor).toBe('toe');
    for (const u of [0.25, 0.5, 0.75]) {
      const leg = solve(m.frame, movePose(m, move, u)).bones.find(
        (b) => b.side === 'near' && b.kind === 'leg',
      );
      if (!leg?.tip) throw new Error('ingen fod');
      expect(leg.tip[0]).toBeCloseTo(7.2, 5);
      expect(leg.tip[1]).toBeCloseTo(0.3, 5);
      expect(distance(leg.end, leg.tip)).toBeCloseTo(Math.hypot(7.2, 3.3), 1);
    }
  });

  test('en arm svinger frem over hovedet, ikke tilbage gennem kroppen, og holder længden', () => {
    // Behind the body (-30) to over the head (180): forward through 75, not back through -105.
    expect(swingDelta(-30, 180, 'arm')).toBeCloseTo(210);
    expect(swingDelta(10, 80, 'arm')).toBeCloseTo(70);
    const jump: FigureItem = {
      id: 'jump',
      view: 'side',
      facing: 1,
      props: [],
      highlight: ['near.thigh'],
      keyframes: {
        dip: {
          hip: [0, 40],
          torso: 70,
          arms: { near: { to: [-14, 40] }, far: { to: [-13, 40] } },
          legs: { near: { to: [4, 3.6], tip: [11, 0.3] }, far: { to: [3, 3.6], tip: [10, 0.3] } },
        },
        air: {
          hip: [0, 60],
          torso: 90,
          arms: { near: { to: [1, 121] }, far: { to: [1.5, 121] } },
          legs: { near: { to: [1, 13], tip: -60 }, far: { to: [0, 13], tip: -60 } },
        },
      },
    };
    const movement: OwnMovement = {
      positions: [
        { id: 'dip', name: 'Nede', text: 'Nede.', contacts: [{ part: 'foot', on: 'floor' }] },
        { id: 'air', name: 'Luften', text: 'Oppe.', contacts: [] },
      ],
      phases: [{ to: 'air', seconds: 0.6, label: 'Hop' }],
    };
    const m = buildModel(jump, movement);
    const move = m.timeline.moves[0];
    if (!move) throw new Error('ingen bevægelse');
    const s = solve(m.frame, movePose(m, move, 0.5));
    const arm = s.bones.find((b) => b.side === 'near' && b.kind === 'arm');
    if (!arm) throw new Error('ingen arm');
    // Halfway the hand is in front of the body (the chest side), and the arm has its full length.
    expect(arm.end[0]).toBeGreaterThan(s.shoulder[0] + 10);
    expect(distance(arm.root, arm.end)).toBeGreaterThan(30);
  });

  test('et løftet ben (»lift«) går i en bue over gulvet og lander på sit nye punkt', () => {
    const step: FigureItem = {
      id: 'step',
      view: 'side',
      facing: 1,
      props: [],
      highlight: ['near.thigh'],
      keyframes: {
        a: {
          hip: [0, 44],
          torso: 90,
          arms: { near: { to: [2, 46] }, far: { to: [1, 46] } },
          legs: {
            near: { to: [0, 3.6], tip: [7.2, 0.3] },
            far: { to: [-1, 3.6], tip: [6.2, 0.3] },
          },
        },
        b: {
          hip: [0, 44],
          torso: 90,
          arms: { near: { to: [2, 46] }, far: { to: [1, 46] } },
          legs: {
            near: { to: [20, 3.6], tip: [27.2, 0.3] },
            far: { to: [-1, 3.6], tip: [6.2, 0.3] },
          },
        },
      },
      transitions: [{ from: 'a', to: 'b', lift: ['near.foot'] }],
    };
    const movement: OwnMovement = {
      positions: [
        { id: 'a', name: 'Samlet', text: 'Samlet.', contacts: [{ part: 'foot', on: 'floor' }] },
        { id: 'b', name: 'Skridt', text: 'Skridt.', contacts: [{ part: 'foot', on: 'floor' }] },
      ],
      phases: [{ to: 'b', seconds: 1, label: 'Skridt frem' }],
    };
    const m = buildModel(step, movement);
    const move = m.timeline.moves[0];
    if (!move) throw new Error('ingen bevægelse');
    expect(move.lift).toEqual(['near.foot']);
    const ankle = (u: number) =>
      solve(m.frame, movePose(m, move, u)).bones.find((b) => b.side === 'near' && b.kind === 'leg')
        ?.end ?? [0, 0];
    // Halfway the foot is a step's arc (a tenth of the step, 3 to 8) over where it rests.
    expect(ankle(0.5)[1]).toBeGreaterThan(3.6 + 3);
    expect(ankle(1)[0]).toBeCloseTo(20, 1);
    // And the knee never dips toward the floor on the way.
    for (let u = 0.05; u < 1; u += 0.05) {
      const leg = solve(m.frame, movePose(m, move, u)).bones.find(
        (b) => b.side === 'near' && b.kind === 'leg',
      );
      expect(leg?.joint[1]).toBeGreaterThan(20);
    }
  });

  test('»advance« flytter figuren langs x, og ender den i startstillingen, begynder den forfra med et klip', () => {
    const movement: OwnMovement = {
      positions: [
        { id: 'land', name: 'Landet', text: 'Landet.', contacts: [] },
        { id: 'air', name: 'Luften', text: 'Oppe.', contacts: [] },
      ],
      phases: [{ to: 'air', seconds: 1, repeat: 3, label: '3 bounds' }],
    };
    const line = timeline(movement, CARD_TIMING, [
      { from: 'land', to: 'air', advance: 10 },
      { from: 'air', to: 'land', advance: 10 },
    ]);
    expect(line.moves.map((m) => m.shift)).toEqual([
      [0, 10],
      [10, 20],
      [20, 30],
      [30, 40],
      [40, 50],
      [50, 60],
      [60, 60],
    ]);
    // Back in its first position it never glides backward to the start: it stands a moment where it
    // landed, and the loop starts over at the start (the figure agents' bounds, P1b).
    const back = line.moves.at(-1);
    expect(back).toMatchObject({ from: 'land', to: 'land', phase: null, cut: true });
    expect(back?.seconds).toBeCloseTo(CARD_TIMING.back / 2, 9);
  });
});

describe('tegningen af ryg, ansigt og flasker (D56)', () => {
  const frame = frameOf(PUSH_UP_FIGURE);
  const top = PUSH_UP_FIGURE.keyframes.top as Pose;

  test('»spine« tegner ryggen som en kurve, der buer mod ryggen (rund ryg)', () => {
    const cat: FigureItem = {
      ...PUSH_UP_FIGURE,
      keyframes: { top: { ...top, spine: 4 }, bottom: PUSH_UP_FIGURE.keyframes.bottom as Pose },
    };
    const s = solve(frame, cat.keyframes.top as Pose);
    const torso = bodyPrims(cat, s).find((p) => p.key === 'torso');
    if (!torso || torso.t !== 'curve') throw new Error('ryggen er ikke en kurve');
    // A push-up's chest faces the floor, so a round back bulges up.
    const mid: [number, number] = [(s.hip[0] + s.shoulder[0]) / 2, (s.hip[1] + s.shoulder[1]) / 2];
    expect(torso.c[1]).toBeGreaterThan(mid[1] + 6);
    expect(moving(torso)[0]?.[0]).toBe('d');
    // The other keyframe has a straight back but is drawn as a curve too, so the element stays.
    const flat = bodyPrims(cat, solve(frame, cat.keyframes.bottom as Pose));
    expect(flat.find((p) => p.key === 'torso')?.t).toBe('curve');
    expect(bodyPrims(PUSH_UP_FIGURE, solve(frame, top)).find((p) => p.key === 'torso')?.t).toBe(
      'line',
    );
  });

  test('i sidebilledet viser et lille mærke på hovedet, hvor ansigtet vender; forfra ikke', () => {
    const s = solve(frame, top);
    const face = bodyPrims(PUSH_UP_FIGURE, s).find((p) => p.key === 'face');
    if (!face || face.t !== 'circle') throw new Error('intet ansigt');
    // A push-up looks down at the floor: the mark is below the head's centre.
    expect(face.c[1]).toBeLessThan(s.head[1] - 4);
    const front = solve({ view: 'front', facing: null }, standing());
    const prims = bodyPrims({ view: 'front', highlight: ['torso'] }, front);
    expect(prims.some((p) => p.key === 'face')).toBe(false);
  });

  test('flasker på ryggen ligger langs ryggen på ryggens side, ikke under maven', () => {
    const s = solve(frame, top);
    const extent = { x0: 0, x1: 0, top: 0 };
    const [bottle] = propPrims([{ type: 'bottles', attach: 'back' }], s, extent, 1);
    if (!bottle || bottle.t !== 'poly') throw new Error('ingen flaske');
    const lowest = Math.min(...bottle.pts.map((p) => p[1]));
    const mid = (s.hip[1] + s.shoulder[1]) / 2;
    expect(lowest).toBeGreaterThan(mid);
  });

  test('en arm over hovedet med »bend« vender albuen (håndstand), og tjekket godtager det', () => {
    const handstand: Pose = {
      hip: [10, 52],
      torso: -90,
      arms: { near: { to: [10, 0], upper: 12.5 }, far: { to: [11, 0], upper: 12.5 } },
      legs: {
        near: { to: [10, 98], tip: [12, 105] },
        far: { to: [10.5, 98], tip: [12.5, 105] },
      },
    };
    const left: Frame = { view: 'side', facing: -1 };
    const plain = solve(left, handstand);
    const flipped = solve(left, {
      ...handstand,
      arms: {
        near: { to: [10, 0], upper: 12.5, bend: -1 },
        far: { to: [11, 0], upper: 12.5, bend: -1 },
      },
    });
    const elbowX = (s: typeof plain) =>
      s.bones.find((b) => b.side === 'near' && b.kind === 'arm')?.joint[0] ?? 0;
    expect(Math.sign(elbowX(plain) - 10)).toBe(-Math.sign(elbowX(flipped) - 10));
    expect(bendProblems(left, flipped)).toEqual([]);
  });
});

describe('»advance« uden spring (H1 i P1a-reviewet)', () => {
  /** Single-leg bounds: push off, fly, land, three times, then stand still and rise. */
  const bounds = (): { figure: FigureItem; movement: OwnMovement } => {
    const leg = (to: [number, number], tip: [number, number] | number) => ({ to, tip });
    const arms = {
      near: { to: [6, 50] as [number, number] },
      far: { to: [-4, 50] as [number, number] },
    };
    const pose = (hip: [number, number], near: [number, number], far: [number, number]): Pose => ({
      hip,
      torso: 80,
      arms,
      legs: { near: leg(near, 0), far: leg(far, -30) },
    });
    return {
      figure: {
        id: 'power_legs.6',
        movement: 'bounds',
        view: 'side',
        facing: 1,
        props: [],
        highlight: ['near.thigh'],
        keyframes: {
          stand: pose([0, 50.5], [0, 3.6], [-14, 12]),
          push: pose([6, 48], [0, 3.6], [-16, 14]),
          air: pose([12, 54], [4, 12], [-10, 16]),
          land: pose([0, 48], [0, 3.6], [-16, 14]),
        },
        transitions: [
          { from: 'push', to: 'air', advance: 20 },
          { from: 'air', to: 'land', advance: 20 },
        ],
      },
      movement: {
        positions: [
          {
            id: 'stand',
            name: 'Klar',
            text: 'Klar.',
            contacts: [{ part: 'foot', on: 'floor', count: 1 }],
          },
          {
            id: 'push',
            name: 'Afsæt',
            text: 'Afsæt.',
            contacts: [{ part: 'foot', on: 'floor', count: 1 }],
          },
          { id: 'air', name: 'I luften', text: 'Luften.', contacts: [] },
          {
            id: 'land',
            name: 'Landing',
            text: 'Landing.',
            contacts: [{ part: 'foot', on: 'floor', count: 1 }],
          },
        ],
        phases: [
          { to: 'push', seconds: 0.3, label: 'Spring 1' },
          { to: 'air', seconds: 0.4, label: 'I luften' },
          { to: 'land', seconds: 0.3, label: 'Land' },
          { to: 'push', seconds: 0.3, label: 'Spring 2' },
          { to: 'air', seconds: 0.4, label: 'I luften' },
          { to: 'land', seconds: 0.3, label: 'Land' },
          { to: 'land', seconds: 1, label: 'Stå stille' },
          { to: 'stand', seconds: 1, label: 'Rejs dig' },
        ],
      },
    };
  };

  test('hver bevægelse og hvert hold har den løbende forskydning, og vejen tilbage går til 0', () => {
    const { figure, movement } = bounds();
    const line = timeline(movement, CARD_TIMING, figure.transitions);
    expect(line.moves.map((m) => m.shift ?? [0, 0])).toEqual([
      [0, 0],
      [0, 20],
      [20, 40],
      [40, 40],
      [40, 60],
      [60, 80],
      [80, 80],
      [80, 80],
      [80, 80],
    ]);
    expect(line.moves.at(-1)?.cut).toBe(true);
  });

  test('hoften springer ikke mellem to billeder ved 30 billeder i sekundet', () => {
    const { figure, movement } = bounds();
    const model = buildModel(figure, movement);
    let last: number | null = null;
    let worst = 0;
    // One loop: it starts over with a cut (below), never with a jump in the middle.
    for (let t = 0; t < model.timeline.total - 1e-9; t += 1 / 30) {
      const x = solve(model.frame, poseAt(model, t)).hip[0];
      if (last !== null) worst = Math.max(worst, Math.abs(x - last));
      last = x;
    }
    // The fastest way: 20 units in 0.4 sek with easing, about 2,6 units a frame at its peak.
    expect(worst).toBeLessThan(5);
    // The last frame stands where it landed, the next loop at the start: a cut, and the check
    // knows it (no »figuren springer« between the way back and the first move).
    const end = solve(model.frame, poseAt(model, model.timeline.total - 1e-6)).hip[0];
    expect(end).toBeGreaterThan(70);
    expect(solve(model.frame, poseAt(model, model.timeline.total)).hip[0]).toBeLessThan(10);
    expect(jumpProblems(model)).toEqual([]);
  });

  test('stillbillederne står i deres egen kasse uden turen langs gulvet', () => {
    const { figure, movement } = bounds();
    const model = buildModel(figure, movement);
    const travel = model.box.x1 - model.box.x0;
    const own = model.stillBox.x1 - model.stillBox.x0;
    expect(travel).toBeGreaterThan(own + 60);
    const noAdvance = buildModel({ ...figure, transitions: [] }, movement);
    expect(own).toBeCloseTo(noAdvance.box.x1 - noAdvance.box.x0, 0);
  });
});

describe('»via«: en mellempose på en overgang (H2 i P1a-reviewet)', () => {
  /** Standing, then down on the heels, through a pose with the hands up on the way down and up. */
  const figure = (): FigureItem => {
    const low: Pose = {
      ...standing(),
      hip: [-6, 30],
      torso: 70,
      legs: { near: { to: [1, 3.6], tip: [8.2, 0.3] }, far: { to: [-1, 3.6], tip: [6.2, 0.3] } },
    };
    const through: Pose = {
      ...standing(),
      hip: [-2, 42],
      torso: 85,
      arms: { near: { to: [6, 100] }, far: { to: [5, 100] } },
    };
    return {
      id: 'press.1',
      view: 'side',
      facing: 1,
      props: [],
      highlight: ['near.thigh'],
      keyframes: { stand: standing(), low },
      transitions: [
        { from: 'stand', to: 'low', via: through },
        { from: 'low', to: 'stand', via: { ...through, hip: [-3, 40] } },
      ],
    };
  };
  const movement: OwnMovement = {
    positions: [
      { id: 'stand', name: 'Stå', text: 'Stå.', contacts: [{ part: 'foot', on: 'floor' }] },
      { id: 'low', name: 'Nede', text: 'Nede.', contacts: [{ part: 'foot', on: 'floor' }] },
    ],
    phases: [{ to: 'low', seconds: 1, label: 'Ned' }],
  };

  test('bevægelsen går i to halvdele gennem via-posen, også vejen tilbage til start', () => {
    const line = timeline(movement, CARD_TIMING, figure().transitions);
    expect(line.moves.map((m) => [m.from, m.to, m.start, m.seconds, m.phase, m.bridge])).toEqual([
      ['stand', viaId('stand', 'low'), 0, 0.5, 0, true],
      [viaId('stand', 'low'), 'low', 0.5, 0.5, 0, true],
      ['low', viaId('low', 'stand'), 1, 0.5, null, true],
      [viaId('low', 'stand'), 'stand', 1.5, 0.5, null, true],
    ]);
    expect(line.total).toBe(2);
  });

  test('halvdelene mødes i via-posen, og ingen keyframe springes over', () => {
    const m = buildModel(figure(), movement);
    const [first, second] = m.timeline.moves;
    if (!first || !second) throw new Error('ingen bevægelser');
    const hip = (move: typeof first, u: number) => solve(m.frame, movePose(m, move, u)).hip;
    expect(near(hip(first, 0), [0, 49])).toBe(true);
    expect(near(hip(first, 1), [-2, 42])).toBe(true);
    expect(near(hip(second, 0), [-2, 42])).toBe(true);
    expect(near(hip(second, 1), [-6, 30])).toBe(true);
    // The hands go up through the via pose on the way down.
    const hand = solve(m.frame, movePose(m, first, 1)).bones.find(
      (b) => b.side === 'near' && b.kind === 'arm',
    );
    expect(hand?.end[1]).toBeGreaterThan(90);
  });
});

describe('D58: vinkler, markeringer og fejlpar', () => {
  /** A mark's own shapes, without the white edge drawn under each (its halo). */
  const shapes = (prims: readonly Prim[] = []) => prims.filter((p) => !p.key.endsWith('.halo'));
  /** The push-up with an arrow down in »3 sek ned«, the elbow at the bottom and an arrow up. */
  const marked = (): FigureItem => ({
    ...PUSH_UP_FIGURE,
    marks: [
      { arrow: 'chest', phase: 1, offset: [0, -4] },
      { angle: 'near.elbow', at: 'bottom', degrees: 90 },
      { arrow: 'chest', phase: 3 },
    ],
  });

  test('forfra krummer »spine« overkroppen til den nære side, og trapezet bøjer med (14 punkter)', () => {
    const frame: Frame = { view: 'front', facing: null };
    const pose: Pose = { ...standing(), spine: 4 };
    const s = solve(frame, pose);
    const mid = (s.hip[0] + s.shoulder[0]) / 2;
    // Upright, the near side is to the right (+x): the back's control point lies 8 that way.
    expect(s.back[0]).toBeCloseTo(mid + 8, 5);
    const figure = {
      view: 'front' as const,
      highlight: ['torso' as const],
      keyframes: { a: pose },
    };
    const torso = bodyPrims(figure, s).find((p) => p.key === 'torso');
    if (!torso || torso.t !== 'poly') throw new Error('ingen overkrop');
    expect(torso.pts).toHaveLength(14);
    // The middle of each long side bulges toward the near side.
    expect((torso.pts[3] as [number, number])[0]).toBeGreaterThan(
      ((s.pelvis?.[0][0] ?? 0) + (s.shoulders?.[0][0] ?? 0)) / 2 + 3,
    );
    // Seen from above the back stays straight.
    expect(solve({ view: 'top', facing: null }, pose).spine).toBe(0);
  });

  test('den anden vinkel er en figur for sig med figurens røde segmenter og samme faser', () => {
    const figure: FigureItem = {
      ...PUSH_UP_FIGURE,
      second: {
        view: 'front',
        props: [],
        keyframes: {
          top: {
            ...standing(),
            arms: { near: { to: [12, 50], bend: 1 }, far: { to: [-12, 50], bend: -1 } },
            legs: { near: { to: [5, 3.6], bend: 1 }, far: { to: [-5, 3.6], bend: -1 } },
          },
          bottom: {
            ...standing(),
            hip: [0, 40],
            arms: { near: { to: [12, 50], bend: 1 }, far: { to: [-12, 50], bend: -1 } },
            legs: { near: { to: [5, 3.6], bend: 1 }, far: { to: [-5, 3.6], bend: -1 } },
          },
        },
      },
    };
    const views = figureViews(figure);
    expect(views.map((v) => v.view)).toEqual(['side', 'front']);
    expect(views[1]?.highlight).toEqual(PUSH_UP_FIGURE.highlight);
    expect(views[1]).not.toHaveProperty('second');
    const [a, b] = views.map((v) => buildModel(v, PUSH_UP));
    expect(a?.timeline.phases).toEqual(b?.timeline.phases);
    expect(a?.timeline.total).toBe(b?.timeline.total);
  });

  test('en fase-markering står hele fasen, en positions markering i holdet ved positionen', () => {
    const model = buildModel(marked(), PUSH_UP);
    const plans = markPlans(model);
    expect(plans.map((p) => p.shows.map((s) => [s.start, s.end]))).toEqual([
      [[0, 3]],
      [[3, 4]],
      [[4, 5]],
    ]);
    const at = (t: number) => markAt(plans, model.timeline.total, t)?.plan.index ?? null;
    expect([at(0.5), at(2.9), at(3.5), at(4.5), at(5.5)]).toEqual([0, 0, 1, 2, 0]);
    // Before the clock starts (a session's »Klar«) no mark is shown.
    expect(markAt(plans, model.timeline.total, null)).toBeNull();
  });

  test('vinklen tegnes ved albuen med gradtallet, pilen følger brystet ned og op', () => {
    const model = buildModel(marked(), PUSH_UP);
    const [down, angle, up] = markPlans(model).map((p) => p.shows[0]);
    expect(angle?.label?.text).toBe('90°');
    // Inside the angle, beside the arc: the elbow opens down and back toward the floor.
    expect(['below', 'left']).toContain(angle?.label?.place);
    expect(shapes(angle?.prims)[0]?.t).toBe('path');
    const s = solve(model.frame, PUSH_UP_FIGURE.keyframes.bottom as Pose);
    const elbow = s.bones.find((b) => b.side === 'near' && b.kind === 'arm')?.joint ?? [0, 0];
    expect(angle?.measured).toBeCloseTo(jointAngle(s, 'near.elbow')?.degrees ?? 0, 5);
    const arc = shapes(angle?.prims)[0];
    if (arc?.t !== 'path') throw new Error('ingen bue');
    for (const p of arc.pts) expect(distance(p, elbow)).toBeCloseTo(6, 5);
    // The arrows: down in »3 sek ned« (moved 4 down), up in »Op«; a shaft and a head each.
    expect(shapes(down?.prims).map((p) => p.t)).toEqual(['path', 'poly']);
    // Every shape has a white edge under it, so a red arrow stands out on a red upper arm.
    const halos = (down?.prims ?? []).filter((p) => p.key.endsWith('.halo'));
    expect(halos.map((p) => p.key)).toEqual(['mark0.shaft.halo', 'mark0.head.halo']);
    for (const halo of halos) {
      expect(halo.t === 'path' || halo.t === 'poly' ? halo.s : '').toBe('paper');
      expect(halo.z).toBeLessThan(30);
    }
    // The body the text keeps off: points along every stroke.
    expect(down?.body.length).toBeGreaterThan(40);
    expect(down?.chord?.[1]).toBeLessThan(-8);
    expect(up?.chord?.[1]).toBeGreaterThan(8);
    expect(directionText(model.frame, down?.chord ?? [0, 0])).toMatch(/ned/);
    expect(directionText(model.frame, up?.chord ?? [0, 0])).toMatch(/op/);
  });

  test('en gentaget fase får en pil med hoved i begge ender', () => {
    const pumps: OwnMovement = {
      ...PUSH_UP,
      phases: [{ to: 'bottom', seconds: 0.8, label: '10 pumps', repeat: 10 }],
    };
    const figure: FigureItem = { ...PUSH_UP_FIGURE, marks: [{ arrow: 'hip', phase: 1 }] };
    const [show] = markPlans(buildModel(figure, pumps))[0]?.shows ?? [];
    expect(shapes(show?.prims).map((p) => p.t)).toEqual(['path', 'poly', 'poly']);
    expect(show?.end).toBeCloseTo(8, 9);
  });

  test('stillbillederne har positionens markeringer og pilen for den fase, der starter dér', () => {
    const model = buildModel(marked(), PUSH_UP);
    const first = (m: { prims: Prim[] }) => shapes(m.prims)[0]?.key;
    expect(stillMarks(model, 'top').map(first)).toEqual(['mark0.shaft']);
    expect(stillMarks(model, 'bottom').map(first)).toEqual(['mark1.arc', 'mark2.shaft']);
  });

  test('en cue står ved sit punkt på den side, der vender væk fra kroppen, og en linje er stiplet', () => {
    const figure: FigureItem = {
      ...PUSH_UP_FIGURE,
      marks: [
        { cue: 'Én planke', at: 'bottom', point: 'head' },
        { line: ['near.foot', 'shoulder'], cue: 'Lige linje', phase: 1 },
        { cue: 'Ned', phase: 3 },
      ],
    };
    const model = buildModel(figure, PUSH_UP);
    const [cue, line, corner] = markPlans(model).map((p) => p.shows[0]);
    expect(cue?.label).toMatchObject({ text: 'Én planke', place: 'right' });
    expect(shapes(cue?.prims)[0]?.t).toBe('circle');
    const drawn = shapes(line?.prims)[0];
    expect(drawn?.t === 'line' && drawn.dash).toBeTruthy();
    expect(line?.label?.place).toBe('above');
    expect(corner?.label).toMatchObject({ text: 'Ned', at: null, place: 'corner' });
  });

  test('teksten står ved sit punkt, men flytter sig væk fra kroppen, hvis den ville dække den', () => {
    const body = [
      [50, 50, 3],
      [60, 50, 3],
      [70, 50, 3],
    ] as const;
    // Room on the right of the point: it stands there.
    expect(
      placeLabel({ width: 200, height: 100, w: 40, h: 20, at: [80, 50], place: 'right', body }),
    ).toEqual([86, 40]);
    // Asked for the left, where the body is: it goes to the first side that is free.
    const [x, y] = placeLabel({
      width: 200,
      height: 100,
      w: 40,
      h: 20,
      at: [80, 50],
      place: 'left',
      body,
    });
    expect(x >= 86 || y + 20 <= 47 || y >= 53).toBe(true);
    // Never outside the drawing.
    const [cx, cy] = placeLabel({
      width: 100,
      height: 100,
      w: 60,
      h: 20,
      at: [95, 95],
      place: 'right',
      body: [],
    });
    expect(cx + 60).toBeLessThanOrEqual(100);
    expect(cy + 20).toBeLessThanOrEqual(100);
    // Without a point: the top left corner.
    expect(
      placeLabel({ width: 100, height: 100, w: 30, h: 20, at: null, place: 'corner', body: [] }),
    ).toEqual([0, 0]);
  });

  test('tekstalternativet nævner vinklerne og markeringerne på dansk', () => {
    const model = buildModel(marked(), PUSH_UP);
    const text = viewsAndMarksText([{ model, plans: markPlans(model) }]);
    expect(text).toBe(
      'Markeringer: i »3 sek ned« en pil ned ved brystet; ved Nede albuen 90°; i »Op« en pil op ved brystet.',
    );
  });

  test('en forkert stilling ændrer det, den siger: hoften hænger, hænder og fødder står', () => {
    const right = PUSH_UP_FIGURE.keyframes.top as Pose;
    const wrong = wrongPose(right, { hip: [44.04, 15], torso: 30 });
    expect(wrong.arms).toEqual(right.arms);
    expect(wrong.legs).toEqual(right.legs);
    const frame = frameOf(PUSH_UP_FIGURE);
    const s = solve(frame, wrong);
    const hand = s.bones.find((b) => b.side === 'near' && b.kind === 'arm')?.end ?? [0, 0];
    expect(near(hand, [69.2, 0], 0.05)).toBe(true);
    const differs = deviation(frame, right, wrong);
    expect(differs.by).toBeGreaterThan(4.9);
    // A limb given replaces the right pose's limb only.
    const knees = wrongPose(right, { legs: { near: { to: [2, 3.6], tip: [5.4, 0.3] } } });
    expect(knees.legs.far).toEqual(right.legs.far);
    const pair = faultPair(PUSH_UP_FIGURE, PUSH_UP, {
      mistake: 1,
      at: 'top',
      wrong: { hip: [44.04, 15] },
    });
    expect(pair?.figure.view).toBe('side');
    expect(
      faultPair(PUSH_UP_FIGURE, PUSH_UP, {
        mistake: 1,
        at: 'top',
        view: 'front',
        wrong: { torso: 1 },
      }),
    ).toBeNull();
  });

  describe("rammen følger en figur, der rejser langs x (P1a's forslag)", () => {
    // Single-leg bounds as the P1a instruction drew them: 14 forward on each way of each bound (84
    // in all), so the frame's rules are tested apart from the figure agents' drawing.
    const legs = (near: [Point, Point], far: [Point, Point]): Pose['legs'] => ({
      near: { to: near[0], tip: near[1] },
      far: { to: far[0], tip: far[1] },
    });
    const pose = (
      hip: Point,
      torso: number,
      head: number,
      hands: [Point, Point],
      feet: Pose['legs'],
    ): Pose => ({
      hip,
      torso,
      head,
      arms: { near: { to: hands[0] }, far: { to: hands[1] } },
      legs: feet,
    });
    const tried: { figure: FigureItem } = {
      figure: {
        id: 'power_legs.6',
        movement: 'bounds',
        view: 'side',
        facing: 1,
        props: [],
        highlight: ['near.thigh'],
        keyframes: {
          stand: pose(
            [0.6, 49.9],
            80,
            8,
            [
              [7.81, 48.69],
              [3.81, 48.69],
            ],
            legs(
              [
                [1.2, 3.6],
                [8.4, 0.3],
              ],
              [
                [-23.5, 14.8],
                [-24.8, 7.41],
              ],
            ),
          ),
          push: pose(
            [14.15, 54.32],
            72,
            10,
            [
              [54.72, 82.85],
              [54.6, 85.57],
            ],
            legs(
              [
                [5.95, 7.83],
                [8.4, 0.3],
              ],
              [
                [32.1, 34.19],
                [38.25, 29.89],
              ],
            ),
          ),
          air: pose(
            [8.5, 57.5],
            78,
            8,
            [
              [-5.38, 62.87],
              [-4.1, 61.85],
            ],
            legs(
              [
                [14.29, 12.47],
                [21.53, 10.53],
              ],
              [
                [-19.03, 52.57],
                [-26.08, 50.01],
              ],
            ),
          ),
          land: pose(
            [-1.74, 47.2],
            70,
            15,
            [
              [22.6, 48.9],
              [24.15, 50.37],
            ],
            legs(
              [
                [1.2, 3.6],
                [8.4, 0.3],
              ],
              [
                [-22, 18],
                [-23.3, 10.61],
              ],
            ),
          ),
        },
        transitions: [
          { from: 'push', to: 'air', advance: 14 },
          { from: 'air', to: 'land', advance: 14 },
        ],
      },
    };
    const explain = JSON.parse(
      readFileSync(join(process.cwd(), 'content', 'explain', 'power_legs.json'), 'utf8'),
    ) as ExplainFile;
    const movement = movementFor(explain, 'power_legs.6', 'bounds') as OwnMovement;
    const model = buildModel(tried.figure, movement);
    const tall = 191 / 214;

    test('figuren er næsten lige så stor som stående stille og er altid helt inde i rammen', () => {
      expect(model.travel?.max).toBeGreaterThan(40);
      const height = (b: Box) => b.y1 - b.y0 + 6;
      const width = (b: Box) => b.x1 - b.x0 + 6;
      const first = frameBox(model, 0, tall);
      // The frame has the drawing's own shape, a little taller than the figure at most.
      expect(width(first) / height(first)).toBeCloseTo(tall, 5);
      expect(height(first)).toBeLessThan(height(model.stillBox) * 1.3);
      // The whole trip in one frame would make it much smaller.
      expect(height(first)).toBeLessThan((width(model.box) / tall) * 0.85);
      for (let t = 0; t < model.timeline.total; t += 1 / 30) {
        const frame = frameBox(model, t, tall);
        const s = solve(model.frame, poseAt(model, t));
        for (const p of [s.hip, s.head, ...s.bones.flatMap((b) => [b.joint, b.end])]) {
          expect(p[0]).toBeGreaterThanOrEqual(frame.x0 - 3 - 1e-6);
          expect(p[0]).toBeLessThanOrEqual(frame.x1 + 3 + 1e-6);
        }
      }
    });

    test('figuren krydser rammen synligt, mens rammen panorerer resten', () => {
      const start = frameBox(model, 0, tall);
      const t = model.timeline.phases[6]?.start ?? 0;
      const later = frameBox(model, t, tall);
      const moved = shiftAtTime(model, t);
      const panned = later.x0 - start.x0;
      expect(panned).toBeGreaterThan(0);
      expect(moved - panned).toBeGreaterThan(10);
    });

    test('alt passer i en bred tegning, og en figur med møbler viser hele scenen', () => {
      expect(frameBox(model, 1, 6)).toBe(model.box);
      const wall = buildModel(
        { ...tried.figure, props: [{ type: 'wall', x: -30, side: 1 }] },
        movement,
      );
      expect(frameBox(wall, 1, tall)).toBe(wall.box);
      const still = buildModel(PUSH_UP_FIGURE, PUSH_UP);
      expect(frameBox(still, 1, tall)).toBe(still.box);
    });
  });
});

// ---------------------------------------------------------------------------------------------
// D60: the fixes after the review of P1b (docs/reviews/nat3-p1b-figurmotor.md)
// ---------------------------------------------------------------------------------------------

/** Legs from the front, the knees a little out: a hip at `y` over feet hip-width apart. */
function frontLegs(y: number): Pose['legs'] {
  const reach = Math.min(46.5, y - 3.6);
  return {
    near: { to: [6, y - reach], bend: 1 },
    far: { to: [-6, y - reach], bend: -1 },
  };
}

describe('D60: rettelser efter reviewet af P1b', () => {
  /** A mark's own shapes, without the white edge drawn under each (its halo). */
  const own = (prims: readonly Prim[] = []) => prims.filter((p) => !p.key.endsWith('.halo'));

  test('H1: en tekst, der ikke kan stå i sin tegning, står på sin egen linje over eller under kroppen', () => {
    // A standing figure across 240 × 160 px with its head near the top: over the head the text
    // covers less of the body than under the feet.
    const tall = Array.from({ length: 12 }, (_, i) => [120, 40 + i * 10, 4] as const);
    expect(
      placeLabel({
        width: 240,
        height: 160,
        w: 200,
        h: 46,
        at: [150, 100],
        place: 'right',
        line: true,
        body: tall,
      }),
    ).toEqual([40, 0]);
    // A squat lower in the drawing: the text stands on its own line just over the head.
    const squat = Array.from({ length: 8 }, (_, i) => [120, 80 + i * 10, 4] as const);
    expect(
      placeLabel({
        width: 240,
        height: 160,
        w: 200,
        h: 46,
        at: [150, 120],
        place: 'right',
        line: true,
        body: squat,
      }),
    ).toEqual([40, 24]);
    // Room beside the point is not enough: the text stands on the line over the body, not beside
    // its point – at the right, where it covers nothing.
    const narrow = Array.from({ length: 12 }, (_, i) => [30, 40 + i * 10, 4] as const);
    const beside = { width: 240, height: 160, w: 150, h: 46, at: [30, 100] as [number, number] };
    expect(placeLabel({ ...beside, place: 'right', body: narrow })).toEqual([36, 77]);
    expect(placeLabel({ ...beside, place: 'right', line: true, body: narrow })).toEqual([90, 0]);
    // Never outside the area, also when the text is as wide as it.
    const [x, y] = placeLabel({
      width: 240,
      height: 160,
      w: 240,
      h: 46,
      at: null,
      place: 'corner',
      line: true,
      body: squat,
    });
    expect([x, y + 46 <= 160]).toEqual([0, true]);
  });

  test('H2: en cue ved hoften og en hjælpelinje i en fase følger kroppen, mens teksten står stille', () => {
    const figure: FigureItem = {
      ...PUSH_UP_FIGURE,
      marks: [
        { cue: 'Hoften med', phase: 1, point: 'hip' },
        { cue: 'Stille', phase: 2, point: [40, 30] },
        { line: ['near.foot', 'shoulder'], cue: 'Én planke', phase: 3 },
        { cue: 'Ned', at: 'bottom', point: 'hip' },
      ],
    };
    const model = buildModel(figure, PUSH_UP);
    const plans = markPlans(model);
    const [cue, fixed, line, held] = plans.map((p) => p.shows[0]);
    // A part of the body in a phase follows; a point in figure units and a position's mark stand.
    expect([cue?.follow, fixed?.follow, line?.follow, held?.follow]).toEqual([
      true,
      undefined,
      true,
      undefined,
    ]);
    // Near the end of »3 sek ned« the dot sits on the hip as it is then, far below where it began.
    const late = poseAt(model, 2.9);
    const hip = solve(model.frame, late).hip;
    const top = solve(model.frame, PUSH_UP_FIGURE.keyframes.top as Pose).hip;
    expect(distance(hip, top)).toBeGreaterThan(10);
    const first = plans[0]?.mark ?? { cue: '' };
    const dot = own(followPrims(model, first, 0, late, 0)).find((p) => p.t === 'circle');
    expect(dot?.t === 'circle' && near(dot.c, hip)).toBe(true);
    // The shapes have the keys of the ones drawn when the mark came, so the app moves them.
    const keys = (prims: readonly Prim[]) => prims.map((p) => p.key).sort();
    expect(keys(followPrims(model, first, 0, late, 0))).toEqual(keys(cue?.prims ?? []));
    // Halfway through »Op« the line runs through the foot and the shoulder as they are then.
    const mid = poseAt(model, 4.5);
    const s = solve(model.frame, mid);
    const third = plans[2]?.mark ?? { cue: '' };
    const drawn = own(followPrims(model, third, 2, mid, 0)).find((p) => p.t === 'line');
    if (drawn?.t !== 'line') throw new Error('ingen linje');
    const foot = s.bones.find((b) => b.side === 'near' && b.kind === 'leg')?.end ?? [0, 0];
    const off = (p: readonly number[], a: readonly number[], b: readonly number[]) =>
      Math.abs(
        ((b[0] ?? 0) - (a[0] ?? 0)) * ((p[1] ?? 0) - (a[1] ?? 0)) -
          ((b[1] ?? 0) - (a[1] ?? 0)) * ((p[0] ?? 0) - (a[0] ?? 0)),
      ) / Math.hypot((b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0));
    expect(off(foot, drawn.a, drawn.b)).toBeLessThan(0.01);
    expect(off(s.shoulder, drawn.a, drawn.b)).toBeLessThan(0.01);
    // The text keeps off the body during the whole phase: the body it keeps off has the hip at the
    // bottom as well as at the top.
    const bottom = solve(model.frame, PUSH_UP_FIGURE.keyframes.bottom as Pose).hip;
    const has = (p: readonly number[]) =>
      (cue?.body ?? []).some(([x, y]) => Math.hypot(x - (p[0] ?? 0), y - (p[1] ?? 0)) < 1.5);
    expect([has(top), has(bottom)]).toEqual([true, true]);
  });

  test('M1: to vinkler står side om side eller over hinanden, alt efter hvad der tegner den mindste størst', () => {
    // A standing figure (the squat jump: 0.52 and 0.36 as wide as high) side by side everywhere: on
    // the card, beside the target, beside the clock and in the pause.
    for (const [w, h] of [
      [382, 192],
      [246, 160],
      [170, 160],
      [382, 160],
    ] as const) {
      expect(stackViews([0.52, 0.36], w, h)).toBe(false);
    }
    // A push-up from the side and from above (2.2 each) over each other beside the target: each view
    // 76 px high instead of 54 side by side, and at least 60 px.
    expect(stackViews([2.2, 2.2], 246, 160)).toBe(true);
    const [side] = drawnHeights([2.2, 2.2], 246, 160, false);
    const [over] = drawnHeights([2.2, 2.2], 246, 160, true);
    expect(side).toBeLessThan(60);
    expect(over).toBeGreaterThanOrEqual(60);
    // Beside the clock too: as big as one view would be there (170 × 77 px), not halved.
    expect(stackViews([2.2, 2.2], 170, 160)).toBe(true);
    const [clock] = drawnHeights([2.2, 2.2], 170, 160, true);
    expect(clock).toBeGreaterThan((170 / 2.2) * 0.95);
    // In the pause side by side is larger (187 × 85 px against 382 × 76 px), and so on the card for
    // a figure that is a little wider than high.
    expect(stackViews([2.2, 2.2], 382, 160)).toBe(false);
    expect(stackViews([1.3, 1.6], 382, 192)).toBe(false);
    // One wide view is enough: a standing view and a lying one stand over each other at the clock.
    expect(stackViews([0.9, 3.6], 170, 160)).toBe(true);
  });

  test('L1: to vinkler har samme løkke, også når kun den ene rejser langs gulvet', () => {
    const movement: OwnMovement = {
      positions: [
        { id: 'land', name: 'Landet', text: 'Landet.', contacts: [] },
        { id: 'air', name: 'Luften', text: 'Oppe.', contacts: [] },
      ],
      phases: [{ to: 'air', seconds: 1, repeat: 3, label: '3 hop' }],
    };
    const figure: FigureItem = {
      id: 'power_legs.6',
      view: 'side',
      facing: 1,
      props: [],
      highlight: ['near.thigh'],
      keyframes: { land: standing(), air: { ...standing(), hip: [0, 56] } },
      transitions: [
        { from: 'land', to: 'air', advance: 10 },
        { from: 'air', to: 'land', advance: 10 },
      ],
      second: {
        view: 'front',
        props: [],
        keyframes: {
          land: { hip: [0, 49], torso: 90, arms: { near: null, far: null }, legs: frontLegs(49) },
          air: { hip: [0, 56], torso: 90, arms: { near: null, far: null }, legs: frontLegs(56) },
        },
      },
    };
    // Built alone, the view that travels ends with its half second where it landed (the cut), and
    // the other does not: they would drift half a second apart each loop.
    const [a, b] = figureViews(figure).map((v) => buildModel(v, movement));
    expect(a?.timeline.total).toBeCloseTo(3.5, 9);
    expect(b?.timeline.total).toBeCloseTo(3, 9);
    // Together both have the same loop: the one that stays holds its first position as long.
    const [one, two] = viewModels(figure, movement);
    expect(one?.timeline.total).toBeCloseTo(3.5, 9);
    expect(two?.timeline.total).toBeCloseTo(3.5, 9);
    expect(two?.timeline.moves.at(-1)).toMatchObject({ from: 'land', to: 'land', phase: null });
    expect(two?.timeline.moves.at(-1)?.shift).toBeUndefined();
    // A figure without travel is built as before.
    const [still] = viewModels(PUSH_UP_FIGURE, PUSH_UP);
    expect(still?.timeline.total).toBe(5);
  });

  test('L2: et stillbillede har ingen pil i en fase, hvor figuren rejser langs gulvet', () => {
    const movement: OwnMovement = {
      positions: [
        { id: 'stand', name: 'Klar', text: 'Klar.', contacts: [] },
        { id: 'dip', name: 'Nede', text: 'Nede.', contacts: [] },
        { id: 'air', name: 'Luften', text: 'Oppe.', contacts: [] },
      ],
      phases: [
        { to: 'dip', seconds: 0.5, label: 'Ned' },
        { to: 'air', seconds: 0.5, label: 'Spring' },
        { to: 'stand', seconds: 0.5, label: 'Land' },
      ],
    };
    const figure: FigureItem = {
      id: 'power_legs.2',
      view: 'side',
      facing: 1,
      props: [],
      highlight: ['near.thigh'],
      keyframes: {
        stand: standing(),
        dip: { ...standing(), hip: [-4, 40] },
        air: { ...standing(), hip: [0, 56] },
      },
      transitions: [
        { from: 'dip', to: 'air', advance: 20 },
        { from: 'air', to: 'stand', advance: 20 },
      ],
      marks: [
        { arrow: 'hip', phase: 1 },
        { arrow: 'hip', phase: 2 },
      ],
    };
    const model = buildModel(figure, movement);
    const first = (m: { prims: Prim[] }) => own(m.prims)[0]?.key;
    // »Ned« stays where it is: its arrow is on the still image it starts from.
    expect(stillMarks(model, 'stand').map(first)).toEqual(['mark0.shaft']);
    // »Spring« travels 20 forward: without the travel the arrow would point back, so it is left out.
    expect(stillMarks(model, 'dip')).toEqual([]);
    // The animation still has it, pointing forward.
    expect(markPlans(model)[1]?.shows[0]?.chord?.[0]).toBeGreaterThan(10);
  });

  test('H1: teksten holder sig fra hovedet og fra overkroppens sider forfra som fra et lem', () => {
    // The body a mark's text keeps off: the head as a disk of points, not one point among many
    // along the limbs, and from the front the torso's long sides.
    const figure: FigureItem = {
      ...PUSH_UP_FIGURE,
      marks: [{ cue: 'Blikket ned', at: 'bottom', point: 'head' }],
    };
    const model = buildModel(figure, PUSH_UP);
    const body = markPlans(model)[0]?.shows[0]?.body ?? [];
    const head = solve(model.frame, PUSH_UP_FIGURE.keyframes.bottom as Pose).head;
    const near = (p: readonly number[], q: readonly number[], r: number) =>
      Math.hypot((p[0] ?? 0) - (q[0] ?? 0), (p[1] ?? 0) - (q[1] ?? 0)) <= r;
    expect(body.filter((p) => near(p, head, 6.4)).length).toBeGreaterThanOrEqual(9);
    const front: FigureItem = {
      id: 'power_legs.1',
      view: 'front',
      props: [],
      highlight: ['torso'],
      keyframes: {
        land: { hip: [0, 49], torso: 90, arms: { near: null, far: null }, legs: frontLegs(49) },
      },
      marks: [{ cue: 'Knæ ud', at: 'land', point: 'near.knee' }],
    };
    const still: OwnMovement = {
      positions: [{ id: 'land', name: 'Landing', text: 'Landing.', contacts: [] }],
      phases: [{ to: 'land', seconds: 2, label: 'Hold' }],
    };
    const s = solve({ view: 'front', facing: null }, front.keyframes.land as Pose);
    const corner = s.shoulders?.[1] ?? [0, 0];
    const drawn = markPlans(buildModel(front, still))[0]?.shows[0]?.body ?? [];
    expect(drawn.some((p) => near(p, corner, 0.01))).toBe(true);
  });

  test('en forkert stilling med »spine« tegnes med krum ryg, også når ingen position har »spine«', () => {
    const pair = faultPair(PUSH_UP_FIGURE, PUSH_UP, {
      mistake: 1,
      at: 'top',
      wrong: { spine: 4 },
    });
    if (!pair) throw new Error('intet par');
    expect(curvedBack(PUSH_UP_FIGURE)).toBe(false);
    const model = buildModel(pair.figure, PUSH_UP);
    const torso = (pose: Pose) => movingPrims(model, pose).find((p) => p.key === 'torso')?.t;
    expect(torso(pair.wrong)).toBe('curve');
    // The right pose beside it keeps its straight back.
    expect(torso(pair.right)).toBe('line');
    // A via with »spine« bends the back in the animation, so every frame draws it as a curve.
    const via: FigureItem = {
      ...PUSH_UP_FIGURE,
      transitions: [
        { from: 'top', to: 'bottom', via: { ...(PUSH_UP_FIGURE.keyframes.top as Pose), spine: 3 } },
      ],
    };
    expect(curvedBack(via)).toBe(true);
  });
});
