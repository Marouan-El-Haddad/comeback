// deriveState: replays the append-only event log into the state the UI reads (docs/ENGINE.md 3).
// Progression counters (target, hits) are derived here when a session is completed; the step
// changes themselves are events written by the engine (session.ts) and only applied here.
import { calendarWeek, mondayOf } from './dates.ts';
import {
  findStep,
  findTrack,
  getStep,
  getTrack,
  getWeek,
  minTarget,
  perSide,
  ruleOf,
  stepIndex,
  workRange,
} from './lookup.ts';
import type {
  AppEvent,
  BlockEvaluation,
  EventOf,
  ISODate,
  LoggedSet,
  PlannedBlockRef,
  Program,
  SessionSummary,
  State,
  TrackState,
} from './types.ts';
import { currentStepId } from './migrations/index.ts';
import { computeWeeks } from './weeks.ts';

export function emptyState(program: Program, today: ISODate): State {
  const tracks: Record<string, TrackState> = {};
  for (const track of program.tracks) {
    const first = track.steps[0];
    if (!first) continue;
    tracks[track.id] = { stepId: first.id, target: minTarget(program, first.id), hits: 0, load: 0 };
  }
  const emomFirst = tracks.burpee_emom?.stepId ?? '';
  return {
    onboarded: false,
    startDate: program.startDate,
    today,
    round: 1,
    tracks,
    emom: { stepId: emomFirst, pendingUp: false, stepAtRoundStart: emomFirst },
    burpeeVariant: tracks.burpee_skill?.stepId ?? '',
    sideBranch: null,
    schedule: { clubDays: program.club.days.map((d) => d.weekday), clinch: false },
    statuses: [],
    events: [],
    weeks: [],
    sessions: [],
    club: [],
    measurements: [],
    sundayChecks: [],
    moves: [],
    skipped: [],
    overlayChoices: {},
    heroes: {},
    turbo: { exerciseId: null, log: {} },
    osByWeek: {},
    completedOsWeeks: 0,
    bossLog: [],
    decisions: [],
    neckStops: 0,
    absenceApplied: [],
    declaredWeeks: [],
  };
}

/** The first `n` working sets per side, in logged order. */
function firstSets(sets: LoggedSet[], n: number, sided: boolean): LoggedSet[] {
  if (!sided) return sets.slice(0, n);
  return [
    ...sets.filter((s) => s.side === 'L').slice(0, n),
    ...sets.filter((s) => s.side === 'R').slice(0, n),
  ];
}

function isComplete(sets: LoggedSet[], n: number, sided: boolean): boolean {
  if (!sided) return sets.length >= n;
  return (
    sets.filter((s) => s.side === 'L').length >= n && sets.filter((s) => s.side === 'R').length >= n
  );
}

