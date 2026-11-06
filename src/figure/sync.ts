// The figure in a session follows the session's clock where there is one (docs/SPEC.md 3.2,
// DECISIONS.md D52); elsewhere it runs in the exercise's own tempo, as on the card. The clock is a
// list of parts – »Klar«, the hold, a minute of the EMOM, a part of a round, a pause between the
// neck's holds, an Open & Strong item – and the figure gets the time into its movement from the part
// that runs and how far it has come:
//
// - hold: the "dose" phase is the hold. What comes before it plays at the end of the part before the
//   hold (»Klar«), what comes after it in the part after it (the neck's pause), and in between the
//   figure stands in its first position without a phase.
// - emom: each minute starts the minute's repetitions in the tempo; the rest of the minute the figure
//   stands still.
// - rounds: the phases are shared out over the parts of a round in order, so that each part shows the
//   phases closest to its time; within a part they are stretched to fit it, a "dose" phase takes up
//   what is left, and a part without a time (»Videre«) runs in the tempo.
// - routine: the "dose" phases share the item's time; without them the movement repeats.
//
// Pure functions without the DOM; the figure's timeline is the one the card animates (motion.ts).
import type { OwnMovement, Phase } from '../content/types.ts';
import { CARD_TIMING, timeline } from './motion.ts';

export type PartKind = 'ready' | 'work' | 'rest';

/** A stretch of the session's clock for the exercise in hand. */
export interface ClockPart {
  kind: PartKind;
  /** Seconds; 0 = it waits for a tap (»Videre«). */
  seconds: number;
}

export type SyncMode =
  | { kind: 'hold' }
  | { kind: 'emom'; reps: number }
  | { kind: 'rounds'; perRound: number }
  | { kind: 'routine' };

export interface FigureSync {
  /** The movement with every "dose" made a number of seconds: the figure's model is built from it. */
  movement: OwnMovement;
  /**
   * Seconds into `movement` when the clock's part `index` has run `elapsed` seconds; null = the
   * first position without a phase (before the work starts, or in a pause).
   */
  at(index: number, elapsed: number): number | null;
}

/** A little before the end: the figure stays on the last frame instead of starting over. */
const END = 1e-3;
/** The shortest a phase can be, as in the data (docs/SPEC.md 9.1). */
const MIN_PHASE = 0.2;

function isDose(phase: Phase): boolean {
  return phase.seconds === 'dose' || phase.repeat === 'dose';
}

/** How long a phase takes when it has no "dose", or its least time when it has. */
function fixedSeconds(phase: Phase): number {
  if (phase.seconds === 'dose') return 0;
  if (phase.repeat === 'dose') return phase.seconds;
  return phase.seconds * (phase.repeat ?? 1);
}

/**
 * The movement with its "dose" phases given times: the k-th "dose" phase lasts `spans[k]` seconds
 * (the last span for any beyond). A repeated phase ("repeat": "dose") goes out and back as many
 * times as fit in its span. Without spans the phases get the card's times (docs/SPEC.md 9.1).
 */
export function resolveDoses(movement: OwnMovement, spans: readonly number[]): OwnMovement {
  let k = 0;
  const phases = movement.phases.map((phase): Phase => {
    if (!isDose(phase)) return phase;
    if (spans.length === 0) {
      if (phase.repeat === 'dose')
        return {
          ...phase,
          seconds: phase.seconds === 'dose' ? CARD_TIMING.dose : phase.seconds,
          repeat: CARD_TIMING.doseRepeats,
        };
      return { ...phase, seconds: CARD_TIMING.dose };
    }
    const span = Math.max(MIN_PHASE, spans[Math.min(k, spans.length - 1)] ?? CARD_TIMING.dose);
    k += 1;
    if (phase.repeat === 'dose') {
      const once = phase.seconds === 'dose' ? span : phase.seconds;
      return { ...phase, seconds: once, repeat: Math.max(1, Math.round(span / once)) };
    }
    if (typeof phase.repeat === 'number') {
      return { ...phase, seconds: Math.max(MIN_PHASE, span / phase.repeat) };
    }
    return { ...phase, seconds: span };
  });
  return { ...movement, phases };
}

/**
 * The position a still image shows: the one the movement spends longest in – the hold, or the
 * bottom of a push-up – so a row of stills shows each exercise at its most typical.
 */
