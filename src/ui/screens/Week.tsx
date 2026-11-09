// Uge (docs/SPEC.md 3.4): seven rows as a table – the day on the left, the session, its length and
// status on the right – and the week's sets, reserve, power, motor and EMOM cap at the top. A session
// of the week that is not started is a button: »Flyt eller spring over« opens in place of Uge, also
// for a forgotten one from an earlier day (D64).
import { useEffect, useState } from 'preact/hooks';
import { formatLong, PROGRAM, weekPlan } from '../../engine/index.ts';
import type { SessionKind } from '../../engine/types.ts';
import { capitalize, SESSION_NAME, sessionMinutes } from '../format.ts';
import { screenSettled, useScreenEntry, useSettle } from '../hooks.ts';
import type { LifeRequest } from '../life.ts';
import { LifeForm } from '../lifeScreen.ts';
import type { Model } from '../model.ts';
import { canAct, movable, movedFrom, weekdayWord } from '../moves.ts';

/** The chip's colour from the tokens' semantics: strength navy, motor blue (design-tokens.json). */
function chipKind(kind: SessionKind): string {
  return kind === 'motor' ? 'motor' : kind === 'os' ? '' : 'strength';
}

export function WeekView({ model }: { model: Model }) {
  const [form, setForm] = useState<LifeRequest | null>(null);
  /** »✓ Styrke A er flyttet til torsdag 12. november.« after the screen wrote; only on its day. */
  const [saved, setSaved] = useState<{ text: string; on: string } | null>(null);
  const settling = useSettle([form]);
  const { state, today } = model;
  // The screen and its »✓« line belong to their world: when the time machine ends, they go.
  const world = model.sim;
  useEffect(() => {
    setForm(null);
    setSaved(null);
  }, [world]);
  // A screen is a step in the history: Android's back gesture closes it, not the app (D65).
  useScreenEntry(form !== null, () => setForm(null));

  if (form) {
    return (
      <div class={settling ? 'life-host settling' : 'life-host'}>
        <LifeForm
          request={form}
          model={model}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setSaved(message ? { text: message, on: today } : null);
            setForm(null);
          }}
        />
      </div>
    );
  }

  const open = (request: LifeRequest) => {
    const show = () => setForm(request);
    void Promise.all([LifeForm.preload(), screenSettled()]).then(show, show);
  };
  const days = weekPlan(PROGRAM, state, today);
  const first = days.find((d) => !d.beforeStart) ?? days[0];
  const week = first && !first.beforeStart ? first.week : null;
  return (
    <div class={settling ? 'screen week-screen settling' : 'screen week-screen'} data-testid="week">
      <h1>{week ? `Uge ${first?.pw} · ${week.text.phase}` : 'Før programstart'}</h1>
      {saved?.on === today && (
        <p class="life-saved" role="status">
          {saved.text}
        </p>
      )}
      {week && (
        <dl class="week-facts card panel">
          <dt>Styrke</dt>
          <dd>{week.text.strength}</dd>
          <dt>Power</dt>
          <dd>{week.text.power}</dd>
          <dt>Motor (tor)</dt>
          <dd>{week.text.motor}</dd>
          <dt>Burpees (tir)</dt>
          <dd>{week.text.burpees}</dd>
        </dl>
      )}
      <ul class="week-days">
        {days.map((d) => {
          const isToday = d.date === today;
          const session = d.done ?? d.open;
          const item = d.kind ? movable(PROGRAM, state, d.date, today) : null;
          // A session skipped and then moved away leaves nothing on its old day.
          const skipped =
            d.kind !== null &&
            state.skipped.some((s) => s.forDate === d.date && s.reason === 'user');
          const from = item ? movedFrom(PROGRAM, state, item.kind, d.date) : null;
          const [weekdayName = '', ...rest] = formatLong(d.date).split(' ');
          const date = rest.join(' ');
          let status = '';
          if (d.done?.status === 'green' || d.done?.status === 'travel') status = '✓ logget';
          else if (d.done?.status === 'yellow') status = '◐ gult';
          else if (d.done?.status === 'red') status = 'rødt';
          else if (skipped) status = '– sprunget over';
          else if (d.open) status = 'i gang';
          else if (item?.missed) status = '– ikke logget';
          else if (from) status = `flyttet fra ${weekdayWord(from)}`;
          const chip =
            d.kind &&
            `${SESSION_NAME[d.kind]}${d.short ? ' · kort' : ''}${
              d.session ? ` · ${sessionMinutes(d.session)} min` : ''
            }`;
          return (
            <li key={d.date} class={isToday ? 'week-day today' : 'week-day'}>
              <p class="week-day-name">
                {/* »Mandag« over »16. november«: the day reads first, as in a table (SPEC 3.4). */}
                <span class="week-day-weekday">{capitalize(weekdayName)}</span>{' '}
                <span class="week-day-date">{date}</span>
              </p>
              <div class="chips">
                {d.kind &&
                  (item && canAct(item) ? (
                    <button
                      type="button"
                      class={`chip chip-button ${chipKind(d.kind)}`}
                      data-testid="week-session"
                      onClick={() => open({ kind: 'move', session: item.kind, date: d.date })}
                    >
                      {chip}
                    </button>
                  ) : (
                    <span class={`chip ${chipKind(d.kind)}`}>{chip}</span>
                  ))}
                {!d.kind && session && (
                  <span class={`chip ${chipKind(session.kind)}`}>{SESSION_NAME[session.kind]}</span>
                )}
                {d.club.day && (
                  <span class="chip club">
                    {d.club.closed ? 'Kamp-runder hjemme' : `Muay Thai ${d.club.time ?? ''}`}
                  </span>
                )}
                {d.red && <span class="chip">Syg</span>}
                {status && <span class="chip status">{status}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
