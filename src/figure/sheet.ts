// The contact sheet of a figure file (docs/SPEC.md 9.1, DECISIONS.md D36, D48 and D56): every
// position of every figure as a still image at the same scale, with the chest's direction (`facing`)
// as a blue arrow, rings on the contacts the explanation names (blue = the figure keeps it, red = it
// does not) and the angles of the knees and elbows; the middle of every move as a frame of its own,
// so a joint that kinks on the way can be seen; the movement as an onion skin, the phases with their
// times, the transitions, and the problems the checks found. Pure: scripts/figure-sheet.ts turns the
// page into a PNG in a browser. Never part of the app.
import {
  isFigureLike,
  isLike,
  type Contact,
  type Fault,
  type ExplainFile,
  type FigureFile,
  type FigureItem,
  type OwnMovement,
  type Point,
} from '../content/types.ts';
import type { Problem } from '../content/validate.ts';
import type { Program } from '../engine/types.ts';
import { evaluatePose, jointDegrees, movementFor, placeName } from './check.ts';
import { bodyPrims, emptyBox, svgBody, track, viewBox, type Box, type Prim } from './draw.ts';
import { faultPair } from './faults.ts';
import { markPlans, placeLabel, stillMarks, type MarkDraw, type MarkPlan } from './marks.ts';
import { chestDirection, polar, solve, type Frame, type Skeleton } from './geometry.ts';
import {
  buildModel,
  movePoseLocal,
  movingPrims,
  phaseSeconds,
  sampledPoses,
  stillPrims,
  type FigureModel,
  type Move,
} from './motion.ts';
import { figureViews, stackViews, VIEW_GAP, VIEW_NAME, viewAspect, viewModels } from './views.ts';

export interface SheetInput {
  file: FigureFile;
  explain: ExplainFile;
  program: Program;
  /** Where the file is, as printed on the sheet. */
  source: string;
  /** The problems of the file (format and quality), shown with their figure. */
  problems: readonly Problem[];
}

export interface SheetStyle {
  /** design-tokens.json: the colours become the app's CSS variables. */
  tokens: { color: Record<string, string>; pictogram: Record<string, string> };
  /** Fonts as data URLs (Bai Jamjuree 400 and 600, Kanit 600); the system font without them. */
  fonts?: { body: string; bodyBold: string; display: string };
}

/** Pixels per figure unit: every figure on every sheet at the same scale. */
export const SCALE = 3;

const PART: Record<Contact['part'], string> = {
  hand: 'hånd',
  forearm: 'underarm',
  elbow: 'albue',
  knee: 'knæ',
  shin: 'skinneben',
  foot: 'fod',
  toes: 'tæer',
  heel: 'hæl',
  hip: 'hofte',
  back: 'ryg',
  belly: 'mave',
  side: 'side',
  shoulders: 'skuldre',
  chest: 'bryst',
  head: 'hoved',
};

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

/** The programme's name of a step, routine item or measurement. */
export function itemName(program: Program, id: string): string {
  for (const t of program.tracks) {
    const step = t.steps.find((s) => s.id === id);
    if (step) return `${t.short} · trin ${step.key} · ${step.name}`;
  }
  for (const r of program.routines) {
    const item = r.items.find((i) => `${r.id}.${i.key}` === id);
    if (item) return `${r.name} · ${item.name}`;
  }
  const m = program.measures.find((x) => `measures.${x.id}` === id);
  return m ? `Måling · ${m.name}` : id;
}

function contactText(c: Contact): string {
  const count = c.count === 1 ? ' (én)' : '';
  return `${PART[c.part]}${count} → ${c.on}`;
}

function size(box: Box, pad = 3): { width: number; height: number } {
  return {
    width: Math.round((box.x1 - box.x0 + 2 * pad) * SCALE),
    height: Math.round((box.y1 - box.y0 + 2 * pad) * SCALE),
  };
}

/** A cell's drawing in its box: the positions and the middles of the moves without the travel. */
function svg(box: Box, inner: string): string {
  const { width, height } = size(box);
  return `<svg viewBox="${viewBox(box)}" width="${width}" height="${height}">${inner}</svg>`;
}

