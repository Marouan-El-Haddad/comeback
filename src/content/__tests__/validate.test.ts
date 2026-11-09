// The validation of content/ (docs/SPEC.md 9.1): valid examples pass, and each rule gives a short
// message that says what is wrong and where.
import { describe, expect, test } from 'vitest';
import { PROGRAM } from '../../engine/program.ts';
import type { ExplainFile, ExplainItem, FigureFile, FigureItem, OwnMovement } from '../types.ts';
import {
  coverage,
  statedSeconds,
  subjectOf,
  validateExplainFile,
  validateFigureFile,
} from '../validate.ts';
import {
  CLUB,
  CORE_FRONT,
  CORE_FRONT_FIGURES,
  EMOM,
  MEASURES_EXPLAIN,
  OS,
  PRESS,
  PRESS_FIGURES,
  WALLSIT,
  WARMUP_POTENSER,
} from './fixtures.ts';

/** The item's first movement, which in these examples has its own positions and phases. */
const own = (item: ExplainItem, n = 0) => item.movements[n] as OwnMovement;

const explainProblems = (file: unknown, name: string) =>
  validateExplainFile(file, name, PROGRAM).map((p) => `${p.where}: ${p.message}`);
const figureProblems = (file: unknown, name: string, explain: ExplainFile | null) =>
  validateFigureFile(file, name, PROGRAM, explain).map((p) => `${p.where}: ${p.message}`);

/** A copy of the press example with the change applied to its first item. */
function press(change: (item: ExplainItem, file: ExplainFile) => void): ExplainFile {
  const file = structuredClone(PRESS);
  change(file.items[0] as ExplainItem, file);
  return file;
}

function pressFigure(change: (figure: FigureItem, file: FigureFile) => void): FigureFile {
  const file = structuredClone(PRESS_FIGURES);
  change(file.figures[0] as FigureItem, file);
  return file;
}

describe('forklaringer: gyldige eksempler', () => {
  test.each([
    ['press', PRESS],
    ['burpee_emom', EMOM],
    ['os', OS],
    ['core_front', CORE_FRONT],
  ])('%s har ingen fejl', (name, file) => {
    expect(explainProblems(file, name)).toEqual([]);
  });

  test('rutinepunkter har id’et rutine.nr', () => {
    expect(subjectOf(PROGRAM, 'warmup')?.items.map((i) => i.id)).toEqual([
      'warmup.1',
      'warmup.2',
      'warmup.3',
      'warmup.4',
    ]);
    expect(subjectOf(PROGRAM, 'os')?.items).toHaveLength(6);
    expect(subjectOf(PROGRAM, 'nope')).toBeNull();
  });

  test('tider i programmets tekst læses som sekunder', () => {
    expect(statedSeconds(['3 sek ned, 1 sek pause lige over gulvet.'])).toEqual([
      [3, 3, '3 sek ned'],
      [1, 1, '1 sek pause'],
    ]);
    expect(statedSeconds(['Sænk dig på 4–5 sek til en pude.'])).toEqual([[4, 5, '4–5 sek til']]);
    expect(statedSeconds(['Højst seks ord.'])).toEqual([]);
  });
});

