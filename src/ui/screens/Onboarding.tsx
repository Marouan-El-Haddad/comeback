// First start and phase-in in under five minutes (docs/SPEC.md 4.1, Tilføjelse T2): start date,
// the weeks since the start, the step on every ladder with an optional latest number, and the
// week-1 measurements when the programme started earlier.
import { useState } from 'preact/hooks';
import {
  addDays,
  calendarWeek,
  formatDay,
  formatDose,
  getTrack,
  isValidDate,
  mondayOf,
  PROGRAM,
  workRange,
} from '../../engine/index.ts';
import type { AppEvent, ISODate } from '../../engine/types.ts';
import { Picto } from '../components/Picto.tsx';
import type { Model } from '../model.ts';

/** The ten ladders, rotation, the three power tracks, the club sequence and the neck (4.1.4). */
const ONBOARDING_TRACKS = [
  'press',
  'shoulder',
  'pull',
  'legs',
  'wallsit',
  'posterior',
  'core_front',
  'core_side',
  'core_rot',
  'core_situp',
  'groin',
  'power_legs',
  'power_upper',
  'burpee_emom',
  'club_sequence',
  'neck',
];

const MEASURES_AT_START = [
  'wall_test',
  'pushups',
  'table_rows',
  'pike',
  'hollow',
  'side_plank',
  'wall_sit',
  'balance',
  'base_check',
];

type Choice = { stepId: string; latest: string };

