// The figure in a session follows the session's clock (docs/SPEC.md 3.2, DECISIONS.md D52): in a hold
// the "dose" phase is the hold, in the EMOM each minute starts its repetitions and then the figure
// stands still, in a round each part of the round shows the phases that belong to it, and in an
// Open & Strong item the "dose" phases share the item's time. The movements are the ones in
// content/explain, so the rules are tried on the data the session shows.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { ExplainFile, ExplainItem, OwnMovement } from '../../content/types.ts';
import { timeline } from '../motion.ts';
import { keyPosition, resolveDoses, syncFigure, type ClockPart } from '../sync.ts';

function movementOf(subject: string, id: string, index = 0): OwnMovement {
  const file = JSON.parse(
    readFileSync(join('content', 'explain', `${subject}.json`), 'utf8'),
  ) as ExplainFile;
  const item = file.items.find((i) => i.id === id) as ExplainItem | undefined;
  if (!item) throw new Error(`${id} findes ikke`);
  return item.movements[index] as OwnMovement;
}

/** The label of the phase the figure shows at figure time `t` (null = none). */
function labelAt(movement: OwnMovement, t: number | null): string | null {
  if (t === null) return null;
  const line = timeline(movement);
  const local = ((t % line.total) + line.total) % line.total;
  let index: number | null = null;
  for (const m of line.moves) if (m.start <= local) index = m.phase;
  return index === null ? null : (movement.phases[index]?.label ?? null);
}

const ready: ClockPart = { kind: 'ready', seconds: 5 };
const work = (seconds: number): ClockPart => ({ kind: 'work', seconds });
const rest = (seconds: number): ClockPart => ({ kind: 'rest', seconds });

describe('resolveDoses', () => {
  test('en "dose"-fase får holdets tid, og "repeat": "dose" gentages, så længe den varer', () => {
    const wallsit = resolveDoses(movementOf('wallsit', 'wallsit.W1'), [45]);
    expect(wallsit.phases.map((p) => p.seconds)).toEqual([2, 45, 2]);
    // W2: »Rolige lige slag«, one punch out and back every 2 sek, for the whole hold.
    const punches = resolveDoses(movementOf('wallsit', 'wallsit.W2'), [60]);
    expect(punches.phases[1]).toMatchObject({ seconds: 2, repeat: 30 });
    expect(timeline(punches).phases[1]?.seconds).toBe(60);
  });
});

describe('keyPosition', () => {
  test('stillbilledet viser stillingen, øvelsen bruger længst tid i: holdet og bunden', () => {
    expect(keyPosition(movementOf('wallsit', 'wallsit.W1'))).toBe('sit');
    expect(keyPosition(movementOf('press', 'press.1'))).toBe('bottom');
  });
});

describe('syncFigure: hold', () => {
  const movement = movementOf('wallsit', 'wallsit.W1');
  const parts = [ready, work(45)];
  const sync = syncFigure(movement, parts, { kind: 'hold' });

  test('figuren glider ned i de sidste 2 sek af »Klar« og holder, mens holdet tælles ned', () => {
    expect(sync).not.toBeNull();
    if (!sync) return;
    expect(sync.at(0, 0)).toBeNull();
    expect(sync.at(0, 2.9)).toBeNull();
    expect(labelAt(sync.movement, sync.at(0, 3.5))).toBe('Glid ned');
    expect(sync.at(1, 0)).toBeCloseTo(2, 5);
    expect(labelAt(sync.movement, sync.at(1, 10))).toBe('Hold');
    expect(labelAt(sync.movement, sync.at(1, 44.9))).toBe('Hold');
    // The figure's own phases: the hold lasts as long as the set.
    expect(timeline(sync.movement).phases[1]?.seconds).toBe(45);
  });

  test('nakkens hold med pauser: slip roligt efter holdet, stille i pausen, ind i stilling før næste', () => {
    const neck = movementOf('neck', 'neck.N1');
    const s = syncFigure(neck, [ready, work(10), rest(10), work(10)], { kind: 'hold' });
    if (!s) throw new Error('ingen sync');
    expect(labelAt(s.movement, s.at(1, 5))).toBe('Hold');
    expect(labelAt(s.movement, s.at(2, 1))).toBe('Slip roligt');
    expect(s.at(2, 5)).toBeNull();
    expect(labelAt(s.movement, s.at(2, 8.5))).toBe('Hagen ind');
    expect(labelAt(s.movement, s.at(3, 1))).toBe('Hold');
  });

  test('et hold uden "dose"-fase kører i sit eget tempo, mens holdet varer', () => {
    const pushUp = movementOf('press', 'press.1');
    const s = syncFigure(pushUp, [ready, work(30)], { kind: 'hold' });
    if (!s) throw new Error('ingen sync');
    expect(s.at(0, 1)).toBeNull();
    expect(labelAt(s.movement, s.at(1, 1))).toBe('3 sek ned');
    expect(labelAt(s.movement, s.at(1, 3.5))).toBe('1 sek stille');
    expect(labelAt(s.movement, s.at(1, 5 + 1))).toBe('3 sek ned');
  });
});

