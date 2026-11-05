// Entering a measurement (docs/SPEC.md 4.8): reps and centimetres with −/+, times with a stopwatch,
// Nordic depth with three buttons, distance in metres. Shows the previous value and the level.
import { useState } from 'preact/hooks';
import { measureLevel, PROGRAM } from '../../engine/index.ts';
import type { Level, State } from '../../engine/types.ts';
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
}) {
  const measure = PROGRAM.measures.find((m) => m.id === props.measureId);
  const [value, setValue] = useState<number | null>(null);
  const [timing, setTiming] = useState(false);
  const [timed, setTimed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!measure) return null;
  const previous = [...props.state.measurements].reverse().find((m) => m.measureId === measure.id);
  const level = value !== null ? measureLevel(PROGRAM, measure.id, value) : null;
  const save = async () => {
    if (value === null || busy) return;
    setBusy(true);
    await props.onSave(value);
  };
  const timedTest = measure.placement.type === 'replace_finisher';

  return (
    <div class="stack">
      <p class="step-kicker">
        Måling{props.firstSetOf ? ` · første sæt i ${props.firstSetOf}` : ''}
      </p>
      <h1>{measure.name}</h1>
      <p class="cue">{measure.how}</p>
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
              paused={false}
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

      {measure.unit === 'sec' && value === null && (
        <>
          {timing ? (
            <Stopwatch running={true} onStop={(s) => setValue(s)} />
          ) : (
            <button type="button" class="btn primary block" onClick={() => setTiming(true)}>
              Start uret
            </button>
          )}
        </>
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

      {(measure.unit === 'reps' ||
        measure.unit === 'cm' ||
        measure.unit === 'm' ||
        (measure.unit === 'sec' && value !== null)) &&
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
      <button
        type="button"
        class="btn primary block"
        disabled={value === null || busy}
        onClick={() => void save()}
      >
        Gem målingen
      </button>
      <button type="button" class="btn block" onClick={props.onSkip}>
        Spring målingen over
      </button>
    </div>
  );
}