/** The chest's direction as a small blue arrow beside the torso. */
function facingArrow(frame: Frame, model: FigureModel, positionId: string): string {
  const pose = model.figure.keyframes[positionId];
  if (!pose) return '';
  const direction = chestDirection(frame, pose);
  if (direction === null) return '';
  const s = solve(frame, pose);
  const mid: [number, number] = [(s.hip[0] + s.shoulder[0]) / 2, (s.hip[1] + s.shoulder[1]) / 2];
  const a = polar(mid, 7, direction);
  const b = polar(mid, 17, direction);
  const left = polar(b, 4, direction + 150);
  const right = polar(b, 4, direction - 150);
  const p = (q: [number, number]) => `${q[0].toFixed(2)},${(-q[1]).toFixed(2)}`;
  return `<line x1="${a[0].toFixed(2)}" y1="${(-a[1]).toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${(-b[1]).toFixed(2)}" stroke="var(--c-blue)" stroke-width="1.6" stroke-linecap="round"/><polygon points="${p(left)} ${p(b)} ${p(right)}" fill="var(--c-blue)"/>`;
}

/** Rings on the points of each contact: blue when the figure keeps it, red when it does not. */
function contactRings(
  figure: FigureItem,
  positionId: string,
  contacts: readonly Contact[],
): string {
  const pose = figure.keyframes[positionId];
  if (!pose) return '';
  return evaluatePose(figure, pose, contacts)
    .contacts.flatMap((r) =>
      r.points.map(
        (q) =>
          `<circle cx="${q[0].toFixed(2)}" cy="${(-q[1]).toFixed(2)}" r="4.2" fill="none" stroke="var(${r.ok ? '--c-blue' : '--c-red'})" stroke-width="1.3"/>`,
      ),
    )
    .join('');
}

function phasesLine(movement: OwnMovement, model?: FigureModel): string {
  const names = new Map(movement.positions.map((p) => [p.id, p.name]));
  let at = movement.positions[0]?.id ?? '';
  let total = 0;
  const parts = movement.phases.map((phase) => {
    const seconds = phaseSeconds(phase);
    total += seconds;
    const times =
      phase.repeat === undefined
        ? ''
        : ` × ${phase.repeat === 'dose' ? 'dosis (3 i kortet)' : phase.repeat}`;
    const dose = phase.seconds === 'dose' ? 'dosis = ' : '';
    const target =
      phase.repeat !== undefined
        ? ` ⇄ ${names.get(phase.to) ?? phase.to}`
        : phase.to === at
          ? ' (stille)'
          : ` → ${names.get(phase.to) ?? phase.to}`;
    if (phase.repeat === undefined) at = phase.to;
    return `<b>${escape(phase.label)}</b> (${dose}${num(seconds)} sek${times})${escape(target)}`;
  });
  const cut = model?.timeline.moves.at(-1)?.cut
    ? ` · står, hvor den kom til, og begynder forfra ved start (klip, ${num(model.timeline.moves.at(-1)?.seconds ?? 0)} sek)`
    : '';
  const back = at !== (movement.positions[0]?.id ?? '') ? ' · tilbage til start (1 sek)' : cut;
  return `${parts.join(' · ')}${back} — i alt ${num(total)} sek i kortet`;
}

/** The angles of the knees and elbows: »knæ 180°/178° · albuer 163°/160°« (near/far; 180° = straight). */
function anglesText(s: Skeleton): string {
  const part = (kind: 'leg' | 'arm', name: string) => {
    const bones = ['near', 'far'].flatMap((side) =>
      s.bones.filter((b) => b.kind === kind && b.side === side),
    );
    return bones.length === 0
      ? ''
      : `${name} ${bones.map((b) => `${Math.round(jointDegrees(b))}°`).join('/')}`;
  };
  return [part('leg', 'knæ'), part('arm', 'albuer')].filter(Boolean).join(' · ');
}

/**
 * The moves between two different positions, one of each: repeats share one, and the way back
 * shares the way there when it lifts nothing else and moves as far (its middle is the same frame).
 */