export function Onboarding({ model }: { model: Model }) {
  const [page, setPage] = useState(0);
  const [startDate, setStartDate] = useState<ISODate>(PROGRAM.startDate);
  const [done, setDone] = useState<Record<ISODate, boolean>>({});
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(
      ONBOARDING_TRACKS.map((id) => [
        id,
        { stepId: getTrack(PROGRAM, id).steps[0]?.id ?? '', latest: '' },
      ]),
    ),
  );
  const [measures, setMeasures] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const today = model.today;
  const start = mondayOf(isValidDate(startDate) ? startDate : PROGRAM.startDate);
  const pastWeeks: ISODate[] = [];
  for (let k = 0; k < calendarWeek(start, today); k++) pastWeeks.push(addDays(start, 7 * k));

  const pages = [
    'welcome',
    'start',
    ...(pastWeeks.length > 0 ? ['weeks'] : []),
    'steps',
    ...(pastWeeks.length > 0 ? ['measures'] : []),
  ];
  const current = pages[page] ?? 'welcome';
  const next = () => setPage((p) => Math.min(p + 1, pages.length - 1));
  const back = () => setPage((p) => Math.max(0, p - 1));
  const last = page === pages.length - 1;

  const finish = async () => {
    setBusy(true);
    const make = model.ctx.make;
    const events: AppEvent[] = [
      make(
        {
          type: 'onboarding_completed',
          startDate: start,
          completedWeeks: pastWeeks.filter((w) => done[w] ?? true),
        },
        today,
      ),
    ];
    for (const id of ONBOARDING_TRACKS) {
      const choice = choices[id];
      if (!choice) continue;
      const step = getTrack(PROGRAM, id).steps.find((s) => s.id === choice.stepId);
      const range = step ? workRange(step.dose) : null;
      const latest = Number(choice.latest);
      const target =
        range && choice.latest !== '' && Number.isFinite(latest)
          ? Math.min(range.max, Math.max(range.min, latest))
          : undefined;
      events.push(
        make(
          {
            type: 'step_set',
            trackId: id,
            stepId: choice.stepId,
            target,
            reason: 'onboarding',
            explanation: 'Valgt ved start',
          },
          today,
        ),
      );
    }
    for (const [measureId, raw] of Object.entries(measures)) {
      const value = Number(raw);
      if (raw !== '' && Number.isFinite(value)) {
        events.push(
          make({ type: 'measurement_logged', measureId, value, programWeek: 1, round: 1 }, start),
        );
      }
    }
    await model.commit(events);
    await model.refreshDay();
  };

  return (
    <div class="screen onboarding" data-testid="onboarding">
      {current === 'welcome' && (
        <div class="stack">
          {/* The programme's name on a navy band, as the day's card on I dag (D59). */}
          <header class="welcome-band">
            <h1>Comeback</h1>
            <p>Sekundærtræning til Muay Thai · 12 uger</p>
          </header>
          <p class="lead">
            Appen tager tænkearbejdet i dit 12-ugers program: hvad du skal i dag, hvor mange sæt og
            reps, og hvornår du rykker op.
          </p>
          <p>Indfasningen tager under 5 minutter.</p>
        </div>
      )}

      {current === 'start' && (
        <div class="stack">
          <h1>Startdato</h1>
          <label class="field">
            <span>Programmets første mandag</span>
            <input
              type="date"
              value={startDate}
              onInput={(e) => setStartDate((e.target as HTMLInputElement).value)}
            />
          </label>
          <p class="muted">Uge 1 starter mandag 9. november 2026.</p>
        </div>
      )}

      {current === 'weeks' && (
        <div class="stack">
          <h1>Uger siden start</h1>
          <p>
            Det afgør, hvilken programuge du er i. En uge er gennemført med mindst Styrke A eller B.
          </p>
          {pastWeeks.map((w, i) => {
            const value = done[w] ?? true;
            return (
              <div key={w} class="card week-choice">
                <p>
                  Uge {i + 1} · fra {formatDay(w)}
                </p>
                <div class="row">
                  <button
                    type="button"
                    class={value ? 'btn selected' : 'btn'}
                    aria-pressed={value}
                    onClick={() => setDone({ ...done, [w]: true })}
                  >
                    Gennemført
                  </button>
                  <button
                    type="button"
                    class={!value ? 'btn selected' : 'btn'}
                    aria-pressed={!value}
                    onClick={() => setDone({ ...done, [w]: false })}
                  >
                    Ikke gennemført
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {current === 'steps' && (
        <div class="stack">
          <h1>Dit trin på hver stige</h1>
          <p class="hint">
            Det sværeste trin, hvor du kan lave 3 sæt i bunden med perfekt form og 2–3 i reserve. I
            tvivl: et trin lavere.
          </p>
          {ONBOARDING_TRACKS.map((id) => {
            const track = getTrack(PROGRAM, id);
            const choice = choices[id] ?? { stepId: track.steps[0]?.id ?? '', latest: '' };
            const index = track.steps.findIndex((s) => s.id === choice.stepId);
            const step = track.steps[index];
            const range = step ? workRange(step.dose) : null;
            const set = (stepId: string) =>
              setChoices({ ...choices, [id]: { stepId, latest: '' } });
            return (
              <div key={id} class="card step-choice" data-track={id}>
                <p class="step-choice-track">{track.short}</p>
                <div class="step-choice-row">
                  <Picto stepId={choice.stepId} small />
                  <div>
                    <p class="step-choice-name">
                      Trin {step?.key} · {step?.name}
                    </p>
                    <p class="muted">{step ? formatDose(step.dose) : ''}</p>
                  </div>
                </div>
                <div class="row">
                  <button
                    type="button"
                    class="btn"
                    disabled={index <= 0}
                    aria-label={`${track.short}: lettere trin`}
                    onClick={() => set(track.steps[index - 1]?.id ?? choice.stepId)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    class="btn"
                    disabled={index >= track.steps.length - 1}
                    aria-label={`${track.short}: sværere trin`}
                    onClick={() => set(track.steps[index + 1]?.id ?? choice.stepId)}
                  >
                    +
                  </button>
                  {range && (
                    <label class="field inline">
                      <span>Seneste {range.unit === 'sec' ? 'sek' : 'reps'}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={range.min}
                        max={range.max}
                        value={choice.latest}
                        onInput={(e) =>
                          setChoices({
                            ...choices,
                            [id]: { ...choice, latest: (e.target as HTMLInputElement).value },
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {current === 'measures' && (
        <div class="stack">
          <h1>Målinger fra uge 1</h1>
          <p>Valgfrit. Tom = ikke taget.</p>
          {MEASURES_AT_START.map((id) => {
            const m = PROGRAM.measures.find((x) => x.id === id);
            if (!m) return null;
            return (
              <label key={id} class="field">
                <span>
                  {m.name} ({m.unit === 'sec' ? 'sek' : m.unit === 'm' ? 'meter' : m.unit})
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={measures[id] ?? ''}
                  onInput={(e) =>
                    setMeasures({ ...measures, [id]: (e.target as HTMLInputElement).value })
                  }
                />
              </label>
            );
          })}
        </div>
      )}

      <div class="bottom-actions">
        {page > 0 && (
          <button type="button" class="btn" onClick={back}>
            Tilbage
          </button>
        )}
        {last ? (
          <button
            type="button"
            class="btn primary grow"
            disabled={busy}
            onClick={() => void finish()}
            data-testid="onboarding-done"
          >
            Færdig
          </button>
        ) : (
          <button
            type="button"
            class="btn primary grow"
            onClick={next}
            data-testid="onboarding-next"
          >
            {page === 0 ? 'Kom i gang' : 'Næste'}
          </button>
        )}
      </div>
    </div>
  );
}
