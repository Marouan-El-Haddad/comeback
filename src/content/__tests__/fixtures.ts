// Valid example files for the content tests. They are not shipped: the real files live in
// content/ and are written by the content agents. The push-up keyframes are poses.py's push_up.
import type { Contact, ExplainFile, FigureFile, IkLimb } from '../types.ts';

const PLANK_CONTACTS: Contact[] = [
  { part: 'hand', on: 'floor' },
  { part: 'toes', on: 'floor' },
];

export const PRESS: ExplainFile = {
  format: 1,
  subject: 'press',
  why: [
    'Push-ups giver stærke skuldre, bryst og arme til garden og slagene, og kroppen lærer at holde sig stiv som en planke.',
  ],
  items: [
    {
      id: 'press.1',
      trains: 'Bryst, skuldre og triceps og en stiv krop, der holder, når du slår.',
      start:
        'Hænderne lidt bredere end skuldrene og fingrene frem. Fødderne samlet bag dig, så kroppen er lige fra hæl til hoved.',
      steps: [
        'Spænd maven og ballerne, så kroppen er som én planke.',
        'Sænk dig på 3 sek med albuerne skråt bagud.',
        'Hold 1 sek stille lige over gulvet.',
        'Pres dig op i ét stræk til strakte arme.',
      ],
      tempo: '3 sek ned, 1 sek stille, op i ét roligt stræk.',
      breathing: 'Ånd ind på vej ned, og pust ud på vej op.',
      cues: ['3 sek ned, 1 sek stille', 'Albuerne skråt bagud', 'Kroppen som en planke'],
      mistakes: [
        { mistake: 'Hoften hænger.', fix: 'Klem ballerne, og træk navlen ind.' },
        {
          mistake: 'Albuerne peger lige ud til siden.',
          fix: 'Peg albuerne skråt bagud, ca. 45° fra kroppen.',
        },
      ],
      easier: 'Sæt hænderne på sofaen, hvis du ikke kan lave 6 gentagelser i alle sæt.',
      harder: 'Trin 2: fødderne på en stol.',
      equipment: [],
      getReady: 'Find en fri plads på gulvet, og læg dig i planke med strakte arme.',
      movements: [
        {
          positions: [
            {
              id: 'top',
              name: 'Oppe',
              text: 'Strakte arme med hænderne under skuldrene. Kroppen er lige fra hæl til hoved.',
              contacts: [...PLANK_CONTACTS],
            },
            {
              id: 'bottom',
              name: 'Nede',
              text: 'Brystet lige over gulvet, albuerne bøjet ca. 90° skråt bagud. Kroppen er stadig lige.',
              contacts: [...PLANK_CONTACTS],
            },
          ],
          phases: [
            { to: 'bottom', seconds: 3, label: '3 sek ned' },
            { to: 'bottom', seconds: 1, label: '1 sek stille' },
            { to: 'top', seconds: 1, label: 'Op' },
          ],
        },
      ],
    },
  ],
};

export const EMOM: ExplainFile = {
  format: 1,
  subject: 'burpee_emom',
  why: ['Burpees bygger den kondition, du skal bruge for at holde tempoet i en hel kamp.'],
  items: [
    {
      id: 'burpee_emom.E1',
      trains: 'Kondition og eksplosivitet i hele kroppen.',
      start: 'Stå med fødderne i hoftebredde.',
      steps: [
        'Sæt hænderne i gulvet, og hop ud i planke.',
        'Hop fødderne frem, rejs dig, og hop med armene over hovedet.',
      ],
      tempo: 'Hurtigt og rent, så du har pause tilbage i minuttet.',
      breathing: 'Pust ud, når du hopper op.',
      cues: ['Rent frem for hurtigt', 'Land blødt'],
      mistakes: [
        { mistake: 'Hoften hænger i planken.', fix: 'Spænd maven, når fødderne lander.' },
        { mistake: 'Du lander tungt.', fix: 'Land på forfoden med bløde knæ.' },
      ],
      easier: 'Træd ud i planke i stedet for at hoppe.',
      harder: 'Næste trin i burpee-trappen.',
      equipment: [],
      getReady: 'Stil dig, hvor du har plads til at lægge dig ned.',
      movements: [
        {
          positions: [
            {
              id: 'stand',
              name: 'Stående',
              text: 'Stående med strakte ben.',
              contacts: [{ part: 'foot', on: 'floor' }],
            },
            {
              id: 'plank',
              name: 'Planke',
              text: 'Planke med strakte arme.',
              contacts: [...PLANK_CONTACTS],
            },
            { id: 'jump', name: 'Hop', text: 'I luften med armene over hovedet.', contacts: [] },
          ],
          phases: [
            { to: 'plank', seconds: 1, label: 'Ned i planke' },
            { to: 'stand', seconds: 0.8, label: 'Op' },
            { to: 'jump', seconds: 0.4, label: 'Hop' },
            { to: 'stand', seconds: 0.4, label: 'Land' },
          ],
        },
      ],
    },
    { id: 'burpee_emom.E2', like: 'burpee_emom.E1' },
  ],
};

