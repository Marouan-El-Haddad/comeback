// The exercise card's data (docs/SPEC.md 3.8): every step and routine item gets a card with the
// programme's name and dose; the explanation comes from content/explain when it is written, and
// without it the card shows the programme's own words without sources (DECISIONS.md D43).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { findSourceRef } from '../../content/refs.ts';
import type {
  ExplainFile,
  ExplainItem,
  FigureFile,
  FigureItem,
  Movement,
  OwnMovement,
} from '../../content/types.ts';
import { PROGRAM } from '../../engine/program.ts';
import type { Program } from '../../engine/types.ts';
import {
  cardItem,
  cardMovements,
  doseLegend,
  routineLegend,
  equipmentText,
  explanationOf,
  figureIn,
  figureText,
  likeSubject,
  movementsText,
  phasesText,
} from '../components/cardItem.ts';

const ALL_IDS = [
  ...PROGRAM.tracks.flatMap((t) => t.steps.map((s) => s.id)),
  ...PROGRAM.routines.flatMap((r) => r.items.map((i) => `${r.id}.${i.key}`)),
];

function item(id: string, extra: Partial<ExplainItem> = {}): ExplainItem {
  return {
    id,
    trains: 'Træner.',
    start: 'Start.',
    steps: ['Et.', 'To.'],
    tempo: '3 sek ned.',
    breathing: 'Ånd ud.',
    cues: ['Et', 'To'],
    mistakes: [{ mistake: 'Fejl.', fix: 'Ret.' }],
    easier: 'Lettere.',
    harder: 'Sværere.',
    equipment: [],
    getReady: 'Klar.',
    movements: [
      {
        positions: [
          { id: 'top', name: 'Oppe', text: 'Oppe i ord.', contacts: [] },
          { id: 'bottom', name: 'Nede', text: 'Nede i ord.', contacts: [] },
        ],
        phases: [
          { to: 'bottom', seconds: 3, label: '3 sek ned' },
          { to: 'top', seconds: 1, label: 'Op' },
        ],
      },
    ],
    ...extra,
  };
}

describe('cardItem', () => {
  test('hvert trin og hvert rutinepunkt har et kort med navn og dosis', () => {
    for (const id of ALL_IDS) {
      const card = cardItem(PROGRAM, id);
      expect(card, id).not.toBeNull();
      expect(card?.name, id).not.toBe('');
      expect(card?.dose, id).not.toBe('');
      expect(card?.subject, id).toBe(id.slice(0, id.indexOf('.')));
    }
  });

  test('et ukendt ID giver intet kort', () => {
    expect(cardItem(PROGRAM, 'press.99')).toBeNull();
    expect(cardItem(PROGRAM, 'warmup.9')).toBeNull();
    expect(cardItem(PROGRAM, 'nothing')).toBeNull();
  });

  test('et trin: sporets korte navn og trinnet, programmets dosis og forklaring af tallene', () => {
    const card = cardItem(PROGRAM, 'press.1');
    expect(card?.kicker).toBe('Pres · trin 1');
    expect(card?.name).toBe('Push-up med tempo');
    expect(card?.dose).toBe('3 × 6–12');
    expect(card?.doseLegend).toBe('sæt × gentagelser');
  });

  test('et rutinepunkt: rutinens navn og punktets plads', () => {
    const card = cardItem(PROGRAM, 'warmup.2');
    expect(card?.kicker).toBe('Opvarmning · 2 af 4');
    expect(card?.name).toBe('Mobilisér');
    expect(card?.dose).toBe('3 min');
    expect(card?.doseLegend).toBeNull();
    expect(cardItem(PROGRAM, 'os.6')?.kicker).toBe('Open & Strong · 6 af 6');
  });

  test('programmets tekster vises uden sidetal og kilder', () => {
    for (const id of ALL_IDS) {
      const card = cardItem(PROGRAM, id);
      const texts = [card?.execution ?? '', ...(card?.cues ?? []), ...(card?.why ?? [])];
      for (const text of texts) expect(findSourceRef(text), `${id}: ${text}`).toBeNull();
    }
  });

  test('cues, der gentager udførelsen, vises ikke to gange', () => {
    // neck.N1: the cue is the execution without its full stop.
    expect(cardItem(PROGRAM, 'neck.N1')?.cues).toEqual([]);
    // press.1: the cues add something.
    expect(cardItem(PROGRAM, 'press.1')?.cues).toEqual([
      '3 sek ned, 1 sek stille',
      'Albuerne 45° ud',
    ]);
  });

  test('en udførelse, der kun gentager dosis, vises ikke; en runde vises i dele', () => {
    const club = cardItem(PROGRAM, 'club_sequence.C3');
    expect(club?.dose).toBe('1 × 3 runder');
    expect(club?.execution).toBeNull();
    expect(club?.round).toHaveLength(5);
    expect(club?.round[0]).toBe('Ned til midten. Hold 3 sek.');
    expect(cardItem(PROGRAM, 'press.1')?.round).toEqual([]);
  });

  test('sporets »Hvorfor« fra programmet uden kilder', () => {
    const why = cardItem(PROGRAM, 'power_legs.1')?.why ?? [];
    expect(why.length).toBeGreaterThan(0);
    expect(why.join(' ')).not.toContain('Pareja-Blanco');
    expect(cardItem(PROGRAM, 'warmup.1')?.why).toEqual([]);
  });

  test('et program uden trinnets spor giver intet kort', () => {
    const empty: Program = { ...PROGRAM, tracks: [], routines: [] };
    expect(cardItem(empty, 'press.1')).toBeNull();
  });
});

