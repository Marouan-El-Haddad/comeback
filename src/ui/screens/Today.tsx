// I dag (docs/SPEC.md 3.1): today's session with one button to »Dagens pas«, Open & Strong, tomorrow,
// the rest of the week, the »blev ikke logget« card and the backup line. Visible without a tap (SK1).
// The club log and the Sunday check ask here (4.6, 4.7): a card that waits for an answer stands
// over the day's card, and their screens open in place of I dag.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
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
import type { SessionKind, State } from '../../engine/types.ts';
import { sessionMinutes } from '../format.ts';
import { lazy } from '../lazy.tsx';
import {
  clubAsks,
  clubEnd,
  clubLogOn,
  clubSummary,
  hoursText,
  minutesIn,
  sundayDue,
  type ClubAsk,
  type LifeRequest,
  type SundayDue,
} from '../life.ts';
import type { Model } from '../model.ts';
import { markTodayVisible } from '../startup.ts';
import { distanceText } from './Ladders.tsx';

// The club log's and the Sunday check's screens are not needed for the first screen: fetched in
// the background when I dag has something to ask, or at the tap (docs/SPEC.md 7).
const LifeForm = lazy(() => import('../life/LifeForm.tsx').then((m) => m.LifeForm));

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

/** A block's line on the day's card: the step on the left, the dose on the right. */
interface BlockLine {
  name: string;
  dose: string;
}