export const OS: ExplainFile = {
  format: 1,
  subject: 'os',
  why: ['Open & Strong holder brystryggen og skuldrene åbne efter en dag på stolen.'],
  items: [
    {
      id: 'os.3',
      trains: 'Musklerne mellem skulderbladene, som holder skuldrene tilbage.',
      start: 'Lig på maven med armene strakt frem i et Y og tommelfingrene op.',
      steps: ['Løft armene fra gulvet uden at løfte hovedet.', 'Hold 2 sek, og sænk dem roligt.'],
      tempo: 'Løft roligt, hold 2 sek, og sænk.',
      breathing: 'Pust ud, når du løfter.',
      cues: ['Tommelfingrene op', 'Blikket mod gulvet'],
      mistakes: [
        { mistake: 'Du løfter hovedet.', fix: 'Hold blikket mod gulvet.' },
        {
          mistake: 'Skuldrene kryber op mod ørerne.',
          fix: 'Træk skulderbladene ned mod lommerne.',
        },
      ],
      easier: 'Løft én arm ad gangen.',
      harder: 'Hold en lille vandflaske i hver hånd.',
      equipment: [],
      getReady: 'Læg dig på maven med armene i et Y.',
      movements: [
        {
          positions: [
            {
              id: 'down',
              name: 'Nede',
              text: 'Armene i gulvet i et Y.',
              contacts: [{ part: 'belly', on: 'floor' }],
            },
            {
              id: 'up',
              name: 'Løftet',
              text: 'Armene løftet en håndsbredde.',
              contacts: [{ part: 'belly', on: 'floor' }],
            },
          ],
          phases: [
            { to: 'up', seconds: 1, label: 'Løft' },
            { to: 'up', seconds: 2, label: 'Hold 2 sek' },
            { to: 'down', seconds: 1, label: 'Ned' },
          ],
        },
      ],
    },
  ],
};

export const CORE_FRONT: ExplainFile = {
  format: 1,
  subject: 'core_front',
  why: ['En stærk mave holder kroppen samlet, når du slår, sparker og tager imod.'],
  items: [
    {
      id: 'core_front.2',
      trains: 'Maven, der holder lænden i gulvet.',
      start: 'Lig på ryggen med lænden presset mod gulvet.',
      steps: ['Løft skuldre og ben en håndsbredde.', 'Hold, så længe lænden bliver i gulvet.'],
      tempo: 'Hold stillingen hele tiden.',
      breathing: 'Korte, rolige vejrtrækninger.',
      cues: ['Lænden i gulvet', 'Lange arme'],
      mistakes: [
        { mistake: 'Lænden løfter sig.', fix: 'Bøj knæene lidt mere.' },
        { mistake: 'Du holder vejret.', fix: 'Træk vejret kort og roligt.' },
      ],
      easier: 'Bøj knæene.',
      harder: 'Stræk benene helt.',
      equipment: [],
      getReady: 'Læg dig på ryggen.',
      movements: [
        {
          positions: [
            {
              id: 'down',
              name: 'Liggende',
              text: 'På ryggen.',
              contacts: [{ part: 'back', on: 'floor' }],
            },
            {
              id: 'hold',
              name: 'Hollow',
              text: 'Skuldre og ben løftet.',
              contacts: [{ part: 'back', on: 'floor' }],
            },
          ],
          phases: [
            { to: 'hold', seconds: 1, label: 'Løft' },
            { to: 'hold', seconds: 'dose', label: 'Hold' },
          ],
        },
      ],
    },
    {
      id: 'core_front.3',
      trains: 'Hele forsiden af kroppen, så den kan tage imod uden at give efter.',
      start: 'Albuerne under skuldrene og kroppen lige fra hæl til hoved.',
      steps: ['Træk albuerne mod tæerne.', 'Klem baller og lår, og hold.'],
      tempo: 'Hold stillingen hele tiden.',
      breathing: 'Korte, rolige vejrtrækninger.',
      cues: ['Albuerne mod tæerne', 'Klem ballerne'],
      mistakes: [
        { mistake: 'Hoften hænger.', fix: 'Klem ballerne hårdere.' },
        { mistake: 'Du holder vejret.', fix: 'Træk vejret kort og roligt.' },
      ],
      easier: 'Trin 2: hollow hold.',
      harder: 'Trin 4: long-lever planke.',
      equipment: [],
      getReady: 'Læg dig på underarmene.',
      movements: [
        {
          positions: [
            {
              id: 'plank',
              name: 'Planke',
              text: 'Underarmene i gulvet og kroppen lige.',
              contacts: [
                { part: 'forearm', on: 'floor' },
                { part: 'toes', on: 'floor' },
              ],
            },
          ],
          phases: [{ to: 'plank', seconds: 'dose', label: 'Hold' }],
        },
      ],
    },
  ],
};

