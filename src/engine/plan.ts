// planFor: what to do on a date (docs/ENGINE.md 5.1), the traffic light (5.2) and the motor.
import { addDays, calendarWeek, daysBetween, mondayOf, weekday } from './dates.ts';
import { layoutFor, type Layout } from './layout.ts';
import {
  getSession,
  getStep,
  getTrack,
  getWeek,
  hasTag,
  kindForWeekday,
  stepIndex,
  workRange,
} from './lookup.ts';
import type {
  BlockRole,
  ISODate,
  Light,
  Measure,
  Per,
  Phase,
  Program,
  SessionKind,
  SessionSummary,
  State,
  StatusKind,
  StatusRange,
  Week,
  WeekInfo,
} from './types.ts';
import { explainEventTomorrow } from './explain.ts';
import { computeWeeks } from './weeks.ts';

export type PlanUnit = 'reps' | 'sec' | 'rounds' | 'emom' | 'routine' | 'measure';

export interface BlockPlan {
  blockId: string;
  /** 'warmup' for the warm-up; the measure id for a standalone measurement. */
  trackId: string;
  role: BlockRole | 'measure';
  group?: string;
  /** '' for the warm-up and standalone measurements. */
  stepId: string;
  /** Working sets (per side for per-side doses), not counting a measurement set. */
  sets: number;
  /** Reps or seconds per set. */
  target: number;
  unit: PlanUnit;
  per?: Per;
  rirPlan: 1 | 2 | 3;
  restSec: number;
  inYellow: boolean;
  /** The block starts with this measurement (or is it, when role is 'measure'). */
  measureId?: string;
  /** Rounds per set (club sequence, W3, W5). */
  rounds?: number;
  emom?: { stepId: string; minutes: number; reps: number };
  load?: number;
  tempDown?: { originalStepId: string; until: ISODate; lighter: boolean };
  optionalPlusOne?: boolean;
}

export type MotorPhaseKind =
  | 'warmup'
  | 'strides'
  | 'base'
  | 'work'
  | 'easy'
  | 'pause'
  | 'round'
  | 'sprint'
  | 'walk'
  | 'cooldown'
  | 'cooper';

export interface MotorPhase {
  kind: MotorPhaseKind;
  label: string;
  /** 0 = runs until the user taps (the strides have no length in the source). */
  seconds: number;
}

export interface MotorSession {
  variant: 'base' | 'base_check' | 'intervals' | 'fight' | 'cooper_or_base';
  title: string;
  minutes: number;
  phases: MotorPhase[];
  measureId?: 'base_check' | 'cooper';
  /** Cooper is optional; base-check is the alternative (light weeks). */
  cooperOptional?: boolean;
}

export interface SessionPlan {
  kind: SessionKind;
  name: string;
  durationMin: [number, number];
  light: Light;
  short: boolean;
  blocks: BlockPlan[];
  motor?: MotorSession;
  /** The planned intervals, when the calm base replaced them (P25) – »Kør intervallerne alligevel«. */
  intervalsOption?: MotorSession;
  calmBase: boolean;
  bossOffered: boolean;
  boss: boolean;
}

export type DayFlag =
  | { type: 'before_start'; startDate: ISODate }
  | { type: 'not_onboarded' }
  | { type: 'event_tomorrow'; label: string }
  | { type: 'status'; status: StatusKind }
  | { type: 'reduced_volume' }
  | { type: 'light_week' }
  | { type: 'physio'; trackId: string }
  | { type: 'neck_warning' }
  | { type: 'motor_dropped' }
  | { type: 'turbo' };

export interface OverlaySuggestion {
  overlayId: string;
  label: string;
  alternativeLabel: string;
  choice: 'default' | 'alternative' | null;
}

export interface DayPlan {
  date: ISODate;
  k: number;
  pw: number;
  round: number;
  phase: Phase;
  week: Week;
  weekInfo: WeekInfo | null;
  beforeStart: boolean;
  status: StatusKind | null;
  /** The day's session; null on rest, club and red days. */
  kind: SessionKind | null;
  short: boolean;
  session: SessionPlan | null;
  /** Red day (illness): only Open & Strong and a walk. */
  red: boolean;
  /** Sunday or the layout's rest day. */
  restDay: boolean;
  club: { day: boolean; closed: boolean; time?: string; clinch?: string };
  flags: DayFlag[];
  overlays: OverlaySuggestion[];
  /** A session completed on this date. */
  done: SessionSummary | null;
  /** A session started on this date and not completed (resume). */
  open: SessionSummary | null;
  /** Sessions planned for yesterday that were not started (the »blev ikke logget« card). */
  missed: Array<{ kind: SessionKind; date: ISODate }>;
}

