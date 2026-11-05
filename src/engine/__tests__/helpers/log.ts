// Test helper: builds an event log the way the app does, through the engine's own functions.
import {
  catchUp,
  deriveState,
  finishSession,
  logBlockResult,
  logSet,
  planFor,
  PROGRAM,
  resolvePlan,
  startSession,
  type BlockPlan,
  type Ctx,
  type SessionPlan,
} from '../../index.ts';
import type {
  AppEvent,
  BlockResult,
  EventBody,
  EventFactory,
  ISODate,
  Pain,
  Program,
  Rir,
  SessionKind,
  State,
} from '../../types.ts';

/** Steps chosen at onboarding: a step id, or a step id with working number and load. */
export type Steps = Record<string, string | { stepId: string; target?: number; load?: number }>;

export type SetSpec =
  | number[]
  | {
      values?: number[];
      left?: number[];
      right?: number[];
      rir?: Rir | Rir[];
      pain?: Pain;
      /** Only log this many working sets (an interrupted block). */
      count?: number;
    };

export interface SessionSpec {
  date: ISODate;
  kind?: SessionKind;
  light?: 'green' | 'yellow' | 'red';
  answers?: [boolean, boolean, boolean];
  /** Per track id: the logged values (default: everything »som planlagt«). */
  sets?: Record<string, SetSpec>;
  results?: Record<string, BlockResult>;
  /** Measurement values by measure id (default 10). */
  measures?: Record<string, number>;
  /** Log only these tracks (the rest of the session is not logged). */
  only?: string[];
  aborted?: boolean;
  /** Start and log, but do not finish the session. */
  open?: boolean;
  short?: boolean;
  boss?: boolean;
  intervalsAnyway?: boolean;
}

const DEFAULT_RESULTS: Record<string, BlockResult> = {
  power: { quality: true },
  emom: { clean: true, rest20: true },
  rounds: { clean: true },
  neck: { feel: 'ok' },
};

export class Log {
  readonly program: Program;
  events: AppEvent[] = [];
  private seq = 0;
  private clock = Date.UTC(2026, 10, 1, 8, 0, 0);

  /** The id prefix keeps ids apart when two helpers write to one log (the time machine). */
  private readonly prefix: string;

  constructor(program: Program = PROGRAM, prefix = 'e') {
    this.program = program;
    this.prefix = prefix;
  }

