// R-TIME: the time machine works on a copy of the log in memory. Nothing it does reaches the real
// log; finishing the simulation simply drops the copy (docs/ENGINE.md 5.14, T5).
import { addDays } from './dates.ts';
import { deriveState } from './derive.ts';
import type { AppEvent, ISODate, Program, State } from './types.ts';

export class Simulation {
  readonly program: Program;
  private readonly log: AppEvent[];
  private day: ISODate;

  constructor(program: Program, real: readonly AppEvent[], today: ISODate) {
    this.program = program;
    this.log = structuredClone([...real]);
    this.day = today;
  }

  get today(): ISODate {
    return this.day;
  }

  get events(): readonly AppEvent[] {
    return this.log;
  }

  state(): State {
    return deriveState(this.program, this.log, this.day);
  }

  append(events: readonly AppEvent[]): void {
    this.log.push(...structuredClone([...events]));
  }

  /** »+1 dag« */
  advance(days = 1): void {
    this.day = addDays(this.day, days);
  }

  setToday(date: ISODate): void {
    this.day = date;
  }
}

export function simulate(
  program: Program,
  events: readonly AppEvent[],
  simulatedToday: ISODate,
): Simulation {
  return new Simulation(program, events, simulatedToday);
}