describe('forklaringer: hver regel giver en fejl', () => {
  const cases: Array<[string, unknown, string]> = [
    ['forkert format', { ...PRESS, format: 2 }, 'format: skal være 1'],
    [
      'subject er ikke filens navn',
      { ...PRESS, subject: 'pull' },
      'subject: skal være filens navn',
    ],
    ['ukendt felt', press((i) => Object.assign(i, { tips: 'x' })), 'ukendt felt »tips«'],
    [
      'manglende felt',
      press((i) => delete (i as Partial<ExplainItem>).getReady),
      'feltet »getReady« mangler',
    ],
    [
      'trin fra et andet spor',
      press((i) => (i.id = 'pull.1')),
      '»pull.1« er ikke et trin i »press«',
    ],
    [
      'samme trin to gange',
      press((_, f) => f.items.push(structuredClone(f.items[0]!))),
      'står to gange',
    ],
    [
      'forkert rækkefølge',
      press((_, f) =>
        f.items.unshift({ ...(structuredClone(f.items[0]!) as ExplainItem), id: 'press.2' }),
      ),
      'programmets rækkefølge',
    ],
    ['for få trin', press((i) => (i.steps = ['Gør det.'])), 'skal have 2–4 trin (har 1)'],
    [
      'for mange trin',
      press((i) => (i.steps = ['A.', 'B.', 'C.', 'D.', 'E.'])),
      'skal have 2–4 trin (har 5)',
    ],
    [
      'for lang cue',
      press((i) => (i.cues[0] = 'Hold kroppen helt stiv fra hæl til hoved')),
      'højst 6 ord (har 8)',
    ],
    ['én cue', press((i) => (i.cues = ['Albuerne bagud'])), 'skal have 2–3 cues'],
    [
      'én typisk fejl',
      press((i) => (i.mistakes = i.mistakes.slice(0, 1))),
      'skal have 2–3 typiske fejl',
    ],
    [
      'sidetal',
      press((i) => (i.trains = 'Som på side 12.')),
      'ingen henvisning til PDF, sidetal eller kilder',
    ],
    ['PDF', press((i) => (i.easier = 'Se PDF’en.')), 'ingen henvisning til PDF'],
    ['kilde', press((i) => (i.easier = 'Kilden siger det.')), 'ingen henvisning'],
    ['citat', press((_, f) => (f.why = ['Det virker (Edwards 2023).'])), 'ingen henvisning'],
    ['udråbstegn', press((i) => (i.getReady = 'Kom så!')), 'ingen udråbstegn'],
    ['emoji', press((i) => (i.cues[1] = 'Albuerne bagud 💪')), 'ingen emojis'],
    ['dobbelt mellemrum', press((i) => (i.start = 'Hænderne  i gulvet.')), 'dobbelt mellemrum'],
    [
      'mellemrum til sidst',
      press((i) => (i.start = 'Hænderne i gulvet. ')),
      'mellemrum i starten eller slutningen',
    ],
    ['linjeskift', press((i) => (i.start = 'Hænderne\ni gulvet.')), 'ingen linjeskift'],
    ['prosa uden punktum', press((i) => (i.breathing = 'Ånd roligt')), 'skal slutte med punktum'],
    ['cue med punktum', press((i) => (i.cues[1] = 'Albuerne bagud.')), 'uden punktum til sidst'],
    [
      'lille begyndelsesbogstav',
      press((i) => (i.harder = 'trin 2.')),
      'stort bogstav eller et tal',
    ],
    [
      'for lang tekst',
      press((i) => (i.getReady = `${'Læg dig ned. '.repeat(14)}Klar.`)),
      'højst 140 tegn',
    ],
    ['dosis i teksten', press((i) => (i.steps[0] = 'Lav 3 × 8.')), 'skriv ikke dosis (»3 × 8«)'],
    ['ukendt udstyr', press((i) => (i.equipment = ['rope' as never])), 'ukendt udstyr »rope«'],
    ['udstyr to gange', press((i) => (i.equipment = ['wall', 'wall'])), '»wall« står to gange'],
    [
      'ukendt kropsdel',
      press((i) => (own(i).positions[0]!.contacts[0]!.part = 'nose' as never)),
      'ukendt kropsdel »nose«',
    ],
    [
      'count på en enkelt kropsdel',
      press((i) => (own(i).positions[0]!.contacts = [{ part: 'back', on: 'floor', count: 1 }])),
      '»count« bruges kun',
    ],
    [
      'flade uden udstyr',
      press((i) => (own(i).positions[0]!.contacts[1]!.on = 'chair')),
      '»chair« skal også stå i »equipment«',
    ],
    [
      'ugyldigt positions-id',
      press((i) => (own(i).positions[1]!.id = 'Bund')),
      'små bogstaver a–z',
    ],
    [
      'fase til ukendt position',
      press((i) => (own(i).phases[0]!.to = 'mid')),
      'positionen »mid« findes ikke (der er: top, bottom)',
    ],
    [
      'position uden fase',
      press((i) =>
        own(i).positions.push({
          id: 'mid',
          name: 'Midt',
          text: 'Halvvejs.',
          contacts: [],
        }),
      ),
      'ingen fase går til positionen »mid«',
    ],
    ['for lang fase', press((i) => (own(i).phases[0]!.seconds = 12)), '0.2–10 sek eller "dose"'],
    [
      '"dose" i en øvelse med gentagelser',
      press((i) => (own(i).phases[1]!.seconds = 'dose')),
      '"dose" bruges kun ved hold',
    ],
    [
      'gentagelsen slutter et andet sted',
      press((i) => own(i).phases.pop()),
      'sidste fase skal gå til »top«',
    ],
    [
      'programmets tempo mangler',
      press((i) => (own(i).phases[0]!.seconds = 2)),
      'programmet siger »3 sek ned«, men ingen fase varer 3 sek',
    ],
    [
      'tempoteksten passer ikke',
      press((i) => (i.tempo = '2 sek ned, 1 sek stille, op.')),
      'tempo: »2 sek ned« passer ikke med faserne',
    ],
    [
      'flere bevægelser uden id',
      press((i) => i.movements.push(structuredClone(i.movements[0]!))),
      'flere bevægelser kræver et »id«',
    ],
    ['ukendt spor', { ...PRESS, subject: 'kettlebell' }, 'subject'],
  ];
  test.each(cases)('%s', (_, file, fragment) => {
    const name = (file as { subject?: string }).subject === 'kettlebell' ? 'kettlebell' : 'press';
    expect(explainProblems(file, name).join('\n')).toContain(fragment);
  });

  test('et hold uden "dose"-fase', () => {
    const file = structuredClone(CORE_FRONT);
    own(file.items[1] as ExplainItem).phases[0]!.seconds = 5;
    expect(explainProblems(file, 'core_front').join('\n')).toContain('et hold skal have en fase');
  });

  test('»like« peger på et fuldt forklaret trin', () => {
    const file = structuredClone(EMOM);
    file.items[1] = { id: 'burpee_emom.E2', like: 'burpee_emom.E3' };
    expect(explainProblems(file, 'burpee_emom').join('\n')).toContain(
      '»like« skal pege på et fuldt forklaret trin',
    );
  });

  test('en rutine må have "dose" og slutte et andet sted', () => {
    const file = structuredClone(OS);
    const movement = own(file.items[0] as ExplainItem);
    movement.phases = [
      { to: 'up', seconds: 1, label: 'Løft' },
      { to: 'up', seconds: 2, label: 'Hold 2 sek' },
      { to: 'up', seconds: 'dose', label: 'Bliv' },
    ];
    movement.positions = movement.positions.filter((p) => p.id !== 'down');
    movement.positions.unshift({ id: 'down', name: 'Nede', text: 'Nede.', contacts: [] });
    expect(explainProblems(file, 'os')).toEqual([]);
  });

  test('en fil, der ikke er et objekt', () => {
    expect(explainProblems([], 'press')).toEqual([': skal være et objekt { … }']);
  });
});

