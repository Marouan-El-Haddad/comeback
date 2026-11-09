// Entering a measurement (docs/SPEC.md 4.8): reps and centimetres with −/+, times with a stopwatch,
// Nordic depth with three buttons, distance in metres. Shows the previous value and the level. A
// time measured per side (side plank, balance) has a clock for the left side and then one for the
// right, each started with »Start uret«, and saves the shorter time (P59, D49). In a session it is
// »Nu« (docs/SPEC.md 3.2): »Sådan gør du« beside the name and the figure beside the programme's
// text, so the field, the clock or »Start uret« stands on the first screen above the actions (D54).
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { measureLevel, PROGRAM } from '../../engine/index.ts';
import type { Level, State } from '../../engine/types.ts';
import { HowButton } from '../card.tsx';
import { NowHead } from './NowNext.tsx';
import { measureSides, shortest } from './sides.ts';
import { Countdown, Stopwatch } from './timers.tsx';

const LEVEL: Record<Level, string> = {
  basis: 'Basis',
  staerk: 'Stærk',
  imponerende: 'Imponerende',
  boss: 'Boss',
};

const UNIT: Record<string, string> = { cm: 'cm', reps: 'reps', sec: 'sek', m: 'meter', depth: '' };

export function MeasureInput(props: {
  measureId: string;
  state: State;
  onSave: (value: number) => void | Promise<void>;
  onSkip: () => void;
  /** The measurement takes the place of the first set of this exercise (page 40). */
  firstSetOf?: string;
  /** Opens the exercise card of that exercise (»Sådan gør du«, docs/SPEC.md 3.8). */
  onCard?: () => void;
  /** The session stands still (»Hold pause«, or the exercise card is open: D47). */
  paused: boolean;
  /** In a session: the measurement's figure under its text (»Nu«, docs/SPEC.md 3.2). */
  figure?: ComponentChildren;
  /** In a session: »Næste« above the actions. */
  next?: ComponentChildren;
}) {
  const measure = PROGRAM.measures.find((m) => m.id === props.measureId);
  // A time has one clock, or one per side: null is a side without a name (D49).
  const sides: Array<string | null> = (measure && measureSides(measure)) ?? [null];
  const [value, setValue] = useState<number | null>(null);
  const [times, setTimes] = useState<Array<number | null>>(() => sides.map(() => null));
  const [timing, setTiming] = useState(false);
  const [timed, setTimed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!measure) return null;
  const clocked = measure.unit === 'sec';
  // A time measured per side saves the shorter of the two (P59).
  const result = clocked ? shortest(times) : value;
  const previous = [...props.state.measurements].reverse().find((m) => m.measureId === measure.id);
  const level = result !== null ? measureLevel(PROGRAM, measure.id, result) : null;
  const save = async () => {
    if (result === null || busy) return;
    setBusy(true);
    await props.onSave(result);
  };
  /** The side whose clock comes next; -1 when every side has its time. */
  const next = times.findIndex((t) => t === null);
  const setTime = (side: number, time: number | null) =>
    setTimes((all) => all.map((t, i) => (i === side ? time : t)));
  const timedTest = measure.placement.type === 'replace_finisher';

  const kicker = `Måling${props.firstSetOf ? ` · første sæt i ${props.firstSetOf}` : ''}`;
  const inSession = props.next !== undefined;

  return (
    <div class={inSession ? 'stack now' : 'stack'}>
      {inSession ? (
        <NowHead kicker={kicker} name={measure.name} onCard={props.onCard} />
      ) : (
        <>
          <p class="step-kicker">{kicker}</p>
          <h1>{measure.name}</h1>
        </>
      )}
      {props.figure ? (
        <div class="now-stage measure-stage">
          <div class="now-figure">{props.figure}</div>
          <p class="cue">{measure.how}</p>
        </div>
      ) : (
        <p class="cue">{measure.how}</p>
      )}
      {props.onCard && !inSession && <HowButton onClick={props.onCard} />}
      {previous && (
        <p class="muted">
          Forrige: {previous.value} {UNIT[measure.unit]}
        </p>
      )}

      {timedTest && !timed && (
        <>
          {timing ? (
            <Countdown
              seconds={180}
              paused={props.paused}
              onDone={() => setTimed(true)}
              label="Flest rene reps"
            />
          ) : (
            <button type="button" class="btn primary block" onClick={() => setTiming(true)}>
              Start 3 minutter
            </button>
          )}
        </>
      )}

      {clocked && (
        <div class="stack">
          {sides.map((label, side) => {
            const time = times[side] ?? null;
            if (time !== null) {
              return (
                <label class="field" key={side}>
                  <span>{label ?? measure.name} (sek)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={time}
                    onInput={(e) => {
                      const raw = (e.target as HTMLInputElement).value;
                      setTime(side, raw === '' ? null : Math.max(0, Number(raw)));
                      // An emptied time gets »Start uret« again, never a clock that just runs.
                      setTiming(false);
                    }}
                  />
                </label>
              );
            }
            if (side !== next) return null;
            return (
              <div class="stack" key={side}>
                {label && <h2>{label}</h2>}
                {timing ? (
                  <Stopwatch
                    paused={props.paused}
                    onStop={(s) => {
                      setTime(side, s);
                      setTiming(false);
                    }}
                  />
                ) : (
                  <button type="button" class="btn primary block" onClick={() => setTiming(true)}>
                    Start uret
                  </button>
                )}
              </div>
            );
          })}
          {sides.length > 1 && result !== null && (
            <p class="hint">Den korteste tid gemmes: {result} sek.</p>
          )}
        </div>
      )}

      {measure.unit === 'depth' && (
        <div class="stack">
          {(measure.depthLabels ?? []).map((label, i) => (
            <button
              key={label}
              type="button"
              class={value === i + 1 ? 'btn block selected' : 'btn block'}
              onClick={() => setValue(i + 1)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(measure.unit === 'reps' || measure.unit === 'cm' || measure.unit === 'm') &&
        (!timedTest || timed) && (
          <label class="field">
            <span>
              {measure.name} ({UNIT[measure.unit]})
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={value ?? ''}
              onInput={(e) => {
                const raw = (e.target as HTMLInputElement).value;
                setValue(raw === '' ? null : Math.max(0, Number(raw)));
              }}
            />
          </label>
        )}

      {level && <p class="hint">Målbrættet: {LEVEL[level]}</p>}
      <div class="fixed-actions">
        {props.next}
        <button type="button" class="btn block" onClick={props.onSkip}>
          Spring målingen over
        </button>
        <button
          type="button"
          class="btn primary block"
          disabled={result === null || busy}
          onClick={() => void save()}
        >
          Gem målingen
        </button>
      </div>
    </div>
  );
}