function distinctMoves(model: FigureModel): Move[] {
  const seen = new Set<string>();
  return model.timeline.moves.filter((m) => {
    if (m.from === m.to || !model.steps.has(m)) return false;
    const pair = [m.from, m.to].sort().join('>');
    const key = `${pair}>${m.shift ? Math.abs(m.shift[1] - m.shift[0]) : 0}>${(m.lift ?? []).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function transitionText(entry: FigureItem, names: Map<string, string>): string {
  const all = entry.transitions ?? [];
  if (all.length === 0) return '';
  const parts = all.map((t) => {
    const what = [
      t.lift ? `løfter ${t.lift.join(', ')}` : '',
      t.advance ? `flytter ${num(t.advance)} langs x` : '',
      t.via ? 'gennem en via-pose (blå ramme)' : '',
    ]
      .filter(Boolean)
      .join(' og ');
    return `${names.get(t.from) ?? t.from} → ${names.get(t.to) ?? t.to}: ${what}`;
  });
  return `<p class="meta">Overgange: ${escape(parts.join(' · '))}</p>`;
}

/**
 * The card's figure as the app draws it (figure.css): one view 382 × 152 px, a standing one 183 ×
 * 216 px beside its phases, and two views 192 px high side by side or over each other (D60).
 */
const CARD = { width: 382, height: 152, tall: [183, 216], two: 192 } as const;

/** A view's box as the card draws it: without the travel along the floor when the frame follows. */
function cardBox(model: FigureModel): Box {
  return model.travel && !model.fixed ? model.stillBox : model.box;
}

/** The size of a view's drawing on the card, in px. */
function cardDrawing(models: readonly FigureModel[], i: number): { width: number; height: number } {
  const model = models[i] as FigureModel;
  if (models.length > 1) {
    const aspects = models.map((m) => viewAspect(m));
    return stackViews(aspects, CARD.width, CARD.two)
      ? { width: CARD.width, height: Math.floor((CARD.two - VIEW_GAP) / 2) }
      : { width: (CARD.width - VIEW_GAP) / 2, height: CARD.two };
  }
  const still = model.stillBox;
  const tall = still.y1 - still.y0 > (still.x1 - still.x0) * 0.9;
  return tall
    ? { width: CARD.tall[0], height: CARD.tall[1] }
    : { width: CARD.width, height: CARD.height };
}

/** Px per figure unit of a view on the card: the marks' text has its card size next to it. */
function cardScale(model: FigureModel, card: { width: number; height: number }): number {
  const box = cardBox(model);
  return Math.min(card.width / (box.x1 - box.x0 + 6), card.height / (box.y1 - box.y0 + 6));
}

/**
 * A cell's drawing with the marks of its position on it: the shapes in the SVG and the text where the
 * app puts it (placeLabel), in the size and at most the width it has on the card (18 px there,
 * wrapped there on at most two lines), so a figure agent sees what it covers. The text's size is
 * estimated from its letters; a text of more than two lines stands on its own line over or under the
 * body, as in the app (D60).
 */
function drawing(
  box: Box,
  inner: string,
  marks: readonly MarkDraw[],
  font: number,
  widest: number,
): string {
  const vx = box.x0 - 3;
  const top = box.y1 + 3;
  const { width, height } = size(box);
  const px = (p: Point): Point => [(p[0] - vx) * SCALE, (top - p[1]) * SCALE];
  const labels = marks.flatMap((m) => {
    if (!m.label) return [];
    const once = m.label.text.length * 0.56 * font + 0.9 * font;
    const lines = Math.max(1, Math.ceil(once / widest));
    const w = Math.min(once, widest);
    const h = lines * 1.3 * font + 2;
    const [x, y] = placeLabel({
      width,
      height,
      w,
      h,
      at: m.label.at ? px(m.label.at) : null,
      place: m.label.place,
      ray: m.label.ray
        ? {
            from: px(m.label.ray.from),
            dir: [
              Math.cos((m.label.ray.angle * Math.PI) / 180),
              -Math.sin((m.label.ray.angle * Math.PI) / 180),
            ],
          }
        : null,
      body: m.body.map(([bx, by, r]) => [...px([bx, by]), r * SCALE] as const),
      line: lines > 2,
    });
    return [
      // As wide as on the card (at most the drawing there), even where the cell is narrower.
      `<span class="mark" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;font-size:${font.toFixed(1)}px;width:max-content;max-width:${widest.toFixed(1)}px">${escape(m.label.text)}</span>`,
    ];
  });
  const shapes = svgBody(marks.flatMap((m) => m.prims));
  return `<div class="draw">${svg(box, inner + shapes)}${labels.join('')}</div>`;
}