describe('figurer', () => {
  test('gyldige eksempler har ingen fejl', () => {
    expect(figureProblems(PRESS_FIGURES, 'press', PRESS)).toEqual([]);
    expect(figureProblems(CORE_FRONT_FIGURES, 'core_front', CORE_FRONT)).toEqual([]);
  });

  const cases: Array<[string, unknown, string]> = [
    ['ukendt trin', pressFigure((f) => (f.id = 'press.9')), '»press.9« er ikke et trin i »press«'],
    ['trin uden forklaring', pressFigure((f) => (f.id = 'press.2')), 'har ingen forklaring'],
    [
      'mangler en keyframe',
      pressFigure((f) => delete f.keyframes.bottom),
      'mangler positionen »bottom«',
    ],
    [
      'keyframe uden position',
      pressFigure((f) => (f.keyframes.mid = structuredClone(f.keyframes.top!))),
      '»mid« er ikke en position',
    ],
    [
      'bend i sidebilledet',
      pressFigure((f) => (f.keyframes.top!.arms.near = { to: [69, 0], bend: 1 })),
      'fjern »bend«',
    ],
    [
      'bend mangler forfra',
      pressFigure((f) => (f.view = 'front')),
      'skal være 1 eller -1 i frontbilledet',
    ],
    [
      'facing forfra',
      pressFigure((f) => Object.assign(f, { view: 'top', facing: 1 })),
      '»facing« bruges kun i sidebilledet',
    ],
    [
      'skjult lem i én keyframe',
      pressFigure((f) => (f.keyframes.top!.arms.far = null)),
      'far.arms er skjult (null)',
    ],
    [
      'ugyldigt punkt',
      pressFigure((f) => (f.keyframes.top!.hip = [1] as never)),
      'skal være et punkt [x, y]',
    ],
    [
      'punkt langt væk',
      pressFigure((f) => (f.keyframes.top!.hip = [900, 20])),
      'langt uden for figuren',
    ],
    [
      'for kort overarm',
      pressFigure((f) => (f.keyframes.bottom!.arms.near = { to: [69, 0], upper: 3 })),
      'skal være mellem 8 og 16',
    ],
    [
      'ukendt segment',
      pressFigure((f) => (f.highlight = ['near.toe' as never])),
      'ukendt segment »near.toe«',
    ],
    ['intet rødt segment', pressFigure((f) => (f.highlight = [])), 'skal have 1–8 røde segmenter'],
    [
      'rekvisit uden udstyr',
      pressFigure((f) => (f.props = [{ type: 'chair', x: 0, width: 24, height: 23 }])),
      '»chair« står ikke i forklaringens »equipment«',
    ],
    [
      'ukendt rekvisit',
      pressFigure((f) => (f.props = [{ type: 'rope' } as never])),
      'ukendt rekvisit »rope«',
    ],
    [
      'width i sidebilledet',
      pressFigure((f) => (f.keyframes.top!.width = { shoulders: 22, hips: 12 })),
      '»width« bruges kun i frontbilledet',
    ],
    [
      'samme figur to gange',
      pressFigure((_, file) => file.figures.push(structuredClone(file.figures[0]!))),
      'står to gange',
    ],
  ];
  test.each(cases)('%s', (_, file, fragment) => {
    expect(figureProblems(file, 'press', PRESS).join('\n')).toContain(fragment);
  });

  test('kontakt med en flade kræver rekvisitten', () => {
    const explain = press((i) => {
      i.equipment = ['chair'];
      own(i).positions[0]!.contacts[1]!.on = 'chair';
    });
    expect(figureProblems(PRESS_FIGURES, 'press', explain).join('\n')).toContain(
      'positionen »top« rører »chair«, men figuren har ingen chair',
    );
    const withChair = pressFigure(
      (f) => (f.props = [{ type: 'chair', x: -10, width: 24, height: 23 }]),
    );
    expect(figureProblems(withChair, 'press', explain)).toEqual([]);
  });

  test('»like« peger på en tegnet figur i filen', () => {
    const explain = press((_, f) =>
      f.items.push({ ...structuredClone(f.items[0] as ExplainItem), id: 'press.2' }),
    );
    const like = (target: string) =>
      pressFigure((_, file) => file.figures.push({ id: 'press.2', like: target }));
    expect(figureProblems(like('press.1'), 'press', explain)).toEqual([]);
    expect(figureProblems(like('press.4'), 'press', explain).join('\n')).toContain(
      'skal pege på en tegnet figur i filen (ikke »press.4«)',
    );
  });

  test('figuren kræver forklaringen', () => {
    expect(figureProblems(PRESS_FIGURES, 'press', null).join('\n')).toContain(
      'forklaringen content/explain/press.json mangler',
    );
  });

  test('et trin forklaret »like« et andet bruger dets figur', () => {
    const file: FigureFile = {
      format: 1,
      subject: 'burpee_emom',
      figures: [
        {
          id: 'burpee_emom.E2',
          view: 'side',
          facing: 1,
          props: [],
          highlight: ['torso'],
          keyframes: {},
        },
      ],
    };
    expect(figureProblems(file, 'burpee_emom', EMOM).join('\n')).toContain(
      'forklares som »burpee_emom.E1« og bruger dens figur',
    );
  });
});

