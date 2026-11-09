// The contact sheet of a figure file (docs/SPEC.md 9.1, DECISIONS.md D36, D48 and D56): every
// position of every figure as a still image at the same scale, with the chest's direction (`facing`)
// as a blue arrow, rings on the contacts the explanation names (blue = the figure keeps it, red = it
// does not) and the angles of the knees and elbows; the middle of every move as a frame of its own,
// so a joint that kinks on the way can be seen; the movement as an onion skin, the phases with their
// times, the transitions, and the problems the checks found. Pure: scripts/figure-sheet.ts turns the
// page into a PNG in a browser. Never part of the app.
import {
  isFigureLike,
  type Contact,
  type ExplainFile,
  type FigureFile,
  type FigureItem,
  type OwnMovement,
} from '../content/types.ts';
import type { Problem } from '../content/validate.ts';
import type { Program } from '../engine/types.ts';
import { evaluatePose, jointDegrees, movementFor, placeName } from './check.ts';
import { bodyPrims, svgBody, viewBox, type Box, type Prim } from './draw.ts';
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

/** A cell's drawing: the positions and the middles of the moves in the still box, without the travel. */
function svg(model: FigureModel, inner: string, box: Box = model.stillBox): string {
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

function phasesLine(movement: OwnMovement): string {
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
  const back = at !== (movement.positions[0]?.id ?? '') ? ' · tilbage til start (1 sek)' : '';
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

function figureSection(input: SheetInput, entry: FigureItem): string {
  const movement = movementFor(input.explain, entry.id, entry.movement);
  if (!movement) return '';
  const model = buildModel(entry, movement);
  const frame = model.frame;
  const where = entry.movement ? `${entry.id} › ${entry.movement}` : entry.id;
  const mine = input.problems.filter((p) => p.where === where || p.where.startsWith(`${where} ›`));
  const facing =
    frame.view === 'side'
      ? ` · facing ${frame.facing} (brystet mod ${frame.facing === 1 ? 'højre' : 'venstre'}, når figuren står op)`
      : '';
  const props = entry.props.length > 0 ? entry.props.map((p) => p.type).join(', ') : 'ingen';
  const names = new Map(movement.positions.map((p) => [p.id, p.name]));
  const cells = movement.positions.map((position) => {
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
    return `<div class="cell">${svg(model, inner)}<p class="name">${escape(position.name)} <span>(${position.id})</span></p><p class="contacts">${escape(contacts)}</p>${angles ? `<p class="angles">${escape(angles)}</p>` : ''}${own.map((p) => `<p class="problem">${escape(p.message)}</p>`).join('')}</div>`;
  });
  // A transition's via: the pose the figure goes through on the way, checked like a keyframe. In
  // the middle of a half the other end names which via it is.
  const nameOf = (id: string) => (id.includes('>') ? 'via-posen' : (names.get(id) ?? id));
  for (const t of entry.transitions ?? []) {
    if (!t.via) continue;
    const place = `${where} › ${placeName(`${t.from}>${t.to}`)}`;
    const own = mine.filter((p) => p.where === place);
    const solved = solve(frame, t.via);
    const inner = svgBody([...model.still, ...movingPrims(model, t.via)]);
    cells.push(
      `<div class="cell via">${svg(model, inner)}<p class="name">${escape(`Via: ${names.get(t.from) ?? t.from} → ${names.get(t.to) ?? t.to}`)}</p><p class="contacts">overgang, ingen position</p><p class="angles">${escape(anglesText(solved))}</p>${own.map((p) => `<p class="problem">${escape(p.message)}</p>`).join('')}</div>`,
    );
  }
  // The middle of every move (H1): the frame where a kinking knee or a joint through the floor shows.
  for (const move of distinctMoves(model)) {
    const pose = movePoseLocal(model, move, 0.5);
    const s = solve(frame, pose);
    const moving: Prim[] = movingPrims(model, pose);
    const place = `${where} › ${placeName(move.from)} → ${placeName(move.to)}`;
    const own = mine.filter((p) => p.where === place);
    const label = `Midt i: ${nameOf(move.from)} → ${nameOf(move.to)}`;
    cells.push(
      `<div class="cell mid">${svg(model, svgBody([...model.still, ...moving]))}<p class="name">${escape(label)}</p><p class="angles">${escape(anglesText(s))}</p>${own.map((p) => `<p class="problem">${escape(p.message)}</p>`).join('')}</div>`,
    );
  }
  // The onion skin: a pale frame every quarter of a second, the first position on top.
  const ghosts = sampledPoses(model, 0.25)
    .map((pose) => svgBody(bodyPrims(entry, solve(frame, pose), 'ghost', 'g')))
    .join('');
  const first = movement.positions[0]?.id ?? '';
  cells.push(
    `<div class="cell">${svg(model, svgBody(model.still) + ghosts + svgBody(stillPrims(model, first).filter((p) => !model.still.includes(p))), model.box)}<p class="name">Bevægelsen</p><p class="contacts">hver 0,25 sek; mørk = ${escape(movement.positions[0]?.name ?? '')}</p></div>`,
  );
  const shown = new Set([
    ...movement.positions.map((pos) => `${where} › ${pos.id}`),
    ...distinctMoves(model).map((m) => `${where} › ${placeName(m.from)} → ${placeName(m.to)}`),
    ...(entry.transitions ?? []).flatMap((t) =>
      t.via ? [`${where} › ${placeName(`${t.from}>${t.to}`)}`] : [],
    ),
  ]);
  const general = mine.filter(
    (p) => ![...shown].some((s) => p.where === s || p.where.startsWith(`${s} ›`)),
  );
  return `<section><h2>${escape(where)} · ${escape(itemName(input.program, entry.id))}${entry.movement ? ` · ${escape(movement.name ?? '')}` : ''}</h2><p class="meta">${frame.view}${escape(facing)} · rødt: ${escape(entry.highlight.join(', '))} · rekvisitter: ${escape(props)}</p>${transitionText(entry, names)}<div class="cells">${cells.join('')}</div><p class="phases">${phasesLine(movement)}</p>${general.map((p) => `<p class="problem">${escape(p.where)}: ${escape(p.message)}</p>`).join('')}</section>`;
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
.problem{margin:4px 0 0;color:var(--c-redDark);font-weight:600}
.ok{color:var(--c-green);font-weight:600}
</style></head><body><h1>Kontaktark · ${escape(input.file.subject)}</h1><p class="meta">${escape(input.source)} · ${drawn.length} ${drawn.length === 1 ? 'figur' : 'figurer'}${figures.length > drawn.length ? ` og ${figures.length - drawn.length} »like«` : ''} · ${count === 0 ? '<span class="ok">ingen problemer</span>' : `<span class="problem">${count} ${count === 1 ? 'problem' : 'problemer'}</span>`}</p><p class="legend">Blå pil: brystets retning. Ringe: kontakterne i forklaringen (blå = passer, rød = passer ikke). Under hver position: knæ- og albuevinklerne (180° = strakt, nær/fjern). Stiplet ramme: billedet midt i en bevægelse. Blå ramme: en overgangs via-pose. Samme skala på alle figurer.</p>${sections.join('')}</body></html>`;
}
