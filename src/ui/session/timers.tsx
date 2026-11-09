// Timer views used in a session: countdown with sounds at 3-2-1 and the end, a hold timer with a
// 5-second »klar« countdown, and a sequence of timed phases (warm-up, motor, club sequence, Open &
// Strong). None of them needs a touch to run to the end (SK3).
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { play, type Sound } from '../audio.ts';
import {
  elapsedMs,
  formatClock,
  pauseClock,
  resumeClock,
  startClock,
  useTick,
  type Clock,
} from '../timers/clock.ts';

/** Plays tik at 3, 2, 1 seconds left and `end` at 0; `half` once at half time. */
function useCountdownSounds(
  remaining: number,
  total: number,
  opts: { end?: Sound; half?: boolean; active: boolean },
) {
  const last = useRef<number | null>(null);
  const halfDone = useRef(false);
  useEffect(() => {
    if (!opts.active) return;
    const whole = Math.ceil(remaining);
    if (last.current !== null && whole !== last.current) {
      if (whole <= 3 && whole >= 1) play('tik');
      if (whole <= 0) play(opts.end ?? 'slut');
    }
    if (opts.half && !halfDone.current && total >= 10 && remaining <= total / 2) {
      halfDone.current = true;
      play('halv');
    }
    last.current = whole;
  }, [remaining, total, opts.active, opts.end, opts.half]);
}

export interface TimerControl {
  paused: boolean;
}

/** How big a countdown is drawn: the pause's ring, a ring beside a figure, or one line. */
export type CountdownSize = 'big' | 'medium' | 'line';

export interface CountdownState {
  remaining: number;
  /** 0 at the start, 1 at zero. */
  progress: number;
}

/**
 * A countdown of `seconds` that calls `onDone` once at zero, with the sounds; the view is separate
 * (CountdownView), so a pause can show the same clock in two layouts (the intro card, D51).
 * `onClock` gets the clock whenever it starts, stands still or goes on (the figure follows it).
 */
export function useCountdown(
  seconds: number,
  paused: boolean,
  opts: { onDone: () => void; end?: Sound; half?: boolean; onClock?: (clock: Clock) => void },
): CountdownState {
  const [clock, setClock] = useState<Clock>(() => startClock());
  const done = useRef(false);
  useEffect(() => {
    setClock((c) => (paused ? pauseClock(c) : resumeClock(c)));
  }, [paused]);
  const onClock = useRef(opts.onClock);
  onClock.current = opts.onClock;
  useEffect(() => {
    onClock.current?.(clock);
  }, [clock]);
  const now = useTick(!paused && !done.current);
  const remaining = Math.max(0, seconds - elapsedMs(clock, now) / 1000);
  useCountdownSounds(remaining, seconds, { end: opts.end, half: opts.half, active: !paused });
  useEffect(() => {
    if (remaining <= 0 && !done.current) {
      done.current = true;
      opts.onDone();
    }
  });
  return { remaining, progress: seconds > 0 ? 1 - remaining / seconds : 1 };
}

export function CountdownView({
  state,
  label,
  size = 'big',
}: {
  state: CountdownState;
  label?: string;
  size?: CountdownSize;
}) {
  if (size === 'line') {
    return (
      <div class="countdown line" role="timer" aria-live="off">
        {label && <span class="countdown-label">{label}</span>}
        <span class="countdown-number" data-testid="countdown">
          {formatClock(state.remaining)}
        </span>
        <span class="countdown-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(Math.min(1, state.progress) * 100)}%` }} />
        </span>
      </div>
    );
  }
  return (
    <div class={`countdown ${size}`} role="timer" aria-live="off">
      <Ring progress={state.progress} />
      <div class="countdown-text">
        <span class="countdown-number" data-testid="countdown">
          {formatClock(state.remaining)}
        </span>
        {label && <span class="countdown-label">{label}</span>}
      </div>
    </div>
  );
}

