// Writing a session: start (with the EMOM step-up), sets »som planlagt«, finish with the engine's
// decisions (docs/ENGINE.md 5.3–5.5), and the daily catch-up (missed sessions, R-ABSENCE-3).
import { addDays, calendarWeek, daysBetween, mondayOf } from './dates.ts';
import { deriveState } from './derive.ts';
import {
  explainAbsence,
  explainEmomUp,
  explainLoad,
  explainPain,
  explainPainAgain,
  explainRestore,
  explainStepUp,
  explainUserChoice,
} from './explain.ts';
import {
  getStep,
  getTrack,
  getWeek,
  nextStep,
  perSide,
  previousStep,
  ruleOf,
  stepIndex,
  workRange,
} from './lookup.ts';
import {
  applyTrafficLight,
  emomCap,
  lightFor,
  sessionPlan,
  unloggedOn,
  weekInfoAt,
  type BlockPlan,
  type SessionPlan,
} from './plan.ts';
import type {
  AppEvent,
  BlockResult,
  EventFactory,
  ISODate,
  Light,
  Pain,
  PlannedBlockRef,
  Program,
  Rir,
  SessionKind,
  SessionStatus,
  SessionSummary,
  Side,
  State,
} from './types.ts';
import { absenceRun } from './weeks.ts';

export interface Ctx {
  program: Program;
  make: EventFactory;
}

// ---------------------------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------------------------

/**
 * The reserve »Som planlagt« logs: the week's plan, except that a »1–2 i reserve« week logs 2
 * when the working number is the step's top, so a hit is possible (5.3, P10, R4).
 */
export function plannedRir(program: Program, block: BlockPlan): Rir {
  if (block.rirPlan !== 1 || !block.stepId) return block.rirPlan;
  const range = workRange(getStep(program, block.stepId).dose);
  return range && block.target >= range.max ? 2 : 1;
}

export interface SetInput {
  sessionId: string;
  date: ISODate;
  block: BlockPlan;
  setIndex: number;
  side?: Side;
  value?: number;
  rir?: Rir;
  pain?: Pain;
  measureId?: string;
}

/** One set_logged. Without `value` and `rir` it is »Som planlagt«. */
export function logSet(ctx: Ctx, input: SetInput): AppEvent {
  const { block } = input;
  const planned = input.value === undefined && input.rir === undefined && input.pain === undefined;
  const value = input.value ?? block.target;
  const rir: Rir = input.measureId ? 0 : (input.rir ?? plannedRir(ctx.program, block));
  const asPlanned =
    !input.measureId &&
    value === block.target &&
    rir === plannedRir(ctx.program, block) &&
    !input.pain;
  return ctx.make(
    {
      type: 'set_logged',
      sessionId: input.sessionId,
      blockId: block.blockId,
      trackId: block.trackId,
      stepId: block.stepId,
      setIndex: input.setIndex,
      side: input.side,
      ...(block.unit === 'sec' ? { seconds: value } : { reps: value }),
      rir,
      pain: input.pain,
      asPlanned: planned || asPlanned,
      measureId: input.measureId,
    },
    input.date,
  );
}

/** A hold timer's set: »som planlagt« when the full time was held (S-HOLD-03). */
export function logHoldSet(
  ctx: Ctx,
  input: Omit<SetInput, 'value' | 'rir'> & { secondsHeld: number },
): AppEvent {
  const held = Math.max(0, Math.round(input.secondsHeld));
  return logSet(ctx, {
    ...input,
    value: Math.min(held, input.block.target),
    rir: plannedRir(ctx.program, input.block),
  });
}

export function logBlockResult(
  ctx: Ctx,
  input: { sessionId: string; date: ISODate; block: BlockPlan; result: BlockResult },
): AppEvent {
  return ctx.make(
    {
      type: 'block_result',
      sessionId: input.sessionId,
      blockId: input.block.blockId,
      trackId: input.block.trackId,
      stepId: input.block.stepId,
      result: input.result,
    },
    input.date,
  );
}

// ---------------------------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------------------------

export interface StartInput {
  sessionId: string;
  date: ISODate;
  kind: SessionKind;
  answers: [boolean, boolean, boolean];
  /** The red button: ill, fever, sharp pain or under 4 hours of sleep. */
  red?: boolean;
  short?: boolean;
  /** Keep the overlay's calm base (Christmas) or the hard-club default. */
  calmBase?: boolean;
  /** »Kør intervallerne alligevel«. */
  intervalsAnyway?: boolean;
  /** A boss challenge instead of the EMOM (R-BOSS). */
  boss?: boolean;
}

