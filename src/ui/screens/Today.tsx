// I dag (docs/SPEC.md 3.1): today's session with one button to »Dagens pas«, Open & Strong, tomorrow,
// the rest of the week, the »blev ikke logget« card and the backup line. Visible without a tap (SK1).
// The club log and the Sunday check ask here (4.6, 4.7): a card that waits for an answer stands
// over the day's card, and their screens open in place of I dag – as does »Flyt eller spring over«
// for today's session and a forgotten one (D64), and Status and Begivenheder (D67). A changed day is
// explained in the engine's own words: the day before an event, a repeated week, three weeks away.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  ABSENCE_REASON,
  addDays,
  calmTourDay,
  daysBetween,
  eventExplanation,
  formatLong,
  getStep,
  getTrack,
  getWeek,
  measurementWeek,
  mondayOf,
  osThisWeek,
  planFor,
  PROGRAM,
  statusRangeOn,
  weekday,
  weekInfoAt,
  type BlockPlan,
  type DayPlan,
} from '../../engine/index.ts';
import type { ISODate, SessionKind, State, StatusRange } from '../../engine/types.ts';
import { SESSION_NAME, sessionMinutes } from '../format.ts';
import {
  screenSettled,
  showTopOnClose,
  useSameWorld,
  useScreenEntry,
  useSettle,
  useWriteOnce,
} from '../hooks.ts';
import { LifeForm } from '../lifeScreen.ts';
import {
  canAct,
  dayRef,
  forgotten,
  motorGone,
  motorNote,
  movable,
  movedFrom,
  weekdayWord,
  type Movable,
} from '../moves.ts';
import {
  clubAsks,
  clubEnd,
  clubLogOn,
  clubSummary,
  hoursText,
  minutesIn,
  standingChanges,
  standingText,
  sundayDue,
  trackDistance,
  type ClubAsk,
  type LifeRequest,
  type SundayDue,
} from '../life.ts';
import type { Model } from '../model.ts';
import { markTodayVisible } from '../startup.ts';
import {
  absenceChanges,
  repeatedWeek,
  type AbsenceChanges,
  STATUS_LINE,
  STATUS_NAME,
  untilText,
} from '../status.ts';

