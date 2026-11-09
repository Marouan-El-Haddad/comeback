// Where a guided session stands, kept in localStorage so it resumes at the same step after the app
// was closed. Separate from Runner.tsx: the app shell needs it at start, the session code it can
// load later (docs/SPEC.md 7, docs/DECISIONS.md D35).
import type { ISODate, SessionKind } from '../../engine/types.ts';
import { readLocal } from '../hooks.ts';
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
  sessionId: string | null;
  intervalsAnyway: boolean;
  sim: boolean;
}

export const RUN_KEY = 'comeback.run';

/** A session left half-way today is resumed at the same step after the app was closed. */
export function resumableRun(model: Model): RunRequest | null {
  const saved = readLocal<RunState>(RUN_KEY);
  if (!saved || saved.date !== model.today || saved.sim !== (model.sim !== null)) return null;
  // »Dagens pas« and the summary are not a session in hand: the app opens on I dag (SPEC 7).
  if (saved.phase === 'summary' || saved.phase === 'overview') return null;
  if (saved.sessionId) {
    const session = model.state.sessions.find((s) => s.sessionId === saved.sessionId);
    if (!session || session.completed) return null;
  }
  return saved;
}
