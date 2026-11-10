// Open & Strong (docs/SPEC.md 4.4): six exercises as one clock, no traffic light, no touch needed
// from start to end (SK3). Logged as os_done; only »denne uge: n af 7« is shown, never a streak.
// Before it starts, its six exercises on one screen as »Dagens pas« (SPEC 3.2); while it runs, »Nu«
// with the figure following the item's clock, and »Næste« with the next item. No intro card (D44).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { mondayOf, osCue, osThisWeek, PROGRAM } from '../../engine/index.ts';
import { enableAudio, play } from '../audio.ts';
import { ExerciseCard, useCard } from '../card.tsx';
import { useSettle } from '../hooks.ts';
import type { Model } from '../model.ts';
import { keepAwake, releaseAwake } from '../wakelock.ts';
import { DayParts, PlanTime, type DayItem } from './DayPlan.tsx';
import { useSubjects } from './exercise.ts';
import {
  ExerciseFigure,
  NextStrip,
  NowCues,
  NowHead,
  SessionProgress,
  useCues,
  useSessionStyle,
} from './NowNext.tsx';
import { SUMMARY_NEXT, type Upcoming } from './outline.ts';
import { Countdown } from './timers.tsx';
import type { Clock } from '../timers/clock.ts';
import type { ClockPart } from '../../figure/sync.ts';

const OS = PROGRAM.routines.find((r) => r.id === 'os');

/** »45 sek«, »1 min 20 sek«. */
function timeText(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} sek`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} sek`;
}

export function OpenStrong({ model, onClose }: { model: Model; onClose: () => void }) {
  useSessionStyle();
  const [index, setIndex] = useState(-1);
  const [paused, setPaused] = useState(false);
  // Set at once, so a second »Videre« in a double tap never saves Open & Strong twice (D61).
  const saved = useRef(false);
  const items = OS?.items ?? [];
  const item = items[index];
  // »Sådan gør du« opens the item's exercise card; the clock stands still while it is open, so the
  // item keeps its time (docs/SPEC.md 3.8, DECISIONS.md D47).
  const card = useCard();
  const held = paused || card.id !== null;
  // Half a second without taps after a new item or the card closing, as in the session (D33, D57):
  // the second tap of a double tap on »Videre« lands on nothing, so no item is skipped (D68).
  const settling = useSettle([index, card.id]);
  const routine = OS?.id ?? 'os';
  useSubjects([routine]);

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
    if (!saved.current) {
      saved.current = true;
      await model.commit([model.ctx.make({ type: 'os_done' }, model.today)]);
    }
    setIndex(items.length);
  };

  const listed: DayItem[] = items.map((i) => ({
    key: i.key,
    cardId: `${routine}.${i.key}`,
    pictoId: `${routine}.${i.key}`,
    kicker: timeText(i.seconds),
    name: i.name,
    dose: i.dose,
    notes: [],
  }));
  const upcoming = (at: number): Upcoming => {
    const following = items[at];
    if (!following) return { ...SUMMARY_NEXT, title: 'Færdig', line: 'Denne uge tæller med' };
    return {
      cardId: `${routine}.${following.key}`,
      pictoId: `${routine}.${following.key}`,
      title: following.name,
      line: `${following.dose} · ${timeText(following.seconds)}`,
    };
  };
  const total = Math.round(items.reduce((sum, i) => sum + i.seconds, 0) / 60);

  return (
    <>
      <div
        class={settling ? 'session settling' : 'session'}
        data-testid="open-strong"
        hidden={card.id !== null}
      >
        <div class="session-top">
          <header class="session-header">
            <div class="session-heading">
              {item && (
                <p class="session-progress">
                  Øvelse {index + 1} af {items.length}
                </p>
              )}
              <p class="session-title">
                Open &amp; Strong{item ? ` · ${index + 1}/${items.length}` : ''}
              </p>
            </div>
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
          {item && <SessionProgress at={index + 1} of={items.length} label={item.name} />}
        </div>
        <div class={item ? 'session-body' : 'session-body with-actions'}>
          {index < 0 && (
            <div class="day-plan" data-testid="day-plan">
              <header class="day-plan-facts">
                <p class="step-kicker">Dagens pas</p>
                <h1>Open &amp; Strong</h1>
                <p class="day-plan-stats">
                  <PlanTime minutes={total} />
                </p>
                <p>Seks øvelser som ét ur. Læg telefonen, så den kan ses og høres.</p>
              </header>
              <DayParts
                parts={[{ label: 'Seks øvelser', note: 'Uret skifter selv', items: listed }]}
                onCard={(i) => i.cardId && card.open(i.cardId)}
                numbered={false}
              />
            </div>
          )}
          {item && (
            <OsItem
              key={index}
              id={`${routine}.${item.key}`}
              name={item.name}
              dose={item.dose}
              seconds={item.seconds}
              cue={osCue(PROGRAM, model.state, item.key)}
              paused={held}
              onDone={() => void next()}
              onCard={() => card.open(`${routine}.${item.key}`)}
              next={upcoming(index + 1)}
              onNext={() => void next()}
            />
          )}
          {index >= items.length && (
            <div class="stack">
              <h1>Godt gået</h1>
              <p class="cue">Denne uge: {osThisWeek(model.state, mondayOf(model.today))} af 7.</p>
            </div>
          )}
        </div>
        {!item && (
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
            {index >= items.length && (
              <button
                type="button"
                class="btn primary block"
                onClick={onClose}
                data-testid="os-close"
              >
                Færdig
              </button>
            )}
          </div>
        )}
      </div>
      {card.id !== null && (
        <ExerciseCard
          id={card.id}
          back="Tilbage til Open & Strong"
          onClose={card.close}
          status="Open & Strong står stille."
        />
      )}
    </>
  );
}

/** One item: »Nu« with the figure following the item's clock, its cue, »Næste« and »Videre«. */
function OsItem(props: {
  id: string;
  name: string;
  dose: string;
  seconds: number;
  cue: string;
  paused: boolean;
  onDone: () => void;
  onCard: () => void;
  next: Upcoming;
  onNext: () => void;
}) {
  const cues = useCues(props.id);
  const parts = useMemo<ClockPart[]>(
    () => [{ kind: 'work', seconds: props.seconds }],
    [props.seconds],
  );
  const [clock, setClock] = useState<Clock | null>(null);
  return (
    <div class="stack now">
      <NowHead kicker={props.dose} name={props.name} onCard={props.onCard} />
      <div class="now-stage step-enter">
        <div class="now-figure">
          <ExerciseFigure
            cardId={props.id}
            pictoId={props.id}
            name={props.name}
            size="now"
            follow={{
              parts,
              mode: { kind: 'routine' },
              part: () => (clock ? { index: 0, clock } : null),
            }}
          />
        </div>
        <Countdown
          seconds={props.seconds}
          paused={props.paused}
          onDone={props.onDone}
          end="go"
          size="medium"
          onClock={setClock}
        />
      </div>
      <p class="cue">{props.cue}</p>
      <NowCues cues={cues} />
      <div class="fixed-actions">
        <NextStrip next={props.next} />
        <button type="button" class="btn block" onClick={props.onNext}>
          Videre
        </button>
      </div>
    </div>
  );
}
