// The figure system (docs/SPEC.md 5 and 9.1, DECISIONS.md D48): the port of picto.py's geometry, the
// anatomical bend from `facing`, the timeline in the dose's tempo, the interpolation that keeps
// planted hands and feet still, and the drawing with stable keys for the app.
import { describe, expect, test } from 'vitest';
import type { Contact, FigureItem, OwnMovement, Pose } from '../../content/types.ts';
import { bendProblems, turn } from '../check.ts';
import { bodyPrims, moving, propPrims, svgBody, track, emptyBox } from '../draw.ts';
import { bendOf, frameOf, ik, solve, type Frame } from '../geometry.ts';
import {
  buildModel,
  CARD_TIMING,
  lerpAngle,
  lerpPose,
  moveAt,
  movingPrims,
  phaseAt,
  poseAt,
  timeline,
} from '../motion.ts';

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

  test('halvvejs ned er hoften halvvejs, og vinklerne tager den korte vej', () => {
    const mid = poseAt(model, 1.5);
    expect(mid.hip[1]).toBeCloseTo((20.02 + 7.2) / 2, 5);
    expect(lerpAngle(170, -170, 0.5)).toBeCloseTo(180);
    expect(lerpAngle(10, 350, 0.25)).toBeCloseTo(5);
  });

  test('et led givet som punkter i den ene position og som IK i den anden glider jævnt', () => {
    const a = PUSH_UP_FIGURE.keyframes.top as Pose;
    const b: Pose = { ...a, arms: { ...a.arms, near: { joint: [70, 15], end: [69.2, 0] } } };
    const mid = lerpPose(a, b, 0.5, solve(model.frame, a), solve(model.frame, b));
    expect(mid.arms.near && 'joint' in mid.arms.near).toBe(true);
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
