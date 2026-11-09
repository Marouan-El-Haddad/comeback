// What the Sunday check offers (docs/SPEC.md 4.7, DECISIONS.md D63): the exercises under pain, the
// ladders for »For tungt?«, the list »Klar til næste trin«, the week's light pain, »Film dig selv«
// and the hours of sleep. Only the Sunday check's screen uses it, so it is fetched with that screen.
import {
  addDays,
  calendarWeek,
  getSession,
  getStep,
  getTrack,
  stepIndex,
  weekdayName,
  weekday,
} from '../../engine/index.ts';
import type { ISODate, Program, State } from '../../engine/types.ts';
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
 * »For tungt?«: the ladders and power tracks with a step below your step, and the ones `keep`
 * names (a saved check's choices, shown again when it is corrected).
 */
export function heavyChoices(program: Program, state: State, keep: readonly string[]): string[] {
  return ladderTracks(program).filter((id) => {
    const t = state.tracks[id];
    return keep.includes(id) || (t !== undefined && stepIndex(program, t.stepId) > 0);
  });
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