// ---------------------------------------------------------------------------------------------
// Weeks and the week's schedule
// ---------------------------------------------------------------------------------------------

/** WeekInfo for calendar week k (projected forward when k is after this week). */
export function weekInfoAt(program: Program, state: State, k: number): WeekInfo | null {
  if (k < 0) return null;
  const known = state.weeks[k];
  if (known) return known;
  return computeWeeks(program, state, k)[k] ?? null;
}

/** The status range that applies on a date: of two that overlap, the newest (ENGINE 3.1, 5.1). */
export function statusRangeOn(state: State, date: ISODate): StatusRange | null {
  for (let i = state.statuses.length - 1; i >= 0; i--) {
    const s = state.statuses[i];
    if (s && s.from <= date && date <= s.to) return s;
  }
  return null;
}

export function statusOn(state: State, date: ISODate): StatusKind | null {
  return statusRangeOn(state, date)?.status ?? null;
}

export function currentLayout(program: Program, state: State): Layout {
  return layoutFor(program, state.schedule.clubDays);
}

export interface Assignment {
  kind: SessionKind;
  date: ISODate;
  short: boolean;
  calmBase: boolean;
}

/** The week's A, B and motor after layout, overlays (5.8) and moves (5.9). */
export function scheduleForWeek(program: Program, state: State, monday: ISODate): Assignment[] {
  const layout = currentLayout(program, state);
  const list: Assignment[] = [];
  const add = (kind: SessionKind, day: number | null) => {
    if (day !== null)
      list.push({ kind, date: addDays(monday, day - 1), short: layout.short, calmBase: false });
  };
  add('A', layout.A);
  add('B', layout.B);
  if (!layout.motorDropped) add('motor', layout.motor);

  const k = calendarWeek(state.startDate, monday);
  const info = weekInfoAt(program, state, k);
  const light = info ? getWeek(program, info.pw).light : false;
  for (const overlay of program.overlays) {
    if (overlay.week !== monday || (overlay.onlyIfLight && !light)) continue;
    const choice = state.overlayChoices[overlay.id] ?? 'default';
    for (const move of overlay.moves) {
      const item = list.find((a) => a.kind === move.kind);
      if (!item) continue;
      item.date = choice === 'alternative' ? move.alternative : move.default;
      item.calmBase = choice !== 'alternative' && move.calmBase === true;
      item.short = false;
    }
  }
  const sunday = addDays(monday, 6);
  for (const move of state.moves) {
    if (move.fromDate < monday || move.fromDate > sunday) continue;
    const item = list.find((a) => a.kind === move.kind && a.date === move.fromDate);
    if (!item) continue;
    // »To pas kan aldrig lande på samme dag; det, der flyttes, taber« (5.9, S-MOVE-04), also for a
    // move in the log that was never checked (a merged import): not onto A or B, the motor not onto
    // any session, and never out of the week.
    if (move.toDate < monday || move.toDate > sunday) continue;
    const there = list.filter((a) => a !== item && a.date === move.toDate);
    if (there.some((a) => a.kind !== 'motor') || (move.kind === 'motor' && there.length > 0)) {
      continue;
    }
    item.date = move.toDate;
    item.short = move.short;
  }
  // »Motor-passet ryger først«: A or B on the motor's day drops the motor that week.
  const motor = list.find((a) => a.kind === 'motor');
  if (motor && list.some((a) => a.kind !== 'motor' && a.date === motor.date)) {
    list.splice(list.indexOf(motor), 1);
  }
  return list;
}

// ---------------------------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------------------------

export function measurementWeek(week: Week, round: number): boolean {
  return week.measurements && (week.pw !== 1 || round === 1);
}

/**
 * The measurements due in a session (5.6): in a measurement week those of the session's day not
 * yet logged this week; the week after, those that were not taken (a yellow day, skipped) are
 * offered at the next green session of the same kind – not the burpee test or the motor's
 * distance, which belong to the light week itself (P31, S-MEAS-05).
 */