export function keyPosition(movement: OwnMovement): string {
  let best = movement.positions[0]?.id ?? '';
  let longest = -1;
  for (const phase of movement.phases) {
    const seconds = isDose(phase) ? Number.POSITIVE_INFINITY : fixedSeconds(phase);
    if (seconds > longest) {
      longest = seconds;
      best = phase.to;
    }
  }
  return best;
}

/** When the phases end in the timeline, without the way back to the start. */
function phasesEnd(movement: OwnMovement): number {
  const last = timeline(movement).phases.at(-1);
  return last ? last.start + last.seconds : 0;
}

function holdSync(movement: OwnMovement, parts: readonly ClockPart[]): FigureSync {
  const hold = parts.find((p) => p.kind === 'work')?.seconds ?? 0;
  const doses = movement.phases.flatMap((p, i) => (isDose(p) ? [i] : []));
  const first = doses[0];
  const last = doses.at(-1);
  if (first === undefined || last === undefined || hold <= 0) {
    // No hold in the figure: it runs in its tempo while the hold lasts.
    const resolved = resolveDoses(movement, []);
    const total = timeline(resolved).total;
    return {
      movement: resolved,
      at: (index, elapsed) => (parts[index]?.kind === 'work' && total > 0 ? elapsed % total : null),
    };
  }
  // The phases between the first and the last "dose" phase fill the hold.
  const between = movement.phases
    .slice(first + 1, last)
    .reduce((sum, p) => sum + (isDose(p) ? 0 : fixedSeconds(p)), 0);
  const share = (hold - between) / doses.length;
  const resolved = resolveDoses(
    movement,
    doses.map(() => share),
  );
  const line = timeline(resolved);
  const lead = line.phases[first]?.start ?? 0;
  const lastPhase = line.phases[last];
  const end = lastPhase ? lastPhase.start + lastPhase.seconds : lead;
  return {
    movement: resolved,
    at(index, elapsed) {
      const part = parts[index];
      if (!part) return null;
      if (part.kind === 'work') return lead + Math.min(elapsed, hold) * ((end - lead) / hold);
      const remaining = part.seconds - elapsed;
      if (parts[index + 1]?.kind === 'work' && remaining <= lead) return lead - remaining;
      if (parts[index - 1]?.kind === 'work') {
        const t = end + elapsed;
        return t < line.total ? t : null;
      }
      return null;
    },
  };
}

function emomSync(movement: OwnMovement, parts: readonly ClockPart[], reps: number): FigureSync {
  const resolved = resolveDoses(movement, []);
  const one = timeline(resolved).total;
  return {
    movement: resolved,
    at(index, elapsed) {
      if (parts[index]?.kind !== 'work' || one <= 0) return null;
      return elapsed < reps * one ? elapsed % one : null;
    },
  };
}

function routineSync(movement: OwnMovement, parts: readonly ClockPart[]): FigureSync {
  const item = parts.find((p) => p.kind === 'work')?.seconds ?? 0;
  const doses = movement.phases.filter(isDose).length;
  if (doses === 0 || item <= 0) {
    const resolved = resolveDoses(movement, []);
    const total = timeline(resolved).total;
    return {
      movement: resolved,
      at: (index, elapsed) => (parts[index]?.kind === 'work' && total > 0 ? elapsed % total : null),
    };
  }
  const fixed = movement.phases.reduce((sum, p) => sum + (isDose(p) ? 0 : fixedSeconds(p)), 0);
  const share = (item - fixed) / doses;
  const resolved = resolveDoses(
    movement,
    movement.phases.filter(isDose).map(() => share),
  );
  const end = phasesEnd(resolved);
  return {
    movement: resolved,
    at(index, elapsed) {
      if (parts[index]?.kind !== 'work') return null;
      return Math.min(elapsed * (end / item), end - END);
    },
  };
}

/** A little weight for the order within a part: the shift into a hold belongs before it. */
const EPS = 0.01;

/** What it costs to give the phases [from, to) to a part of `seconds` (0 = no time). */
function groupCost(phases: readonly Phase[], from: number, to: number, seconds: number): number {
  if (seconds <= 0) return to > from ? 0 : 1;
  if (to <= from) return seconds * seconds;
  const group = phases.slice(from, to);
  const least = group.reduce((sum, p) => sum + fixedSeconds(p), 0);
  const firstDose = group.findIndex(isDose);
  if (firstDose < 0) return (least - seconds) ** 2;
  if (least > seconds) return (least - seconds) ** 2;
  const lastDose = group.length - 1 - [...group].reverse().findIndex(isDose);
  const before = group.slice(0, firstDose).reduce((sum, p) => sum + fixedSeconds(p), 0);
  const after = group.slice(lastDose + 1).reduce((sum, p) => sum + fixedSeconds(p), 0);
  return EPS * before + 2 * EPS * after;
}

