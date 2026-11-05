import { useEffect, useRef, useState } from 'preact/hooks';
import { audioContext, play, type Sound } from '../audio';
import { errorText, formatNumber, nowIso } from '../format';
import type { Outcome, Results } from '../store';
import { Facts, Row, combine, outcomeText, type Recorder } from '../ui';

const DELAY_SECONDS = 5;
// [seconds after the tap, vibration in ms]: tik, tik, tik, go, slut – as the timers will do.
const SEQUENCE: [number, number][] = [
  [5, 100],
  [6, 100],
  [7, 100],
  [8, 300],
  [11, 300],
];
const SEQUENCE_END = 12;

function vibrate(ms: number): Outcome {
  const at = nowIso();
  if (typeof navigator.vibrate !== 'function') {
    return { ok: false, text: 'Vibration-API findes ikke', at };
  }
  try {
    return navigator.vibrate(ms)
      ? { ok: true, text: `vibrate(${ms}) accepteret – mærkede du den?`, at }
      : { ok: false, text: `vibrate(${ms}) afvist`, at };
  } catch (error) {
    return { ok: false, text: errorText(error), at };
  }
}

export function SoundRow({ results, record }: { results: Results; record: Recorder }) {
  const [contextState, setContextState] = useState('ikke startet');
  const [floorStart, setFloorStart] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((id) => clearTimeout(id)), []);

  useEffect(() => {
    if (floorStart === null) return;
    const id = setInterval(() => {
      if ((performance.now() - floorStart) / 1000 > SEQUENCE_END) setFloorStart(null);
      else setTick((t) => t + 1);
    }, 250);
    return () => clearInterval(id);
  }, [floorStart]);

  /** Starts Web Audio from the tap and records whether it runs. */
  const withAudio = async (schedule: (ctx: AudioContext) => void): Promise<boolean> => {
    try {
      const ctx = await audioContext();
      setContextState(`${ctx.state}, ${formatNumber(ctx.sampleRate)} Hz`);
      if (ctx.state !== 'running') {
        record({ sound: { ok: false, text: `Web Audio står som ${ctx.state}`, at: nowIso() } });
        return false;
      }
      schedule(ctx);
      record({ sound: { ok: true, text: 'Web Audio spiller – kunne du høre det?', at: nowIso() } });
      return true;
    } catch (error) {
      record({
        sound: { ok: false, text: `Web Audio fejlede: ${errorText(error)}`, at: nowIso() },
      });
      return false;
    }
  };

  const playNow = (sound: Sound) => void withAudio((ctx) => play(ctx, sound));

  const floorTest = async () => {
    const started = performance.now();
    await withAudio((ctx) => {
      const t0 = ctx.currentTime + DELAY_SECONDS - (performance.now() - started) / 1000;
      play(ctx, 'tik', t0);
      play(ctx, 'tik', t0 + 1);
      play(ctx, 'tik', t0 + 2);
      play(ctx, 'go', t0 + 3);
      play(ctx, 'slut', t0 + 6);
    });
    setFloorStart(started);
    // The vibrations run without a fresh tap, like the timers in the app will.
    const outcomes: Outcome[] = [];
    for (const [seconds, ms] of SEQUENCE) {
      const delay = seconds * 1000 - (performance.now() - started);
      const id = window.setTimeout(() => {
        outcomes.push(vibrate(ms));
        if (outcomes.length < SEQUENCE.length) return;
        const accepted = outcomes.filter((o) => o.ok).length;
        record({
          vibrationLater: {
            ok: accepted === SEQUENCE.length,
            text: `${accepted} af ${SEQUENCE.length} vibrationer accepteret uden tryk`,
            at: nowIso(),
          },
        });
      }, delay);
      timers.current.push(id);
    }
  };

  const status = combine([results.sound?.ok, results.vibration?.ok, results.vibrationLater?.ok]);
  const text =
    status === 'green'
      ? 'Browseren spiller lyd og vibrerer, også uden tryk. Om det kan høres og mærkes, afgør du.'
      : status === 'red'
        ? 'Mindst én del virker ikke – se linjerne herunder.'
        : 'Skru op for medielyden. Tryk »Test på gulvet«, læg telefonen på gulvet 1 meter væk, og lyt. Prøv vibrationsknapperne med telefonen på et tæppe.';

  let floorText: string | null = null;
  if (floorStart !== null) {
    const left = DELAY_SECONDS - (performance.now() - floorStart) / 1000;
    floorText = left > 0 ? `Lyd om ${Math.ceil(left)} …` : 'Spiller: tik, tik, tik, go … slut';
  }

  return (
    <Row n={6} title="Lyd og vibration" status={status} text={text}>
      {floorText && <p class="big">{floorText}</p>}
      <Facts
        items={[
          ['Web Audio', contextState],
          ['Lyd', outcomeText(results.sound)],
          ['Vibration ved tryk', outcomeText(results.vibration)],
          [
            'Vibration uden tryk',
            outcomeText(results.vibrationLater, 'ikke prøvet – »Test på gulvet«'),
          ],
        ]}
      />
      <div class="buttons">
        <button type="button" class="primary" onClick={() => void floorTest()}>
          Test på gulvet
        </button>
        <button type="button" onClick={() => playNow('tik')}>
          Tik
        </button>
        <button type="button" onClick={() => playNow('go')}>
          Go
        </button>
        <button type="button" onClick={() => playNow('slut')}>
          Slut
        </button>
        <button type="button" onClick={() => record({ vibration: vibrate(100) })}>
          Vibration 100 ms
        </button>
        <button type="button" onClick={() => record({ vibration: vibrate(300) })}>
          Vibration 300 ms
        </button>
      </div>
    </Row>
  );
}
