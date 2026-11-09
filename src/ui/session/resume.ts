// Where a guided session stands, kept in localStorage so it resumes at the same step after the app
// was closed. Separate from Runner.tsx: the app shell needs it at start, the session code it can
// load later (docs/SPEC.md 7, docs/DECISIONS.md D35). A session in the time machine is kept in
// memory and never written to storage, so it can never take the place of a real session that holds
// a pause (SPEC 3.7, D57).
import type { ISODate, SessionKind } from '../../engine/types.ts';
import { readLocal, writeLocal } from '../hooks.ts';
import type { Model } from '../model.ts';

export interface RunRequest {
  date: ISODate;
  kind: SessionKind;
  short?: boolean;
  calmBase?: boolean;
}

export interface RunState extends RunRequest {
  /** »Dagens pas«, the traffic light, the warm-up, the session's steps, the summary. */
  phase: 'overview' | 'light' | 'pre' | 'run' | 'summary';
  answers: [boolean, boolean, boolean];
  red: boolean;
  preIndex: number;
  stepIndex: number;
  /**
   * What the step at `stepIndex` is (steps.ts `stepKey`), so a later version with other steps
   * resumes at the same one. Missing in a session saved by a version before it (D54).
   */
  stepKey?: string;
  sessionId: string | null;
  intervalsAnyway: boolean;
  sim: boolean;
}

export const RUN_KEY = 'comeback.run';

/** The time machine's session: in memory only, gone when the time machine ends. */
let simRun: RunState | null = null;

/** The saved session of a world: the real one in localStorage, the time machine's in memory. */
export function readRun(sim: boolean): RunState | null {
  return sim ? simRun : readLocal<RunState>(RUN_KEY);
}

/** Saves (or with null forgets) where the session of a world stands. */
export function writeRun(sim: boolean, run: RunState | null): void {
  if (sim) simRun = run;
  else writeLocal(run, RUN_KEY);
}

/** The time machine starts or ends: its session is not taken into the next world. */
export function forgetSimRun(): void {
  simRun = null;
}

/** A session left half-way today is resumed at the same step after the app was closed. */
export function resumableRun(model: Model): RunRequest | null {
  const saved = readRun(model.sim !== null);
  if (!saved || saved.date !== model.today || saved.sim !== (model.sim !== null)) return null;
  // »Dagens pas« and the summary are not a session in hand: the app opens on I dag (SPEC 7).
  if (saved.phase === 'summary' || saved.phase === 'overview') return null;
  if (saved.sessionId) {
    const session = model.state.sessions.find((s) => s.sessionId === saved.sessionId);
    if (!session || session.completed) return null;
  }
  return saved;
}