describe('explanationOf', () => {
  const file: ExplainFile = {
    format: 1,
    subject: 'burpee_emom',
    why: ['Hvorfor.'],
    items: [item('burpee_emom.E1'), { id: 'burpee_emom.E2', like: 'burpee_emom.E1' }],
  };

  test('finder trinnets forklaring', () => {
    expect(explanationOf(file, 'burpee_emom.E1')?.id).toBe('burpee_emom.E1');
  });

  test('et trin »som« et andet får det andet trins forklaring', () => {
    expect(explanationOf(file, 'burpee_emom.E2')?.trains).toBe('Træner.');
  });

  test('et trin »som« et andet får også dets »Mærk« (D55)', () => {
    const feel = 'Pulsen stiger i arbejdet og falder i pausen.';
    const withFeel: ExplainFile = {
      ...file,
      items: [item('burpee_emom.E1', { feel }), { id: 'burpee_emom.E2', like: 'burpee_emom.E1' }],
    };
    expect(explanationOf(withFeel, 'burpee_emom.E2')?.feel).toBe(feel);
    expect(explanationOf(file, 'burpee_emom.E2')?.feel).toBeUndefined();
  });

  test('uden fil eller uden trinnet: ingen forklaring', () => {
    expect(explanationOf(file, 'burpee_emom.E3')).toBeNull();
    expect(explanationOf(null, 'burpee_emom.E1')).toBeNull();
    expect(explanationOf(undefined, 'burpee_emom.E1')).toBeNull();
  });

  test('alle forklarede punkter i content/explain findes i programmet og får et kort', () => {
    const dir = join(process.cwd(), 'content', 'explain');
    for (const name of readdirSync(dir)) {
      const data = JSON.parse(readFileSync(join(dir, name), 'utf8')) as ExplainFile;
      for (const entry of data.items) {
        expect(cardItem(PROGRAM, entry.id), entry.id).not.toBeNull();
        expect(explanationOf(data, entry.id), entry.id).not.toBeNull();
      }
    }
  });
});