describe('dækning', () => {
  test('tæller forklarede trin og trin med figur', () => {
    const result = coverage(PROGRAM, [PRESS, EMOM], [PRESS_FIGURES]);
    expect(result.all).toHaveLength(
      PROGRAM.tracks.reduce((n, t) => n + t.steps.length, 0) +
        PROGRAM.routines.reduce((n, r) => n + r.items.length, 0) +
        PROGRAM.measures.length,
    );
    expect(result.explained).toEqual(['press.1', 'burpee_emom.E1', 'burpee_emom.E2']);
    expect(result.drawn).toEqual(['press.1']);
  });
});

describe('gentagelser, tider og »dose« (M2, M3)', () => {
  test('klubsekvensen med ti mikro-pumps som én gentaget fase og wall sit med slag under holdet', () => {
    expect(explainProblems(CLUB, 'club_sequence')).toEqual([]);
    expect(explainProblems(WALLSIT, 'wallsit')).toEqual([]);
  });

  const club = (change: (m: OwnMovement) => void): ExplainFile => {
    const file = structuredClone(CLUB);
    change(own(file.items[0] as ExplainItem));
    return file;
  };
  const cases: Array<[string, ExplainFile, string]> = [
    [
      'repeat til samme position',
      club((m) => (m.phases[6]!.to = 'mid')),
      '»repeat« går frem og tilbage: »to« skal være en anden position end »mid«',
    ],
    [
      'repeat uden for 2–30',
      club((m) => (m.phases[6]!.repeat = 40)),
      'et helt tal fra 2 til 30 eller "dose"',
    ],
    [
      'en label med sekunder, der ikke passer',
      club((m) => (m.phases[1]!.seconds = 1)),
      '»Hold 3 sek« siger 3 sek, men fasen varer 1 sek',
    ],
    [
      'en kort tid i en label på en "dose"-fase',
      club((m) => (m.phases[1]!.seconds = 'dose')),
      '»Hold 3 sek« siger 3 sek, men fasen er "dose"',
    ],
  ];
  test.each(cases)('%s', (_, file, fragment) => {
    expect(explainProblems(file, 'club_sequence').join('\n')).toContain(fragment);
  });

  test('"repeat": "dose" kun, hvor dosis tillader det', () => {
    const file = structuredClone(PRESS);
    own(file.items[0] as ExplainItem).phases[0]!.repeat = 'dose';
    expect(explainProblems(file, 'press').join('\n')).toContain('"dose" bruges kun ved hold');
  });

  test('en gentaget fase ender, hvor den startede', () => {
    // Push-up: down and still, then three times up and back down: the repetition ends at the bottom.
    const file = structuredClone(PRESS);
    const movement = own(file.items[0] as ExplainItem);
    movement.phases = [
      { to: 'bottom', seconds: 3, label: '3 sek ned' },
      { to: 'bottom', seconds: 1, label: '1 sek stille' },
      { to: 'top', seconds: 1, repeat: 3, label: 'Tre gange op' },
    ];
    expect(explainProblems(file, 'press').join('\n')).toContain('sidste fase skal gå til »top«');
  });

  test('rutinens dosis læses: hage-ind »8 × 5 sek« kræver en fase på 5 sek', () => {
    const chin: ExplainItem = {
      ...(structuredClone(OS.items[0]) as ExplainItem),
      id: 'os.5',
      movements: [
        {
          positions: [
            { id: 'neutral', name: 'Neutral', text: 'Blikket vandret.', contacts: [] },
            { id: 'tucked', name: 'Hagen ind', text: 'Hagen trukket lige bagud.', contacts: [] },
          ],
          phases: [
            { to: 'tucked', seconds: 1, label: 'Hagen ind' },
            { to: 'tucked', seconds: 2, label: 'Hold 2 sek' },
            { to: 'neutral', seconds: 1, label: 'Slip' },
          ],
        },
      ],
    };
    chin.tempo = 'Roligt ind, og slip.';
    const file: ExplainFile = { ...structuredClone(OS), items: [chin] };
    expect(explainProblems(file, 'os').join('\n')).toContain(
      'programmet siger »5 sek«, men ingen fase varer 5 sek',
    );
  });
});