/**
 * The cells of one view: its positions with their marks, its via poses, the middle of each move and
 * its onion skin; `places` are the problems' places they show.
 */
function viewCells(
  entry: FigureItem,
  model: FigureModel,
  movement: OwnMovement,
  where: string,
  mine: readonly Problem[],
  font: number,
  widest: number,
): { cells: string[]; places: string[] } {
  const frame = model.frame;
  const names = new Map(movement.positions.map((p) => [p.id, p.name]));
  const places: string[] = [];
  const cells = movement.positions.map((position) => {
    places.push(`${where} › ${position.id}`);
    const own = mine.filter(
      (p) =>
        p.where === `${where} › ${position.id}` ||
        p.where.startsWith(`${where} › ${position.id} ›`),
    );
    const inner =
      svgBody(stillPrims(model, position.id)) +
      facingArrow(frame, model, position.id) +
      contactRings(entry, position.id, position.contacts);
    const contacts =
      position.contacts.length > 0 ? position.contacts.map(contactText).join(', ') : 'i luften';
    const solved = model.solved[position.id];
    const angles = solved ? anglesText(solved) : '';
    const marks = stillMarks(model, position.id);
    return `<div class="cell">${drawing(model.stillBox, inner, marks, font, widest)}<p class="name">${escape(position.name)} <span>(${position.id})</span></p><p class="contacts">${escape(contacts)}</p>${angles ? `<p class="angles">${escape(angles)}</p>` : ''}${own.map((p) => `<p class="problem">${escape(p.message)}</p>`).join('')}</div>`;
  });
  // A transition's via: the pose the figure goes through on the way, checked like a keyframe. In
  // the middle of a half the other end names which via it is.
  const nameOf = (id: string) => (id.includes('>') ? 'via-posen' : (names.get(id) ?? id));
  for (const t of entry.transitions ?? []) {
    if (!t.via) continue;
    const place = `${where} › ${placeName(`${t.from}>${t.to}`)}`;
    places.push(place);
    const own = mine.filter((p) => p.where === place);
    const solved = solve(frame, t.via);
    const inner = svgBody([...model.still, ...movingPrims(model, t.via)]);
    cells.push(
      `<div class="cell via">${svg(model.stillBox, inner)}<p class="name">${escape(`Via: ${names.get(t.from) ?? t.from} → ${names.get(t.to) ?? t.to}`)}</p><p class="contacts">overgang, ingen position</p><p class="angles">${escape(anglesText(solved))}</p>${own.map((p) => `<p class="problem">${escape(p.message)}</p>`).join('')}</div>`,
    );
  }
  // The middle of every move (H1): the frame where a kinking knee or a joint through the floor shows.
  for (const move of distinctMoves(model)) {
    const pose = movePoseLocal(model, move, 0.5);
    const s = solve(frame, pose);
    const moving: Prim[] = movingPrims(model, pose);
    const place = `${where} › ${placeName(move.from)} → ${placeName(move.to)}`;
    places.push(place);
    const own = mine.filter((p) => p.where === place);
    const label = `Midt i: ${nameOf(move.from)} → ${nameOf(move.to)}`;
    cells.push(
      `<div class="cell mid">${svg(model.stillBox, svgBody([...model.still, ...moving]))}<p class="name">${escape(label)}</p><p class="angles">${escape(anglesText(s))}</p>${own.map((p) => `<p class="problem">${escape(p.message)}</p>`).join('')}</div>`,
    );
  }
  // The onion skin: a pale frame every quarter of a second, the first position on top.
  const ghosts = sampledPoses(model, 0.25)
    .map((pose) => svgBody(bodyPrims(entry, solve(frame, pose), 'ghost', 'g')))
    .join('');
  const first = movement.positions[0]?.id ?? '';
  cells.push(
    `<div class="cell">${svg(model.box, svgBody(model.still) + ghosts + svgBody(stillPrims(model, first).filter((p) => !model.still.includes(p))))}<p class="name">Bevægelsen</p><p class="contacts">hver 0,25 sek; mørk = ${escape(movement.positions[0]?.name ?? '')}</p></div>`,
  );
  return { cells, places };
}

