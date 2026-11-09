// »Flyt eller spring over« (docs/SPEC.md 3.1 and 3.4, ENGINE.md 5.9, DECISIONS.md D64): a screen in
// place of I dag or Uge with »Tilbage«, never a dialog. Only the days the engine allows from today
// until Sunday: the whole days under »Flyt til« with what the move costs on the button, the club days
// as the short version, and »Spring over« at the bottom. A button that writes takes the screen from
// its first tap (D61); the day is checked against the rules again when it is written.
import { Fragment } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { formatLong, moveSession, PROGRAM, type MoveOption } from '../../engine/index.ts';
import type { ISODate, SessionKind } from '../../engine/types.ts';
import { SESSION_NAME } from '../format.ts';
import { useSameWorld, useWriteOnce } from '../hooks.ts';
import type { Model } from '../model.ts';
import { dayRef, movable, optionName, optionNotes, type Movable } from '../moves.ts';
import { Head } from './Head.tsx';

export interface MoveFormProps {
  model: Model;
  /** The week plan's session (A, B or motor) and the day it stands on. */
  session: SessionKind;
  date: ISODate;
  onClose: () => void;
  onSaved: (message?: string) => void;
}

function skippedLine(name: string, date: ISODate, today: ISODate): string {
  if (date === today) return `✓ ${name} er sprunget over i dag.`;
  return `✓ ${name} ${dayRef(date, today)} er sprunget over.`;
}

export function MoveForm(props: MoveFormProps) {
  const { model } = props;
  const today = model.today;
  const { busy, run } = useWriteOnce();
  const sameWorld = useSameWorld(model);
  const [error, setError] = useState<string | null>(null);
  const fullId = useId();
  const shortId = useId();
  // While a tap writes, the screen keeps what it showed when the tap came.
  const found = movable(PROGRAM, model.state, props.date, today);
  const fresh = found && found.kind === props.session ? found : null;
  const shown = useRef<Movable | null>(fresh);
  if (!busy) shown.current = fresh;
  const item = shown.current;

  if (!item) {
    return (
      <div class="screen life" data-testid="move">
        <Head
          kicker={formatLong(props.date)}
          title="Flyt eller spring over"
          onClose={props.onClose}
        />
        <p>Passet kan ikke flyttes længere.</p>
      </div>
    );
  }

  const name = SESSION_NAME[item.shown];
  const full = item.options.filter((o) => o.mode === 'full');
  const short = item.options.filter((o) => o.mode === 'short');
  const note = item.missed ? ' · ikke logget' : item.skipped ? ' · sprunget over' : '';

  // Opened in the time machine and still open after »Afslut«: nothing is written (SPEC 3.7).
  const otherWorld = () => {
    props.onClose();
    return new Error('the time machine started or ended');
  };
  const move = (option: MoveOption) =>
    run(async () => {
      if (!sameWorld()) throw otherWorld();
      const event = moveSession(PROGRAM, model.state, model.ctx.make, {
        kind: item.kind,
        fromDate: item.date,
        toDate: option.date,
        today: model.today,
        short: option.mode === 'short',
      });
      if (!event) {
        setError('Den dag kan ikke længere tage passet. Vælg en anden.');
        throw new Error('not a valid day any more');
      }
      await model.commit([event]);
      const to = option.date === today ? 'i dag' : formatLong(option.date);
      props.onSaved(
        `✓ ${name} er flyttet til ${to}${option.mode === 'short' ? ' som kort version' : ''}.`,
      );
    });
  const skip = run(async () => {
    if (!sameWorld()) throw otherWorld();
    await model.commit([
      model.ctx.make(
        { type: 'session_skipped', kind: item.kind, forDate: item.date, reason: 'user' },
        model.today,
      ),
    ]);
    props.onSaved(skippedLine(name, item.date, today));
  });

  const day = (option: MoveOption) => (
    <button
      key={option.date}
      type="button"
      class="btn block move-day"
      disabled={busy}
      data-testid="move-day"
      data-date={option.date}
      onClick={move(option)}
    >
      <span class="move-day-name">{optionName(option, today)}</span>
      {optionNotes(option).map((text) => (
        <Fragment key={text}>
          {' '}
          <span class="move-day-note">{text}</span>
        </Fragment>
      ))}
    </button>
  );

  return (
    <div class="screen life" data-testid="move">
      <Head
        kicker={`${name} · ${formatLong(item.date)}${note}`}
        title={item.skipped ? 'Flyt passet' : 'Flyt eller spring over'}
        onClose={props.onClose}
      />
      {error && (
        <p class="error-text" role="alert">
          {error}
        </p>
      )}
      {full.length > 0 && (
        <section class="life-section">
          <p class="life-label" id={fullId}>
            Flyt til
          </p>
          <div class="move-days" role="group" aria-labelledby={fullId}>
            {full.map(day)}
          </div>
        </section>
      )}
      {short.length > 0 && (
        <section class="life-section">
          <p class="life-label" id={shortId}>
            Kort version på en klubdag
          </p>
          <p>30 min med opvarmning, par 1 og 2. Tag den om morgenen, før klubben.</p>
          <div class="move-days" role="group" aria-labelledby={shortId}>
            {short.map(day)}
          </div>
        </section>
      )}
      {item.options.length === 0 && <p>Ingen dag tilbage i ugen kan tage passet.</p>}
      {!item.skipped && (
        <section class="life-section move-skip">
          <button
            type="button"
            class="btn block"
            disabled={busy}
            data-testid="move-skip"
            onClick={skip}
          >
            Spring over
          </button>
        </section>
      )}
    </div>
  );
}