describe('målinger og »like« på tværs af filer (M4, L6)', () => {
  const resolve = (id: string) =>
    id === 'core_front.2' ? (CORE_FRONT.items[0] as ExplainItem) : null;

  test('målingerne er et emne med id’erne measures.<id>', () => {
    const measures = subjectOf(PROGRAM, 'measures');
    expect(measures?.items.map((i) => i.id)).toContain('measures.wall_test');
    expect(measures?.items).toHaveLength(PROGRAM.measures.length);
    expect(validateExplainFile(MEASURES_EXPLAIN, 'measures', PROGRAM, resolve)).toEqual([]);
  });

  test('»like« til et trin i en anden fil skal være forklaret dér', () => {
    const problems = validateExplainFile(MEASURES_EXPLAIN, 'measures', PROGRAM, () => null);
    expect(problems.map((p) => p.message).join('\n')).toContain(
      '»like« peger på »core_front.2«, som ikke er forklaret fuldt i content/explain/core_front.json',
    );
  });

  test('»like« til noget, programmet ikke har', () => {
    const file = structuredClone(MEASURES_EXPLAIN);
    file.items[1] = { id: 'measures.hollow', like: 'core_front.9' };
    expect(explainProblems(file, 'measures').join('\n')).toContain(
      '»like« peger på »core_front.9«, som ikke findes i programmet',
    );
  });

  test('»like« deler »Lettere« og »Sværere«, så de nævner intet trin (L6)', () => {
    const file = structuredClone(EMOM);
    (file.items[0] as ExplainItem).harder = 'Trin E2: et minut mere.';
    expect(explainProblems(file, 'burpee_emom').join('\n')).toContain(
      '»like« deler »harder« med burpee_emom.E1, som nævner',
    );
  });
});