const POINT_NAMES: Record<string, string> = {
  hip: 'hoften',
  shoulder: 'skulderen',
  chest: 'brystet',
  head: 'hovedet',
  hand: 'hånden',
  elbow: 'albuen',
  knee: 'knæet',
  foot: 'foden',
  toes: 'tæerne',
};

/** A mark in words with when it is shown: »1 pil ved brystet i fase 1 »3 sek ned« (0–3 sek)«. */
function markLine(model: FigureModel, plan: MarkPlan): string {
  const mark = plan.mark;
  const position = model.movement.positions.find((p) => p.id === mark.at);
  const phase = mark.phase === undefined ? undefined : model.movement.phases[mark.phase - 1];
  const when = position
    ? `ved ${position.name}`
    : phase
      ? `i fase ${mark.phase ?? ''} »${phase.label}«`
      : '';
  const named = (p: string) => POINT_NAMES[p.split('.').pop() ?? p] ?? p;
  let what: string;
  if ('arrow' in mark) what = `pil ved ${named(mark.arrow)}`;
  else if ('angle' in mark) {
    const measured = plan.shows[0]?.measured;
    const drawn = measured === undefined ? '' : ` (tegnet ${Math.round(measured)}°)`;
    const said = mark.degrees === undefined ? '' : ` ${mark.degrees}°`;
    what = `vinkel ved ${named(mark.angle)}${said}${drawn}`;
  } else if ('line' in mark) what = `linje${mark.cue ? ` »${mark.cue}«` : ''}`;
  else what = `cue »${mark.cue}«`;
  const times = plan.shows.map((s) => `${num(s.start)}–${num(s.end)} sek`).join(', ');
  return `${plan.index + 1} ${what} ${when} (${times || 'ses ikke'})`;
}

/** A typical mistake as right and wrong, at the same scale, with how far apart they are (D58). */
function faultCells(
  input: SheetInput,
  entry: FigureItem,
  movement: OwnMovement,
  fault: Fault,
  own: readonly Problem[],
): string {
  const names = new Map(movement.positions.map((p) => [p.id, p.name]));
  const explained = input.explain.items.find((e) => e.id === entry.id);
  const text =
    explained && !isLike(explained) ? (explained.mistakes[fault.mistake - 1]?.mistake ?? '') : '';
  const pair = faultPair(entry, movement, fault);
  if (!pair) return `<p class="problem">Fejl ${fault.mistake}: kan ikke tegnes</p>`;
  const model = buildModel(pair.figure, movement);
  const right = [...model.still, ...movingPrims(model, pair.right)];
  const ring: Prim = {
    key: 'ring',
    z: 40,
    t: 'circle',
    c: pair.differs.at,
    r: 7,
    f: 'none',
    s: 'hi',
    w: 1.4,
    dash: '2.6 1.8',
  };
  const wrong = [...model.still, ...movingPrims(model, pair.wrong), ring];
  const box = track(track(emptyBox(), right), wrong);
  const view =
    pair.figure.view === entry.view
      ? ''
      : ` (${VIEW_NAME[pair.figure.view].toLocaleLowerCase('da-DK')})`;
  return `<p class="meta">Fejl ${fault.mistake} ved ${escape(names.get(fault.at) ?? fault.at)}: ${escape(text)}${escape(view)}</p><div class="cells"><div class="cell">${svg(box, svgBody(right))}<p class="name">Rigtigt</p></div><div class="cell">${svg(box, svgBody(wrong))}<p class="name">Forkert</p><p class="angles">afviger ${num(pair.differs.by)}</p>${own.map((p) => `<p class="problem">${escape(p.message)}</p>`).join('')}</div></div>`;
}