/** The phases shared out over the parts of one round: the first phase of each group, and the end. */
function shareOut(phases: readonly Phase[], round: readonly number[]): number[] {
  const n = round.length;
  const m = phases.length;
  // cost[k][j]: the least cost of giving phases [0, j) to the first k parts.
  const cost: number[][] = Array.from({ length: n + 1 }, () =>
    Array<number>(m + 1).fill(Number.POSITIVE_INFINITY),
  );
  const from: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  (cost[0] as number[])[0] = 0;
  for (let k = 1; k <= n; k++) {
    for (let j = 0; j <= m; j++) {
      for (let i = 0; i <= j; i++) {
        const c = (cost[k - 1]?.[i] ?? Infinity) + groupCost(phases, i, j, round[k - 1] ?? 0);
        if (c < (cost[k]?.[j] ?? Infinity)) {
          (cost[k] as number[])[j] = c;
          (from[k] as number[])[j] = i;
        }
      }
    }
  }
  // Phases after the last part would never be seen: they cost their time.
  let best = m;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let j = 0; j <= m; j++) {
    const tail = phases.slice(j).reduce((sum, p) => sum + fixedSeconds(p) + (isDose(p) ? 1 : 0), 0);
    const c = (cost[n]?.[j] ?? Infinity) + tail * tail;
    if (c < bestCost) {
      bestCost = c;
      best = j;
    }
  }
  const starts: number[] = [];
  let j = best;
  for (let k = n; k >= 1; k--) {
    const i = from[k]?.[j] ?? 0;
    starts.unshift(i);
    j = i;
  }
  return [...starts, best];
}

function roundsSync(
  movement: OwnMovement,
  parts: readonly ClockPart[],
  perRound: number,
): FigureSync {
  const firstWork = parts.findIndex((p) => p.kind === 'work');
  const round = parts.slice(firstWork, firstWork + perRound).map((p) => p.seconds);
  const bounds = shareOut(movement.phases, round);
  // Each part's "dose" phases share what its other phases leave of its time.
  const spans: number[] = [];
  round.forEach((seconds, k) => {
    const group = movement.phases.slice(bounds[k], bounds[k + 1]);
    const doses = group.filter(isDose).length;
    if (doses === 0) return;
    const fixed = group.reduce((sum, p) => sum + (isDose(p) ? 0 : fixedSeconds(p)), 0);
    const share = seconds > 0 ? (seconds - fixed) / doses : 2;
    for (let d = 0; d < doses; d++) spans.push(share);
  });
  const resolved = resolveDoses(movement, spans);
  const line = timeline(resolved);
  const groups = round.map((seconds, k) => {
    const start = line.phases[bounds[k] ?? 0]?.start ?? 0;
    const lastIndex = (bounds[k + 1] ?? 0) - 1;
    const last = line.phases[lastIndex];
    const end = lastIndex >= (bounds[k] ?? 0) && last ? last.start + last.seconds : start;
    return { start, length: end - start, seconds };
  });
  return {
    movement: resolved,
    at(index, elapsed) {
      if (parts[index]?.kind !== 'work' || index < firstWork) return null;
      const group = groups[(index - firstWork) % perRound];
      if (!group) return null;
      if (group.length <= 0) return group.start > 0 ? group.start - END : null;
      const into =
        group.seconds > 0
          ? Math.min(elapsed, group.seconds) * (group.length / group.seconds)
          : Math.min(elapsed, group.length);
      return group.start + Math.min(into, group.length - END);
    },
  };
}

/**
 * How the figure of `movement` follows the session's clock `parts` (docs/SPEC.md 3.2): the movement
 * with its "dose" phases timed and the figure's time for any moment of the clock.
 */
export function syncFigure(
  movement: OwnMovement,
  parts: readonly ClockPart[],
  mode: SyncMode,
): FigureSync | null {
  if (movement.positions.length === 0 || movement.phases.length === 0) return null;
  switch (mode.kind) {
    case 'hold':
      return holdSync(movement, parts);
    case 'emom':
      return emomSync(movement, parts, mode.reps);
    case 'rounds':
      return roundsSync(movement, parts, Math.max(1, mode.perRound));
    case 'routine':
      return routineSync(movement, parts);
  }
}
