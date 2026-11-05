// I dag (docs/SPEC.md 3.1): today's session with one button, Open & Strong, tomorrow, the rest of
// the week, the »blev ikke logget« card and the backup line. Visible without a tap (SK1).
import { useEffect } from 'preact/hooks';
import {
  addDays,
  daysBetween,
  formatLong,
  getStep,
  getTrack,
  getWeek,
  measurementWeek,
  mondayOf,
  osThisWeek,
  planFor,
  PROGRAM,
  weekday,
  weekInfoAt,
  type BlockPlan,
  type DayPlan,
} from '../../engine/index.ts';
import type { SessionKind } from '../../engine/types.ts';
import { sessionMinutes } from '../format.ts';
import type { Model } from '../model.ts';
import { markTodayVisible } from '../startup.ts';

const PHASE: Record<string, string> = {
  fundament: 'Fundament',
  opbygning: 'Opbygning',
  kampform: 'Kampform',
  let: 'Let uge',
};

const SESSION_NAME: Record<SessionKind, string> = {
  A: 'Styrke A',
  B: 'Styrke B',
  motor: 'Motor',
  os: 'Open & Strong',
  travel: 'Rejsepas',
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function blockLine(block: BlockPlan): string | null {
  if (block.role === 'warmup') return 'Opvarmning · 8 min';
  if (block.role === 'measure') {
    return `Måling: ${PROGRAM.measures.find((m) => m.id === block.measureId)?.name ?? ''}`;
  }
  const track = getTrack(PROGRAM, block.trackId);
  const step = getStep(PROGRAM, block.stepId);
  if (block.unit === 'emom' && block.emom)
    return `Burpees EMOM ${step.key} · ${block.emom.minutes} × ${block.emom.reps}`;
  if (block.unit === 'rounds') {
    const rounds = block.rounds ?? 1;
    const word = rounds === 1 ? 'runde' : 'runder';
    const dose = block.sets > 1 ? `${block.sets} × ${rounds} ${word}` : `${rounds} ${word}`;
    return `${track.short} trin ${step.key} · ${dose}${block.measureId ? ' + måling' : ''}`;
  }
  const unit = block.unit === 'sec' ? ' sek' : '';
  const per =
    block.per === 'side'
      ? ' pr. side'
      : block.per === 'ben'
        ? ' pr. ben'
        : block.per === 'retning'
          ? ' pr. retning'
          : '';
  const measure = block.measureId ? ' + måling' : '';
  return `${track.short} trin ${step.key} · ${block.sets} × ${block.target}${unit}${per}${measure}`;
}

function dayLine(day: DayPlan): string {
  if (day.red) return 'Syg: Open & Strong og en gåtur';
  if (day.kind) return SESSION_NAME[day.kind] + (day.short ? ' · kort version' : '');
  if (day.club.day)
    return day.club.closed ? '4–5 kamp-runder hjemme' : `Muay Thai ${day.club.time ?? ''}`.trim();
  if (weekday(day.date) === 7) return 'Fri gåtur · Open & Strong valgfri';
  return 'Hviledag';
}

export function Today(props: {
  model: Model;
  onStart: (kind: SessionKind, short: boolean, calmBase: boolean) => void;
  onOpenAndStrong: () => void;
  onBackup: () => void;
}) {
  const { model } = props;
  const { state, today } = model;
  const plan = planFor(PROGRAM, state, today);
  const tomorrow = planFor(PROGRAM, state, addDays(today, 1));

  // SK1: the plan of the day is on screen (with its fonts) – measured for Diagnose (SPEC 7).
  useEffect(() => markTodayVisible(), []);

  const week = plan.beforeStart
    ? null
    : `Uge ${plan.pw}${plan.round > 1 ? ` · runde ${plan.round}` : ''} · ${PHASE[plan.phase] ?? ''}`;
  const monday = mondayOf(today);
  const os = osThisWeek(state, monday);
  const backupAge = state.lastBackup ? daysBetween(state.lastBackup, today) : null;
  const hasLog = state.sessions.some((s) => s.completed);
  // SPEC 3.1/4.12: after 7 days without a backup, and in the week after a measurement week.
  const lastWeek = plan.k > 0 ? weekInfoAt(PROGRAM, state, plan.k - 1) : null;
  const afterMeasurements =
    lastWeek !== null &&
    measurementWeek(getWeek(PROGRAM, lastWeek.pw), lastWeek.round) &&
    (state.lastBackup ?? '') < lastWeek.monday;
  const showBackup = hasLog && (backupAge === null || backupAge > 7 || afterMeasurements);
  const rest = [1, 2, 3, 4, 5, 6]
    .map((d) => addDays(today, d))
    .filter((d) => d <= addDays(monday, 6))
    .map((d) => planFor(PROGRAM, state, d));

  return (
    <div class="screen today" data-testid="today">
      <header class="today-head">
        <p class="date">{capitalize(formatLong(today))}</p>
        {week && <p class="week">{week}</p>}
      </header>

      {plan.flags.map((flag) => {
        switch (flag.type) {
          case 'event_tomorrow':
            return (
              <p key="event" class="flag">
                I morgen: {flag.label} – let udgave i dag.
              </p>
            );
          case 'physio':
            return (
              <p key={`p${flag.trackId}`} class="flag">
                {getTrack(PROGRAM, flag.trackId).short}: bliver smerten værre fra gang til gang, så
                få den undersøgt.
              </p>
            );
          case 'neck_warning':
            return (
              <p key="neck" class="flag">
                Nakken: stop ved snurren, svimmelhed eller smerte ud i armen – søg læge, hvis det
                ikke går over.
              </p>
            );
          case 'reduced_volume':
            return (
              <p key="flat" class="flag">
                To flade uger i træk: en tredjedel færre sæt denne uge (side 39).
              </p>
            );
          case 'light_week':
            return (
              <p key="light" class="flag">
                Let uge med målinger.
              </p>
            );
          default:
            return null;
        }
      })}

      {plan.missed.map((m) => (
        <div key={`${m.kind}${m.date}`} class="card missed">
          <p>{SESSION_NAME[m.kind]} i går blev ikke logget.</p>
          <button
            type="button"
            class="btn"
            onClick={() =>
              void model.commit([
                model.ctx.make(
                  { type: 'session_skipped', kind: m.kind, forDate: m.date, reason: 'user' },
                  today,
                ),
              ])
            }
          >
            Spring over
          </button>
        </div>
      ))}

      <MainCard plan={plan} startDate={state.startDate} onStart={props.onStart} />

      <div class="card os-row">
        <div>
          <p class="os-title">Open &amp; Strong · 6 min</p>
          <p class="muted">Denne uge: {os} af 7</p>
        </div>
        <button type="button" class="btn" onClick={props.onOpenAndStrong} data-testid="os-start">
          Start
        </button>
      </div>

      <p class="tomorrow">I morgen: {dayLine(tomorrow)}</p>

      {rest.length > 1 && (
        <details class="rest-of-week">
          <summary>Resten af ugen</summary>
          <ul>
            {rest.slice(1).map((d) => (
              <li key={d.date}>
                {capitalize(formatLong(d.date).split(' ')[0] ?? '')}: {dayLine(d)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {showBackup && (
        <button type="button" class="backup-line" onClick={props.onBackup}>
          Sidste backup: {backupAge === null ? 'aldrig' : `${backupAge} dage siden`} – tryk for at
          eksportere
        </button>
      )}
    </div>
  );
}

function MainCard({
  plan,
  startDate,
  onStart,
}: {
  plan: DayPlan;
  startDate: string;
  onStart: (kind: SessionKind, short: boolean, calmBase: boolean) => void;
}) {
  if (plan.beforeStart) {
    return (
      <div class="card main-card">
        <h1>Programmet starter {formatLong(startDate)}</h1>
        <p>
          Open &amp; Strong kan du tage allerede nu. Tidsmaskinen under Mere → Om lader dig prøve et
          pas.
        </p>
      </div>
    );
  }
  if (plan.open) {
    return (
      <div class="card main-card">
        <h1>{SESSION_NAME[plan.open.kind]}</h1>
        <p>Passet er i gang.</p>
        <button
          type="button"
          class="btn primary block"
          onClick={() =>
            onStart(plan.open?.kind ?? 'A', plan.short, plan.session?.calmBase ?? false)
          }
        >
          Fortsæt passet
        </button>
      </div>
    );
  }
  if (plan.done) {
    const status =
      plan.done.status === 'green'
        ? 'grønt'
        : plan.done.status === 'yellow'
          ? 'gult'
          : plan.done.status === 'red'
            ? 'rødt'
            : 'logget';
    return (
      <div class="card main-card done">
        <h1>{SESSION_NAME[plan.done.kind]}</h1>
        <p>Logget i dag ({status}).</p>
      </div>
    );
  }
  if (plan.red) {
    return (
      <div class="card main-card">
        <h1>Syg</h1>
        <p>Kun Open &amp; Strong og en gåtur. Kun forkølet over halsen er din egen vurdering.</p>
      </div>
    );
  }
  if (!plan.session || !plan.kind) {
    return (
      <div class="card main-card">
        <h1>
          {plan.club.day
            ? plan.club.closed
              ? 'Klubben er lukket'
              : 'Muay Thai'
            : weekday(plan.date) === 7
              ? 'Søndag'
              : 'Hviledag'}
        </h1>
        <p>
          {plan.club.day
            ? plan.club.closed
              ? '4–5 kamp-runder hjemme i stedet for Muay Thai.'
              : `Træning ${plan.club.time ?? ''}${plan.club.clinch ? ` · MMA-clinch ${plan.club.clinch}` : ''}`
            : 'Fri gåtur. Open & Strong er valgfri.'}
        </p>
      </div>
    );
  }
  const session = plan.session;
  const lines = session.blocks.map(blockLine).filter((l): l is string => l !== null);
  const motor = session.motor;
  return (
    <div class="card main-card" data-testid="main-card">
      <div class="main-card-head">
        <h1>{SESSION_NAME[plan.kind]}</h1>
        <p class="muted">ca. {sessionMinutes(session)} min</p>
      </div>
      {motor ? (
        <p class="block-line">{motor.title}</p>
      ) : (
        <ul class="block-lines">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {session.calmBase && session.intervalsOption && (
        <p class="hint">
          I går var klubtræningen hård: rolig base i dag. Du kan vælge intervallerne før start.
        </p>
      )}
      <button
        type="button"
        class="btn primary block"
        data-testid="start-session"
        onClick={() => onStart(plan.kind ?? 'A', plan.short, session.calmBase)}
      >
        Start passet
      </button>
    </div>
  );
}