/** R-DP, R-HOLD, R-POWER, R-EMOM, R-CLUB, R-W3, R-NECK, R-LOAD for one block of a completed session. */
function evaluateBlock(
  program: Program,
  state: State,
  session: SessionSummary,
  ref: PlannedBlockRef,
): BlockEvaluation {
  const t = state.tracks[ref.trackId];
  const all = session.sets.filter((s) => s.blockId === ref.blockId);
  // Sharp pain ends the track's work in the session, in every block of that track.
  const pain = session.sets.some(
    (s) => s.trackId === ref.trackId && (s.pain === 'sharp' || s.pain === 'stop'),
  );
  const result: BlockEvaluation = {
    trackId: ref.trackId,
    stepId: ref.stepId,
    qualifying: false,
    hit: false,
    pain,
    targetBefore: t?.target ?? 0,
    targetAfter: t?.target ?? 0,
    hitsAfter: t?.hits ?? 0,
  };
  const track = findTrack(program, ref.trackId);
  if (!t || !track) return result;
  const step = getStep(program, ref.stepId);
  const week = getWeek(program, session.pw);
  const rule = ruleOf(track, step);
  // Neutral: not green, light week, sharp pain, or the block ran another step than the track's
  // (a companion block, P17). The EMOM runs at min(your step, the week's cap): that still counts.
  const otherStep = t.stepId !== ref.stepId && rule !== 'emom';
  if (session.status !== 'green' || week.light || pain || otherStep) return result;

  const sided = perSide(step.dose);
  const work = all.filter((s) => s.measureId === undefined && s.rir !== 0);
  const outcome = session.results.find((r) => r.blockId === ref.blockId)?.result;
  const done = (hit: boolean) => {
    t.hits = hit ? Math.min(2, t.hits + 1) : 0;
    return { ...result, qualifying: true, hit, targetAfter: t.target, hitsAfter: t.hits };
  };

  switch (rule) {
    case 'double':
    case 'hold':
    case 'load': {
      const range = workRange(step.dose);
      if (!range || !isComplete(work, ref.sets, sided)) return result;
      const sets = firstSets(work, ref.sets, sided);
      const values = sets.map((s) => (range.unit === 'sec' ? s.seconds : s.reps) ?? 0);
      const hit = values.every((v) => v >= range.max) && sets.every((s) => s.rir >= 2);
      const up = values.every((v) => v >= t.target) && sets.every((s) => s.rir >= ref.rirPlan);
      if (up) t.target = Math.min(range.max, t.target + (range.unit === 'sec' ? 5 : 1));
      return done(hit);
    }
    case 'power': {
      const range = workRange(step.dose);
      if (!range || !outcome || !('quality' in outcome) || !isComplete(work, ref.sets, sided)) {
        return result;
      }
      const sets = firstSets(work, ref.sets, sided);
      const values = sets.map((s) => s.reps ?? 0);
      if (!outcome.quality) return done(false);
      if (values.every((v) => v >= t.target)) t.target = Math.min(range.max, t.target + 1);
      return done(values.every((v) => v >= range.max));
    }
    case 'emom': {
      if (!outcome || !('rest20' in outcome)) return result;
      const hit = outcome.clean && outcome.rest20;
      if (session.kind === 'A') state.emom.pendingUp = hit;
      return { ...result, qualifying: true, hit };
    }
    case 'rounds': {
      if (!outcome || !('clean' in outcome) || 'rest20' in outcome) return result;
      if (step.dose.kind !== 'rounds') return result;
      // W3: the rounds (the block's target) follow the week's sets; only a clean session with
      // all rounds is a hit.
      const ranged = step.dose.rounds[0] !== step.dose.rounds[1];
      return done(outcome.clean && (!ranged || ref.target >= step.dose.rounds[1]));
    }
    case 'neck': {
      if (!outcome || !('feel' in outcome)) return result;
      return done(outcome.feel === 'easy');
    }
    default:
      return result;
  }
}

function applyStepChange(program: Program, state: State, e: EventOf<'step_changed'>): void {
  const t = state.tracks[e.trackId];
  if (!t) return;
  switch (e.reason) {
    case 'pain': {
      const extension = t.tempDown !== undefined && e.from === e.to;
      if (extension && t.tempDown) {
        t.tempDown.until = e.until ?? t.tempDown.until;
        t.tempDown.physio = true;
      } else {
        t.tempDown = {
          originalStepId: t.tempDown?.originalStepId ?? e.from,
          until: e.until ?? e.date,
          sharpSince: e.date,
          lighter: e.from === e.to,
          physio: t.tempDown !== undefined,
        };
      }
      break;
    }
    case 'restore':
      t.tempDown = undefined;
      break;
    case 'user_choice':
      t.tempDown = undefined;
      if (
        getTrack(program, e.trackId).steps.findIndex((s) => s.id === e.to) >
        getTrack(program, e.trackId).steps.findIndex((s) => s.id === e.from)
      ) {
        t.warnedUp = true;
      }
      break;
    case 'absence':
      t.tempDown = undefined;
      if (!state.absenceApplied.includes(e.date)) state.absenceApplied.push(e.date);
      break;
    case 'progression':
      break;
  }
  t.stepId = e.to;
  t.target = minTarget(program, e.to);
  t.hits = 0;
  if (e.trackId === 'burpee_emom') {
    state.emom.stepId = e.to;
    // A step-up uses the pending step-up; any other change (absence, pain, own choice) drops it,
    // just as it sets hits to 0 on the other tracks (S-EMOM-06).
    state.emom.pendingUp = false;
    if (e.reason === 'progression' && e.week) state.emom.lastStepUpWeek = e.week;
  }
  if (e.trackId === 'burpee_skill') state.burpeeVariant = e.to;
  state.decisions.push({
    date: e.date,
    at: e.at,
    trackId: e.trackId,
    from: e.from,
    to: e.to,
    by: e.by,
    reason: e.reason,
    explanation: e.explanation,
  });
  if (e.sessionId) {
    state.sessions
      .find((s) => s.sessionId === e.sessionId)
      ?.decisions.push({ trackId: e.trackId, explanation: e.explanation });
  }
}