function blockLine(block: BlockPlan): BlockLine {
  if (block.role === 'warmup') return { name: 'Opvarmning', dose: '8 min' };
  if (block.role === 'measure') {
    const measure = PROGRAM.measures.find((m) => m.id === block.measureId)?.name ?? '';
    return { name: `Måling: ${measure}`, dose: '' };
  }
  const track = getTrack(PROGRAM, block.trackId);
  const step = getStep(PROGRAM, block.stepId);
  if (block.unit === 'emom' && block.emom)
    return {
      name: `Burpees EMOM ${step.key}`,
      dose: `${block.emom.minutes} × ${block.emom.reps}`,
    };
  const name = `${track.short} trin ${step.key}`;
  const measure = block.measureId ? ' + måling' : '';
  if (block.unit === 'rounds') {
    const rounds = block.rounds ?? 1;
    const word = rounds === 1 ? 'runde' : 'runder';
    const dose = block.sets > 1 ? `${block.sets} × ${rounds} ${word}` : `${rounds} ${word}`;
    return { name, dose: `${dose}${measure}` };
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
  return { name, dose: `${block.sets} × ${block.target}${unit}${per}${measure}` };
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
  /** A session is paused with »Hold pause« (docs/SPEC.md 3): the card goes back to it. */
  paused?: boolean;
  onStart: (kind: SessionKind, short: boolean, calmBase: boolean) => void;
  onOpenAndStrong: () => void;
  onBackup: () => void;
}) {
  const { model } = props;
  const { state, today } = model;
  const [form, setForm] = useState<LifeRequest | null>(null);
  /** »✓ Klubtræningen i går er logget.« after a save that took its card away. */
  const [saved, setSaved] = useState<string | null>(null);
  const settling = useSettle(form);
  const asks = clubAsks(PROGRAM, state, today, minutesIn(model.now()));
  const sunday = sundayDue(state, today);
  useClubEnd(model, asks);

  // SK1: the plan of the day is on screen (with its fonts) – measured for Diagnose (SPEC 7).
  useEffect(() => markTodayVisible(), []);
  const asking = asks.some((a) => a.ended && !a.log) || sunday !== null;
  useEffect(() => {
    if (!asking) return;
    const id = setTimeout(() => void LifeForm.preload().catch(() => undefined), 1000);
    return () => clearTimeout(id);
  }, [asking]);

  const open = (request: LifeRequest) => {
    const show = () => setForm(request);
    void LifeForm.preload().then(show, show);
  };
  if (form) {
    return (
      <div class={settling ? 'life-host settling' : 'life-host'}>
        <LifeForm
          request={form}
          model={model}
          onClose={() => setForm(null)}
          onSaved={() => {
            if (form.kind === 'club' && form.date !== today) {
              setSaved('✓ Klubtræningen i går er logget.');
            } else if (
              form.kind === 'club' &&
              !clubInMain(planFor(PROGRAM, state, today), props.paused ?? false)
            ) {
              setSaved('✓ Klubtræningen er logget.');
            }
            setForm(null);
          }}
        />
      </div>
    );
  }

  const plan = planFor(PROGRAM, state, today);
  const tomorrow = planFor(PROGRAM, state, addDays(today, 1));

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
  const paused = props.paused ?? false;
  // The club log and the Sunday check ask on the day's card when it is theirs, otherwise in a card
  // over it; a saved Sunday check stands under it (docs/SPEC.md 3.1).
  const todayAsk = asks.find((a) => !a.yesterday) ?? null;
  const yesterdayAsk = asks.find((a) => a.yesterday) ?? null;
  const clubMain = clubInMain(plan, paused);
  const sundayMain =
    sunday !== null && sunday.sunday === today && restCard(plan, paused) && !plan.club.day;
  const openClub = (ask: ClubAsk) => () => open({ kind: 'club', date: ask.date });
  const openSunday = () => sunday && open({ kind: 'sunday', sunday: sunday.sunday });

  return (
    <div class={settling ? 'screen today settling' : 'screen today'} data-testid="today">
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
                To flade uger i træk: en tredjedel færre sæt denne uge.
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

      {saved && (
        <p class="life-saved" role="status">
          {saved}
        </p>
      )}
      {yesterdayAsk && !yesterdayAsk.log && (
        <ClubCard ask={yesterdayAsk} onOpen={openClub(yesterdayAsk)} />
      )}
      {todayAsk && todayAsk.ended && !todayAsk.log && !clubMain && (
        <ClubCard ask={todayAsk} onOpen={openClub(todayAsk)} />
      )}
      {sunday && !sunday.check && !sundayMain && (
        <SundayCard due={sunday} state={state} onOpen={openSunday} />
      )}

      <MainCard
        plan={plan}
        startDate={state.startDate}
        paused={paused}
        onStart={props.onStart}
        state={state}
        club={clubMain ? todayAsk : null}
        sunday={sundayMain ? sunday : null}
        onClub={() => todayAsk && openClub(todayAsk)()}
        onSunday={openSunday}
      />

      {sunday && sunday.check && !sundayMain && (
        <SundayCard due={sunday} state={state} onOpen={openSunday} />
      )}

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

/**
 * The day's card: the session's name (and time) on a navy band, then what the day holds. Every state
 * of the day has the same card: a session, one that holds a pause or is under way, one logged today,
 * a red day, a club or rest day, and the days before the programme starts (docs/SPEC.md 3.1).
 */
function Card({
  title,
  aside,
  done = false,
  children,
}: {
  title: string;
  aside?: ComponentChildren;
  done?: boolean;
  children: ComponentChildren;
}) {
  return (
    <div class={done ? 'card main-card done' : 'card main-card'} data-testid="main-card">
      <div class="main-card-head">
        <h1>{title}</h1>
        {aside}
      </div>
      <div class="main-card-body">{children}</div>
    </div>
  );
}

/** The day's card shows what the day holds without a session: the club, the Sunday or rest. */
function restCard(plan: DayPlan, paused: boolean): boolean {
  return (
    !paused &&
    !plan.beforeStart &&
    !plan.open &&
    !plan.done &&
    !plan.red &&
    !(plan.session && plan.kind)
  );
}

/** The day's card is the club's own (a club day without a session): the club log asks there. */
function clubInMain(plan: DayPlan, paused: boolean): boolean {
  return restCard(plan, paused) && plan.club.day && !plan.club.closed;
}

/** Half a second without taps after the club log or the Sunday check opens or closes (D57). */
function useSettle(form: LifeRequest | null): boolean {
  const first = useRef(true);
  const [settling, setSettling] = useState(false);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSettling(true);
    const id = setTimeout(() => setSettling(false), 500);
    return () => clearTimeout(id);
  }, [form]);
  return settling;
}