describe('»Potensér« og pas (M5)', () => {
  test('dagens første power-øvelse lånes, og pogo-hop hører kun til Styrke A', () => {
    expect(explainProblems(WARMUP_POTENSER, 'warmup')).toEqual([]);
  });

  test('»from« og »sessions« bruges kun i rutiner', () => {
    const file = structuredClone(PRESS);
    const item = file.items[0] as ExplainItem;
    item.movements = [
      { id: 'a', name: 'Lånt', from: 'power' },
      { ...own(item), id: 'b', name: 'Egen', sessions: ['A'] },
    ];
    const text = explainProblems(file, 'press').join('\n');
    expect(text).toContain('»from« bruges kun i rutiner');
    expect(text).toContain('»sessions« bruges kun i rutiner');
  });

  test('ukendt pas og to lånte bevægelser', () => {
    const file = structuredClone(WARMUP_POTENSER);
    const item = file.items[0] as ExplainItem;
    item.movements[1]!.sessions = ['X' as never];
    item.movements.push({ id: 'power2', name: 'Igen', from: 'power' });
    const text = explainProblems(file, 'warmup').join('\n');
    expect(text).toContain('ukendt pas »X«');
    expect(text).toContain('højst én bevægelse med »from«');
  });
});

describe('figurer: facing og nakke (L1, L3)', () => {
  test('sidebilledet skal have »facing«', () => {
    const file = structuredClone(PRESS_FIGURES);
    delete (file.figures[0] as { facing?: number }).facing;
    expect(figureProblems(file, 'press', PRESS).join('\n')).toContain(
      'sidebilledet skal have »facing«',
    );
  });

  test('nakken kan være rød', () => {
    const file = structuredClone(PRESS_FIGURES);
    (file.figures[0] as FigureItem).highlight = ['neck'];
    expect(figureProblems(file, 'press', PRESS)).toEqual([]);
  });

  test('en lånt bevægelse har ingen figur', () => {
    const file: FigureFile = {
      format: 1,
      subject: 'warmup',
      figures: [
        {
          id: 'warmup.4',
          movement: 'power',
          view: 'side',
          facing: 1,
          props: [],
          highlight: ['torso'],
          keyframes: {},
        },
      ],
    };
    expect(figureProblems(file, 'warmup', WARMUP_POTENSER).join('\n')).toContain(
      'bevægelsen viser dagens power-trin med dets egen figur',
    );
  });
});