/** The push-up's feet: ankles on the floor, toes down; the far ankle within the leg's reach. */
const feet = (): { near: IkLimb; far: IkLimb } => ({
  near: { to: [0, 3.6], tip: [3.4, 0.3] },
  far: { to: [-0.6, 3.6], tip: [2.8, 0.3] },
});

export const PRESS_FIGURES: FigureFile = {
  format: 1,
  subject: 'press',
  figures: [
    {
      id: 'press.1',
      view: 'side',
      facing: 1,
      props: [],
      highlight: ['near.upperArm'],
      keyframes: {
        top: {
          hip: [43.81, 20.63],
          torso: 21.25,
          head: -4,
          arms: { near: { to: [69.17, 0] }, far: { to: [70.57, 0] } },
          legs: feet(),
        },
        bottom: {
          hip: [46.79, 8.0],
          torso: 5.37,
          head: -4,
          arms: {
            near: { to: [69.17, 0], upper: 12.5 },
            far: { to: [70.57, 0], upper: 12.5 },
          },
          legs: feet(),
        },
      },
    },
  ],
};

export const CORE_FRONT_FIGURES: FigureFile = {
  format: 1,
  subject: 'core_front',
  figures: [
    {
      id: 'core_front.3',
      view: 'side',
      facing: 1,
      props: [],
      highlight: ['torso'],
      keyframes: {
        plank: {
          hip: [-29.39, 13.0],
          torso: 11.54,
          head: -6,
          arms: {
            near: { joint: [0, 3.0], end: [14.0, 2.4] },
            far: { joint: [1.2, 3.0], end: [15.0, 2.6] },
          },
          legs: {
            near: { to: [-75.44, 3.6], tip: [-72.04, 0.3] },
            far: { to: [-76.64, 3.6], tip: [-73.24, 0.3] },
          },
        },
      },
    },
  ],
};

/** The explanation fields every example item below shares; only the movements differ. */
const SHARED = {
  trains: 'Styrke og kontrol.',
  start: 'Stå klar.',
  steps: ['Gør det første.', 'Gør det andet.'],
  tempo: 'Roligt og kontrolleret.',
  breathing: 'Ånd roligt.',
  cues: ['Roligt', 'Kontrol'],
  mistakes: [
    { mistake: 'Det går for hurtigt.', fix: 'Sænk farten.' },
    { mistake: 'Du holder vejret.', fix: 'Ånd roligt.' },
  ],
  easier: 'Tag det roligere.',
  harder: 'Tag det langsommere.',
  getReady: 'Gør klar.',
};