  /** Event factory with deterministic ids and an advancing clock. */
  readonly make: EventFactory = (body: EventBody, date: ISODate) => {
    this.seq += 1;
    const dayStart = Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      7,
    );
    this.clock = Math.max(this.clock + 1000, dayStart);
    return {
      ...body,
      id: `${this.prefix}${String(this.seq).padStart(6, '0')}`,
      at: new Date(this.clock).toISOString(),
      date,
      v: 1,
    };
  };

  get ctx(): Ctx {
    return { program: this.program, make: this.make };
  }

  push(body: EventBody, date: ISODate): AppEvent {
    const event = this.make(body, date);
    this.events.push(event);
    return event;
  }

  add(events: AppEvent[]): AppEvent[] {
    this.events.push(...events);
    return events;
  }

  state(today: ISODate): State {
    return deriveState(this.program, this.events, today);
  }

  onboard(
    options: {
      date?: ISODate;
      startDate?: ISODate;
      completedWeeks?: ISODate[];
      steps?: Steps;
    } = {},
  ): this {
    const date = options.date ?? '2026-11-08';
    this.push(
      {
        type: 'onboarding_completed',
        startDate: options.startDate ?? '2026-11-09',
        completedWeeks: options.completedWeeks ?? [],
      },
      date,
    );
    for (const [trackId, value] of Object.entries(options.steps ?? {})) {
      const spec = typeof value === 'string' ? { stepId: value } : value;
      this.push(
        {
          type: 'step_set',
          trackId,
          stepId: spec.stepId,
          target: spec.target,
          load: spec.load,
          reason: 'onboarding',
          explanation: 'Valgt ved start',
        },
        date,
      );
    }
    return this;
  }

  /** Writes what the app's daily catch-up writes for `today`. */
  catchUp(today: ISODate): AppEvent[] {
    return this.add(catchUp(this.ctx, this.events, today));
  }

  plan(date: ISODate) {
    return planFor(this.program, this.state(date), date);
  }

  /** Runs a session like the app: start, log every block, finish. */
  session(spec: SessionSpec): {
    plan: SessionPlan;
    sessionId: string;
    started: AppEvent[];
    finished: AppEvent[];
  } {
    const sessionId = `${this.prefix}s${String(this.seq + 1).padStart(6, '0')}`;
    const kind = spec.kind ?? 'A';
    const answers: [boolean, boolean, boolean] =
      spec.answers ?? (spec.light === 'yellow' ? [false, true, true] : [true, true, true]);
    const started = this.add(
      startSession(this.ctx, this.events, {
        sessionId,
        date: spec.date,
        kind,
        answers,
        red: spec.light === 'red',
        short: spec.short,
        boss: spec.boss,
        intervalsAnyway: spec.intervalsAnyway,
      }),
    );
    const state = this.state(spec.date);
    const light = spec.light ?? 'green';
    const plan = resolvePlan(this.program, state, {
      date: spec.date,
      kind,
      light,
      short: spec.short,
      boss: spec.boss,
      intervalsAnyway: spec.intervalsAnyway,
    });
    for (const block of plan.blocks) this.logBlock(spec, sessionId, block);
    const finished = spec.open
      ? []
      : this.add(finishSession(this.ctx, this.events, { sessionId, aborted: spec.aborted }));
    return { plan, sessionId, started, finished };
  }

  private logBlock(spec: SessionSpec, sessionId: string, block: BlockPlan): void {
    if (block.role === 'warmup') return;
    if (spec.only && !spec.only.includes(block.trackId)) return;
    const date = spec.date;
    if (block.role === 'measure') {
      const value = spec.measures?.[block.measureId ?? ''] ?? 10;
      this.push(
        {
          type: 'measurement_logged',
          measureId: block.measureId ?? '',
          value,
          programWeek: 0,
          round: 1,
        },
        date,
      );
      return;
    }
    if (block.unit === 'emom' || block.unit === 'rounds') {
      const result =
        spec.results?.[block.trackId] ?? DEFAULT_RESULTS[block.unit === 'emom' ? 'emom' : 'rounds'];
      if (result) this.add([logBlockResult(this.ctx, { sessionId, date, block, result })]);
      return;
    }
    const raw = spec.sets?.[block.trackId];
    const custom = Array.isArray(raw) ? { values: raw } : raw;
    const count = custom?.count ?? block.sets;
    let setIndex = 1;
    if (block.measureId) {
      const value = spec.measures?.[block.measureId] ?? 10;
      this.add([
        logSet(this.ctx, {
          sessionId,
          date,
          block,
          setIndex: setIndex++,
          value,
          measureId: block.measureId,
        }),
      ]);
      this.push(
        { type: 'measurement_logged', measureId: block.measureId, value, programWeek: 0, round: 1 },
        date,
      );
    }
    const sides: Array<'L' | 'R' | undefined> = block.per ? ['L', 'R'] : [undefined];
    for (let i = 0; i < count; i++) {
      for (const side of sides) {
        const list =
          side === 'L'
            ? (custom?.left ?? custom?.values)
            : side === 'R'
              ? (custom?.right ?? custom?.values)
              : custom?.values;
        const value = list?.[i];
        const rir = Array.isArray(custom?.rir) ? custom.rir[i] : custom?.rir;
        const pain = i === count - 1 ? custom?.pain : undefined;
        this.add([
          logSet(this.ctx, {
            sessionId,
            date,
            block,
            setIndex: setIndex,
            side,
            value,
            rir,
            pain,
          }),
        ]);
      }
      setIndex++;
    }
    const kindResult =
      block.role === 'power' ? 'power' : block.role === 'neck' ? 'neck' : undefined;
    if (kindResult) {
      const result = spec.results?.[block.trackId] ?? DEFAULT_RESULTS[kindResult];
      if (result) this.add([logBlockResult(this.ctx, { sessionId, date, block, result })]);
    }
  }
}

/** Mondays of calendar weeks k = 0 … n - 1 from 9 November 2026. */
export function mondays(n: number, start = '2026-11-09'): ISODate[] {
  const out: ISODate[] = [];
  for (let k = 0; k < n; k++) {
    const d = new Date(Date.UTC(2026, 10, 9 + 7 * k));
    out.push(start === '2026-11-09' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 10));
  }
  return out;
}

/** Date of weekday `day` (1 = Monday) in calendar week k from 9 November 2026. */
export function dayOf(k: number, day: number): ISODate {
  return new Date(Date.UTC(2026, 10, 9 + 7 * k + day - 1)).toISOString().slice(0, 10);
}

export function explanationOf(events: AppEvent[], trackId: string): string | undefined {
  const change = events.find(
    (e) => (e.type === 'step_changed' || e.type === 'load_changed') && e.trackId === trackId,
  );
  return change && 'explanation' in change ? change.explanation : undefined;
}