/** A countdown of `seconds`; calls `onDone` once at zero. */
export function Countdown(props: {
  seconds: number;
  paused: boolean;
  onDone: () => void;
  label?: string;
  end?: Sound;
  half?: boolean;
  size?: CountdownSize;
  onClock?: (clock: Clock) => void;
}) {
  const state = useCountdown(props.seconds, props.paused, {
    onDone: props.onDone,
    end: props.end,
    half: props.half,
    onClock: props.onClock,
  });
  return <CountdownView state={state} label={props.label} size={props.size} />;
}

function Ring({ progress }: { progress: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={r} class="ring-track" />
      <circle
        cx="50"
        cy="50"
        r={r}
        class="ring-fill"
        stroke-dasharray={c}
        stroke-dashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}

export interface Phase {
  label: string;
  /** 0 = waits for the »Videre« button (e.g. strides without a set length). */
  seconds: number;
  detail?: string;
  sound?: Sound;
}

/**
 * Runs timed phases one after another without touching the screen. `onPart` gets the phase that
 * runs and its clock, so a figure can follow it (src/figure/sync.ts); a phase without a time (it
 * waits for »Videre«) gets a clock that starts with it. `beside` stands next to the ring (the
 * figure in »Nu«), and the ring is then the smaller one.
 */
export function PhaseRunner(props: {
  phases: Phase[];
  paused: boolean;
  onDone: () => void;
  /** Sound when a new phase starts (default: go). */
  startSound?: Sound;
  title?: string;
  onPart?: (index: number, clock: Clock) => void;
  beside?: ComponentChildren;
  /** »Derefter: …« under the clock; off where »Næste« already says it (the motor). */
  showNext?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const phase = props.phases[index];
  const onPart = useRef(props.onPart);
  onPart.current = props.onPart;
  useEffect(() => {
    if (index > 0 && phase) play(phase.sound ?? props.startSound ?? 'go');
    if (phase && phase.seconds <= 0) onPart.current?.(index, startClock());
  }, [index]);
  if (!phase) return null;
  const next = () => {
    if (index + 1 >= props.phases.length) props.onDone();
    else setIndex(index + 1);
  };
  const upcoming = props.phases[index + 1];
  const timer =
    phase.seconds > 0 ? (
      <Countdown
        key={index}
        seconds={phase.seconds}
        paused={props.paused}
        onDone={next}
        end="go"
        size={props.beside ? 'medium' : 'big'}
        onClock={(clock) => onPart.current?.(index, clock)}
      />
    ) : null;
  // No »2 af 5« over the phase: it counted »Klar« and the pauses, next to »Minut 1 af 4« and the
  // part in the header (D54). A phase's label says where it is: »Minut 1 af 4«, »Sæt 3 af 10«,
  // »Runde 1: …«.
  return (
    <div class="phase-runner">
      {props.title && <p class="step-kicker">{props.title}</p>}
      <h2 class="phase-label">{phase.label}</h2>
      {phase.detail && <p class="cue">{phase.detail}</p>}
      {props.beside ? (
        <div class="now-stage">
          <div class="now-figure">{props.beside}</div>
          {timer}
        </div>
      ) : (
        timer
      )}
      {!timer && (
        <button type="button" class="btn primary block" onClick={next}>
          Videre
        </button>
      )}
      {upcoming && props.showNext !== false && (
        <p class="muted phase-next">Derefter: {upcoming.label}</p>
      )}
    </div>
  );
}

/** Counts up (max tests: hollow, side plank, wall sit, balance); stands still while paused. */
export function Stopwatch(props: { paused: boolean; onStop: (seconds: number) => void }) {
  const [clock, setClock] = useState<Clock>(() => startClock());
  useEffect(() => {
    setClock((c) => (props.paused ? pauseClock(c) : resumeClock(c)));
  }, [props.paused]);
  const now = useTick(!props.paused);
  const seconds = elapsedMs(clock, now) / 1000;
  return (
    <div class="stopwatch">
      <span class="countdown-number" data-testid="stopwatch">
        {formatClock(Math.floor(seconds))}
      </span>
      <button
        type="button"
        class="btn primary block"
        onClick={() => props.onStop(Math.floor(seconds))}
      >
        Stop
      </button>
    </div>
  );
}
