// The app's model: the event log, »i dag« and the derived state, with one way to write (commit).
// The time machine swaps in an in-memory copy and makes the real store read-only (SPEC 3.7).
import { addDays, catchUp, deriveState, PROGRAM, todayIn, type Ctx } from '../engine/index.ts';
import type { AppEvent, ISODate, State } from '../engine/types.ts';
import { MemoryStore, type EventStore } from '../storage/store.ts';
import { eventFactory } from './ids.ts';
import { noteTimeMachine } from './startup.ts';

export interface Simulation {
  /** The simulated date. */
  date: ISODate;
  store: MemoryStore;
}

type Listener = () => void;

export class Model {
  readonly real: EventStore;
  events: AppEvent[];
  sim: Simulation | null = null;
  state: State;
  today: ISODate;
  /** The last write failed: shown as »Kan ikke gemme – eksportér backup nu«. */
  saveError: string | null = null;
  restoredFromMirror = false;
  private readonly listeners = new Set<Listener>();

  constructor(store: EventStore, events: AppEvent[], now: number) {
    this.real = store;
    this.events = events;
    this.today = todayIn(now);
    this.state = deriveState(PROGRAM, events, this.today);
  }

  get store(): EventStore {
    return this.sim?.store ?? this.real;
  }

  /** The clock events are stamped with: the simulated date keeps the time of day. */
  now(): number {
    if (!this.sim) return Date.now();
    const wall = Date.now();
    const realToday = todayIn(wall);
    const days =
      (Date.UTC(
        +this.sim.date.slice(0, 4),
        +this.sim.date.slice(5, 7) - 1,
        +this.sim.date.slice(8, 10),
      ) -
        Date.UTC(+realToday.slice(0, 4), +realToday.slice(5, 7) - 1, +realToday.slice(8, 10))) /
      86_400_000;
    return wall + days * 86_400_000;
  }

  get ctx(): Ctx {
    return { program: PROGRAM, make: eventFactory(() => this.now()) };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private recompute(): void {
    this.state = deriveState(PROGRAM, this.events, this.today);
    this.emit();
  }

  /** Events that could not be written yet; they go along with the next write. */
  private unsaved: AppEvent[] = [];

  /** Appends events to the store (real or simulated) and updates the state. */
  async commit(events: AppEvent[]): Promise<void> {
    if (events.length === 0) return;
    const batch = [...this.unsaved, ...events];
    try {
      // Ids already stored are ignored, so a retry of earlier events is safe.
      await this.store.append(batch);
      this.unsaved = [];
      this.saveError = null;
    } catch (error) {
      // Keep going in memory; the banner asks for a backup (SPEC 4.13).
      this.unsaved = batch;
      this.saveError = error instanceof Error ? error.message : String(error);
    }
    this.events = [...this.events, ...events];
    this.recompute();
  }

  /** Writes what a new day needs (missed sessions, R-ABSENCE-3) and refreshes »i dag«. */
  async refreshDay(): Promise<void> {
    const today = this.sim ? this.sim.date : todayIn(Date.now());
    const changed = today !== this.today;
    this.today = today;
    const extra = this.state.onboarded ? catchUp(this.ctx, this.events, today) : [];
    if (extra.length > 0) await this.commit(extra);
    else if (changed) this.recompute();
  }

  /** The time machine: a copy of the log in memory, the real store read-only. */
  async startSimulation(date: ISODate): Promise<void> {
    noteTimeMachine();
    if (this.sim) this.real.readOnly = false;
    const copy = new MemoryStore(this.realEvents ?? this.events);
    this.realEvents ??= this.events;
    this.real.readOnly = true;
    this.sim = { date, store: copy };
    this.events = (await copy.load()).events;
    this.today = date;
    this.recompute();
    await this.refreshDay();
  }

  /** »+1 dag« in the time machine. */
  async nextSimulatedDay(): Promise<void> {
    if (!this.sim) return;
    this.sim.date = addDays(this.sim.date, 1);
    await this.refreshDay();
  }

  /** »Afslut«: the copy is dropped, the real log is shown again. */
  async stopSimulation(): Promise<void> {
    if (!this.sim) return;
    this.sim = null;
    this.real.readOnly = false;
    this.events = this.realEvents ?? (await this.real.load()).events;
    this.realEvents = null;
    this.today = todayIn(Date.now());
    this.recompute();
    await this.refreshDay();
  }

  private realEvents: AppEvent[] | null = null;

  /** Replaces the whole log (import »Erstat alt«); the store keeps a backup first. */
  async replaceAll(events: AppEvent[]): Promise<void> {
    await this.store.replaceAll(events);
    // The store drops duplicate ids; read back exactly what it kept.
    this.events = (await this.store.load()).events;
    this.unsaved = [];
    this.recompute();
  }
}