function refs(plan: SessionPlan): PlannedBlockRef[] {
  return plan.blocks
    .filter((b) => b.role !== 'warmup' && b.role !== 'measure' && b.stepId !== '')
    .map((b) => ({
      blockId: b.blockId,
      trackId: b.trackId,
      stepId: b.stepId,
      sets: b.sets,
      target: b.target,
      rirPlan: b.rirPlan,
      group: b.group,
      measureId: b.measureId,
    }));
}

/** The plan a session runs with (also used to resume it). */
export function resolvePlan(
  program: Program,
  state: State,
  input: Omit<StartInput, 'sessionId' | 'answers'> & { light: Light },
): SessionPlan {
  let plan = sessionPlan(program, state, input.kind, input.date, {
    short: input.short,
    calmBase: input.calmBase,
    hardYesterday: !input.intervalsAnyway && hardClubYesterday(state, input.date),
  });
  if (input.intervalsAnyway && plan.intervalsOption) {
    plan = { ...plan, motor: plan.intervalsOption, intervalsOption: undefined, calmBase: false };
  }
  plan = applyTrafficLight(plan, input.light);
  if (input.boss && plan.bossOffered && input.light === 'green') {
    plan = {
      ...plan,
      boss: true,
      blocks: plan.blocks.filter((b) => b.unit !== 'emom'),
    };
  }
  return plan;
}

function hardClubYesterday(state: State, date: ISODate): boolean {
  const yesterday = addDays(date, -1);
  return state.club.some((c) => c.date === yesterday && c.hardness === 'hard');
}

/** session_started (and an EMOM step-up first, when one is due: R-EMOM). */
export function startSession(ctx: Ctx, events: readonly AppEvent[], input: StartInput): AppEvent[] {
  const { program, make } = ctx;
  const state = deriveState(program, events, input.date);
  const light: Light = input.red ? 'red' : lightFor(input.answers);
  const k = calendarWeek(state.startDate, input.date);
  const info = weekInfoAt(program, state, Math.max(0, k));
  const pw = info?.pw ?? 1;
  const round = info?.round ?? 1;
  const out: AppEvent[] = [];

  let plan = resolvePlan(program, state, { ...input, light });
  const emomBlock = plan.blocks.find((b) => b.unit === 'emom');
  const last = state.emom.lastStepUpWeek;
  if (
    input.kind === 'A' &&
    emomBlock &&
    state.emom.pendingUp &&
    info?.volumeFactor !== 0.67 &&
    !(last && last.round === round && last.pw === pw)
  ) {
    const cap = emomCap(program, state, getWeek(program, pw), round);
    const current = state.emom.stepId;
    const next = nextStep(program, current);
    if (cap && next && stepIndex(program, next.id) <= stepIndex(program, cap)) {
      const change = make(
        {
          type: 'step_changed',
          trackId: 'burpee_emom',
          from: current,
          to: next.id,
          by: 'engine',
          reason: 'progression',
          explanation: explainEmomUp(program, next.id),
          week: { round, pw },
          sessionId: input.sessionId,
        },
        input.date,
      );
      out.push(change);
      plan = resolvePlan(program, deriveState(program, [...events, change], input.date), {
        ...input,
        light,
      });
    }
  }

  out.push(
    make(
      {
        type: 'session_started',
        sessionId: input.sessionId,
        kind: input.kind,
        light,
        answers: input.answers,
        programWeek: pw,
        round,
        blocks: refs(plan),
        calmBase: plan.kind === 'motor' ? plan.calmBase : undefined,
        boss: plan.boss || undefined,
      },
      input.date,
    ),
  );
  return out;
}

// ---------------------------------------------------------------------------------------------
// Finish
// ---------------------------------------------------------------------------------------------

function blockDone(session: SessionSummary, ref: PlannedBlockRef, program: Program): boolean {
  const sets = session.sets.filter((s) => s.blockId === ref.blockId && s.measureId === undefined);
  // A block ended by sharp pain counts as done: the rules ended it (Præcisering P28).
  if (sets.some((s) => s.pain === 'sharp' || s.pain === 'stop')) return true;
  const dose = getStep(program, ref.stepId).dose;
  if (!perSide(dose)) return sets.length >= ref.sets;
  return (
    sets.filter((s) => s.side === 'L').length >= ref.sets &&
    sets.filter((s) => s.side === 'R').length >= ref.sets
  );
}

/** done = every set of pair 1 logged (R-WEEK-DONE). */
export function pairOneDone(program: Program, session: SessionSummary): boolean {
  const pair1 = session.blocks.filter((b) => b.group === 'pair1');
  return pair1.length > 0 && pair1.every((ref) => blockDone(session, ref, program));
}