describe('tekster på kortet', () => {
  test('dosis forklares efter sin slags', () => {
    expect(doseLegend({ kind: 'reps', sets: [3, 3], reps: [6, 12] })).toBe('sæt × gentagelser');
    expect(doseLegend({ kind: 'power', sets: [3, 4], reps: [3, 5] })).toBe('sæt × gentagelser');
    expect(doseLegend({ kind: 'fixed', sets: 2, reps: 5 })).toBe('sæt × gentagelser');
    expect(doseLegend({ kind: 'hold', sets: [3, 3], seconds: [20, 45] })).toBe('sæt × sekunder');
    expect(doseLegend({ kind: 'emom', minutes: 4, reps: 3 })).toBe(
      'minutter × gentagelser i starten af hvert minut',
    );
    // The club sequence: the first number is sets (D47); »5 runder i træk« says it itself.
    expect(doseLegend({ kind: 'rounds', sets: 2, rounds: [1, 1], text: '2 × 1 runde' })).toBe(
      'sæt × runder',
    );
    expect(
      doseLegend({ kind: 'rounds', sets: 1, rounds: [5, 5], text: '5 runder i træk' }),
    ).toBeNull();
    expect(doseLegend({ kind: 'always', text: 'Altid' })).toBeNull();
  });

  test('en rutines dosis forklares, når den er tal × tal (D47)', () => {
    expect(routineLegend('2 × 8')).toBe('sæt × gentagelser');
    expect(routineLegend('8 × 5 sek')).toBe('gentagelser × sekunder');
    expect(routineLegend('3 positioner × 3 dybe vejrtrækninger')).toBeNull();
    expect(routineLegend('5 pr. side')).toBeNull();
    expect(routineLegend('2 min')).toBeNull();
    expect(cardItem(PROGRAM, 'os.3')?.doseLegend).toBe('sæt × gentagelser');
    expect(cardItem(PROGRAM, 'os.5')?.doseLegend).toBe('gentagelser × sekunder');
    expect(cardItem(PROGRAM, 'club_sequence.C1')?.doseLegend).toBe('sæt × runder');
    expect(cardItem(PROGRAM, 'club_sequence.C4')?.doseLegend).toBeNull();
  });

  test('udstyr som dansk opremsning; tom liste er kun gulvet', () => {
    expect(equipmentText([])).toBe('Kun gulvet');
    expect(equipmentText(['wall'])).toBe('Væg');
    expect(equipmentText(['chair', 'wall'])).toBe('Stol og væg');
    expect(equipmentText(['chair', 'books', 'towel'])).toBe('Stol, bøger og håndklæde');
  });

  test('faserne som én linje', () => {
    const [movement] = item('press.1').movements;
    expect(movement && phasesText(movement)).toBe('3 sek ned · Op');
  });

  test('positionerne i ord som tekstalternativ, med bevægelsens navn ved flere', () => {
    const one = item('press.1');
    expect(movementsText(one.movements)).toBe('Oppe: Oppe i ord. Nede: Nede i ord.');
    const [movement] = one.movements;
    if (!movement) throw new Error('no movement');
    const two = [
      { ...movement, id: 'a', name: 'Med bøjede knæ' },
      { ...movement, id: 'b', name: 'Med strakte ben' },
    ];
    expect(movementsText(two)).toBe(
      'Med bøjede knæ. Oppe: Oppe i ord. Nede: Nede i ord. Med strakte ben. Oppe: Oppe i ord. Nede: Nede i ord.',
    );
  });
});

