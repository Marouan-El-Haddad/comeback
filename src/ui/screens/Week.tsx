// Uge (docs/SPEC.md 3.4; view only in milestone 2): seven rows with the session, its length and
// status, and the week's sets, reserve, power, motor and EMOM cap at the top.
import { formatLong, PROGRAM, weekPlan } from '../../engine/index.ts';
import type { SessionKind } from '../../engine/types.ts';
import { capitalize, sessionMinutes } from '../format.ts';
import type { Model } from '../model.ts';

const NAME: Record<SessionKind, string> = {
  A: 'Styrke A',
  B: 'Styrke B',
  motor: 'Motor',
  os: 'Open & Strong',
  travel: 'Rejsepas',
};

export function WeekView({ model }: { model: Model }) {
  const days = weekPlan(PROGRAM, model.state, model.today);
  const first = days.find((d) => !d.beforeStart) ?? days[0];
  const week = first && !first.beforeStart ? first.week : null;
  return (
    <div class="screen week-screen" data-testid="week">
      <h1>{week ? `Uge ${first?.pw} · ${week.text.phase}` : 'Før programstart'}</h1>
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
          const today = d.date === model.today;
          const session = d.done ?? d.open;
          const skipped = model.state.skipped.some(
            (s) => s.forDate === d.date && s.reason === 'user',
          );
          let status = '';
          if (d.done?.status === 'green' || d.done?.status === 'travel') status = '✓ logget';
          else if (d.done?.status === 'yellow') status = '◐ gult';
          else if (d.done?.status === 'red') status = 'rødt';
          else if (skipped) status = '– sprunget over';
          else if (d.open) status = 'i gang';
          return (
            <li key={d.date} class={today ? 'week-day today' : 'week-day'}>
              <p class="week-day-name">{capitalize(formatLong(d.date))}</p>
              <div class="chips">
                {d.kind && (
                  <span class="chip">
                    {NAME[d.kind]}
                    {d.short ? ' · kort' : ''}
                    {d.session ? ` · ${sessionMinutes(d.session)} min` : ''}
                  </span>
                )}
                {!d.kind && session && <span class="chip">{NAME[session.kind]}</span>}
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