/** The club sequence's round: three holds of 3 sek and ten micro pumps as one repeated phase. */
export const CLUB: ExplainFile = {
  format: 1,
  subject: 'club_sequence',
  why: ['Klubsekvensen bygger styrke i hele push-uppens bane.'],
  items: [
    {
      id: 'club_sequence.C1',
      ...SHARED,
      equipment: [],
      movements: [
        {
          positions: [
            { id: 'top', name: 'Oppe', text: 'Strakte arme.', contacts: [...PLANK_CONTACTS] },
            { id: 'mid', name: 'Midten', text: 'Halvvejs nede.', contacts: [...PLANK_CONTACTS] },
            {
              id: 'pump',
              name: 'Lidt under',
              text: 'En håndsbredde under midten.',
              contacts: [...PLANK_CONTACTS],
            },
            { id: 'low', name: 'Nede', text: 'Lige over gulvet.', contacts: [...PLANK_CONTACTS] },
          ],
          phases: [
            { to: 'mid', seconds: 1, label: 'Ned til midten' },
            { to: 'mid', seconds: 3, label: 'Hold 3 sek' },
            { to: 'low', seconds: 1, label: 'Helt ned' },
            { to: 'low', seconds: 3, label: 'Hold 3 sek' },
            { to: 'mid', seconds: 1, label: 'Op til midten' },
            { to: 'mid', seconds: 3, label: 'Hold 3 sek' },
            { to: 'pump', seconds: 0.8, repeat: 10, label: '10 mikro-pumps' },
            { to: 'low', seconds: 2, label: 'Helt ned' },
            { to: 'top', seconds: 2, label: 'Helt op' },
          ],
        },
      ],
    },
  ],
};

/** Wall sit W2: the hold is the punches, repeated for as long as the dose lasts. */
export const WALLSIT: ExplainFile = {
  format: 1,
  subject: 'wallsit',
  why: ['Wall sit giver stærke lår, der holder dig i garden hele runden.'],
  items: [
    {
      id: 'wallsit.W2',
      ...SHARED,
      equipment: ['wall'],
      movements: [
        {
          positions: [
            {
              id: 'guard',
              name: 'Garde',
              text: 'Ryggen mod væggen, lårene vandrette, hænderne i garde.',
              contacts: [
                { part: 'back', on: 'wall' },
                { part: 'foot', on: 'floor' },
              ],
            },
            {
              id: 'punch',
              name: 'Slag',
              text: 'Som garden, men den forreste arm strakt frem.',
              contacts: [
                { part: 'back', on: 'wall' },
                { part: 'foot', on: 'floor' },
              ],
            },
          ],
          phases: [{ to: 'punch', seconds: 1.5, repeat: 'dose', label: 'Rolige lige slag' }],
        },
      ],
    },
  ],
};

/** A measurement with its own explanation, and one explained like its step (in another file). */
export const MEASURES_EXPLAIN: ExplainFile = {
  format: 1,
  subject: 'measures',
  why: ['Målingerne viser, hvor du står, og hvor meget du er rykket.'],
  items: [
    {
      id: 'measures.wall_test',
      ...SHARED,
      equipment: ['wall'],
      movements: [
        {
          positions: [
            {
              id: 'stand',
              name: 'Mod væggen',
              text: 'Hæle, baller og skulderblade mod væggen, hagen vandret.',
              contacts: [
                { part: 'heel', on: 'wall' },
                { part: 'back', on: 'wall' },
                { part: 'foot', on: 'floor' },
              ],
            },
          ],
          phases: [{ to: 'stand', seconds: 'dose', label: 'Stå stille' }],
        },
      ],
    },
    { id: 'measures.hollow', like: 'core_front.2' },
  ],
};

/** The warm-up's »Potensér«: the session's first power step, and pogo-hop only in Styrke A. */
export const WARMUP_POTENSER: ExplainFile = {
  format: 1,
  subject: 'warmup',
  why: ['Opvarmningen gør kroppen klar og viser, hvordan dagen er.'],
  items: [
    {
      id: 'warmup.4',
      ...SHARED,
      equipment: [],
      movements: [
        { id: 'power', name: 'Dagens første power-øvelse', from: 'power' },
        {
          id: 'pogo',
          name: 'Pogo-hop',
          sessions: ['A'],
          positions: [
            {
              id: 'down',
              name: 'Landet',
              text: 'På forfødderne.',
              contacts: [{ part: 'toes', on: 'floor' }],
            },
            { id: 'up', name: 'I luften', text: 'Lige over gulvet.', contacts: [] },
          ],
          phases: [{ to: 'up', seconds: 0.4, repeat: 10, label: '10 pogo-hop' }],
        },
      ],
    },
  ],
};
