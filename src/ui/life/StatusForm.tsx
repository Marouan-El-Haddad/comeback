// Status (docs/SPEC.md 3.6, ENGINE.md 3.1, 5.1 step 3, 5.7 and 5.8, DECISIONS.md D67): a screen in
// place of Mere or I dag with »Tilbage«, never a dialog. The statuses that apply today or later with
// »Afslut« or »Fjern«, then a new one – Syg, Rejse, Ferie or Klubben lukket from today or later –
// with what it does, and »Gem status« at the bottom. A button that writes takes the screen from its
// first tap (D61), and the screen writes only in the world it was opened in (D64, D65).
import { useId, useState } from 'preact/hooks';
import { addDays, formatLong, isValidDate } from '../../engine/index.ts';
import type { ISODate, StatusKind, StatusRange } from '../../engine/types.ts';
import { capitalize } from '../format.ts';
import { useSameWorld, useWriteOnce } from '../hooks.ts';
import type { Model } from '../model.ts';
import { currentStatuses, rangeText, STATUS_LINE, STATUS_NAME } from '../status.ts';
import { otherWorld, Toggles } from './common.tsx';
import { Head } from './Head.tsx';

export interface StatusFormProps {
  model: Model;
  onClose: () => void;
  onSaved: (message?: string) => void;
}

const KINDS: StatusKind[] = ['ill', 'travel', 'holiday', 'club_closed'];

/** What a status does (ENGINE 5.1 step 3, R-ILL, R-TRAVEL, R-HOLIDAY and 5.8), a line each. */
const EFFECTS: Record<StatusKind, string[]> = {
  ill: [
    'Alle dage er røde: kun Open & Strong og en gåtur.',
    'Ugerne under sygdom er ikke gennemførte.',
    'Kun forkølet over halsen er din egen vurdering.',
  ],
  travel: [
    'Styrke-dagene får rejsepasset: 25 min med push-ups, rygsæk-row, split squats og 6 min EMOM.',
    'Rejsepasset gennemfører ugen, men flytter ingen stiger.',
  ],
  holiday: [
    'Hvile: ingen pas, og Open & Strong er valgfri.',
    'Ugerne er ikke gennemførte. Vil du træne i ferien, så sæt ikke ferie.',
  ],
  club_closed: ['Muay Thai-dagene bliver 4–5 kamp-runder hjemme.'],
};

/** What is wrong with the days, or null. */
function rangeProblem(from: string, to: string, today: ISODate): string | null {
  if (!isValidDate(from)) return 'Vælg den første dag under »Fra«.';
  if (!isValidDate(to)) return 'Vælg den sidste dag under »Til og med«.';
  if (from < today) return '»Fra« kan ikke ligge før i dag.';
  if (to < from) return '»Til og med« ligger før »Fra«.';
  return null;
}

/** »til og med onsdag 11. november« for a status that applies today, the days for a later one. */
function spanText(range: StatusRange, today: ISODate): string {
  if (range.from > today) return rangeText(range.from, range.to, today);
  return range.to === today ? 'i dag' : `til og med ${formatLong(range.to)}`;
}

export function StatusForm(props: StatusFormProps) {
  const { model } = props;
  const today = model.today;
  const { busy, run } = useWriteOnce();
  const sameWorld = useSameWorld(model);
  const [kind, setKind] = useState<StatusKind[]>([]);
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const listId = useId();
  const fromId = useId();
  const toId = useId();

  const current = currentStatuses(model.state, today);
  const chosen = kind[0];
  const problem = rangeProblem(from, to, today);
  const ready = chosen !== undefined && problem === null;

  // A new status with the same status and first day replaces the old one in its place (ENGINE 3.1);
  // otherwise it is the newest, and of ill, travel and holiday the newest applies where they overlap
  // – the club closed applies next to them (5.1 step 3).
  const notes: string[] = [];
  if (ready) {
    const same = current.find((r) => r.status === chosen && r.from === from);
    const own = (k: StatusKind) => k !== 'club_closed';
    if (same) {
      notes.push(`Afløser ${STATUS_NAME[chosen]} ${rangeText(same.from, same.to, today)}.`);
    } else if (own(chosen)) {
      const over = current.filter(
        (r) => own(r.status) && r.status !== chosen && r.from <= to && from <= r.to,
      );
      const names = [...new Set(over.map((r) => STATUS_NAME[r.status]))];
      if (names.length > 0) {
        notes.push(`Gælder i stedet for ${names.join(' og ')} de dage, de overlapper.`);
      }
    }
  }

  const save = run(async () => {
    if (!chosen || problem !== null) throw new Error('not ready');
    if (!sameWorld()) throw otherWorld(props.onClose);
    await model.commit([model.ctx.make({ type: 'status_set', status: chosen, from, to }, today)]);
    props.onSaved(`✓ ${STATUS_NAME[chosen]} ${rangeText(from, to, today)}.`);
  });
  // A status that applies today ends yesterday; one that starts today or later goes (ENGINE 3.1).
  const end = (range: StatusRange) =>
    run(async () => {
      if (!sameWorld()) throw otherWorld(props.onClose);
      const last = addDays(range.from > today ? range.from : today, -1);
      await model.commit([
        model.ctx.make(
          { type: 'status_set', status: range.status, from: range.from, to: last },
          today,
        ),
      ]);
      const name = STATUS_NAME[range.status];
      props.onSaved(
        range.from <= today
          ? `✓ ${name} er afsluttet. Fra i dag gælder den almindelige plan.`
          : `✓ ${name} ${rangeText(range.from, range.to, today)} er fjernet.`,
      );
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
                  <p class="muted">
                    {now
                      ? 'Afslut, så gælder den almindelige plan fra i dag.'
                      : 'Fjern, så gælder statussen ikke.'}
                  </p>
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
      ) : chosen ? (
        <ul class="life-effects" data-testid="status-effects">
          <li>
            {STATUS_NAME[chosen]} {rangeText(from, to, today)}.
          </li>
          {EFFECTS[chosen].map((line) => (
            <li key={line}>{line}</li>
          ))}
          {notes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p class="muted">Vælg en status.</p>
      )}

      <button
        type="button"
        class="btn primary block"
        disabled={busy || !ready}
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
