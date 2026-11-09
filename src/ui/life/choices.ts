// What the Sunday check offers (docs/SPEC.md 4.7, DECISIONS.md D63): the exercises under pain, the
// ladders for »For tungt?«, the list »Klar til næste trin«, the week's light pain, »Film dig selv«
// and the hours of sleep. Only the Sunday check's screen uses it, so it is fetched with that screen.
import {
  addDays,
  calendarWeek,
  formatDay,
  getSession,
  getStep,
  getTrack,
  mondayOf,
  stepIndex,
  submitSundayCheck,
  weekdayName,
  weekday,
} from '../../engine/index.ts';
import type { AppEvent, EventFactory, ISODate, Program, State } from '../../engine/types.ts';
import { distanceText } from '../screens/Ladders.tsx';

/** The hours of sleep: a number (»7«, »6,5«), null when empty, 'invalid' when not a number of hours. */
export function parseSleep(text: string): number | null | 'invalid' {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  if (!/^\d{1,2}(\.\d+)?$/.test(clean)) return 'invalid';
  const hours = Math.round(Number(clean) * 10) / 10;
  return hours > 0 && hours <= 14 ? hours : 'invalid';
}

export interface ChoiceGroup {
  title: string;
  trackIds: string[];
}

/** The exercises of Styrke A and B, each once, in the sessions' order: the choices under pain. */
export function painChoices(program: Program): ChoiceGroup[] {
  const seen = new Set<string>();
  return (['A', 'B'] as const).map((kind) => {
    const session = getSession(program, kind);
    const trackIds: string[] = [];
    for (const block of session.blocks) {
      const id = block.trackId;
      // The warm-up is a routine, not a track: it has no step to go down.
      if (seen.has(id) || !program.tracks.some((t) => t.id === id)) continue;
      seen.add(id);
      trackIds.push(id);
    }
    return { title: session.name, trackIds };
  });
}

/** The ladders and power tracks of Stiger (docs/SPEC.md 3.5), in the programme's order. */
function ladderTracks(program: Program): string[] {
  return program.tracks
    .filter((t) => t.category === 'ladder' || t.category === 'power')
    .map((t) => t.id);
}

/**
 * The step »For tungt?« is about: your step, or in a pain period the step before the pain, which
 * the period would bring back (»Ben · trin 3« while Ben stands on trin 2, D65).
 */
export function heavyStep(state: State, trackId: string): string | null {
  const t = state.tracks[trackId];
  if (!t) return null;
  return t.tempDown && !t.tempDown.lighter ? t.tempDown.originalStepId : t.stepId;
}

/**
 * »For tungt?«: the ladders and power tracks with a step below the step it is about, and the ones
 * `keep` names (a saved check's choices, shown again when it is corrected).
 */
export function heavyChoices(program: Program, state: State, keep: readonly string[]): string[] {
  return ladderTracks(program).filter((id) => {
    const step = heavyStep(state, id);
    return keep.includes(id) || (step !== null && stepIndex(program, step) > 0);
  });
}

/** »Ben · trin 3«: the ladder and the step »For tungt?« is about. */
export function heavyLabel(program: Program, state: State, trackId: string): string {
  const step = heavyStep(state, trackId);
  const key = step ? getStep(program, step).key : '';
  return `${getTrack(program, trackId).short} · trin ${key}`;
}

/** Events made only to read what saving would do; never written. */
const preview: EventFactory = (body, date) => ({ ...body, id: 'preview', at: '', date, v: 1 });

/**
 * What saving the check does, one line per chosen track, read from the engine's own events
 * (submitSundayCheck), so the screen never promises a step change that does not happen (D65): »Ben
 * går fra trin 3 til trin 2 – dit eget valg.«, »Lyske får en lettere variant til 22. november.«,
 * »Ben bliver på trin 2 og kommer ikke tilbage til trin 3 – dit eget valg.«, or that a track is
 * down already from an earlier check of the week, or follows the pain.
 */
