// Timer views used in a session: countdown with sounds at 3-2-1 and the end, a hold timer with a
// 5-second »klar« countdown, and a sequence of timed phases (warm-up, motor, club sequence, Open &
// Strong). None of them needs a touch to run to the end (SK3).
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

/** A countdown of `seconds`; calls `onDone` once at zero. */
export function Countdown(props: {
  seconds: number;
  paused: boolean;
  onDone: () => void;
  label?: string;
  end?: Sound;
  half?: boolean;
  big?: boolean;
}) {
  const [clock, setClock] = useState<Clock>(() => startClock());
  const done = useRef(false);
  useEffect(() => {
    setClock((c) => (props.paused ? pauseClock(c) : resumeClock(c)));
  }, [props.paused]);
  const now = useTick(!props.paused && !done.current);
  const remaining = Math.max(0, props.seconds - elapsedMs(clock, now) / 1000);
  useCountdownSounds(remaining, props.seconds, {
    end: props.end,
    half: props.half,
    active: !props.paused,
  });
  useEffect(() => {
    if (remaining <= 0 && !done.current) {
      done.current = true;
      props.onDone();
    }
  });
  const progress = props.seconds > 0 ? 1 - remaining / props.seconds : 1;
  return (
    <div class={props.big === false ? 'countdown' : 'countdown big'} role="timer" aria-live="off">
      <Ring progress={progress} />
      <div class="countdown-text">
        <span class="countdown-number" data-testid="countdown">
          {formatClock(remaining)}
        </span>
        {props.label && <span class="countdown-label">{props.label}</span>}
      </div>
    </div>
  );
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

/** Runs timed phases one after another without touching the screen. */
export function PhaseRunner(props: {
  phases: Phase[];
  paused: boolean;
  onDone: () => void;
  /** Sound when a new phase starts (default: go). */
  startSound?: Sound;
  title?: string;
}) {
  const [index, setIndex] = useState(0);
  const phase = props.phases[index];
  useEffect(() => {
    if (index > 0 && phase) play(phase.sound ?? props.startSound ?? 'go');
  }, [index]);
  if (!phase) return null;
  const next = () => {
    if (index + 1 >= props.phases.length) props.onDone();
    else setIndex(index + 1);
  };
  const upcoming = props.phases[index + 1];
  return (
    <div class="phase-runner">
      {props.title && <p class="step-kicker">{props.title}</p>}
      <p class="phase-count">
        {index + 1} af {props.phases.length}
      </p>
      <h2 class="phase-label">{phase.label}</h2>
      {phase.detail && <p class="cue">{phase.detail}</p>}
      {phase.seconds > 0 ? (
        <Countdown
          key={index}
          seconds={phase.seconds}
          paused={props.paused}
          onDone={next}
          end="go"
        />
      ) : (
        <button type="button" class="btn primary block" onClick={next}>
          Videre
        </button>
      )}
      {upcoming && <p class="muted next-up">Derefter: {upcoming.label}</p>}
    </div>
  );
}

/** Counts up (max tests: hollow, side plank, wall sit, balance). */
export function Stopwatch(props: { running: boolean; onStop: (seconds: number) => void }) {
  const [clock] = useState<Clock>(() => startClock());
  const now = useTick(props.running);
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
