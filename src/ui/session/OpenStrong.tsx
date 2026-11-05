// Open & Strong (docs/SPEC.md 4.4): six exercises as one clock, no traffic light, no touch needed
// from start to end (SK3). Logged as os_done; only »denne uge: n af 7« is shown, never a streak.
import { useEffect, useState } from 'preact/hooks';
import { mondayOf, osCue, osThisWeek, PROGRAM } from '../../engine/index.ts';
import { enableAudio, play } from '../audio.ts';
import { pictoUrl } from '../components/Picto.tsx';
import type { Model } from '../model.ts';
import { keepAwake, releaseAwake } from '../wakelock.ts';
import { Countdown } from './timers.tsx';

const OS = PROGRAM.routines.find((r) => r.id === 'os');

export function OpenStrong({ model, onClose }: { model: Model; onClose: () => void }) {
  const [index, setIndex] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState(false);
  const items = OS?.items ?? [];
  const item = items[index];

  useEffect(() => {
    void keepAwake();
    return () => releaseAwake();
  }, []);

  const next = async () => {
    if (index + 1 < items.length) {
      setIndex(index + 1);
      return;
    }
    play('slut');
    if (!saved) {
      setSaved(true);
      await model.commit([model.ctx.make({ type: 'os_done' }, model.today)]);
    }
    setIndex(items.length);
  };

  return (
    <div class="session" data-testid="open-strong">
      <header class="session-header">
        <p class="session-title">
          Open &amp; Strong{item ? ` · ${index + 1}/${items.length}` : ''}
        </p>
        {item && (
          <button
            type="button"
            class="btn small"
            onClick={() => setPaused(!paused)}
            aria-pressed={paused}
          >
            {paused ? 'Fortsæt' : 'Pause'}
          </button>
        )}
        <button type="button" class="btn small" onClick={onClose}>
          Luk
        </button>
      </header>
      <div class="session-body">
        {index < 0 && (
          <div class="stack">
            <h1>Open &amp; Strong · 6 min</h1>
            <p class="cue">Seks øvelser som ét ur. Læg telefonen, så den kan ses og høres.</p>
            <ol class="os-list">
              {items.map((i) => (
                <li key={i.key}>
                  {i.name} · {i.dose}
                </li>
              ))}
            </ol>
          </div>
        )}
        {item && (
          <div class="stack">
            <p class="step-kicker">{item.dose}</p>
            <h1>{item.name}</h1>
            {item.picto && (
              <img
                class="picto"
                src={pictoUrl(`os.${item.key}`) ?? ''}
                alt=""
                width={120}
                height={120}
              />
            )}
            <p class="cue">{osCue(PROGRAM, model.state, item.key)}</p>
            <Countdown
              key={index}
              seconds={item.seconds}
              paused={paused}
              onDone={() => void next()}
              end="go"
            />
          </div>
        )}
        {index >= items.length && (
          <div class="stack">
            <h1>Godt gået</h1>
            <p class="cue">Denne uge: {osThisWeek(model.state, mondayOf(model.today))} af 7.</p>
          </div>
        )}
      </div>
      <div class="session-actions">
        {index < 0 && (
          <button
            type="button"
            class="btn primary block"
            data-testid="os-go"
            onClick={() => {
              void enableAudio();
              void next();
            }}
          >
            Start
          </button>
        )}
        {item && (
          <button type="button" class="btn block" onClick={() => void next()}>
            Videre
          </button>
        )}
        {index >= items.length && (
          <button type="button" class="btn primary block" onClick={onClose} data-testid="os-close">
            Færdig
          </button>
        )}
      </div>
    </div>
  );
}