export function checkEffects(
  program: Program,
  events: readonly AppEvent[],
  state: State,
  input: { date: ISODate; painTracks: string[]; tooHeavy: string[] },
): Map<string, string> {
  const ctx = { program, make: preview };
  const written = submitSundayCheck(ctx, events, { ...input, sleepAvg: undefined });
  const taken = state.sundayChecks.find((c) => c.weekStart === mondayOf(input.date))?.taken ?? [];
  const out = new Map<string, string>();
  for (const id of [...input.painTracks, ...input.tooHeavy]) {
    if (out.has(id)) continue;
    const short = getTrack(program, id).short;
    const e = written.find((x) => x.type === 'step_changed' && x.trackId === id);
    const t = state.tracks[id];
    if (e && e.type === 'step_changed') {
      const from = getStep(program, e.from).key;
      const to = getStep(program, e.to).key;
      if (e.reason === 'pain') {
        const until = e.until ? formatDay(e.until) : '';
        out.set(
          id,
          e.from !== e.to
            ? `${short} går fra trin ${from} til trin ${to} til ${until}.`
            : t?.tempDown
              ? `${short} bliver på trin ${to} en uge mere (til ${until}).`
              : `${short} får en lettere variant til ${until}.`,
        );
      } else if (e.from !== e.to) {
        out.set(id, `${short} går fra trin ${from} til trin ${to} – dit eget valg.`);
      } else {
        const before = t?.tempDown ? getStep(program, t.tempDown.originalStepId).key : from;
        out.set(
          id,
          `${short} bliver på trin ${to} og kommer ikke tilbage til trin ${before} – dit eget valg.`,
        );
      }
    } else if (input.painTracks.includes(id) && input.tooHeavy.includes(id)) {
      out.set(id, `${short} følger smertereglen.`);
    } else if (taken.includes(id)) {
      out.set(id, `${short} står allerede nede fra søndagstjekket.`);
    } else {
      out.set(id, `${short}: intet trin at gå ned til.`);
    }
  }
  return out;
}

export interface ReadyLadder {
  trackId: string;
  /** »nu trin 2, rykket op fredag« or the distance as in Stiger (»1 pas mere med …«). */
  text: string;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * »Klar til næste trin« for the week from `weekStart`: the ladders and power tracks the engine
 * moved up in the week, the ones one session short of it, and the EMOM about to move up.
 */
export function readyLadders(program: Program, state: State, weekStart: ISODate): ReadyLadder[] {
  const sunday = addDays(weekStart, 6);
  const out: ReadyLadder[] = [];
  for (const id of ladderTracks(program)) {
    const t = state.tracks[id];
    if (!t) continue;
    const track = getTrack(program, id);
    const up = [...state.decisions]
      .reverse()
      .find(
        (d) =>
          d.trackId === id && d.reason === 'progression' && d.date >= weekStart && d.date <= sunday,
      );
    if (up && up.to === t.stepId) {
      const key = getStep(program, t.stepId).key;
      out.push({ trackId: id, text: `nu trin ${key}, rykket op ${weekdayName(weekday(up.date))}` });
      continue;
    }
    if (t.tempDown) continue;
    const emom = id === 'burpee_emom';
    if ((emom && state.emom.pendingUp) || (!emom && t.hits === 1)) {
      const text = distanceText(track, t, state.emom.pendingUp);
      if (text && text !== 'Toptrin') out.push({ trackId: id, text: lowerFirst(text) });
    }
  }
  return out;
}

export interface LightPain {
  trackId: string;
  date: ISODate;
}

/** The week's light pain (R-PAIN-LIGHT: »synlig i søndagstjekket«), one per track and day. */
export function lightPains(state: State, weekStart: ISODate): LightPain[] {
  const sunday = addDays(weekStart, 6);
  const out: LightPain[] = [];
  for (const s of state.sessions) {
    if (s.date < weekStart || s.date > sunday) continue;
    for (const set of s.sets) {
      if (set.pain !== 'light') continue;
      if (out.some((p) => p.trackId === set.trackId && p.date === s.date)) continue;
      out.push({ trackId: set.trackId, date: s.date });
    }
  }
  return out;
}

/** »Film dig selv« every other week (P23): in the even calendar weeks from the programme's start. */
export function filmWeek(state: State, sunday: ISODate): boolean {
  return calendarWeek(state.startDate, sunday) % 2 === 0;
}