/** The step from which »Næste variant« is allowed (R-VARIANT: E6). */
const VARIANT_FROM = 'burpee_emom.E6';

/**
 * R-VARIANT: going back is always allowed; the next variant only one at a time and only from
 * EMOM E6 (S-VARIANT-01).
 */
export function variantAllowed(program: Program, state: State, stepId: string): boolean {
  const current = stepIndex(program, state.burpeeVariant);
  const wanted = stepIndex(program, stepId);
  if (wanted < 0) return false;
  if (wanted <= current) return true;
  return (
    wanted === current + 1 &&
    stepIndex(program, state.emom.stepId) >= stepIndex(program, VARIANT_FROM)
  );
}

/** Step ids from an older programme version are mapped to the current one (S-DATA-05). */
function normalize(program: Program, e: AppEvent): AppEvent {
  const map = (id: string) => (findStep(program, id) ? id : currentStepId(program, id));
  switch (e.type) {
    case 'step_set':
    case 'set_logged':
    case 'block_result':
    case 'variant_set':
      return findStep(program, e.stepId) ? e : { ...e, stepId: map(e.stepId) };
    case 'step_changed':
      return findStep(program, e.from) && findStep(program, e.to)
        ? e
        : { ...e, from: map(e.from), to: map(e.to) };
    case 'session_started':
      return e.blocks.every((b) => findStep(program, b.stepId))
        ? e
        : { ...e, blocks: e.blocks.map((b) => ({ ...b, stepId: map(b.stepId) })) };
    default:
      return e;
  }
}