function dueMeasures(
  program: Program,
  state: State,
  kind: SessionKind,
  date: ISODate,
  k: number,
): Measure[] {
  const monday = mondayOf(date);
  // Only days before the session's own day count: a measurement logged during the session must
  // not change the session's plan while it runs.
  const logged = (id: string, from: ISODate) =>
    state.measurements.some((m) => m.measureId === id && m.date >= from && m.date < date);
  const forKind = (week: Week) =>
    program.measures.filter(
      (m) =>
        kindForWeekday(program, m.weekday) === kind && (m.weeks !== 'light_only' || week.light),
    );
  const info = weekInfoAt(program, state, Math.max(0, k));
  if (info) {
    const week = getWeek(program, info.pw);
    if (measurementWeek(week, info.round))
      return forKind(week).filter((m) => !logged(m.id, monday));
  }
  const previous = k > 0 ? weekInfoAt(program, state, k - 1) : null;
  if (!previous) return [];
  const before = getWeek(program, previous.pw);
  if (!measurementWeek(before, previous.round)) return [];
  const lastMonday = addDays(monday, -7);
  // Only after a session of this kind that was logged without them (not a week declared done
  // at onboarding, where the measurements may be on paper).
  const sessionThen = state.sessions.some(
    (s) => s.kind === kind && s.completed && s.date >= lastMonday && s.date < monday,
  );
  if (!sessionThen) return [];
  return forKind(before).filter(
    (m) =>
      m.placement.type !== 'replace_finisher' &&
      m.placement.type !== 'motor' &&
      !logged(m.id, lastMonday),
  );
}

function setsFor(rule: string, fixed: [number, number] | undefined, week: Week): number {
  let n: number;
  switch (rule) {
    case 'par12':
      n = week.sets.par12;
      break;
    case 'other':
      n = week.sets.other;
      break;
    case 'power':
      n = week.powerSets;
      break;
    default:
      return fixed ? fixed[1] : 1;
  }
  return fixed ? Math.min(fixed[1], n) : n;
}

/** R-FLAT: a third fewer sets, rounded down, at least 2. */
function reduce(sets: number, factor: 1 | 0.67): number {
  return factor === 1 ? sets : Math.max(2, Math.floor(sets * factor));
}

/** The highest EMOM step allowed this week (R-EMOM, R-ROUND2), or null in a test week. */
export function emomCap(program: Program, state: State, week: Week, round: number): string | null {
  if (week.emomCap === 'test') return null;
  if (round < 2) return week.emomCap;
  const floor = state.emom.stepAtRoundStart;
  return stepIndex(program, floor) > stepIndex(program, week.emomCap) ? floor : week.emomCap;
}

function lowerStep(program: Program, a: string, b: string): string {
  return stepIndex(program, a) <= stepIndex(program, b) ? a : b;
}

export interface SessionOptions {
  short?: boolean;
  calmBase?: boolean;
  /** Plan as on a light-question day with a hard club session yesterday (P25). */
  hardYesterday?: boolean;
}

export function eventTomorrow(state: State, date: ISODate): string | null {
  return state.events.find((e) => e.eventDate === addDays(date, 1))?.label ?? null;
}

/** R-BOSS: a boss challenge may replace the EMOM (green is checked when the session starts). */
export function bossOffered(state: State, week: Week, round: number, date: ISODate): boolean {
  if (week.light) return false;
  if (!(round >= 2 || (round === 1 && week.pw >= 11))) return false;
  if (eventTomorrow(state, date)) return false;
  return !state.bossLog.some((b) => daysBetween(b.date, date) < 28 && b.date <= date);
}

