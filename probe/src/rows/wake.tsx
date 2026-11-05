import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { errorText, formatClock, nowIso } from '../format';
import type { Results } from '../store';
import { Facts, Row, outcomeText, type Recorder, type Status } from '../ui';

const TARGET_SECONDS = 180;
type Method = 'wakeLock' | 'video';
type Run = { method: Method; start: number };
const NAMES: Record<Method, string> = { wakeLock: 'Wake Lock', video: 'Fallback-videoen' };
const VIDEO_URL = `${import.meta.env.BASE_URL}keep-awake.webm`;

export function WakeRow({ results, record }: { results: Results; record: Recorder }) {
  const [run, setRun] = useState<Run | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const runRef = useRef<Run | null>(null);
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  const stop = useCallback(() => {
    runRef.current = null;
    setRun(null);
    const lock = sentinel.current;
    sentinel.current = null;
    if (lock && !lock.released) lock.release().catch(() => undefined);
    video.current?.pause();
  }, []);

  const finish = useCallback(
    (ok: boolean, text: string) => {
      const current = runRef.current;
      if (!current) return;
      const outcome = { ok, text, at: nowIso() };
      record(current.method === 'wakeLock' ? { wakeLock: outcome } : { video: outcome });
      stop();
    },
    [record, stop],
  );

  const begin = (method: Method) => {
    const next = { method, start: performance.now() };
    runRef.current = next;
    setRun(next);
    setElapsed(0);
  };

  useEffect(() => {
    if (!run) return;
    const seconds = () => (performance.now() - run.start) / 1000;
    const timer = setInterval(() => {
      const s = seconds();
      setElapsed(s);
      if (s >= TARGET_SECONDS)
        finish(true, `${NAMES[run.method]} holdt skærmen tændt i 3 minutter`);
    }, 250);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        finish(false, `Skærmen slukkede eller appen blev skjult efter ${formatClock(seconds())}`);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [run, finish]);

  useEffect(() => stop, [stop]);

  const startWakeLock = async () => {
    stop();
    if (!('wakeLock' in navigator)) {
      record({
        wakeLock: { ok: false, text: 'Wake Lock-API findes ikke i browseren', at: nowIso() },
      });
      return;
    }
    try {
      const lock = await navigator.wakeLock.request('screen');
      sentinel.current = lock;
      lock.addEventListener('release', () => {
        const current = runRef.current;
        if (current?.method === 'wakeLock' && sentinel.current === lock) {
          const s = (performance.now() - current.start) / 1000;
          finish(false, `Wake Lock blev sluppet efter ${formatClock(s)}`);
        }
      });
      begin('wakeLock');
    } catch (error) {
      record({ wakeLock: { ok: false, text: `Afvist: ${errorText(error)}`, at: nowIso() } });
    }
  };

  const startVideo = async () => {
    stop();
    const element = video.current;
    if (!element) return;
    try {
      element.currentTime = 0;
      await element.play();
      begin('video');
    } catch (error) {
      const text = `Videoen kunne ikke afspilles: ${errorText(error)}`;
      record({ video: { ok: false, text, at: nowIso() } });
    }
  };

  let status: Status = 'waiting';
  let text =
    'Tryk på en knap, og læg telefonen uden at røre den i 3 minutter. Skærmens timeout skal være kortere end 3 minutter.';
  if (run) {
    text = `${NAMES[run.method]} kører. Rør ikke telefonen.`;
  } else if (results.wakeLock?.ok || results.video?.ok) {
    status = 'green';
    text = results.wakeLock?.ok
      ? 'Wake Lock holdt skærmen tændt i 3 minutter.'
      : 'Wake Lock virker ikke, men fallback-videoen holdt skærmen tændt i 3 minutter.';
  } else if (results.wakeLock || results.video) {
    status = 'red';
    text = results.video
      ? 'Skærmen slukkede med både Wake Lock og fallback-video.'
      : 'Wake Lock holdt ikke skærmen tændt. Prøv fallback-videoen.';
  }

  return (
    <Row n={5} title="Wake Lock" status={status} text={text}>
      {run && (
        <p class="big">
          {formatClock(elapsed)} af {formatClock(TARGET_SECONDS)}
        </p>
      )}
      <Facts
        items={[
          ['Wake Lock-API', 'wakeLock' in navigator ? 'findes' : 'findes ikke'],
          ['Wake Lock', outcomeText(results.wakeLock)],
          ['Fallback-video', outcomeText(results.video)],
        ]}
      />
      <video
        ref={video}
        class="keep-awake"
        src={VIDEO_URL}
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Fallback-video"
      />
      <div class="buttons">
        <button type="button" onClick={() => void startWakeLock()}>
          Start Wake Lock
        </button>
        <button type="button" onClick={() => void startVideo()}>
          Start fallback-video
        </button>
        {run && (
          <button type="button" onClick={stop}>
            Stop
          </button>
        )}
      </div>
    </Row>
  );
}
