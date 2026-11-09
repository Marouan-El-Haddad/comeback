// Typical mistakes as figures (docs/SPEC.md 3.8 and 9.1, DECISIONS.md D58): the right pose of a
// position beside the wrong one. The figure file says which mistake in the explanation, at which
// position, and how the wrong pose differs (`wrong`: the fields of the pose that change). A limb with
// `to` keeps its point, so a hip that hangs leaves the hands and feet where they stand. The check
// asks that the wrong pose differs visibly from the right one: some drawn point at least
// FAULT_VISIBLE units away. Pure functions without DOM.
import type { Fault, FigureItem, OwnMovement, Point, Pose, PoseChange } from '../content/types.ts';
import { drawnPoints } from './draw.ts';
import { distance, frameOf, solve, type Frame } from './geometry.ts';
import { faultFigure } from './views.ts';

/** A wrong pose differs from the right one by at least this much somewhere, in figure units. */
export const FAULT_VISIBLE = 3;

/** The right pose with the wrong pose's changes: a limb given replaces the right pose's limb. */
export function wrongPose(right: Pose, change: PoseChange): Pose {
  const { arms, legs, ...rest } = change;
  return {
    ...right,
    ...rest,
    arms: { ...right.arms, ...(arms ?? {}) },
    legs: { ...right.legs, ...(legs ?? {}) },
  };
}

/** How far a wrong pose lies from the right one: the drawn point that moved most, and how far. */
export function deviation(frame: Frame, right: Pose, wrong: Pose): { by: number; at: Point } {
  const a = drawnPoints(solve(frame, right));
  const b = drawnPoints(solve(frame, wrong));
  let best = { by: 0, at: b[0] ?? right.hip };
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = distance(a[i] as Point, b[i] as Point);
    if (d > best.by) best = { by: d, at: b[i] as Point };
  }
  return best;
}

/** A mistake ready to draw: its view, the right and the wrong pose, and where they differ most. */
export interface FaultPair {
  fault: Fault;
  figure: FigureItem;
  frame: Frame;
  right: Pose;
  wrong: Pose;
  /** The drawn point that moved most, in the wrong pose, and how far. */
  differs: { by: number; at: Point };
}

/** The pair of a mistake, or null when its view or position is missing. */
export function faultPair(
  figure: FigureItem,
  movement: OwnMovement,
  fault: Fault,
): FaultPair | null {
  const view = faultFigure(figure, fault);
  const right = view?.keyframes[fault.at];
  if (!view || !right || !movement.positions.some((p) => p.id === fault.at)) return null;
  const frame = frameOf(view);
  const wrong = wrongPose(right, fault.wrong);
  return { fault, figure: view, frame, right, wrong, differs: deviation(frame, right, wrong) };
}