function statusOf(session: SessionSummary): SessionStatus {
  if (session.kind === 'travel') return session.light === 'red' ? 'red' : 'travel';
  return session.light;
}

/** session_completed and the engine's decisions for every track in the session. */
export function finishSession(
  ctx: Ctx,
  events: readonly AppEvent[],
  input: { sessionId: string; aborted?: boolean },
): AppEvent[] {
  const { program, make } = ctx;
  const started = events.find(
    (e) => e.type === 'session_started' && e.sessionId === input.sessionId,
  );
  if (!started) throw new Error(`No session ${input.sessionId}`);
  const before = deriveState(program, events, started.date);
  const session = before.sessions.find((s) => s.sessionId === input.sessionId);
  if (!session || session.completed) return [];
  const status = statusOf(session);
  const completed = make(
    {
      type: 'session_completed',
      sessionId: input.sessionId,
      status,
      aborted: input.aborted === true,
      done: session.light !== 'red' && pairOneDone(program, session),
    },
    session.date,
  );
  const after = deriveState(program, [...events, completed], session.date);
  return [completed, ...decide(ctx, after, input.sessionId)];
}

function decide(ctx: Ctx, state: State, sessionId: string): AppEvent[] {
  const { program, make } = ctx;
  const session = state.sessions.find((s) => s.sessionId === sessionId);
  if (!session) return [];
  const out: AppEvent[] = [];
  const seen = new Set<string>();
  for (const ref of session.blocks) {
    if (seen.has(ref.trackId)) continue;
    seen.add(ref.trackId);
    const t = state.tracks[ref.trackId];
    const evaluation = session.evaluations[ref.blockId];
    if (!t || !evaluation) continue;
    const track = getTrack(program, ref.trackId);
    const step = getStep(program, ref.stepId);
    const change = (
      to: string,
      reason: 'progression' | 'pain' | 'restore',
      explanation: string,
      until?: ISODate,
    ) =>
      out.push(
        make(
          {
            type: 'step_changed',
            trackId: ref.trackId,
            from: t.stepId,
            to,
            by: 'engine',
            reason,
            explanation,
            until,
            sessionId,
          },
          session.date,
        ),
      );

    // R-PAIN-SHARP: one step down for 7 days; again within the period: 7 more days.
    if (evaluation.pain) {
      if (track.progression === 'manual') continue;
      const until = addDays(session.date, 7);
      if (t.tempDown) {
        change(t.stepId, 'pain', explainPainAgain(program, t.stepId, until), until);
      } else {
        const to = previousStep(program, t.stepId)?.id ?? t.stepId;
        change(to, 'pain', explainPain(program, t.stepId, to, until, 'session'), until);
      }
      continue;
    }
    // R-PAIN-RESTORE (T3): the first qualifying session on or after `until` without new pain.
    if (t.tempDown && evaluation.qualifying && session.date >= t.tempDown.until) {
      const to = t.tempDown.originalStepId;
      change(to, 'restore', explainRestore(program, t.stepId, to));
      continue;
    }
    if (!evaluation.qualifying || t.hits < 2 || t.tempDown) continue;
    const rule = ruleOf(track, step);
    if (rule === 'emom' || rule === 'manual') continue;
    if (rule === 'load') {
      out.push(
        make(
          {
            type: 'load_changed',
            trackId: ref.trackId,
            from: t.load,
            to: t.load + 2,
            by: 'engine',
            explanation: explainLoad(program, t.stepId, ref.sets, t.load + 2),
            sessionId,
          },
          session.date,
        ),
      );
      continue;
    }
    const next = nextStep(program, t.stepId);
    if (!next) continue; // the top step stays (S-DP-10)
    const how =
      rule === 'power'
        ? 'power'
        : rule === 'neck'
          ? 'neck'
          : rule === 'rounds'
            ? step.dose.kind === 'rounds' && step.dose.rounds[0] !== step.dose.rounds[1]
              ? 'w3'
              : 'rounds'
            : 'double';
    change(next.id, 'progression', explainStepUp(program, t.stepId, next.id, how, ref.sets));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Catch-up when a day is computed: stale sessions, missed sessions, three weeks away
// ---------------------------------------------------------------------------------------------

const ABSENCE_RULES = new Set(['double', 'hold', 'power', 'emom', 'rounds', 'neck']);

export function catchUp(ctx: Ctx, events: readonly AppEvent[], today: ISODate): AppEvent[] {
  const { program, make } = ctx;
  const out: AppEvent[] = [];
  let log = [...events];
  let state = deriveState(program, log, today);
  if (!state.onboarded) return [];

  // A session left open on an earlier day is finished as aborted, so its sets still count.
  for (const s of state.sessions.filter((x) => !x.completed && x.date < today)) {
    const finished = finishSession(ctx, log, { sessionId: s.sessionId, aborted: true });
    out.push(...finished);
    log = [...log, ...finished];
  }
  if (out.length > 0) state = deriveState(program, log, today);

  // R-ABSENCE-3: three weeks in a row without a completed week, once per absence period.
  const todayK = calendarWeek(state.startDate, today);
  const from =
    state.onboardedOn && state.onboardedOn > state.startDate
      ? mondayOf(state.onboardedOn)
      : state.startDate;
  const run = absenceRun(state.weeks, todayK, from);
  if (run && !state.absenceApplied.some((d) => d >= run)) {
    for (const track of program.tracks) {
      const t = state.tracks[track.id];
      const first = track.steps[0];
      if (!t || !first || !ABSENCE_RULES.has(track.progression)) continue;
      const to = previousStep(program, t.stepId)?.id ?? t.stepId;
      out.push(
        make(
          {
            type: 'step_changed',
            trackId: track.id,
            from: t.stepId,
            to,
            by: 'engine',
            reason: 'absence',
            explanation: explainAbsence(program, t.stepId, to),
          },
          today,
        ),
      );
    }
  }

  // Sessions that were not started by the end of their day (5.3.5).
  const start =
    [state.startDate, state.onboardedOn ?? state.startDate, addDays(today, -7)].sort().pop() ??
    today;
  for (let d = start; d < today; d = addDays(d, 1)) {
    for (const missed of unloggedOn(program, state, d)) {
      const already = state.skipped.some((s) => s.forDate === d && s.kind === missed.kind);
      if (already) continue;
      out.push(
        make({ type: 'session_skipped', kind: missed.kind, forDate: d, reason: 'missed' }, d),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The user's own choices
// ---------------------------------------------------------------------------------------------

/** R-USER-STEP: the user picks another step; hits = 0, target = min. */
export function chooseStep(
  ctx: Ctx,
  events: readonly AppEvent[],
  input: { trackId: string; stepId: string; date: ISODate },
): { events: AppEvent[]; warnUp: boolean } {
  const state = deriveState(ctx.program, events, input.date);
  const t = state.tracks[input.trackId];
  if (!t || t.stepId === input.stepId) return { events: [], warnUp: false };
  const up = stepIndex(ctx.program, input.stepId) > stepIndex(ctx.program, t.stepId);
  const event = ctx.make(
    {
      type: 'step_changed',
      trackId: input.trackId,
      from: t.stepId,
      to: input.stepId,
      by: 'user',
      reason: 'user_choice',
      explanation: explainUserChoice(ctx.program, input.stepId),
    },
    input.date,
  );
  return { events: [event], warnUp: up && !t.warnedUp };
}

/** R-PAIN-SUNDAY: »gør ondt, ikke væk« counts as sharp pain for those tracks. */
export function submitSundayCheck(
  ctx: Ctx,
  events: readonly AppEvent[],
  input: { date: ISODate; sleepAvg?: number; painTracks: string[]; tooHeavy: string[] },
): AppEvent[] {
  const { program, make } = ctx;
  const state = deriveState(program, events, input.date);
  const out: AppEvent[] = [
    make(
      {
        type: 'sunday_check',
        weekStart: mondayOf(input.date),
        sleepAvg: input.sleepAvg,
        painTracks: input.painTracks,
        tooHeavy: input.tooHeavy,
      },
      input.date,
    ),
  ];
  const until = addDays(input.date, 7);
  for (const trackId of input.painTracks) {
    const t = state.tracks[trackId];
    if (!t) continue;
    if (t.tempDown) {
      out.push(
        make(
          {
            type: 'step_changed',
            trackId,
            from: t.stepId,
            to: t.stepId,
            by: 'engine',
            reason: 'pain',
            explanation: explainPainAgain(program, t.stepId, until),
            until,
          },
          input.date,
        ),
      );
      continue;
    }
    const to = previousStep(program, t.stepId)?.id ?? t.stepId;
    out.push(
      make(
        {
          type: 'step_changed',
          trackId,
          from: t.stepId,
          to,
          by: 'engine',
          reason: 'pain',
          explanation: explainPain(program, t.stepId, to, until, 'sunday'),
          until,
        },
        input.date,
      ),
    );
  }
  return out;
}

/** Days since the last backup, or null when there has been none. */
export function daysSinceBackup(state: State, today: ISODate): number | null {
  return state.lastBackup ? daysBetween(state.lastBackup, today) : null;
}