describe('målinger, »like« på tværs af filer og »Potensér« (docs/SPEC.md 9.1)', () => {
  test('hver måling har et kort: »Måling«, navnet og hvad der måles', () => {
    for (const m of PROGRAM.measures) {
      const card = cardItem(PROGRAM, `measures.${m.id}`);
      expect(card?.subject, m.id).toBe('measures');
      expect(card?.kicker, m.id).toBe('Måling');
      expect(card?.name, m.id).toBe(m.name);
      expect(card?.dose, m.id).not.toBe('');
      expect(findSourceRef(card?.execution ?? ''), m.id).toBeNull();
    }
    expect(cardItem(PROGRAM, 'measures.wall_test')?.dose).toBe('Afstand i cm');
    expect(cardItem(PROGRAM, 'measures.hollow')?.dose).toBe('Så længe du kan');
    expect(cardItem(PROGRAM, 'measures.nope')).toBeNull();
  });

  test('en måling »som« et trin får trinnets forklaring fra den anden fil', () => {
    const measures: ExplainFile = {
      format: 1,
      subject: 'measures',
      why: ['Hvorfor.'],
      items: [{ id: 'measures.hollow', like: 'core_front.2' }],
    };
    const core: ExplainFile = {
      format: 1,
      subject: 'core_front',
      why: ['Hvorfor.'],
      items: [item('core_front.2')],
    };
    expect(likeSubject(measures, 'measures.hollow')).toBe('core_front');
    expect(explanationOf(measures, 'measures.hollow')).toBeNull();
    expect(explanationOf(measures, 'measures.hollow', core)?.id).toBe('core_front.2');
    expect(likeSubject(core, 'core_front.2')).toBeNull();
  });

  const potenser: Movement[] = [
    { id: 'power', name: 'Dagens første power-øvelse', from: 'power' },
    {
      ...(item('warmup.4').movements[0] as Movement),
      id: 'pogo',
      name: 'Pogo-hop',
      sessions: ['A'],
    },
  ];

  test('i Styrke A: power-trinnets bevægelse under dets navn og pogo-hop', () => {
    const power = { name: 'Squat jump', explained: item('power_legs.1') };
    const shown = cardMovements(potenser, { session: 'A', power: 'power_legs.1' }, power);
    expect(shown.map((m) => m.name)).toEqual(['Squat jump', 'Pogo-hop']);
    expect(shown[0]?.phases).toHaveLength(2);
  });

  test('i Styrke B: ingen pogo-hop; uden forklaring kun power-trinnets navn', () => {
    const power = { name: 'Hurtig push-up', explained: null };
    const shown = cardMovements(potenser, { session: 'B', power: 'power_upper.1' }, power);
    expect(shown.map((m) => m.name)).toEqual(['Hurtig push-up']);
    expect(shown[0]?.phases).toEqual([]);
    expect(movementsText(shown)).toBe('Hurtig push-up.');
  });

  test('et pas uden power-blok udelader den lånte bevægelse; uden for et pas vises alt', () => {
    expect(cardMovements(potenser, { session: 'travel', power: null }, null)).toEqual([]);
    const outside = cardMovements(potenser, null, null);
    expect(outside.map((m) => m.name)).toEqual(['Dagens første power-øvelse', 'Pogo-hop']);
    expect(phasesText(potenser[0] as Movement)).toBe('');
  });
});

describe('figuren på kortet: opslag og tekstalternativ (L2 i P3-reviewet)', () => {
  const figure = (id: string, movement?: string): FigureItem => ({
    id,
    ...(movement ? { movement } : {}),
    view: 'side',
    facing: 1,
    props: [],
    highlight: ['torso'],
    keyframes: {},
  });
  const file: FigureFile = {
    format: 1,
    subject: 'burpee_emom',
    figures: [
      figure('burpee_emom.E1'),
      { id: 'burpee_emom.E2', like: 'burpee_emom.E1' },
      figure('warmup.2', 'katko'),
    ],
  };

  test('figureIn finder figuren, følger »like« i samme fil og skelner bevægelser', () => {
    expect(figureIn(file, 'burpee_emom.E1')?.id).toBe('burpee_emom.E1');
    expect(figureIn(file, 'burpee_emom.E2')?.id).toBe('burpee_emom.E1');
    expect(figureIn(file, 'warmup.2', 'katko')?.movement).toBe('katko');
    expect(figureIn(file, 'warmup.2')).toBeNull();
    expect(figureIn(file, 'burpee_emom.E3')).toBeNull();
    expect(figureIn(null, 'burpee_emom.E1')).toBeNull();
  });

  test('cardMovements siger, hvor positionerne kommer fra: punktet selv, en »like« og »Potensér«', () => {
    const own = item('burpee_emom.E1');
    expect(cardMovements(own.movements, null, null, 'burpee_emom.E1')[0]?.source).toEqual({
      item: 'burpee_emom.E1',
      movement: undefined,
    });
    // A like in the same file or in another (a measurement like its step) passes the target's id.
    const like = cardMovements(item('core_front.2').movements, null, null, 'core_front.2');
    expect(like[0]?.source?.item).toBe('core_front.2');
    // »Potensér« in a session: the power step's own movement and figure.
    const potenser: Movement[] = [{ id: 'power', name: 'Potensér', from: 'power' }];
    const shown = cardMovements(
      potenser,
      { session: 'A', power: 'power_legs.1' },
      { name: 'Squat jump', explained: item('power_legs.1') },
    );
    expect(shown[0]?.source).toEqual({ item: 'power_legs.1', movement: undefined });
  });

  test('figureText beskriver navnet, hver position og faserne', () => {
    const movement = item('press.1').movements[0] as OwnMovement;
    expect(figureText('Push-up med tempo', movement)).toBe(
      'Push-up med tempo. Oppe: Oppe i ord. Nede: Nede i ord. Faserne: 3 sek ned og op.',
    );
  });
});
