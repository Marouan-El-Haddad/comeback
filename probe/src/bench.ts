// A synthetic event log and a replay that does the kind of work the engine will do at start-up
// (docs/SPEC.md section 7): fold an append-only log into per-track state.

export type SyntheticEvent =
  | { id: string; type: 'session_started'; date: string; session: 'A' | 'B' }
  | {
      id: string;
      type: 'set_logged';
      date: string;
      track: string;
      set: number;
      reps: number;
      reserve: number;
      pain: 'none' | 'light' | 'sharp';
    }
  | { id: string; type: 'session_completed'; date: string; status: 'green' | 'yellow' | 'red' }
  | {
      id: string;
      type: 'step_changed';
      date: string;
      track: string;
      to: number;
      explanation: string;
    }
  | { id: string; type: 'club_logged'; date: string; hardness: 'Let' | 'Middel' | 'Hård' }
  | { id: string; type: 'os_done'; date: string };

const TRACKS = ['press', 'pull', 'legs', 'hinge', 'shoulders', 'core', 'groin', 'calves'];
const DAY = 86_400_000;

/** Deterministic: the same 1,000 events every time. */
export function syntheticEvents(count = 1000): SyntheticEvent[] {
  let seed = 42;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const events: SyntheticEvent[] = [];
  const id = () => `e${events.length}`;
  for (let day = 0; events.length < count; day++) {
    const date = new Date(Date.UTC(2026, 10, 9) + day * DAY).toISOString().slice(0, 10);
    const weekday = day % 7; // 0 = Monday
    if (weekday === 1 || weekday === 4) {
      events.push({ id: id(), type: 'session_started', date, session: weekday === 1 ? 'A' : 'B' });
      for (const track of TRACKS) {
        for (let set = 1; set <= 3; set++) {
          const r = random();
          events.push({
            id: id(),
            type: 'set_logged',
            date,
            track,
            set,
            reps: 6 + Math.floor(random() * 7),
            reserve: Math.floor(random() * 4),
            pain: r < 0.03 ? 'sharp' : r < 0.1 ? 'light' : 'none',
          });
        }
      }
      events.push({
        id: id(),
        type: 'session_completed',
        date,
        status: random() < 0.85 ? 'green' : 'yellow',
      });
      if (random() < 0.3) {
        const track = TRACKS[Math.floor(random() * TRACKS.length)] ?? 'press';
        events.push({
          id: id(),
          type: 'step_changed',
          date,
          track,
          to: 2,
          explanation: `${track}: valgt trin 2`,
        });
      }
    } else if (weekday === 0 || weekday === 2 || weekday === 5) {
      const r = random();
      events.push({
        id: id(),
        type: 'club_logged',
        date,
        hardness: r < 0.3 ? 'Hård' : r < 0.7 ? 'Middel' : 'Let',
      });
    }
    events.push({ id: id(), type: 'os_done', date });
  }
  return events.slice(0, count);
}

type TrackState = { step: number; working: number; hits: number; pain: number };
type SessionSets = Map<string, { sets: number; allAtMax: boolean }>;

function isoWeek(date: string): string {
  const time = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
  const monday0 = (new Date(time).getUTCDay() + 6) % 7;
  const thursday = time + (3 - monday0) * DAY;
  const year = new Date(thursday).getUTCFullYear();
  return `${year}-W${1 + Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * DAY))}`;
}

export function replay(events: readonly SyntheticEvent[]) {
  const tracks = new Map<string, TrackState>();
  const weeks = new Map<string, number>();
  const explanations: string[] = [];
  const hardClubDays: string[] = [];
  let session: SessionSets | null = null;
  let completed = 0;
  let openAndStrong = 0;
  const track = (name: string) => {
    let state = tracks.get(name);
    if (!state) tracks.set(name, (state = { step: 1, working: 6, hits: 0, pain: 0 }));
    return state;
  };

  for (const e of events) {
    const week = isoWeek(e.date);
    weeks.set(week, (weeks.get(week) ?? 0) + 1);
    switch (e.type) {
      case 'session_started':
        session = new Map();
        break;
      case 'set_logged': {
        const t = track(e.track);
        const sets = session?.get(e.track) ?? { sets: 0, allAtMax: true };
        sets.sets += 1;
        sets.allAtMax = sets.allAtMax && e.reps >= 12 && e.reserve >= 2;
        session?.set(e.track, sets);
        if (e.reps >= t.working && e.reserve >= 2) t.working = Math.min(t.working + 1, 12);
        if (e.pain === 'sharp') t.pain += 1;
        break;
      }
      case 'session_completed':
        completed += 1;
        if (e.status === 'green' && session) {
          for (const [name, sets] of session) {
            const t = track(name);
            if (!sets.allAtMax) t.hits = 0;
            else if (++t.hits >= 2) {
              t.step += 1;
              t.hits = 0;
              t.working = 6;
              explanations.push(`${name}: to pas i træk med max – trin ${t.step}`);
            }
          }
        }
        session = null;
        break;
      case 'step_changed':
        track(e.track).step = e.to;
        explanations.push(e.explanation);
        break;
      case 'club_logged':
        if (e.hardness === 'Hård') hardClubDays.push(e.date);
        break;
      case 'os_done':
        openAndStrong += 1;
        break;
    }
  }
  return { tracks, weeks, explanations, hardClubDays, completed, openAndStrong };
}

/** Smallest step of performance.now(); privacy settings can coarsen it to 100 ms. */
export function timerResolution(): number {
  let smallest = Infinity;
  for (let i = 0; i < 3; i++) {
    const a = performance.now();
    let b = a;
    while (b === a) b = performance.now();
    smallest = Math.min(smallest, b - a);
  }
  return smallest;
}

export type BenchResult = { first: number; average: number; runs: number; resolution: number };

/** Replays the log for at least one second, so a coarse clock still gives a usable average. */
export function benchmark(): BenchResult {
  const events = syntheticEvents(1000);
  const resolution = timerResolution();
  const t0 = performance.now();
  let sink = replay(events).completed;
  const first = performance.now() - t0;
  const start = performance.now();
  let runs = 0;
  let elapsed: number;
  do {
    sink += replay(events).completed;
    runs += 1;
    elapsed = performance.now() - start;
  } while (elapsed < 1000 && runs < 5000);
  if (sink < 0) console.log(sink); // keeps the work observable
  return { first, average: elapsed / runs, runs, resolution };
}