describe('kilder i forklaringerne (L2)', () => {
  test('ingen årstal og ingen studier eller forskning', () => {
    const year = press((i) => (i.trains = 'Som vist i 2023.'));
    expect(explainProblems(year, 'press').join('\n')).toContain('ingen årstal (»2023«)');
    const study = press((i) => (i.trains = 'En metaanalyse viser, at det virker.'));
    expect(explainProblems(study, 'press').join('\n')).toContain(
      'ingen henvisning til studier eller forskning (»metaanalyse«)',
    );
    // Words that only look like it: »forskellige«, »2.000«.
    const fine = press((i) => (i.trains = 'Forskellige vinkler og 2.000 skridt.'));
    expect(explainProblems(fine, 'press')).toEqual([]);
  });
});

describe('»Mærk« (feel, D55)', () => {
  const FEEL = 'Brystet og bagsiden af armene, ikke skuldrene.';

  /** press.1 with »Mærk« as key number `index`: the order of the keys does not matter. */
  const feelAt = (index: number, feel: unknown = FEEL): ExplainFile =>
    press((i, f) => {
      const entries: Array<[string, unknown]> = Object.entries(i);
      entries.splice(index, 0, ['feel', feel]);
      f.items[0] = Object.fromEntries(entries) as unknown as ExplainItem;
    });
  const after = (key: keyof ExplainItem) => Object.keys(PRESS.items[0]!).indexOf(key) + 1;
  const feelProblems = (feel: unknown) => explainProblems(feelAt(after('trains'), feel), 'press');

  test('valgfrit: uden »Mærk« er punktet gyldigt som før', () => {
    expect('feel' in PRESS.items[0]!).toBe(false);
    expect(explainProblems(PRESS, 'press')).toEqual([]);
  });

  test.each([
    ['først', 0],
    ['lige efter »trains«', after('trains')],
    ['lige efter »cues«', after('cues')],
    ['sidst', Object.keys(PRESS.items[0]!).length],
  ])('»Mærk« %s er gyldigt', (_, index) => {
    const file = feelAt(index);
    expect(Object.keys(file.items[0]!).indexOf('feel')).toBe(index);
    expect(explainProblems(file, 'press')).toEqual([]);
  });

  test('forkortelser, tal og et spørgsmål er stadig én sætning', () => {
    expect(feelProblems('Brystet og armene, med albuerne ca. 45° ud.')).toEqual([]);
    expect(feelProblems('Mærker du det i brystet og bagsiden af armene?')).toEqual([]);
  });

  const cases: Array<[string, unknown, string]> = [
    [
      'for lang',
      `${'Brystet og armene, '.repeat(6)}ikke skuldrene.`,
      'press.1 › feel: højst 120 tegn (har 129)',
    ],
    [
      'flere sætninger',
      'Brystet og armene. Ikke skuldrene.',
      'press.1 › feel: skal være én sætning (har 2)',
    ],
    [
      'et spørgsmål og en sætning',
      'Mærker du det i skuldrene? Så sænk dig mindre.',
      'press.1 › feel: skal være én sætning (har 2)',
    ],
    ['emoji', 'Brystet og armene 💪.', 'press.1 › feel: ingen emojis'],
    [
      'kildehenvisning',
      'Brystet og armene, som på side 12.',
      'press.1 › feel: ingen henvisning til PDF, sidetal eller kilder',
    ],
    ['studier', 'Brystet, som forskningen viser.', 'press.1 › feel: ingen henvisning til studier'],
    ['dosis', 'Brystet efter 3 × 8.', 'press.1 › feel: skriv ikke dosis (»3 × 8«)'],
    ['uden punktum', 'Brystet og armene', 'press.1 › feel: skal slutte med punktum'],
    ['tom', '', 'press.1 › feel: må ikke være tom'],
    ['ikke en tekst', ['Brystet.'], 'press.1 › feel: skal være en tekst'],
  ];
  test.each(cases)('%s afvises', (_, feel, message) => {
    expect(feelProblems(feel).join('\n')).toContain(message);
  });

  test('en »like« får »Mærk« med det trin, den peger på, og har ikke sit eget', () => {
    const file = structuredClone(EMOM);
    // The types let it through (»feel« is a field of a full explanation); the validation does not.
    file.items[1] = { id: 'burpee_emom.E2', like: 'burpee_emom.E1', feel: FEEL };
    expect(explainProblems(file, 'burpee_emom').join('\n')).toContain(
      'burpee_emom.E2: ukendt felt »feel«',
    );
  });
});

