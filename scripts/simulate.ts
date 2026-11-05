// 12 calendar weeks with a synthetic user who hits the top of every step in every set (2 in
// reserve, clean EMOM, »let« neck). Prints the step per track and week and fails unless every
// ladder and power track moved up at least once (docs/PLAN.md milestone 1).
// Run: npm run simulate
import {
  addDays,
  catchUp,
  deriveState,
  finishSession,
  getStep,
  logBlockResult,
  logSet,
  planFor,
  PROGRAM,
  resolvePlan,
  startSession,
  workRange,
} from '../src/engine/index.ts';
import type { AppEvent, BlockResult, EventBody, ISODate } from '../src/engine/types.ts';

const START: ISODate = '2026-11-09';
const WEEKS = 12;

let seq = 0;
let clock = Date.UTC(2026, 10, 8, 7);
const make = (body: EventBody, date: ISODate): AppEvent => {
  seq += 1;
  const day = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    6,
  );
  clock = Math.max(clock + 1000, day);
  return {
    ...body,
    id: `sim${String(seq).padStart(6, '0')}`,
    at: new Date(clock).toISOString(),
    date,
    v: 1,
  };
};
const ctx = { program: PROGRAM, make };
const events: AppEvent[] = [];
const add = (list: AppEvent[]) => events.push(...list);

add([make({ type: 'onboarding_completed', startDate: START, completedWeeks: [] }, '2026-11-08')]);

function runSession(date: ISODate, kind: 'A' | 'B' | 'motor'): void {
  const sessionId = `session-${date}`;
  add(startSession(ctx, events, { sessionId, date, kind, answers: [true, true, true] }));
  const plan = resolvePlan(PROGRAM, deriveState(PROGRAM, events, date), {
    date,
    kind,
    light: 'green',
  });
  for (const block of plan.blocks) {
    if (block.role === 'warmup') continue;
    if (block.role === 'measure') {
      add([
        make(
          {
            type: 'measurement_logged',
            measureId: block.measureId ?? '',
            value: 30,
            programWeek: 0,
            round: 1,
          },
          date,
        ),
      ]);
      continue;
    }
    if (block.unit === 'emom' || block.unit === 'rounds') {
      const result: BlockResult =
        block.unit === 'emom' ? { clean: true, rest20: true } : { clean: true };
      add([logBlockResult(ctx, { sessionId, date, block, result })]);
      continue;
    }
    const range = workRange(getStep(PROGRAM, block.stepId).dose);
    const top = range?.max ?? block.target;
    let setIndex = 1;
    if (block.measureId) {
      add([
        logSet(ctx, {
          sessionId,
          date,
          block,
          setIndex: setIndex++,
          value: 30,
          measureId: block.measureId,
        }),
      ]);
    }
    for (let i = 0; i < block.sets; i++, setIndex++) {
      for (const side of block.per ? (['L', 'R'] as const) : [undefined]) {
        add([
          logSet(ctx, {
            sessionId,
            date,
            block,
            setIndex,
            side,
            value: top,
            rir: block.rirPlan === 3 ? 3 : 2,
          }),
        ]);
      }
    }
    if (block.role === 'power')
      add([logBlockResult(ctx, { sessionId, date, block, result: { quality: true } })]);
    if (block.role === 'neck')
      add([logBlockResult(ctx, { sessionId, date, block, result: { feel: 'easy' } })]);
  }
  add(finishSession(ctx, events, { sessionId }));
}

const tracks = PROGRAM.tracks.filter((t) => t.progression !== 'manual');
const rows: string[][] = [];
const header = ['Uge', 'Pu', ...tracks.map((t) => t.short)];
for (let day = 0; day < WEEKS * 7; day++) {
  const date = addDays(START, day);
  add(catchUp(ctx, events, date));
  const plan = planFor(PROGRAM, deriveState(PROGRAM, events, date), date);
  if (plan.kind === 'A' || plan.kind === 'B' || plan.kind === 'motor') runSession(date, plan.kind);
  add([make({ type: 'os_done' }, date)]);
  if (day % 7 === 6) {
    const state = deriveState(PROGRAM, events, date);
    const week = state.weeks[Math.floor(day / 7)];
    rows.push([
      String(Math.floor(day / 7) + 1),
      String(week?.pw ?? ''),
      ...tracks.map((t) => {
        const ts = state.tracks[t.id];
        if (!ts) return '';
        const key = getStep(PROGRAM, ts.stepId).key;
        return t.progression === 'load' ? `${key}+${ts.load}kg` : key;
      }),
    ]);
  }
}

const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ');
console.log(`Simulering: ${WEEKS} uger fra ${START}, en bruger der rammer max hver gang.\n`);
console.log(line(header));
for (const row of rows) console.log(line(row));

const final = deriveState(PROGRAM, events, addDays(START, WEEKS * 7 - 1));
const changes = final.decisions.filter((d) => d.by === 'engine');
const ladders = PROGRAM.tracks.filter((t) => t.category === 'ladder' || t.category === 'power');
const stuck = ladders.filter(
  (t) => !changes.some((d) => d.trackId === t.id && d.reason === 'progression'),
);
console.log(`\n${events.length} hændelser, ${changes.length} beslutninger fra motoren.`);
if (stuck.length > 0) {
  console.error(`Intet trinskift for: ${stuck.map((t) => t.short).join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`Alle ${ladders.length} stiger og power-spor rykkede mindst ét trin op.`);
}
const missingExplanation = changes.filter((d) => d.explanation.trim() === '');
if (missingExplanation.length > 0) {
  console.error(`${missingExplanation.length} beslutninger uden forklaring (SK5).`);
  process.exitCode = 1;
}