describe('syncFigure: EMOM', () => {
  test('hvert minut starter sine burpees, og resten af minuttet står figuren stille', () => {
    const burpee = movementOf('burpee_emom', 'burpee_emom.E1');
    const minutes: ClockPart[] = [ready, work(60), work(60), work(60), work(60)];
    const s = syncFigure(burpee, minutes, { kind: 'emom', reps: 3 });
    if (!s) throw new Error('ingen sync');
    const one = timeline(s.movement).total;
    expect(s.at(0, 3)).toBeNull();
    expect(labelAt(s.movement, s.at(1, 0.1))).toBe('Hænderne ned');
    expect(labelAt(s.movement, s.at(2, one + 0.1))).toBe('Hænderne ned');
    // After three burpees the rest of the minute is a pause: no phase.
    expect(s.at(2, 3 * one + 0.5)).toBeNull();
    expect(s.at(3, 50)).toBeNull();
  });
});

describe('syncFigure: runder', () => {
  test('klubsekvensen: hver del af runden viser sine faser, i takt med uret', () => {
    const club = movementOf('club_sequence', 'club_sequence.C1');
    // »Klar«, then the five parts of a round: 3, 3, 3, 8 and 4 sek, two rounds.
    const round = [work(3), work(3), work(3), work(8), work(4)];
    const s = syncFigure(club, [ready, ...round, ...round], { kind: 'rounds', perRound: 5 });
    if (!s) throw new Error('ingen sync');
    expect(s.at(0, 4)).toBeNull();
    expect(labelAt(s.movement, s.at(1, 0.2))).toBe('Ned til midten');
    expect(labelAt(s.movement, s.at(1, 2.5))).toBe('Hold 3 sek');
    expect(labelAt(s.movement, s.at(2, 0.2))).toBe('Helt ned');
    expect(labelAt(s.movement, s.at(3, 2.5))).toBe('Hold 3 sek');
    expect(labelAt(s.movement, s.at(4, 4))).toBe('10 mikro-pumps');
    expect(labelAt(s.movement, s.at(5, 1))).toBe('Helt ned');
    expect(labelAt(s.movement, s.at(5, 3.5))).toBe('Helt op');
    // The second round starts over with the first part.
    expect(labelAt(s.movement, s.at(6, 0.2))).toBe('Ned til midten');
  });

  test('wall sit W3: holdet fylder de 45 sek, og squatsene kører i deres tempo, til du trykker videre', () => {
    const w3 = movementOf('wallsit', 'wallsit.W3');
    const s = syncFigure(w3, [ready, work(45), work(0)], { kind: 'rounds', perRound: 2 });
    if (!s) throw new Error('ingen sync');
    expect(labelAt(s.movement, s.at(1, 1))).toBe('Glid ned');
    expect(labelAt(s.movement, s.at(1, 30))).toBe('Hold 45 sek');
    expect(labelAt(s.movement, s.at(2, 1))).toBe('Op og et skridt frem');
    expect(labelAt(s.movement, s.at(2, 10))).toBe('20 kontrollerede squats');
  });

  test('wall sit W5: de tre dele er de tre "dose"-faser, med skiftet i starten af delen', () => {
    const w5 = movementOf('wallsit', 'wallsit.W5');
    const s = syncFigure(w5, [ready, work(120), work(30), work(30)], {
      kind: 'rounds',
      perRound: 3,
    });
    if (!s) throw new Error('ingen sync');
    expect(labelAt(s.movement, s.at(1, 60))).toBe('2 min garde og slag');
    expect(labelAt(s.movement, s.at(2, 1))).toBe('Højre ben frem');
    expect(labelAt(s.movement, s.at(2, 15))).toBe('30 sek på venstre ben');
    expect(labelAt(s.movement, s.at(3, 1))).toBe('Skift ben');
    expect(labelAt(s.movement, s.at(3, 20))).toBe('30 sek på højre ben');
  });
});

describe('syncFigure: rutine', () => {
  test('brystryggen: de tre "dose"-faser deler punktets minut', () => {
    const os1 = movementOf('os', 'os.1');
    const s = syncFigure(os1, [work(60)], { kind: 'routine' });
    if (!s) throw new Error('ingen sync');
    expect(labelAt(s.movement, s.at(0, 5))).toBe('3 dybe vejrtrækninger');
    expect(labelAt(s.movement, s.at(0, 19.5))).toBe('Ryk en håndsbredde');
    expect(labelAt(s.movement, s.at(0, 59.5))).toBe('3 dybe vejrtrækninger');
  });

  test('åben bog uden "dose"-fase gentager bevægelsen i punktets tid', () => {
    const os2 = movementOf('os', 'os.2');
    const s = syncFigure(os2, [work(45)], { kind: 'routine' });
    if (!s) throw new Error('ingen sync');
    expect(labelAt(s.movement, s.at(0, 1))).toBe('Åbn og luk, 5 gange');
    expect(labelAt(s.movement, s.at(0, 22))).toBe('Skift side');
    expect(labelAt(s.movement, s.at(0, 26))).toBe('Åbn og luk, 5 gange');
  });

  test('couch stretch: to hold à ca. 45 sek med skiftet imellem', () => {
    const os6 = movementOf('os', 'os.6');
    const s = syncFigure(os6, [work(95)], { kind: 'routine' });
    if (!s) throw new Error('ingen sync');
    expect(labelAt(s.movement, s.at(0, 1))).toBe('Rejs dig op');
    expect(labelAt(s.movement, s.at(0, 30))).toBe('Hold 45 sek');
    expect(labelAt(s.movement, s.at(0, 47.5))).toBe('Ud, og skift ben');
    expect(labelAt(s.movement, s.at(0, 80))).toBe('Hold 45 sek');
  });
});