/** The green plan of a session on a date (traffic light not applied yet). */
export function sessionPlan(
  program: Program,
  state: State,
  kind: SessionKind,
  date: ISODate,
  options: SessionOptions = {},
): SessionPlan {
  const template = getSession(program, kind);
  const k = calendarWeek(state.startDate, date);
  const info = weekInfoAt(program, state, Math.max(0, k));
  const pw = info?.pw ?? 1;
  const round = info?.round ?? 1;
  const week = getWeek(program, pw);
  const factor = info?.volumeFactor ?? 1;
  const tomorrow = eventTomorrow(state, date);
  const measures = kind === 'travel' ? [] : dueMeasures(program, state, kind, date, k);
  const blocks: BlockPlan[] = [];

  const measureBlock = (m: Measure, id: string): BlockPlan => ({
    blockId: id,
    trackId: m.id,
    role: 'measure',
    stepId: '',
    sets: 1,
    target: 0,
    unit: 'measure',
    rirPlan: 3,
    restSec: 60,
    inYellow: false,
    measureId: m.id,
  });

  for (const m of measures) {
    if (m.placement.type === 'before_warmup')
      blocks.push(measureBlock(m, `${kind}.measure.${m.id}`));
  }

  for (const block of template.blocks) {
    if (
      options.short &&
      block.role !== 'warmup' &&
      block.group !== 'pair1' &&
      block.group !== 'pair2'
    ) {
      continue;
    }
    for (const m of measures) {
      if (m.placement.type === 'standalone' && m.placement.before === block.id) {
        blocks.push(measureBlock(m, `${kind}.measure.${m.id}`));
      }
    }
    if (block.trackId === 'warmup') {
      blocks.push({
        blockId: block.id,
        trackId: 'warmup',
        role: 'warmup',
        stepId: '',
        sets: 1,
        target: 0,
        unit: 'routine',
        rirPlan: week.rirPlan,
        restSec: 0,
        inYellow: true,
      });
      continue;
    }
    const track = getTrack(program, block.trackId);
    const t = state.tracks[block.trackId];
    if (!t) continue;
    // R-EVENT: no heavy legs, leg ladder or Nordic the day before an event (A1, R6).
    if (tomorrow) {
      if (hasTag(track, 'heavy_legs')) continue;
      if (hasTag(track, 'heavy_legs_if_loaded') && t.load > 0) continue;
      if (hasTag(getStep(program, t.stepId), 'nordic')) continue;
    }
    const base = {
      blockId: block.id,
      trackId: block.trackId,
      role: block.role,
      group: block.group,
      rirPlan: week.rirPlan,
      restSec: block.restSec ?? 60,
      inYellow: block.inYellow,
    };

    if (track.progression === 'emom') {
      const cap = emomCap(program, state, week, round);
      if (kind === 'travel') {
        const stepId = lowerStep(program, t.stepId, 'burpee_emom.E3');
        const dose = getStep(program, stepId).dose;
        const reps = dose.kind === 'emom' ? dose.reps : 0;
        blocks.push({
          ...base,
          stepId,
          sets: 1,
          target: reps,
          unit: 'emom',
          emom: { stepId, minutes: 6, reps },
        });
        continue;
      }
      if (cap === null) {
        const test = program.measures.find((m) => m.placement.type === 'replace_finisher');
        if (test && measurementWeek(week, round))
          blocks.push(measureBlock(test, `${kind}.measure.${test.id}`));
        continue;
      }
      const stepId = week.emomFixed ? cap : lowerStep(program, t.stepId, cap);
      const dose = getStep(program, stepId).dose;
      if (dose.kind !== 'emom') continue;
      blocks.push({
        ...base,
        stepId,
        sets: 1,
        target: dose.reps,
        unit: 'emom',
        emom: { stepId, minutes: dose.minutes, reps: dose.reps },
      });
      continue;
    }

    // The travel session's split squats stay on a split squat step (S-WEEK-12).
    const stepId = block.maxStep ? lowerStep(program, t.stepId, block.maxStep) : t.stepId;
    const capped = stepId !== t.stepId;
    const step = getStep(program, stepId);
    const per = 'per' in step.dose ? step.dose.per : undefined;
    const tempDown = t.tempDown
      ? {
          originalStepId: t.tempDown.originalStepId,
          until: t.tempDown.until,
          lighter: t.tempDown.lighter,
        }
      : undefined;
    const firstSet = measures.find(
      (m) => m.placement.type === 'replace_first_set' && m.placement.trackId === block.trackId,
    );

    if (step.dose.kind === 'rounds') {
      const ranged = step.dose.rounds[0] !== step.dose.rounds[1];
      const weekSets = reduce(setsFor(block.setsRule, block.fixedSets, week), factor);
      // Club sequence: its own sets × rounds; one round in a light week (5.6). W3: rounds = sets.
      const sets = ranged ? 1 : week.light ? 1 : step.dose.sets;
      const all = ranged ? weekSets : week.light ? 1 : step.dose.rounds[0];
      // A measurement takes the place of the first round (S-MEAS-04).
      const rounds = firstSet ? Math.max(0, all - 1) : all;
      blocks.push({
        ...base,
        stepId: step.id,
        sets,
        target: rounds,
        unit: 'rounds',
        rounds,
        measureId: firstSet?.id,
        tempDown,
      });
      continue;
    }

    const range = workRange(step.dose);
    let sets = reduce(setsFor(block.setsRule, block.fixedSets, week), factor);
    if (step.dose.kind === 'fixed') sets = step.dose.sets;
    // A fixed block without its own set count (the neck ladder) uses the step's sets.
    if (block.setsRule === 'fixed' && !block.fixedSets && 'sets' in step.dose) {
      sets = Array.isArray(step.dose.sets) ? step.dose.sets[1] : step.dose.sets;
    }
    // Shoulder 3: the step-2 dose comes first in the same block; only the hold progresses (P17).
    if (step.with) {
      const companion = getStep(program, step.with);
      const companionRange = workRange(companion.dose);
      blocks.push({
        ...base,
        blockId: `${block.id}.with`,
        stepId: companion.id,
        sets,
        target: companionRange?.max ?? 0,
        unit: companionRange?.unit ?? 'reps',
        per: 'per' in companion.dose ? companion.dose.per : undefined,
      });
    }
    blocks.push({
      ...base,
      stepId: step.id,
      sets: firstSet ? Math.max(1, sets - 1) : sets,
      target: track.progression === 'neck' || capped ? (range?.min ?? 0) : t.target,
      unit: range?.unit ?? 'reps',
      per,
      load: track.progression === 'load' || t.load > 0 ? t.load : undefined,
      measureId: firstSet?.id,
      tempDown,
      optionalPlusOne:
        (block.setsRule === 'par12' && week.sets.optionalPlusOne) ||
        (block.setsRule === 'power' && week.powerOptionalPlusOne) ||
        undefined,
    });

    for (const m of measures) {
      const p = m.placement;
      if (p.type === 'after_block' && p.trackId === block.trackId) {
        if (stepIndex(program, t.stepId) >= stepIndex(program, p.minStep)) {
          blocks.push(measureBlock(m, `${kind}.measure.${m.id}`));
        }
      }
    }
  }
  for (const m of measures) {
    if (m.placement.type === 'standalone' && m.placement.after) {
      const after = m.placement.after;
      const index = blocks.findIndex((b) => b.blockId === after);
      if (index >= 0) blocks.splice(index + 1, 0, measureBlock(m, `${kind}.measure.${m.id}`));
    }
  }

  let motor: MotorSession | undefined;
  let intervalsOption: MotorSession | undefined;
  let calmBase = options.calmBase === true;
  if (kind === 'motor') {
    const planned = motorSession(week, measures);
    const intervals = planned.variant === 'intervals' || planned.variant === 'fight';
    if (tomorrow && !intervals) {
      // The day before an event the motor is a calm base: no strides, no Cooper test (S-EVENT-02).
      motor =
        planned.variant === 'base' || planned.variant === 'base_check'
          ? {
              ...planned,
              title: `Rolig base, ${planned.minutes} min`,
              phases: planned.phases.filter((p) => p.kind !== 'strides'),
            }
          : calmBaseSession();
      calmBase = true;
    } else if (intervals && (tomorrow || calmBase)) {
      motor = calmBaseSession();
      calmBase = true;
    } else if (intervals && options.hardYesterday) {
      motor = calmBaseSession();
      intervalsOption = planned;
      calmBase = true;
    } else {
      motor = planned;
      calmBase = false;
    }
  }

  return {
    kind,
    name: options.short ? `${template.name} · kort version` : template.name,
    durationMin: options.short ? [30, 30] : template.durationMin,
    light: 'green',
    short: options.short === true,
    blocks,
    motor,
    intervalsOption,
    calmBase,
    bossOffered: kind === 'A' && bossOffered(state, week, round, date),
    boss: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------------------------

const MIN = 60;

function warmupPhases(): MotorPhase[] {
  return [
    { kind: 'warmup', label: 'Let opvarmning', seconds: 10 * MIN },
    { kind: 'strides', label: '3 korte stigningsløb', seconds: 0 },
  ];
}

const COOLDOWN: MotorPhase = { kind: 'cooldown', label: 'Rolig nedjogging', seconds: 5 * MIN };

export function calmBaseSession(minutes = 30): MotorSession {
  return {
    variant: 'base',
    title: `Rolig base, ${minutes} min`,
    minutes,
    phases: [{ kind: 'base', label: 'Rolig base i tale-tempo', seconds: minutes * MIN }],
  };
}

/** The motor session of a programme week (page 31–32, week table pages 37–38). */
export function motorSession(week: Week, measures: Measure[] = []): MotorSession {
  const motor = week.motor;
  switch (motor.type) {
    case 'base': {
      const phases: MotorPhase[] = [
        { kind: 'base', label: 'Rolig base i tale-tempo', seconds: motor.minutes * MIN },
      ];
      if (motor.strides) {
        phases.push({ kind: 'strides', label: `${motor.strides} stigningsløb`, seconds: 0 });
      }
      return { variant: 'base', title: week.text.motor, minutes: motor.minutes, phases };
    }
    case 'base_check':
      return {
        variant: 'base_check',
        title: week.text.motor,
        minutes: motor.minutes,
        phases: [{ kind: 'base', label: 'Base-check i tale-tempo', seconds: motor.minutes * MIN }],
        measureId: measures.some((m) => m.id === 'base_check') ? 'base_check' : undefined,
      };
    case 'intervals_30_15': {
      const phases: MotorPhase[] = [...warmupPhases()];
      for (let s = 0; s < motor.series; s++) {
        if (s > 0) phases.push({ kind: 'pause', label: 'Pause', seconds: 3 * MIN });
        for (let r = 0; r < motor.reps; r++) {
          phases.push({ kind: 'work', label: `Hårdt ${r + 1}/${motor.reps}`, seconds: 30 });
          phases.push({ kind: 'easy', label: 'Let', seconds: 15 });
        }
      }
      phases.push(COOLDOWN);
      return {
        variant: 'intervals',
        title: week.text.motor,
        minutes: Math.round(phases.reduce((n, p) => n + p.seconds, 0) / MIN),
        phases,
      };
    }
    case 'fight_rounds': {
      const phases: MotorPhase[] = [...warmupPhases()];
      for (let r = 0; r < motor.rounds; r++) {
        if (r > 0) phases.push({ kind: 'pause', label: 'Pause', seconds: MIN });
        phases.push({
          kind: 'round',
          label: `Kamp-runde ${r + 1}/${motor.rounds}`,
          seconds: 3 * MIN,
        });
      }
      if (motor.sprints) {
        for (let s = 0; s < 2; s++) {
          phases.push({ kind: 'pause', label: 'Pause', seconds: 3 * MIN });
          for (let i = 0; i < 6; i++) {
            phases.push({ kind: 'sprint', label: `Sprint ${i + 1}/6`, seconds: 8 });
            phases.push({ kind: 'walk', label: 'Gå tilbage', seconds: 30 });
          }
        }
      }
      phases.push(COOLDOWN);
      return {
        variant: 'fight',
        title: week.text.motor,
        minutes: Math.round(phases.reduce((n, p) => n + p.seconds, 0) / MIN),
        phases,
      };
    }
    case 'cooper_or_base':
      return {
        variant: 'cooper_or_base',
        title: week.text.motor,
        minutes: 12,
        phases: [
          ...warmupPhases(),
          { kind: 'cooper', label: 'Cooper: længst mulig på 12 min', seconds: 12 * MIN },
          COOLDOWN,
        ],
        measureId: 'cooper',
        cooperOptional: !motor.cooperOnly,
      };
  }
}

// ---------------------------------------------------------------------------------------------
// Traffic light (5.2, 6.1)
// ---------------------------------------------------------------------------------------------

export function lightFor(answers: readonly boolean[]): Light {
  return answers.every(Boolean) ? 'green' : 'yellow';
}

/** Applies the traffic light: yellow keeps pair 1 and 2 with 2 sets and 3 in reserve. */
export function applyTrafficLight(plan: SessionPlan, light: Light): SessionPlan {
  if (light === 'green') return { ...plan, light };
  if (light === 'red') {
    return {
      ...plan,
      light,
      blocks: [],
      motor: undefined,
      intervalsOption: undefined,
      bossOffered: false,
    };
  }
  if (plan.kind === 'motor') {
    return {
      ...plan,
      light,
      motor: calmBaseSession(30),
      intervalsOption: undefined,
      calmBase: true,
    };
  }
  const blocks = plan.blocks
    .filter((b) => b.inYellow && b.role !== 'measure')
    .map((b) =>
      b.role === 'warmup'
        ? b
        : { ...b, sets: 2, rirPlan: 3 as const, measureId: undefined, optionalPlusOne: undefined },
    );
  return { ...plan, light, blocks, bossOffered: false, boss: false, durationMin: [25, 25] };
}

export interface LightDefaults {
  answers: [boolean, boolean, boolean];
  /** q2 defaults to »nej« because of recent sharp pain or the Sunday check. */
  painReason: 'recent_sharp' | 'sunday_check' | null;
  /** Yesterday's club session was logged as hard. */
  hardYesterday: boolean;
}

/** Derived default answers and the hint (5.2). */
export function defaultAnswers(state: State, date: ISODate): LightDefaults {
  const recentSharp = state.sessions.some(
    (s) =>
      daysBetween(s.date, date) >= 0 &&
      daysBetween(s.date, date) <= 2 &&
      s.sets.some((x) => x.pain === 'sharp' || x.pain === 'stop'),
  );
  const check = [...state.sundayChecks]
    .reverse()
    .find((c) => c.date <= date && daysBetween(c.date, date) <= 7);
  const sunday = (check?.painTracks.length ?? 0) > 0;
  const yesterday = addDays(date, -1);
  const hardYesterday = state.club.some((c) => c.date === yesterday && c.hardness === 'hard');
  return {
    answers: [true, !(recentSharp || sunday), true],
    painReason: recentSharp ? 'recent_sharp' : sunday ? 'sunday_check' : null,
    hardYesterday,
  };
}

// ---------------------------------------------------------------------------------------------
// The day
// ---------------------------------------------------------------------------------------------

function clubInfo(program: Program, state: State, date: ISODate) {
  const day = weekday(date);
  const isClub = state.schedule.clubDays.includes(day);
  const time = program.club.days.find((d) => d.weekday === day)?.time;
  const clinch =
    state.schedule.clinch && program.club.clinch.weekday === day
      ? program.club.clinch.time
      : undefined;
  return { day: isClub, closed: isClub && statusOn(state, date) === 'club_closed', time, clinch };
}

/** Planned sessions of the given date that were not started, skipped or moved away. */
export function unloggedOn(
  program: Program,
  state: State,
  date: ISODate,
): Array<{ kind: SessionKind; date: ISODate }> {
  if (!state.onboarded || calendarWeek(state.startDate, date) < 0) return [];
  if (state.onboardedOn && date < state.onboardedOn) return [];
  const status = statusOn(state, date);
  if (status === 'ill' || status === 'holiday') return [];
  return scheduleForWeek(program, state, mondayOf(date))
    .filter((a) => a.date === date)
    .filter(
      (a) =>
        !state.sessions.some((s) => s.date === date && (s.kind === a.kind || s.kind === 'travel')),
    )
    .filter(
      (a) =>
        !state.skipped.some((s) => s.forDate === date && s.kind === a.kind && s.reason === 'user'),
    )
    .map((a) => ({
      kind: status === 'travel' && a.kind !== 'motor' ? ('travel' as const) : a.kind,
      date,
    }));
}

export function planFor(program: Program, state: State, date: ISODate): DayPlan {
  const k = calendarWeek(state.startDate, date);
  const info = weekInfoAt(program, state, k);
  const pw = info?.pw ?? 1;
  const round = info?.round ?? 1;
  const week = getWeek(program, pw);
  const flags: DayFlag[] = [];
  const status = statusOn(state, date);
  const club = clubInfo(program, state, date);
  const done =
    state.sessions.find((s) => s.date === date && s.completed && s.kind !== 'os') ?? null;
  const open =
    state.sessions.find((s) => s.date === date && !s.completed && s.kind !== 'os') ?? null;
  const plan: DayPlan = {
    date,
    k,
    pw,
    round,
    phase: week.phase,
    week,
    weekInfo: info,
    beforeStart: k < 0,
    status,
    kind: null,
    short: false,
    session: null,
    red: false,
    restDay: false,
    club,
    flags,
    overlays: [],
    done,
    open,
    missed: [],
  };
  if (!state.onboarded) flags.push({ type: 'not_onboarded' });
  if (k < 0) {
    flags.push({ type: 'before_start', startDate: state.startDate });
    return plan;
  }
  if (week.light) flags.push({ type: 'light_week' });
  if (info?.volumeFactor === 0.67) flags.push({ type: 'reduced_volume' });
  if (pw >= 5 || round >= 2) flags.push({ type: 'turbo' });
  for (const [trackId, t] of Object.entries(state.tracks)) {
    if (t.tempDown?.physio && date <= t.tempDown.until) flags.push({ type: 'physio', trackId });
  }
  if (state.neckStops >= 2) flags.push({ type: 'neck_warning' });
  const tomorrow = eventTomorrow(state, date);
  if (tomorrow) flags.push({ type: 'event_tomorrow', label: tomorrow });
  if (status) flags.push({ type: 'status', status });

  const monday = mondayOf(date);
  for (const overlay of program.overlays) {
    if (overlay.week !== monday || (overlay.onlyIfLight && !week.light)) continue;
    plan.overlays.push({
      overlayId: overlay.id,
      label: overlay.label,
      alternativeLabel: overlay.alternativeLabel,
      choice: state.overlayChoices[overlay.id] ?? null,
    });
  }
  plan.missed = unloggedOn(program, state, addDays(date, -1));

  const layout = currentLayout(program, state);
  if (layout.motorDropped) flags.push({ type: 'motor_dropped' });
  plan.restDay = layout.rest === weekday(date);

  if (status === 'ill') {
    plan.red = true;
    return plan;
  }
  if (status === 'holiday') {
    plan.restDay = true;
    return plan;
  }
  const assignment = scheduleForWeek(program, state, monday).find((a) => a.date === date);
  if (!assignment) return plan;
  let kind = assignment.kind;
  if (status === 'travel' && (kind === 'A' || kind === 'B')) kind = 'travel';
  plan.kind = kind;
  plan.short = assignment.short;
  plan.session = sessionPlan(program, state, kind, date, {
    short: assignment.short,
    calmBase: assignment.calmBase,
    hardYesterday: defaultAnswers(state, date).hardYesterday,
  });
  return plan;
}

/** The seven days of the calendar week that contains `date` (Uge, docs/SPEC.md 3.4). */
export function weekPlan(program: Program, state: State, date: ISODate): DayPlan[] {
  const monday = mondayOf(date);
  return [0, 1, 2, 3, 4, 5, 6].map((d) => planFor(program, state, addDays(monday, d)));
}

/** What R-EVENT took out of a day's plan the day before an event (5.1 step 5, S-EVENT-03). */
export interface EventTrim {
  /** The event tomorrow. */
  label: string;
  /** The day's session, or null on a day without one. */
  kind: SessionKind | null;
  /** The tracks whose blocks are out of the session, in the session's order. */
  tracks: string[];
  /** The motor became a calm base: instead of intervals, without the Cooper test or the strides. */
  motor: 'intervals' | 'cooper' | 'strides' | null;
  /** The boss challenge is not offered. */
  boss: boolean;
}

/**
 * The day's plan compared with the same plan without tomorrow's event: what the rule took out.
 * Null when tomorrow has no event.
 */
export function eventTrim(program: Program, state: State, date: ISODate): EventTrim | null {
  const label = eventTomorrow(state, date);
  if (!label) return null;
  const tomorrow = addDays(date, 1);
  const after = planFor(program, state, date).session;
  const before = planFor(
    program,
    { ...state, events: state.events.filter((e) => e.eventDate !== tomorrow) },
    date,
  ).session;
  if (!after || !before) return { label, kind: null, tracks: [], motor: null, boss: false };
  const kept = new Set(after.blocks.map((b) => b.blockId));
  const tracks: string[] = [];
  for (const block of before.blocks) {
    if (block.role === 'warmup' || block.role === 'measure' || kept.has(block.blockId)) continue;
    if (!tracks.includes(block.trackId)) tracks.push(block.trackId);
  }
  // The motor as planned before the rule (the intervals, also when a hard club day made the calm
  // base the default with »Kør intervallerne alligevel«).
  const planned = before.intervalsOption ?? before.motor;
  const motor = after.motor;
  let change: EventTrim['motor'] = null;
  if (planned && motor && planned.variant !== motor.variant) {
    change = planned.variant === 'cooper_or_base' ? 'cooper' : 'intervals';
  } else if (
    planned &&
    motor &&
    planned.phases.some((p) => p.kind === 'strides') &&
    !motor.phases.some((p) => p.kind === 'strides')
  ) {
    change = 'strides';
  }
  return {
    label,
    kind: after.kind,
    tracks,
    motor: change,
    boss: before.bossOffered && !after.bossOffered,
  };
}

/** I dag's explanation of the day before an event, in the engine's words (S-EVENT-03). */
export function eventExplanation(program: Program, state: State, date: ISODate): string | null {
  const trim = eventTrim(program, state, date);
  return trim ? explainEventTomorrow(program, trim) : null;
}