/** One event applied to the state (mutates `state`). */
function apply(program: Program, state: State, raw: AppEvent, emomHistory: EmomPoint[]): void {
  const e = normalize(program, raw);
  switch (e.type) {
    case 'onboarding_completed':
      state.onboarded = true;
      state.onboardedOn = e.date;
      state.startDate = mondayOf(e.startDate);
      state.declaredWeeks = e.completedWeeks.map(mondayOf);
      break;
    case 'step_set': {
      const t = state.tracks[e.trackId];
      if (!t || !getTrack(program, e.trackId).steps.some((s) => s.id === e.stepId)) break;
      t.stepId = e.stepId;
      t.target = e.target ?? minTarget(program, e.stepId);
      t.hits = 0;
      t.tempDown = undefined;
      if (e.load !== undefined) t.load = e.load;
      if (e.trackId === 'burpee_emom') {
        state.emom.stepId = e.stepId;
        state.emom.stepAtRoundStart = e.stepId;
        emomHistory.push({ date: e.date, stepId: e.stepId });
      }
      if (e.trackId === 'burpee_skill') state.burpeeVariant = e.stepId;
      break;
    }
    case 'session_started':
      // A session started again with the same id (resumed after closing the app) keeps its sets.
      if (state.sessions.some((s) => s.sessionId === e.sessionId)) break;
      state.sessions.push({
        sessionId: e.sessionId,
        kind: e.kind,
        date: e.date,
        light: e.light,
        answers: e.answers,
        pw: e.programWeek,
        round: e.round,
        blocks: e.blocks,
        sets: [],
        results: [],
        completed: false,
        calmBase: e.calmBase,
        boss: e.boss,
        evaluations: {},
        decisions: [],
      });
      break;
    case 'set_logged': {
      const s = state.sessions.find((x) => x.sessionId === e.sessionId);
      if (!s || s.completed) break;
      s.sets.push({
        blockId: e.blockId,
        trackId: e.trackId,
        stepId: e.stepId,
        setIndex: e.setIndex,
        side: e.side,
        reps: e.reps,
        seconds: e.seconds,
        rir: e.rir,
        pain: e.pain,
        asPlanned: e.asPlanned,
        measureId: e.measureId,
      });
      break;
    }
    case 'block_result': {
      const s = state.sessions.find((x) => x.sessionId === e.sessionId);
      if (!s || s.completed) break;
      s.results = s.results.filter((r) => r.blockId !== e.blockId);
      s.results.push({
        blockId: e.blockId,
        trackId: e.trackId,
        stepId: e.stepId,
        result: e.result,
      });
      break;
    }
    case 'session_completed': {
      const s = state.sessions.find((x) => x.sessionId === e.sessionId);
      if (!s || s.completed) break;
      s.completed = true;
      s.status = e.status;
      s.aborted = e.aborted;
      s.done = e.done;
      for (const ref of s.blocks) {
        if (!state.tracks[ref.trackId]) continue;
        s.evaluations[ref.blockId] = evaluateBlock(program, state, s, ref);
        const sets = s.sets.filter((x) => x.blockId === ref.blockId && x.measureId === undefined);
        const t = state.tracks[ref.trackId];
        if (t && sets.length > 0) t.last = { date: s.date, stepId: ref.stepId, sets };
      }
      break;
    }
    case 'step_changed':
      applyStepChange(program, state, e);
      if (e.trackId === 'burpee_emom') emomHistory.push({ date: e.date, stepId: e.to });
      break;
    case 'load_changed': {
      const t = state.tracks[e.trackId];
      if (!t) break;
      t.load = e.to;
      if (e.by === 'engine') {
        t.target = minTarget(program, t.stepId);
        t.hits = 0;
        state.decisions.push({
          date: e.date,
          at: e.at,
          trackId: e.trackId,
          from: t.stepId,
          to: t.stepId,
          by: e.by,
          reason: 'load',
          explanation: e.explanation,
        });
        if (e.sessionId) {
          state.sessions
            .find((s) => s.sessionId === e.sessionId)
            ?.decisions.push({ trackId: e.trackId, explanation: e.explanation });
        }
      }
      break;
    }
    case 'session_skipped':
      state.skipped.push({ kind: e.kind, forDate: e.forDate, reason: e.reason });
      break;
    case 'session_moved':
      state.moves.push({
        kind: e.kind,
        fromDate: e.fromDate,
        toDate: e.toDate,
        short: e.short,
        on: e.date,
      });
      break;
    case 'measurement_logged':
      state.measurements.push({
        date: e.date,
        measureId: e.measureId,
        value: e.value,
        pw: e.programWeek,
        round: e.round,
      });
      break;
    case 'club_logged':
      state.club.push({
        date: e.date,
        attended: e.attended,
        hardness: e.hardness,
        freshness: e.freshness,
        technique: e.technique,
        content: e.content,
        at: e.at,
      });
      break;
    case 'sunday_check': {
      // A new check for the same week replaces the earlier one, and the tracks the week's checks
      // named add up, so none is taken down twice (R-PAIN-SUNDAY, S-PAIN-08, S-PAIN-10).
      const before = state.sundayChecks.find((c) => c.weekStart === e.weekStart);
      const taken = [
        ...new Set([...(before?.taken ?? []), ...(e.painTracks ?? []), ...(e.tooHeavy ?? [])]),
      ];
      // »For tungt« only where it worked: not on a track the same check named under pain (S-PAIN-12).
      const heavy = (e.tooHeavy ?? []).filter((id) => !(e.painTracks ?? []).includes(id));
      const takenHeavy = [...new Set([...(before?.takenHeavy ?? []), ...heavy])];
      state.sundayChecks = state.sundayChecks.filter((c) => c.weekStart !== e.weekStart);
      state.sundayChecks.push({
        date: e.date,
        weekStart: e.weekStart,
        painTracks: e.painTracks ?? [],
        tooHeavy: e.tooHeavy ?? [],
        sleepAvg: e.sleepAvg,
        taken,
        takenHeavy,
      });
      break;
    }
    case 'status_set': {
      // A status_set with the same status and from as an earlier one replaces it in its place, so
      // which of two overlapping statuses applies (the newest) stays as it was on the days that
      // are over; a `to` before `from` removes it (»Afslut« and »Fjern«, ENGINE 3.1, S-WEEK-13).
      const range = { status: e.status, from: e.from, to: e.to };
      const index = state.statuses.findIndex((s) => s.status === e.status && s.from === e.from);
      if (index < 0) {
        if (e.to >= e.from) state.statuses.push(range);
      } else if (e.to < e.from) {
        state.statuses.splice(index, 1);
      } else {
        state.statuses[index] = range;
      }
      break;
    }
    case 'calendar_event_added':
      state.events.push({ label: e.label, eventDate: e.eventDate });
      break;
    case 'schedule_changed':
      state.schedule = { clubDays: [...e.clubDays].sort((a, b) => a - b), clinch: e.clinch };
      break;
    case 'overlay_choice':
      state.overlayChoices[e.overlayId] = e.choice;
      break;
    case 'os_done': {
      const monday = mondayOf(e.date);
      state.osByWeek[monday] = (state.osByWeek[monday] ?? 0) + 1;
      break;
    }
    case 'turbo_chosen':
      state.turbo.exerciseId = e.exerciseId;
      break;
    case 'turbo_logged':
      state.turbo.log[e.date] = Math.max(0, Math.min(5, e.sets));
      break;
    case 'side_branch_set':
      state.sideBranch = e.branchId;
      break;
    case 'variant_set':
      if (variantAllowed(program, state, e.stepId)) state.burpeeVariant = e.stepId;
      break;
    case 'hero_checked':
      state.heroes[e.heroId] = e.checked;
      break;
    case 'boss_logged':
      state.bossLog.push({ date: e.date, bossId: e.bossId, result: e.result, level: e.level });
      break;
    case 'backup_exported':
      state.lastBackup = e.date;
      break;
  }
}

