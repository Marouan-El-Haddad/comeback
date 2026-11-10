// Begivenheder (docs/SPEC.md 3.6, ENGINE.md 5.1 step 5, DECISIONS.md D67): a screen in place of Mere
// or I dag with »Tilbage«, never a dialog. The events to come, then a new one – a name and a day from
// tomorrow on – with the day before it that gets lighter and what its session loses (the engine's
// eventTrim), and »Tilføj begivenhed« at the bottom. An event cannot be removed: the engine has no
// event for it, and the screen says so before it is added. The button takes the screen from its
// first tap (D61), and the screen writes only in the world it was opened in (D64, D65).
import { useId, useState } from 'preact/hooks';
import {
  addDays,
  eventTrim,
  formatLong,
  getTrack,
  isValidDate,
  planFor,
  PROGRAM,
  type EventTrim,
} from '../../engine/index.ts';
import { capitalize, SESSION_NAME } from '../format.ts';
import { useSameWorld, useWriteOnce } from '../hooks.ts';
import type { Model } from '../model.ts';
import { comingEvents, dayText } from '../status.ts';
import { otherWorld } from './common.tsx';
import { Head } from './Head.tsx';

export interface EventFormProps {
  model: Model;
  onClose: () => void;
  onSaved: (message?: string) => void;
}

/** The longest name of an event. */
const MAX_LABEL = 40;

/** »A, B og C« */
function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} og ${items[items.length - 1] ?? ''}`;
}

const MOTOR: Record<NonNullable<EventTrim['motor']>, string> = {
  intervals: 'Motoren bliver en rolig base i stedet for intervaller.',
  cooper: 'Motoren bliver en rolig base uden Cooper-testen.',
  strides: 'Motoren bliver en rolig base uden stigningsløb.',
};

/** What the day before the event loses, from the engine's own comparison (S-EVENT-03). */
function trimLines(trim: EventTrim): string[] {
  if (trim.kind === null) return ['Den dag har intet pas.'];
  const name = SESSION_NAME[trim.kind];
  const lines: string[] = [];
  if (trim.tracks.length > 0) {
    lines.push(`${name} mister ${list(trim.tracks.map((id) => getTrack(PROGRAM, id).short))}.`);
  }
  if (trim.motor) lines.push(MOTOR[trim.motor]);
  if (trim.boss) lines.push('Boss-udfordringen venter til en anden dag.');
  if (lines.length === 0) {
    lines.push(`${name} har hverken tunge ben, Nordic eller intervaller og er uændret.`);
  }
  return lines;
}

export function EventForm(props: EventFormProps) {
  const { model } = props;
  const today = model.today;
  const state = model.state;
  const { busy, run } = useWriteOnce();
  const sameWorld = useSameWorld(model);
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const listId = useId();
  const nameId = useId();
  const dateId = useId();

  const coming = comingEvents(state, today);
  const name = label.trim();
  const tomorrow = addDays(today, 1);
  const taken = isValidDate(date) ? state.events.find((e) => e.eventDate === date) : undefined;
  const problem =
    date !== '' && !isValidDate(date)
      ? 'Vælg datoen.'
      : isValidDate(date) && date < tomorrow
        ? 'Datoen skal være i morgen eller senere.'
        : taken
          ? `Der er allerede en begivenhed den dag: ${taken.label}.`
          : null;
  const ready = name !== '' && isValidDate(date) && problem === null;
  const before = isValidDate(date) ? addDays(date, -1) : null;
  // The day before as the engine plans it with the new event (eventTrim). A session logged or under
  // way today ran with what it had, so nothing changes in it (D70).
  const trim =
    ready && before
      ? eventTrim(
          PROGRAM,
          { ...state, events: [...state.events, { label: name, eventDate: date }] },
          before,
        )
      : null;
  const ran = before ? planFor(PROGRAM, state, before) : null;
  const lines = !trim
    ? []
    : ran?.done
      ? ['Dagens pas er logget, så det ændres ikke.']
      : ran?.open
        ? ['Dagens pas er i gang, så det ændres ikke.']
        : trimLines(trim);

  const save = run(async () => {
    if (!ready) throw new Error('not ready');
    if (!sameWorld()) throw otherWorld(props.onClose);
    await model.commit([
      model.ctx.make({ type: 'calendar_event_added', label: name, eventDate: date }, today),
    ]);
    props.onSaved(`✓ ${name} ${formatLong(date)} er tilføjet.`);
  });

  return (
    <div class="screen life" data-testid="event">
      <Head kicker="Status og begivenheder" title="Begivenhed" onClose={props.onClose} />

      {coming.length > 0 && (
        <section class="life-section">
          <p class="life-label" id={listId}>
            Kommende
          </p>
          <ul class="life-list" aria-labelledby={listId} data-testid="event-list">
            {coming.map((e) => (
              <li key={`${e.eventDate}${e.label}`} class="event-item">
                <span>
                  <strong>{e.label}</strong> · {dayText(e.eventDate, today)}
                </span>
                {e.eventDate > today && (
                  <span class="muted">
                    {capitalize(dayText(addDays(e.eventDate, -1), today))} er let.
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section class="life-section">
        <label class="life-label" for={nameId}>
          Navn
        </label>
        <input
          id={nameId}
          class="life-input"
          type="text"
          maxLength={MAX_LABEL}
          autoComplete="off"
          value={label}
          data-testid="event-label"
          onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
        />
        <p class="muted">Fx Kamp.</p>
      </section>
      <section class="life-section">
        <label class="life-label" for={dateId}>
          Dato
        </label>
        <input
          id={dateId}
          class="life-input"
          type="date"
          min={tomorrow}
          value={date}
          data-testid="event-date"
          onInput={(e) => setDate((e.target as HTMLInputElement).value)}
        />
        {isValidDate(date) && <p class="life-date">{capitalize(formatLong(date))}</p>}
      </section>

      {problem !== null ? (
        <p class="error-text" role="alert">
          {problem}
        </p>
      ) : trim && before ? (
        <ul class="life-effects" data-testid="event-effects">
          <li>
            {capitalize(dayText(before, today))} er dagen før: ingen tunge ben, Nordic eller
            intervaller.
          </li>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li>En begivenhed kan ikke fjernes igen.</li>
        </ul>
      ) : (
        <p class="muted">Skriv navnet, og vælg datoen.</p>
      )}

      <button
        type="button"
        class="btn primary block"
        disabled={busy || !ready}
        data-testid="event-save"
        onClick={save}
      >
        Tilføj begivenhed
      </button>
    </div>
  );
}