function figureSection(input: SheetInput, entry: FigureItem): string {
  const movement = movementFor(input.explain, entry.id, entry.movement);
  if (!movement) return '';
  const views = figureViews(entry);
  const models = viewModels(entry, movement);
  const where = entry.movement ? `${entry.id} › ${entry.movement}` : entry.id;
  const mine = input.problems.filter((p) => p.where === where || p.where.startsWith(`${where} ›`));
  const names = new Map(movement.positions.map((p) => [p.id, p.name]));
  const props = (v: FigureItem) =>
    v.props.length > 0 ? v.props.map((p) => p.type).join(', ') : 'ingen';
  const facing = (frame: FigureModel['frame']) =>
    frame.view === 'side'
      ? ` · facing ${frame.facing} (brystet mod ${frame.facing === 1 ? 'højre' : 'venstre'}, når figuren står op)`
      : '';
  const prefixOf = (view: FigureItem, i: number) =>
    i === 0 ? where : `${where} › ${VIEW_NAME[view.view].toLocaleLowerCase('da-DK')}`;
  const second = views[1] ? prefixOf(views[1], 1) : null;
  const places: string[] = [];
  const parts = views.map((view, i) => {
    const model = models[i] as FigureModel;
    const prefix = prefixOf(view, i);
    // The first view's problems are those that are not the second view's.
    const own =
      i === 0 && second
        ? mine.filter((p) => p.where !== second && !p.where.startsWith(`${second} ›`))
        : mine;
    const card = cardDrawing(models, i);
    const scale = SCALE / cardScale(model, card);
    const result = viewCells(view, model, movement, prefix, own, 18 * scale, card.width * scale);
    places.push(...result.places);
    const head =
      i === 0
        ? ''
        : `<h3>${escape(VIEW_NAME[view.view])}</h3><p class="meta">${view.view}${escape(facing(model.frame))} · rødt: ${escape(view.highlight.join(', '))} · rekvisitter: ${escape(props(view))}</p>${transitionText(view, names)}`;
    return `${head}<div class="cells">${result.cells.join('')}</div>`;
  });
  // The marks of both views with when they are shown (D58).
  const marks = views.flatMap((view, i) =>
    markPlans(models[i] as FigureModel).map(
      (plan) =>
        `${i === 0 ? '' : `${VIEW_NAME[view.view].toLocaleLowerCase('da-DK')} `}${markLine(models[i] as FigureModel, plan)}`,
    ),
  );
  const marksText =
    marks.length > 0 ? `<p class="meta">Markeringer: ${escape(marks.join(' · '))}</p>` : '';
  const faults = (entry.faults ?? []).map((fault) => {
    const place = `${where} › fejl ${fault.mistake}`;
    places.push(place);
    return faultCells(
      input,
      entry,
      movement,
      fault,
      mine.filter((p) => p.where === place),
    );
  });
  const general = mine.filter(
    (p) => !places.some((s) => p.where === s || p.where.startsWith(`${s} ›`)),
  );
  const main = models[0] as FigureModel;
  return `<section><h2>${escape(where)} · ${escape(itemName(input.program, entry.id))}${entry.movement ? ` · ${escape(movement.name ?? '')}` : ''}</h2><p class="meta">${main.frame.view}${escape(facing(main.frame))} · rødt: ${escape(entry.highlight.join(', '))} · rekvisitter: ${escape(props(entry))}</p>${transitionText(entry, names)}${marksText}${parts.join('')}<p class="phases">${phasesLine(movement, main)}</p>${faults.join('')}${general.map((p) => `<p class="problem">${escape(p.where)}: ${escape(p.message)}</p>`).join('')}</section>`;
}