interface EmomPoint {
  date: ISODate;
  stepId: string;
}

/** Replays the whole log. Deterministic: the same log and date always give the same state. */
export function deriveState(program: Program, events: readonly AppEvent[], today: ISODate): State {
  const state = emptyState(program, today);
  const emomHistory: EmomPoint[] = [];
  for (const e of events) apply(program, state, e, emomHistory);
  state.neckStops = state.sessions.reduce(
    (n, s) => n + (s.sets.some((x) => x.trackId === 'neck' && x.pain === 'stop') ? 1 : 0),
    0,
  );

  state.weeks = computeWeeks(program, state);
  const todayK = calendarWeek(state.startDate, today);
  const current = state.weeks[Math.max(0, Math.min(todayK, state.weeks.length - 1))];
  state.round = todayK < 0 ? 1 : (current?.round ?? 1);
  // R-ROUND2: the EMOM step when the current round began sets the floor of its EMOM caps.
  if (state.round > 1 && current) {
    const firstOfRound = state.weeks.find((w) => w.round === state.round);
    const startedOn = firstOfRound?.monday ?? current.monday;
    let step = state.emom.stepAtRoundStart;
    for (const point of emomHistory) if (point.date < startedOn) step = point.stepId;
    state.emom.stepAtRoundStart = step;
  }
  state.completedOsWeeks = Object.values(state.osByWeek).filter((n) => n >= 5).length;
  return state;
}