const PHASE: Record<string, string> = {
  fundament: 'Fundament',
  opbygning: 'Opbygning',
  kampform: 'Kampform',
  let: 'Let uge',
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

/** A day in »I morgen« and »Resten af ugen«; `calm` is the day of the optional calm run (D66). */
function dayLine(day: DayPlan, calm: ISODate | null): string {
  if (day.red) return 'Syg: Open & Strong og en gåtur';
  if (day.status === 'holiday') return 'Ferie: hvile';
  if (day.kind) return SESSION_NAME[day.kind] + (day.short ? ' · kort version' : '');
  if (day.club.day)
    return day.club.closed ? '4–5 kamp-runder hjemme' : `Muay Thai ${day.club.time ?? ''}`.trim();
  if (day.date === calm) return 'Valgfri rolig tur';
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
  /** »✓ Klubtræningen i går er logget.« after a save that took its card away; only on its day. */
  const [savedLine, setSavedLine] = useState<{ text: string; on: ISODate } | null>(null);
  const saved = savedLine?.on === today ? savedLine.text : null;
  const setSaved = (text: string | null) => setSavedLine(text ? { text, on: today } : null);
  /** Counts the cards that went away with a tap (»Spring over«): I dag settles after each (D57). */
  const [gone, setGone] = useState(0);
  const settling = useSettle([form, gone]);
  // The screens in place of I dag (the club log, the Sunday check, »Flyt eller spring over«) and the
  // »✓« line belong to their world – the real log or the time machine's copy: when the time machine
  // starts or ends, they go, so nothing opened in one world is saved in the other (SPEC 3.7, D64,
  // D65). Each screen also checks its world before it writes.
  const world = model.sim;
  useEffect(() => {
    setForm(null);
    setSavedLine(null);
  }, [world]);
  // A screen is a step in the history: Android's back gesture closes it, not the app (D65).
  useScreenEntry(form !== null, () => setForm(null));
  const asks = clubAsks(PROGRAM, state, today, minutesIn(model.now()));
  const sunday = sundayDue(state, today);
  useClubEnd(model, asks);

  // SK1: the plan of the day is on screen (with its fonts) – measured for Diagnose (SPEC 7).
  useEffect(() => markTodayVisible(), []);
  // A forgotten session from an earlier day of the week can be moved or skipped (D64).
  const missed = forgotten(PROGRAM, state, today);
  const asking = asks.some((a) => a.ended && !a.answered) || sunday !== null || missed.length > 0;
  useEffect(() => {
    if (!asking) return;
    const id = setTimeout(() => void LifeForm.preload().catch(() => undefined), 1000);
    return () => clearTimeout(id);
  }, [asking]);

  const open = (request: LifeRequest) => {
    const show = () => setForm(request);
    void Promise.all([LifeForm.preload(), screenSettled()]).then(show, show);
  };
  if (form) {
    return (
      <div class={settling ? 'life-host settling' : 'life-host'}>
        <LifeForm
          request={form}
          model={model}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            // I dag comes back at its top, where the »✓« line and the changed day are (D67).
            showTopOnClose();
            if (form.kind === 'move' || form.kind === 'status' || form.kind === 'event') {
              setSaved(message ?? null);
            } else if (form.kind === 'club' && form.date !== today) {
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
  // Today's session too (D64).
  const todayMove = movable(PROGRAM, state, today, today);
  // Moves took the week's motor: the optional calm run on the first free day (ENGINE 5.9, D66).
  const calm = calmTourDay(PROGRAM, state, today, today);
  const openMove = (m: Movable) => () => open({ kind: 'move', session: m.kind, date: m.date });
  const openStatus = () => open({ kind: 'status' });
  const openEvent = () => open({ kind: 'event' });
  // Today's status – of two that overlap, the newest: the day's card on a sick or holiday day says
  // it, otherwise a card over it does (SPEC 3.1, D67).
  const status = plan.beforeStart ? null : statusRangeOn(state, today);
  const statusInMain =
    status !== null &&
    !paused &&
    !plan.open &&
    !plan.done &&
    (plan.red || (plan.status === 'holiday' && !sundayMain));
  // A changed week, in the engine's words: a repeated week (R-PW), three weeks away (R-ABSENCE-3).
  const repeated = plan.beforeStart ? null : repeatedWeek(PROGRAM, state, today);
  const absence = absenceChanges(model.events, today);

  return (
    <div class={settling ? 'screen today settling' : 'screen today'} data-testid="today">
      <header class="today-head">
        <p class="date">{capitalize(formatLong(today))}</p>
        {week && <p class="week">{week}</p>}
      </header>
      {repeated && (
        <p class="hint" data-testid="week-repeat">
          {repeated}
        </p>
      )}

      {plan.flags.map((flag) => {
        switch (flag.type) {
          case 'event_tomorrow':
            // What the rule took out of today's session, in the engine's words (S-EVENT-03).
            return (
              <p key="event" class="flag" data-testid="event-flag">
                {eventExplanation(PROGRAM, state, today) ?? `I morgen: ${flag.label}.`}
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

      {missed.map((m) => (
        <MissedCard
          // A card of the time machine is never the same card as one of the real log.
          key={`${world ? 'sim' : 'real'}-${m.kind}${m.date}`}
          item={m}
          today={today}
          model={model}
          onMove={openMove(m)}
          onSkipped={(text) => {
            setSaved(text);
            setGone((n) => n + 1);
          }}
        />
      ))}

      {saved && (
        <p class="life-saved" role="status">
          {saved}
        </p>
      )}
      {yesterdayAsk && !yesterdayAsk.answered && (
        <ClubCard ask={yesterdayAsk} onOpen={openClub(yesterdayAsk)} />
      )}
      {todayAsk && todayAsk.ended && !todayAsk.answered && !clubMain && (
        <ClubCard ask={todayAsk} onOpen={openClub(todayAsk)} />
      )}
      {sunday && !sunday.check && !sundayMain && (
        <SundayCard due={sunday} state={state} onOpen={openSunday} />
      )}

      {absence && <AbsenceCard changes={absence} />}

      {calm === today && (
        <p class="hint" data-testid="calm-tour">
          Valgfri rolig tur i dag: motoren udgår denne uge, så tag en rolig tur i tale-tempo, hvis
          du kan.
        </p>
      )}

      {status && !statusInMain && <StatusCard range={status} today={today} onOpen={openStatus} />}

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
        move={todayMove}
        onMove={() => todayMove && openMove(todayMove)()}
        status={statusInMain ? status : null}
        onStatus={openStatus}
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

      <p class="tomorrow">I morgen: {dayLine(tomorrow, calm)}</p>

      {rest.length > 1 && (
        <details class="rest-of-week">
          <summary>Resten af ugen</summary>
          <ul>
            {rest.slice(1).map((d) => (
              <li key={d.date}>
                {capitalize(formatLong(d.date).split(' ')[0] ?? '')}: {dayLine(d, calm)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div class="life-links">
        <p>Syg, på rejse, ferie, klubben lukket eller en kamp på vej?</p>
        <div class="card-actions">
          <button type="button" class="btn" data-testid="status-open" onClick={openStatus}>
            Sæt status
          </button>
          <button type="button" class="btn" data-testid="event-open" onClick={openEvent}>
            Tilføj begivenhed
          </button>
        </div>
      </div>

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

/**
 * A session from an earlier day that was not logged (SPEC 3.1, D64): »Flyt« opens the days it can
 * go to, »Spring over« writes at once – the first tap only (D61), and the card goes away.
 */
function MissedCard(props: {
  item: Movable;
  today: ISODate;
  model: Model;
  onMove: () => void;
  onSkipped: (text: string) => void;
}) {
  const { item, today, model } = props;
  const { busy, run } = useWriteOnce();
  const sameWorld = useSameWorld(model);
  const name = SESSION_NAME[item.shown];
  const when = dayRef(item.date, today);
  const skip = run(async () => {
    // Shown in the time machine, never written in the real log (SPEC 3.7).
    if (!sameWorld()) throw new Error('the time machine started or ended');
    await model.commit([
      model.ctx.make(
        { type: 'session_skipped', kind: item.kind, forDate: item.date, reason: 'user' },
        today,
      ),
    ]);
    // Skipped, it can still be moved from Uge while the week has a day for it (D64, D66).
    const still = item.options.length > 0 ? ' Du kan stadig flytte passet under Uge.' : '';
    props.onSkipped(`✓ ${name} ${when} er sprunget over.${still}`);
  });
  return (
    <div class="card life-card" data-testid="missed-card">
      <p class="life-card-title">
        {name} {when} blev ikke logget
      </p>
      {item.options.length === 0 && <p>Ingen dag tilbage i ugen kan tage det.</p>}
      <div class="card-actions">
        {item.options.length > 0 && (
          <button
            type="button"
            class="btn"
            disabled={busy}
            data-testid="missed-move"
            onClick={props.onMove}
          >
            Flyt
          </button>
        )}
        <button type="button" class="btn" disabled={busy} data-testid="missed-skip" onClick={skip}>
          Spring over
        </button>
      </div>
    </div>
  );
}

/** Today's status when the day's card shows something else: a trip, or the club closed (D67). */
function StatusCard(props: { range: StatusRange; today: ISODate; onOpen: () => void }) {
  const { range, today } = props;
  const until = range.to === today ? 'i dag' : `til og med ${formatLong(range.to)}`;
  return (
    <div class="card life-card" data-testid="status-card">
      <p class="life-card-title">
        {STATUS_NAME[range.status]} {until}
      </p>
      <p>{STATUS_LINE[range.status]}</p>
      <button type="button" class="btn block" data-testid="status-change" onClick={props.onOpen}>
        Ret status
      </button>
    </div>
  );
}

/**
 * The week three weeks without a strength session took the ladders down (R-ABSENCE-3): the engine's
 * reason once, and each ladder that went down in its own words (D67).
 */
function AbsenceCard({ changes }: { changes: AbsenceChanges }) {
  const { lines, stayed } = changes;
  return (
    <div class="card life-card" data-testid="absence-card">
      <p class="life-card-title">{ABSENCE_REASON}</p>
      <ul class="life-lines">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
        {stayed && (
          <li>
            {lines.length > 0
              ? 'Stiger på første trin bliver der og starter forfra.'
              : 'Alle stiger står på første trin, så de bliver der og starter forfra.'}
          </li>
        )}
      </ul>
    </div>
  );
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

/** A club session that waits for »Hvordan var det?«: yesterday's, or today's on a session day. */
function ClubCard({ ask, onOpen }: { ask: ClubAsk; onOpen: () => void }) {
  return (
    <div class="card life-card club" data-testid="club-card">
      <p class="life-card-title">
        {ask.yesterday ? 'Muay Thai i går' : `Muay Thai ${ask.time ?? ''}`.trim()}
      </p>
      {ask.log?.technique !== undefined && (
        <p>Karakteren {ask.log.technique} er givet. Resten kan du logge her.</p>
      )}
      <button type="button" class="btn block" onClick={onOpen}>
        Hvordan var det?
      </button>
    </div>
  );
}

/**
 * The saved Sunday check: the answers and what the week's checks changed that still stands – also
 * a track a correction no longer names, which stays where it is (docs/SPEC.md 4.7, D65).
 */
function SundaySummary({ due, state }: { due: SundayDue; state: State }) {
  const check = due.check;
  if (!check) return null;
  const name = (trackId: string) => getTrack(PROGRAM, trackId).short;
  const grade = clubLogOn(state, addDays(due.sunday, -1))?.technique;
  const lines: string[] = [];
  if (check.sleepAvg !== undefined) lines.push(`Søvn: ${hoursText(check.sleepAvg)} t i snit`);
  if (grade !== undefined) lines.push(`Lørdagskarakter: ${grade}`);
  const standing = standingChanges(PROGRAM, state, due, (id) => trackDistance(state, id));
  for (const change of standing) {
    lines.push(
      `${change.kind === 'pain' ? 'Ondt' : 'For tungt'}: ${standingText(PROGRAM, change)}`,
    );
  }
  const named = new Set([...check.painTracks, ...check.tooHeavy]);
  const dropped = standing.map((c) => c.trackId).filter((id) => !named.has(id));
  if (dropped.length > 0) {
    lines.push(
      `Fjernet i rettelsen, men står stadig: ${dropped.map(name).join(', ')}. Trinnet kan vælges under Stiger.`,
    );
  }
  if (standing.length === 0 && named.size === 0) {
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
  move,
  onMove,
  status,
  onStatus,
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
  /** Today's session when it is not started: »Flyt eller spring over« (D64). */
  move: Movable | null;
  onMove: () => void;
  /** Today's status when the day's card is the status's own (a sick or holiday day, D67). */
  status: StatusRange | null;
  onStatus: () => void;
}) {
  // How long the status lasts, and »Ret status« (D67).
  const until = status && (
    <>
      <p class="main-card-until">{untilText(status, plan.date)}</p>
      <button type="button" class="btn block" data-testid="status-change" onClick={onStatus}>
        Ret status
      </button>
    </>
  );
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
    const light =
      plan.done.status === 'green'
        ? 'grønt'
        : plan.done.status === 'yellow'
          ? 'gult'
          : plan.done.status === 'red'
            ? 'rødt'
            : 'logget';
    return (
      <Card title={SESSION_NAME[plan.done.kind]} done>
        <p class="main-card-done">✓ Logget i dag ({light}).</p>
      </Card>
    );
  }
  if (plan.red) {
    return (
      <Card title="Syg">
        <p>Kun Open &amp; Strong og en gåtur. Kun forkølet over halsen er din egen vurdering.</p>
        {until}
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
    if (plan.status === 'holiday') {
      // A holiday is rest, also on a club day (ENGINE 5.1 step 3).
      return (
        <Card title="Ferie">
          <p>Hvile. Open &amp; Strong er valgfri.</p>
          {until}
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
  // The day's own calm base (a moved motor), not the one after a hard club day: that one keeps
  // »Kør intervallerne alligevel« on the traffic light (ENGINE 5.2, P25).
  const start = () =>
    onStart(plan.kind ?? 'A', plan.short, session.calmBase && !session.intervalsOption);
  if (move?.skipped) {
    // Skipped today: it stands, so a mistaken tap does not cost the session (D64).
    return (
      <Card title={SESSION_NAME[plan.kind]}>
        <p class="main-card-done">Sprunget over i dag.</p>
        <p>Du kan stadig tage passet{move.options.length > 0 ? ' eller flytte det' : ''}.</p>
        <div class="card-actions">
          <button type="button" class="btn" data-testid="start-session" onClick={start}>
            Se dagens pas
          </button>
          {move.options.length > 0 && (
            <button type="button" class="btn" data-testid="move-open" onClick={onMove}>
              Flyt
            </button>
          )}
        </div>
      </Card>
    );
  }
  // A moved session says where it came from, a short one what it is, and the motor that drops.
  const from = movedFrom(PROGRAM, state, move?.kind ?? plan.kind, plan.date);
  const clubName =
    plan.club.day && !plan.club.closed && plan.club.time
      ? `Muay Thai ${plan.club.time}`
      : 'klubben';
  const notes = [
    from ? `Flyttet fra ${weekdayWord(from)}.` : '',
    plan.short
      ? `Kort version: 30 min med opvarmning, par 1 og 2 – om morgenen, før ${clubName}.`
      : '',
    from && motorGone(PROGRAM, state, plan.date)
      ? motorNote(calmTourDay(PROGRAM, state, plan.date, plan.date), plan.date)
      : '',
  ].filter((n) => n !== '');
  return (
    <Card
      title={SESSION_NAME[plan.kind]}
      aside={
        <p class="main-card-time">
          ca. <strong>{sessionMinutes(session)}</strong> min
        </p>
      }
    >
      {notes.length > 0 && (
        <ul class="main-card-notes" data-testid="main-card-notes">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
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
      <button type="button" class="btn primary block" data-testid="start-session" onClick={start}>
        Se dagens pas
      </button>
      {move && canAct(move) && (
        <button type="button" class="btn block" data-testid="move-open" onClick={onMove}>
          Flyt eller spring over
        </button>
      )}
    </Card>
  );
}