/** I dag is drawn again when today's club time ends, so »Hvordan var det?« comes by itself. */
function useClubEnd(model: Model, asks: ClubAsk[]): void {
  const pending = asks.find((a) => !a.yesterday && !a.ended);
  const end = pending ? clubEnd(pending.time) : null;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (end === null) return;
    const id = setInterval(() => {
      if (minutesIn(model.now()) >= end) setTick((n) => n + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, [model, end]);
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** A club session that waits for »Hvordan var det?«: yesterday's, or today's on a session day. */
function ClubCard({ ask, onOpen }: { ask: ClubAsk; onOpen: () => void }) {
  return (
    <div class="card life-card club" data-testid="club-card">
      <p class="life-card-title">
        {ask.yesterday ? 'Muay Thai i går' : `Muay Thai ${ask.time ?? ''}`.trim()}
      </p>
      <button type="button" class="btn block" onClick={onOpen}>
        Hvordan var det?
      </button>
    </div>
  );
}

/** The saved Sunday check: the answers and what they changed (docs/SPEC.md 4.7). */
function SundaySummary({ due, state }: { due: SundayDue; state: State }) {
  const check = due.check;
  if (!check) return null;
  const name = (trackId: string) => getTrack(PROGRAM, trackId).short;
  const grade = clubLogOn(state, addDays(due.sunday, -1))?.technique;
  const lines: string[] = [];
  if (check.sleepAvg !== undefined) lines.push(`Søvn: ${hoursText(check.sleepAvg)} t i snit`);
  if (grade !== undefined) lines.push(`Lørdagskarakter: ${grade}`);
  for (const id of check.painTracks) {
    const t = state.tracks[id];
    const now = t?.tempDown
      ? ` – ${lowerFirst(distanceText(getTrack(PROGRAM, id), t, state.emom.pendingUp))}`
      : '';
    lines.push(`Ondt: ${name(id)}${now}`);
  }
  for (const id of check.tooHeavy) {
    const t = state.tracks[id];
    if (check.painTracks.includes(id) || !t) continue;
    lines.push(`For tungt: ${name(id)} – nu trin ${getStep(PROGRAM, t.stepId).key}`);
  }
  if (check.painTracks.length === 0 && check.tooHeavy.length === 0) {
    lines.push('Intet gør ondt, og intet er for tungt.');
  }
  return (
    <>
      <p class="main-card-done">✓ Gemt</p>
      <ul class="life-lines">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}

/** The Sunday check in a card of its own: on the Monday after, or on a Sunday with a session. */
function SundayCard(props: { due: SundayDue; state: State; onOpen: () => void }) {
  const { due } = props;
  return (
    <div class="card life-card" data-testid="sunday-card">
      <p class="life-card-title">{due.check ? 'Søndagstjek' : 'Søndagstjek · 2 min'}</p>
      {due.check ? (
        <SundaySummary due={due} state={props.state} />
      ) : (
        due.late && <p>Glemt i går? Du kan tage det i dag.</p>
      )}
      <button type="button" class="btn block" onClick={props.onOpen}>
        {due.check ? 'Ret søndagstjekket' : 'Tag søndagstjekket'}
      </button>
    </div>
  );
}

function MainCard({
  plan,
  startDate,
  paused,
  onStart,
  state,
  club,
  sunday,
  onClub,
  onSunday,
}: {
  plan: DayPlan;
  startDate: string;
  paused: boolean;
  onStart: (kind: SessionKind, short: boolean, calmBase: boolean) => void;
  state: State;
  /** Today's club session when the day's card is the club's (4.6). */
  club: ClubAsk | null;
  /** The Sunday check when the day's card is the Sunday's (4.7). */
  sunday: SundayDue | null;
  onClub: () => void;
  onSunday: () => void;
}) {
  if (paused) {
    const kind = plan.open?.kind ?? plan.kind ?? 'A';
    return (
      <Card title={SESSION_NAME[kind]}>
        <p>Passet holder pause. Uret står stille, og det, du har logget, er gemt.</p>
        <button
          type="button"
          class="btn primary block"
          onClick={() => onStart(kind, plan.short, plan.session?.calmBase ?? false)}
        >
          Fortsæt passet
        </button>
      </Card>
    );
  }
  if (plan.beforeStart) {
    return (
      <Card title={`Programmet starter ${formatLong(startDate)}`}>
        <p>
          Open &amp; Strong kan du tage allerede nu. Tidsmaskinen under Mere → Om lader dig prøve et
          pas.
        </p>
      </Card>
    );
  }
  if (plan.open) {
    return (
      <Card title={SESSION_NAME[plan.open.kind]}>
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
      </Card>
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
      <Card title={SESSION_NAME[plan.done.kind]} done>
        <p class="main-card-done">✓ Logget i dag ({status}).</p>
      </Card>
    );
  }
  if (plan.red) {
    return (
      <Card title="Syg">
        <p>Kun Open &amp; Strong og en gåtur. Kun forkølet over halsen er din egen vurdering.</p>
      </Card>
    );
  }
  if (!plan.session || !plan.kind) {
    if (sunday) {
      return sunday.check ? (
        <Card title="Søndagstjek" done>
          <SundaySummary due={sunday} state={state} />
          <button type="button" class="btn block" onClick={onSunday}>
            Ret søndagstjekket
          </button>
        </Card>
      ) : (
        <Card
          title="Søndagstjek"
          aside={
            <p class="main-card-time">
              <strong>2</strong> min
            </p>
          }
        >
          <p>
            Søvn, lørdagens karakter, smerte og stigerne. Søndag er ellers fri: en gåtur, og Open
            &amp; Strong er valgfri.
          </p>
          <button
            type="button"
            class="btn primary block"
            data-testid="sunday-open"
            onClick={onSunday}
          >
            Tag søndagstjekket
          </button>
        </Card>
      );
    }
    return (
      <Card
        title={
          plan.club.day
            ? plan.club.closed
              ? 'Klubben er lukket'
              : 'Muay Thai'
            : weekday(plan.date) === 7
              ? 'Søndag'
              : 'Hviledag'
        }
        done={!!club?.log}
      >
        <p>
          {plan.club.day
            ? plan.club.closed
              ? '4–5 kamp-runder hjemme i stedet for Muay Thai.'
              : `Træning ${plan.club.time ?? ''}${plan.club.clinch ? ` · MMA-clinch ${plan.club.clinch}` : ''}`
            : 'Fri gåtur. Open & Strong er valgfri.'}
        </p>
        {club?.ended &&
          (club.log ? (
            <p class="main-card-done">✓ Logget: {clubSummary(club.log)}.</p>
          ) : (
            <button
              type="button"
              class="btn primary block"
              data-testid="club-log-open"
              onClick={onClub}
            >
              Hvordan var det?
            </button>
          ))}
      </Card>
    );
  }
  const session = plan.session;
  const lines = session.blocks.map(blockLine);
  const motor = session.motor;
  return (
    <Card
      title={SESSION_NAME[plan.kind]}
      aside={
        <p class="main-card-time">
          ca. <strong>{sessionMinutes(session)}</strong> min
        </p>
      }
    >
      {motor ? (
        <p class="block-line">{motor.title}</p>
      ) : (
        <ul class="block-lines">
          {lines.map((l) => (
            <li key={l.name}>
              <span>{l.name}</span>
              {l.dose && (
                <>
                  {/* Read aloud as »Pres trin 1 · 3 × 6«; on the screen the dose stands to the right. */}
                  <span class="sr-label"> · </span>
                  <span class="block-dose">{l.dose}</span>
                </>
              )}
            </li>
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
        // The day's own calm base (a moved motor), not the one after a hard club day: that one
        // keeps »Kør intervallerne alligevel« on the traffic light (ENGINE 5.2, P25).
        onClick={() =>
          onStart(plan.kind ?? 'A', plan.short, session.calmBase && !session.intervalsOption)
        }
      >
        Se dagens pas
      </button>
    </Card>
  );
}
