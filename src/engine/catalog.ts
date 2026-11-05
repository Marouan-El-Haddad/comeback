// Requirements (impress catalogue, Hero board, side branches), Målbrættet's levels, Turbo and the
// Open & Strong cue (docs/ENGINE.md 5.6 and 5.12).
import { getStep, perSide, stepIndex, trackIdOf } from './lookup.ts';
import type { ISODate, Level, Program, Requirement, Requires, State } from './types.ts';

function logged(
  program: Program,
  state: State,
  stepId: string,
  sets: number,
  value: number,
  unit: 'reps' | 'sec',
) {
  const sided = perSide(getStep(program, stepId).dose);
  return state.sessions.some((s) => {
    const work = s.sets.filter(
      (x) =>
        x.stepId === stepId &&
        x.measureId === undefined &&
        ((unit === 'sec' ? x.seconds : x.reps) ?? 0) >= value,
    );
    if (!sided) return work.length >= sets;
    return (
      work.filter((x) => x.side === 'L').length >= sets &&
      work.filter((x) => x.side === 'R').length >= sets
    );
  });
}

function beyond(program: Program, state: State, stepId: string): boolean {
  const current = state.tracks[trackIdOf(stepId)]?.stepId;
  return current !== undefined && stepIndex(program, current) > stepIndex(program, stepId);
}

function bestMeasure(state: State, measureId: string): number | null {
  const values = state.measurements.filter((m) => m.measureId === measureId).map((m) => m.value);
  return values.length > 0 ? Math.max(...values) : null;
}

/** Whether the log and the current steps meet a requirement. */
export function requirementMet(program: Program, state: State, requires: Requires): boolean {
  switch (requires.type) {
    case 'always':
      return true;
    case 'step': {
      const current =
        requires.trackId === 'burpee_skill'
          ? state.burpeeVariant
          : state.tracks[requires.trackId]?.stepId;
      return (
        current !== undefined && stepIndex(program, current) >= stepIndex(program, requires.minStep)
      );
    }
    case 'measure': {
      const best = bestMeasure(state, requires.measureId);
      return best !== null && best >= requires.min;
    }
    case 'performance': {
      if (beyond(program, state, requires.stepId)) return true;
      const unit = requires.seconds !== undefined ? 'sec' : 'reps';
      const value = requires.seconds ?? requires.reps ?? 0;
      return logged(program, state, requires.stepId, requires.sets, value, unit);
    }
    case 'clean':
      return state.sessions.some((s) =>
        s.results.some(
          (r) => r.stepId === requires.stepId && 'clean' in r.result && r.result.clean,
        ),
      );
  }
}

export interface Unlock {
  item: Requirement;
  unlocked: boolean;
}

export function impressStatus(program: Program, state: State): Unlock[] {
  return program.impress.map((item) => ({
    item,
    unlocked: requirementMet(program, state, item.requires),
  }));
}

export function sideBranchStatus(program: Program, state: State): Unlock[] {
  return program.sideBranches.map((item) => ({
    item,
    unlocked: requirementMet(program, state, item.requires),
  }));
}

/** R-HERO: `hint` when the log shows the goal is reached; `checked` is only the user's own tick. */
export function heroStatus(
  program: Program,
  state: State,
): Array<{ item: Requirement; hint: boolean; checked: boolean }> {
  return program.heroes.map((item) => ({
    item,
    hint: requirementMet(program, state, item.requires),
    checked: state.heroes[item.id] === true,
  }));
}

/** Målbrættet: the highest level a measured value reaches (wall test: lower is better). */
export function measureLevel(program: Program, measureId: string, value: number): Level | null {
  const levels = program.measures.find((m) => m.id === measureId)?.levels;
  if (!levels) return null;
  const reached = (threshold: number) =>
    levels.lowerIsBetter ? value <= threshold : value >= threshold;
  if (reached(levels.imponerende)) return 'imponerende';
  if (reached(levels.staerk)) return 'staerk';
  if (reached(levels.basis)) return 'basis';
  return null;
}

function hitOn(program: Program, state: State, stepId: string): boolean {
  if (beyond(program, state, stepId)) return true;
  return state.sessions.some((s) =>
    Object.values(s.evaluations).some((e) => e.stepId === stepId && e.hit),
  );
}

/** The legs row of Målbrættet: Split 3 × 12, Bulgarsk 3 × 12, 5 pistols (5.6). */
export function legsLevel(program: Program, state: State): Level | null {
  if (beyond(program, state, 'legs.6') || logged(program, state, 'legs.6', 1, 5, 'reps')) {
    return 'imponerende';
  }
  if (hitOn(program, state, 'legs.2')) return 'staerk';
  if (hitOn(program, state, 'legs.1')) return 'basis';
  return null;
}

/** R-TURBO: optional from programme week 5 (and in round 2). */
export function turboVisible(pw: number, round: number): boolean {
  return pw >= 5 || round >= 2;
}

/** S-OS-01: after four completed Open & Strong weeks the Y-lift cue changes. */
export function osCue(program: Program, state: State, itemKey: string): string {
  const item = program.routines.find((r) => r.id === 'os')?.items.find((i) => i.key === itemKey);
  if (!item) return '';
  return state.completedOsWeeks >= 4 && item.laterCue ? item.laterCue : item.execution;
}

/** Open & Strong done this calendar week (»denne uge: 5 af 7«). */
export function osThisWeek(state: State, monday: ISODate): number {
  return state.osByWeek[monday] ?? 0;
}