describe('labels med tid på hold og gentagelser (L7)', () => {
  /** A neck hold (N1: 10 sek, N2: 10–30 sek) whose hold phase has the given label. */
  const neck = (id: string, label: string): ExplainFile => {
    const item = structuredClone(WALLSIT.items[0]) as ExplainItem;
    item.id = id;
    item.equipment = [];
    const head = [{ part: 'head' as const, on: 'floor' as const }];
    item.movements = [
      {
        positions: [
          { id: 'rest', name: 'Hvile', text: 'Hovedet hviler i gulvet.', contacts: head },
          { id: 'press', name: 'Pres', text: 'Hagen trukket ind.', contacts: head },
        ],
        phases: [
          { to: 'press', seconds: 1, label: 'Hagen ind' },
          { to: 'press', seconds: 'dose', label },
          { to: 'rest', seconds: 1, label: 'Slip' },
        ],
      },
    ];
    return { format: 1, subject: 'neck', why: ['Nakken holder hovedet stille.'], items: [item] };
  };

  test('»Hold 10 sek« i N1 og »Hold 10–30 sek« i N2 er holdets tid fra dosis', () => {
    expect(explainProblems(neck('neck.N1', 'Hold 10 sek'), 'neck')).toEqual([]);
    expect(explainProblems(neck('neck.N2', 'Hold 10–30 sek'), 'neck')).toEqual([]);
  });

  test('en anden tid end dosis på holdet afvises med et råd, der kan følges', () => {
    expect(explainProblems(neck('neck.N2', 'Hold 5 sek'), 'neck').join('\n')).toContain(
      '»Hold 5 sek« siger 5 sek, men holdet varer som dosis (10–30 sek): skriv dosisens tid, eller fjern tiden fra labelen',
    );
  });

  test('tiden for én gentagelse eller alle gentagelser i en »repeat«-fase', () => {
    const wallsit = structuredClone(WALLSIT);
    own(wallsit.items[0] as ExplainItem).phases[0]!.label = 'Et slag hver 1,5 sek';
    expect(explainProblems(wallsit, 'wallsit')).toEqual([]);
    for (const label of ['0,8 sek pr. pump', '10 pumps på 8 sek']) {
      const club = structuredClone(CLUB);
      own(club.items[0] as ExplainItem).phases[6]!.label = label;
      expect(explainProblems(club, 'club_sequence'), label).toEqual([]);
    }
    const club = structuredClone(CLUB);
    own(club.items[0] as ExplainItem).phases[6]!.label = '2 sek pr. pump';
    expect(explainProblems(club, 'club_sequence').join('\n')).toContain(
      '»2 sek pr. pump« siger 2 sek, men én gang frem og tilbage varer 0,8 sek og alle gange 8 sek',
    );
  });
});
