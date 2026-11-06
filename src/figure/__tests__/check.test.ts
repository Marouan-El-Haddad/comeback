// The figure checks (docs/SPEC.md 9.1, DECISIONS.md D48) on the reference figures in content/figures
// and on broken copies of them: the contacts in the explanation fit the floor, the wall and the chair;
// nothing touches that the position does not name; nothing goes into a surface; planted hands and
// feet do not slide (on a wall they may); a hand reaches its point.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type {
  ExplainFile,
  FigureFile,
  FigureItem,
  IkLimb,
  OwnMovement,
  Pose,
} from '../../content/types.ts';
import { checkFigure, checkFigureFile, evaluatePose, movementFor } from '../check.ts';

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
    expect(messages(figure, movement).join('\n')).toContain(
      'press.1 › top: hånden (begge) skal røre gulvet, men er 6 fra (0 af 2 gør)',
    );
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
      'pull.1 › top: hånden skal røre stolen',
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
