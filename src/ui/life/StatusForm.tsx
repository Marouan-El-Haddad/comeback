// Status (docs/SPEC.md 3.6, ENGINE.md 3.1, 5.1 step 3, 5.7 and 5.8, DECISIONS.md D67, D70): a
// screen in place of Mere or I dag with »Tilbage«, never a dialog. The statuses that apply today or
// later with »Afslut« or »Fjern« and what applies once they end, then a new one – Syg, Rejse, Ferie
// or Klubben lukket from today or later – with what it does and the status of the same kind it
// corrects, and »Gem status« at the bottom. The events come from the engine (statusChange,
// statusEnd). A button that writes takes the screen from its first tap (D61), and the screen writes
// only in the world it was opened in (D64, D65).
import { useId, useState } from 'preact/hooks';
import { formatLong, isValidDate, statusChange, statusEnd } from '../../engine/index.ts';
import type { ISODate, StatusKind, StatusRange } from '../../engine/types.ts';
import { capitalize } from '../format.ts';
import { useSameWorld, useWriteOnce } from '../hooks.ts';
import type { Model } from '../model.ts';
import { currentStatuses, STATUS_LINE, STATUS_NAME } from '../status.ts';
import { otherWorld, Toggles } from './common.tsx';
import { Head } from './Head.tsx';
import {
  correctionNote,
  EFFECTS,
  endedLine,
  endNote,
  overlapNote,
  resultText,
  spanText,
} from './statusText.ts';

export interface StatusFormProps {
  model: Model;
  onClose: () => void;
  onSaved: (message?: string) => void;
}

const KINDS: StatusKind[] = ['ill', 'travel', 'holiday', 'club_closed'];

/** What is wrong with the days, or null. */
function rangeProblem(from: string, to: string, today: ISODate): string | null {
  if (!isValidDate(from)) return 'Vælg den første dag under »Fra«.';
  if (!isValidDate(to)) return 'Vælg den sidste dag under »Til og med«.';
  if (from < today) return '»Fra« kan ikke ligge før i dag.';
  if (to < from) return '»Til og med« ligger før »Fra«.';
  return null;
}

export function StatusForm(props: StatusFormProps) {
  const { model } = props;
  const today = model.today;
  const state = model.state;
  const { busy, run } = useWriteOnce();
  const sameWorld = useSameWorld(model);
  const [kind, setKind] = useState<StatusKind[]>([]);
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const listId = useId();
  const fromId = useId();
  const toId = useId();

  const current = currentStatuses(state, today);
  const chosen = kind[0];
  const problem = rangeProblem(from, to, today);
  // What »Gem status« writes: a status of the same kind in force today or later that the new one
  // overlaps or adjoins is corrected, not left lying under it (ENGINE 3.1, S-WEEK-14).
  const change =
    chosen !== undefined && problem === null
      ? statusChange(state, { status: chosen, from, to, today })
      : null;
  const notes = change
    ? [correctionNote(change, today), overlapNote(state, change, today)].filter(
        (n): n is string => n !== null,
      )
    : [];

  const save = run(async () => {
    if (!change) throw new Error('not ready');
    if (!sameWorld()) throw otherWorld(props.onClose);
    await model.commit(change.bodies.map((body) => model.ctx.make(body, today)));
    props.onSaved(`✓ ${STATUS_NAME[change.range.status]} ${resultText(change.range, today)}.`);
  });
  // A status that applies today ends yesterday; one that starts later goes (ENGINE 3.1).
  const end = (range: StatusRange) =>
    run(async () => {
      if (!sameWorld()) throw otherWorld(props.onClose);
      const line = endedLine(state, range, today);
      await model.commit([model.ctx.make(statusEnd(range, today), today)]);
      props.onSaved(line);
    });

  return (
    <div class="screen life" data-testid="status">
      <Head kicker="Status og begivenheder" title="Status" onClose={props.onClose} />

      {current.length > 0 && (
        <section class="life-section">
          <p class="life-label" id={listId}>
            Din status
          </p>
          <ul class="status-list" aria-labelledby={listId}>
            {current.map((range) => {
              const now = range.from <= today;
              return (
                <li
                  key={`${range.status}${range.from}`}
                  class="card status-item"
                  data-testid="status-item"
                >
                  <p class="status-item-name">
                    <strong>{STATUS_NAME[range.status]}</strong> {spanText(range, today)}
                  </p>
                  <p>{STATUS_LINE[range.status]}</p>
                  <p class="muted">{endNote(state, range, today)}</p>
                  <button
                    type="button"
                    class="btn block"
                    disabled={busy}
                    data-testid="status-end"
                    onClick={end(range)}
                  >
                    {now ? 'Afslut' : 'Fjern'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Toggles
        label="Ny status"
        options={KINDS.map((k): [StatusKind, string] => [k, STATUS_NAME[k]])}
        value={kind}
        columns={2}
        onChange={setKind}
      />
      <section class="life-section">
        <label class="life-label" for={fromId}>
          Fra
        </label>
        <input
          id={fromId}
          class="life-input"
          type="date"
          min={today}
          value={from}
          data-testid="status-from"
          onInput={(e) => setFrom((e.target as HTMLInputElement).value)}
        />
        {isValidDate(from) && <p class="life-date">{capitalize(dayLabel(from, today))}</p>}
      </section>
      <section class="life-section">
        <label class="life-label" for={toId}>
          Til og med
        </label>
        <input
          id={toId}
          class="life-input"
          type="date"
          min={isValidDate(from) && from > today ? from : today}
          value={to}
          data-testid="status-to"
          onInput={(e) => setTo((e.target as HTMLInputElement).value)}
        />
        {isValidDate(to) && <p class="life-date">{capitalize(dayLabel(to, today))}</p>}
      </section>

      {problem !== null ? (
        <p class="error-text" role="alert">
          {problem}
        </p>
      ) : change ? (
        <ul class="life-effects" data-testid="status-effects">
          <li>
            {STATUS_NAME[change.range.status]} {resultText(change.range, today)}.
          </li>
          {/* What it corrects and where it applies over another status come first. */}
          {notes.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {EFFECTS[change.range.status].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p class="muted">Vælg en status.</p>
      )}

      <button
        type="button"
        class="btn primary block"
        disabled={busy || !change}
        data-testid="status-save"
        onClick={save}
      >
        Gem status
      </button>
    </div>
  );
}

/** »i dag, tirsdag 10. november« or »onsdag 11. november« under a date field. */
function dayLabel(date: ISODate, today: ISODate): string {
  return date === today ? `i dag, ${formatLong(date)}` : formatLong(date);
}