/** The whole sheet as an HTML page. */
export function sheetHtml(input: SheetInput, style: SheetStyle): string {
  const vars = [
    ...Object.entries(style.tokens.color).map(([k, v]) => `--c-${k}:${v}`),
    ...Object.entries(style.tokens.pictogram)
      .filter(([, v]) => v.startsWith('#'))
      .map(([k, v]) => `--c-picto-${k}:${v}`),
  ].join(';');
  const fonts = style.fonts
    ? `@font-face{font-family:'Bai Jamjuree';font-weight:400;src:url(${style.fonts.body})}@font-face{font-family:'Bai Jamjuree';font-weight:600;src:url(${style.fonts.bodyBold})}@font-face{font-family:'Kanit';font-weight:600;src:url(${style.fonts.display})}`
    : '';
  const figures = input.file.figures;
  const drawn = figures.filter((f) => !isFigureLike(f));
  const sections = figures.map((entry) =>
    isFigureLike(entry)
      ? `<section class="like"><h2>${escape(entry.id)}${entry.movement ? ` › ${escape(entry.movement)}` : ''} · ${escape(itemName(input.program, entry.id))}</h2><p class="meta">tegnes som ${escape(entry.like)}</p></section>`
      : figureSection(input, entry),
  );
  const count = input.problems.length;
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><title>Kontaktark ${escape(input.file.subject)}</title><style>${fonts}:root{${vars}}
body{margin:0;padding:24px;background:var(--c-paper);color:var(--c-ink);font:16px/1.35 'Bai Jamjuree',system-ui,sans-serif;width:1152px}
h1{font:600 28px/1.2 'Kanit',system-ui,sans-serif;color:var(--c-navy);margin:0 0 4px}
h2{font:600 20px/1.2 'Kanit',system-ui,sans-serif;color:var(--c-navy);margin:0 0 2px}
section{border-top:2px solid var(--c-navy);padding:12px 0 16px}
.meta,.legend{margin:0 0 8px;color:var(--c-ink)}
.cells{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
.cell{display:grid;gap:2px;justify-items:center;width:min-content;min-width:120px}
.cell svg{border:1px solid var(--c-line);border-radius:8px;max-width:none}
.cell.mid svg{border-style:dashed}
.cell.via svg{border-color:var(--c-blue)}
.angles{margin:0;font-size:14px;text-align:center;white-space:nowrap}
.name{margin:4px 0 0;font-weight:600;color:var(--c-navy)}.name span{font-weight:400}
.contacts{margin:0;font-size:14px;text-align:center}
.phases{margin:8px 0 0}
h3{font:600 18px/1.2 'Kanit',system-ui,sans-serif;color:var(--c-navy);margin:12px 0 2px}
.draw{position:relative;line-height:0}
.mark{position:absolute;padding:0 0.45em;border:1px solid var(--c-line);border-left:0.22em solid var(--c-red);border-radius:4px;background:var(--c-paper);color:var(--c-navy);font-weight:600;line-height:1.3;white-space:normal;box-sizing:border-box}
.problem{margin:4px 0 0;color:var(--c-redDark);font-weight:600}
.ok{color:var(--c-green);font-weight:600}
</style></head><body><h1>Kontaktark · ${escape(input.file.subject)}</h1><p class="meta">${escape(input.source)} · ${drawn.length} ${drawn.length === 1 ? 'figur' : 'figurer'}${figures.length > drawn.length ? ` og ${figures.length - drawn.length} »like«` : ''} · ${count === 0 ? '<span class="ok">ingen problemer</span>' : `<span class="problem">${count} ${count === 1 ? 'problem' : 'problemer'}</span>`}</p><p class="legend">Blå pil: brystets retning. Ringe: kontakterne i forklaringen (blå = passer, rød = passer ikke). Under hver position: knæ- og albuevinklerne (180° = strakt, nær/fjern). Stiplet ramme: billedet midt i en bevægelse. Blå ramme: en overgangs via-pose. Rødt: markeringerne på positionen og pilen for den fase, der starter dér, med teksten i den størrelse, den har på kortet; under »Markeringer« står, hvornår hver vises. »Rigtigt« og »Forkert«: en typisk fejl og hvor meget den afviger (ring). Samme skala på alle figurer.</p>${sections.join('')}</body></html>`;
}
