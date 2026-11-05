// The validation of content/ (docs/SPEC.md 9.1): valid examples pass, and each rule gives a short
// message that says what is wrong and where.
import { describe, expect, test } from 'vitest';
import { PROGRAM } from '../../engine/program.ts';
import type { ExplainFile, ExplainItem, FigureFile, FigureItem } from '../types.ts';
import {
  coverage,
  statedSeconds,
  subjectOf,
  validateExplainFile,
  validateFigureFile,
} from '../validate.ts';
import { CORE_FRONT, CORE_FRONT_FIGURES, EMOM, OS, PRESS, PRESS_FIGURES } from './fixtures.ts';

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
      press((i) => (i.movements[0]!.positions[0]!.contacts[0]!.part = 'nose' as never)),
      'ukendt kropsdel »nose«',
    ],
    [
      'count på en enkelt kropsdel',
      press(
        (i) => (i.movements[0]!.positions[0]!.contacts = [{ part: 'back', on: 'floor', count: 1 }]),
      ),
      '»count« bruges kun',
    ],
    [
      'flade uden udstyr',
      press((i) => (i.movements[0]!.positions[0]!.contacts[1]!.on = 'chair')),
      '»chair« skal også stå i »equipment«',
    ],
    [
      'ugyldigt positions-id',
      press((i) => (i.movements[0]!.positions[1]!.id = 'Bund')),
      'små bogstaver a–z',
    ],
    [
      'fase til ukendt position',
      press((i) => (i.movements[0]!.phases[0]!.to = 'mid')),
      'positionen »mid« findes ikke (der er: top, bottom)',
    ],
    [
      'position uden fase',
      press((i) =>
        i.movements[0]!.positions.push({
          id: 'mid',
          name: 'Midt',
          text: 'Halvvejs.',
          contacts: [],
        }),
      ),
      'ingen fase går til positionen »mid«',
    ],
    [
      'for lang fase',
      press((i) => (i.movements[0]!.phases[0]!.seconds = 12)),
      '0.2–10 sek eller "dose"',
    ],
    [
      '"dose" i en øvelse med gentagelser',
      press((i) => (i.movements[0]!.phases[1]!.seconds = 'dose')),
      '"dose" bruges kun ved hold',
    ],
    [
      'gentagelsen slutter et andet sted',
      press((i) => i.movements[0]!.phases.pop()),
      'sidste fase skal gå til »top«',
    ],
    [
      'programmets tempo mangler',
      press((i) => (i.movements[0]!.phases[0]!.seconds = 2)),
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
    (file.items[0] as ExplainItem).movements[0]!.phases[0]!.seconds = 5;
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
    const item = file.items[0] as ExplainItem;
    item.movements[0]!.phases = [
      { to: 'up', seconds: 1, label: 'Løft' },
      { to: 'up', seconds: 2, label: 'Hold 2 sek' },
      { to: 'up', seconds: 'dose', label: 'Bliv' },
    ];
    item.movements[0]!.positions = item.movements[0]!.positions.filter((p) => p.id !== 'down');
    item.movements[0]!.positions.unshift({ id: 'down', name: 'Nede', text: 'Nede.', contacts: [] });
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
      pressFigure((f) => ((f.view = 'top'), (f.facing = 1))),
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
      i.movements[0]!.positions[0]!.contacts[1]!.on = 'chair';
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
        { id: 'burpee_emom.E2', view: 'side', props: [], highlight: ['torso'], keyframes: {} },
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
        PROGRAM.routines.reduce((n, r) => n + r.items.length, 0),
    );
    expect(result.explained).toEqual(['press.1', 'burpee_emom.E1', 'burpee_emom.E2']);
    expect(result.drawn).toEqual(['press.1']);
  });
});
