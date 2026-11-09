// The guided session (docs/SPEC.md 3.2, 3.3, 4.2–4.5): »Dagens pas«, the traffic light, the warm-up,
// every set with »Som planlagt«, timers, the finisher, neck and the summary with the engine's
// explanations. On every step »Nu« (figure, target, two cues) and »Næste« are on the screen with the
// part of the session in the header; the pause shows the next exercise big with »Gør klar«, and the
// first time an exercise comes it has an intro card (DECISIONS.md D44, D50–D53). »Hold pause« leaves
// the session standing still under the tabs, and »Fortsæt passet« comes back to the same place.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  defaultAnswers,
  finishSession,
  getStep,
  getTrack,
  lightFor,
  logBlockResult,
  logSet,
  planFor,
  plannedRir,
  PROGRAM,
  resolvePlan,
  startSession,
  workRange,
  type BlockPlan,
  type SessionPlan,
} from '../../engine/index.ts';
import type { Light, Pain, Rir, SessionSummary, State } from '../../engine/types.ts';
import { MEASURES } from '../../content/types.ts';
import { audioState, enableAudio, play } from '../audio.ts';
import { ExerciseCard, HowButton, useCard } from '../card.tsx';
import type { CardContext } from '../components/cardItem.ts';
import { WhyText } from '../components/Why.tsx';
import { sessionMinutes } from '../format.ts';
import { readLocal, useModel, writeLocal } from '../hooks.ts';
import { ulid } from '../ids.ts';
import type { Model } from '../model.ts';
import { requestPersistOnce } from '../persist.ts';
import type { Clock } from '../timers/clock.ts';
import { keepAwake, onWakeState, releaseAwake, wakeState } from '../wakelock.ts';
import { DayPlan, motorParts, strengthParts, type DayItem } from './DayPlan.tsx';
import { IntroBody, IntroCard, IntroStep, WarmupIntro } from './Intro.tsx';
import { MeasureInput } from './MeasureInput.tsx';
import {
  ExerciseFigure,
  NextBig,
  NextBox,
  NextStrip,
  NowCues,
  NowHead,
  SessionProgress,
  useCues,
  useSessionStyle,
  type Follow,
  type PartClock,
} from './NowNext.tsx';
import {
  clubClock,
  emomClock,
  holdClock,
  introHosts,
  loggedLine,
  neckClock,
  partStartedBy,
  roundClock,
  sectionOf,
  perWord,
  sessionSections,
  sideWord,
  SUMMARY_NEXT,
  unitWord,
  upcomingOf,
  type PartStart,
  type Upcoming,
} from './outline.ts';
import { readRun, writeRun, type RunRequest, type RunState } from './resume.ts';
import {
  buildSteps,
  firstNotLogged,
  nextExercise,
  resumeIndex,
  setCount,
  setEvents,
  stepKey,
  type ExerciseStep,
  type Step,
} from './steps.ts';
import { Summary } from './Summary.tsx';
import { Countdown, CountdownView, PhaseRunner, useCountdown, type Phase } from './timers.tsx';

/** »Skru op for medielyden« is shown at the first session only (SPEC 5, Lyd). */
const SOUND_KEY = 'comeback.soundNoted';

const WARMUP = PROGRAM.routines.find((r) => r.id === 'warmup');

function trackName(trackId: string): string {
  return getTrack(PROGRAM, trackId).short;
}

/** The card context of an exercise in the session: the lighter variant after sharp pain (D47). */
function contextOf(step: ExerciseStep | undefined, kind: RunRequest['kind']): CardContext | null {
  if (step && 'block' in step && step.block.tempDown?.lighter) {
    return { session: kind, power: null, lighter: true };
  }
  return null;
}

/**
 * The plan a session runs with: resolved for its day, light and choices, and – once started –
 * exactly as it was planned at the start (P26).
 */
function runPlan(state: State, run: RunState): SessionPlan {
  const light: Light = run.red ? 'red' : lightFor(run.answers);
  const resolved = resolvePlan(PROGRAM, state, {
    date: run.date,
    kind: run.kind,
    light,
    short: run.short,
    calmBase: run.calmBase,
    intervalsAnyway: run.intervalsAnyway,
  });
  const session = run.sessionId
    ? state.sessions.find((s) => s.sessionId === run.sessionId)
    : undefined;
  if (!session) return resolved;
  const blocks = resolved.blocks.map((b) => {
    const ref = session.blocks.find((r) => r.blockId === b.blockId);
    return ref
      ? { ...b, stepId: ref.stepId, sets: ref.sets, target: ref.target, rirPlan: ref.rirPlan }
      : b;
  });
  return { ...resolved, blocks };
}

/**
 * A saved session at its step (D54): the same step when the key fits, and otherwise the first step
 * not logged – also for a session saved by the version before the keys (`comeback.run`).
 */
function resumed(state: State, saved: RunState): RunState {
  if (saved.phase !== 'run' || saved.stepIndex < 0) return saved;
  const steps = buildSteps(runPlan(state, saved));
  const stepIndex = resumeIndex(steps, saved);
  return stepIndex === saved.stepIndex ? saved : { ...saved, stepIndex };
}

/** A clock for the figure: the part that runs, kept in a ref so the figure reads it each frame. */
function usePartClock(): {
  follow: (parts: Follow['parts'], mode: Follow['mode']) => Follow;
  set: (index: number, clock: Clock) => void;
} {
  const ref = useRef<PartClock | null>(null);
  return useMemo(
    () => ({
      follow: (parts, mode) => ({ parts, mode, part: () => ref.current }),
      set: (index, clock) => {
        ref.current = { index, clock };
      },
    }),
    [],
  );
}

export function Runner({
  model,
  request,
  onClose,
  away = false,
  onAway,
}: {
  model: Model;
  request: RunRequest;
  onClose: () => void;
  /** »Hold pause«: the session stands still under the tabs (docs/SPEC.md 3). */
  away?: boolean;
  onAway?: (away: boolean) => void;
}) {
  useModel(model);
  useSessionStyle();
  const [run, setRun] = useState<RunState>(() => {
    const saved = readRun(model.sim !== null);
    // Resume only the same session: same day, kind and world (a time-machine run never comes
    // back in the real app), and its session still open in the log.
    const open =
      saved?.sessionId === null ||
      model.state.sessions.some((s) => s.sessionId === saved?.sessionId && !s.completed);
    if (
      saved &&
      saved.date === request.date &&
      saved.kind === request.kind &&
      saved.phase !== 'summary' &&
      saved.sim === (model.sim !== null) &&
      open
    )
      return resumed(model.state, saved);
    // No saved step (e.g. local storage was cleared) but the session is open in the log: go on
    // with it; the first step without a logged set is found once the steps are known.
    const started = model.state.sessions.find(
      (s) => s.date === request.date && s.kind === request.kind && !s.completed,
    );
    if (started) {
      return {
        ...request,
        phase: 'run',
        answers: started.answers,
        red: started.light === 'red',
        preIndex: 0,
        stepIndex: -1,
        sessionId: started.sessionId,
        intervalsAnyway: false,
        sim: model.sim !== null,
      };
    }
    const defaults = defaultAnswers(model.state, request.date);
    return {
      ...request,
      phase: 'overview',
      answers: defaults.answers,
      red: false,
      preIndex: 0,
      stepIndex: 0,
      sessionId: null,
      intervalsAnyway: false,
      sim: model.sim !== null,
    };
  });
  /** The intro card that was closed: »warmup« or »step-<index>« (D44). */
  const [introShut, setIntroShut] = useState<string | null>(null);
  // »Sådan gør du« opens the exercise card in place of the session (docs/SPEC.md 3.8). While it is
  // open the session stands still – every clock, also the pause – so nothing starts or is logged
  // behind it (DECISIONS.md D47). Away under the tabs it stands still too. `held` is what the timers
  // get.
  const card = useCard();
  // A button that appears after a change of screen cannot be hit by the same clumsy double tap
  // (SPEC 6, design review D1): taps are ignored for half a second. An intro card that closes – a
  // tap, »Luk« or its own clock – and the exercise card that closes are changes of screen too, so
  // the second tap never lands on the neck's »Stop«, »Videre« or »Spring pausen over« under »Luk«
  // (D57). Set before the screen is painted, so not even the first frame takes a tap.
  const [settling, setSettling] = useState(false);
  // A tap that writes an event (an answer, a measurement, a set, the start and the end of the
  // session) takes the screen until the next one comes: the taps that follow it in a double tap are
  // ignored, so an answer is never saved twice and no step is skipped (D33, D57, D61). Set
  // synchronously, so even a second tap before the next drawing finds it.
  const writing = useRef(false);
  useLayoutEffect(() => {
    writing.current = false;
    setSettling(true);
    const id = setTimeout(() => setSettling(false), 500);
    return () => clearTimeout(id);
  }, [run.phase, run.preIndex, run.stepIndex, away, introShut, card.id]);
  /** Runs `action` for the first tap only, until the screen changes (or the writing fails). */
  const once =
    <A extends unknown[]>(action: (...args: A) => unknown) =>
    (...args: A): void => {
      if (writing.current) return;
      writing.current = true;
      setSettling(true);
      Promise.resolve()
        .then(() => action(...args))
        .then(
          () => {
            writing.current = false;
          },
          () => {
            writing.current = false;
            setSettling(false);
          },
        );
    };
  // A new step starts at the top, with »Nu« and the clock in view, wherever the last one was rolled.
  useEffect(() => {
    if (!away) window.scrollTo(0, 0);
  }, [run.phase, run.preIndex, run.stepIndex, away]);
  const sessionClass = settling ? 'session settling' : 'session';
  const [firstTime] = useState(() => readLocal<boolean>(SOUND_KEY) !== true);
  const soundNoted = () => writeLocal(true, SOUND_KEY);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [finished, setFinished] = useState<SessionSummary | null>(null);
  /** The motor's phase, for the part in the header. */
  const [motorPhase, setMotorPhase] = useState(0);
  const held = away || card.id !== null;
  const withCard = (view: preact.JSX.Element, overview = false) => (
    <>
      {view}
      {card.id !== null && (
        <ExerciseCard
          id={card.id}
          back={overview ? 'Tilbage til dagens pas' : 'Tilbage til passet'}
          onClose={card.close}
          context={card.context}
          status={overview ? undefined : 'Passet står stille.'}
        />
      )}
    </>
  );
  const hidden = card.id !== null || away;
  const pause = onAway ? () => onAway(true) : undefined;

  // The screen stays on from the traffic light to the summary (docs/SPEC.md 3.2), not under the tabs.
  const awake = run.phase !== 'overview' && !away;
  useEffect(() => {
    if (!awake) return;
    void keepAwake();
    return () => releaseAwake();
  }, [awake]);

  const state = model.state;
  const light: Light = run.red ? 'red' : lightFor(run.answers);
  const session = run.sessionId
    ? state.sessions.find((s) => s.sessionId === run.sessionId)
    : undefined;

  // The session runs exactly as it was planned when it started (P26).
  const plan: SessionPlan = useMemo(
    () => runPlan(state, run),
    [state, run.date, run.kind, light, run.short, run.calmBase, run.intervalsAnyway, session],
  );

  const steps = useMemo(() => buildSteps(plan), [plan]);
  const hosts = useMemo(() => introHosts(steps), [steps]);

  // Saved after every step with what the step is, so the session resumes at the same step after
  // the app was closed, also in a later version (D54); in the time machine only in memory (D57).
  useEffect(() => {
    writeRun(
      run.sim,
      run.phase === 'run' ? { ...run, stepKey: stepKey(steps, run.stepIndex) } : run,
    );
  }, [run, steps]);

  // Resumed from the log alone (stepIndex -1): the first set, result or measurement not logged.
  useEffect(() => {
    if (run.phase !== 'run' || run.stepIndex >= 0 || !session) return;
    const measured = (measureId: string) =>
      state.measurements.some((m) => m.measureId === measureId && m.date === run.date);
    const index = firstNotLogged(steps, session, measured);
    setRun((r) => ({ ...r, stepIndex: index }));
  }, [run.phase, run.stepIndex, session, steps]);

  // Blocks ended by sharp pain or »Stop« (5.3.3): their remaining sets are skipped.
  const ended = useMemo(() => {
    const set = new Set<string>();
    for (const s of session?.sets ?? [])
      if (s.pain === 'sharp' || s.pain === 'stop') set.add(s.blockId);
    return set;
  }, [session]);

  const skip = (step: Step | undefined): boolean =>
    !!step &&
    ((step.type === 'set' && ended.has(step.block.blockId)) ||
      (step.type === 'rest' && ended.has(step.blockId)));

  const advance = () => {
    setRun((r) => {
      let next = r.stepIndex + 1;
      while (skip(steps[next])) next++;
      return { ...r, stepIndex: Math.min(next, steps.length - 1) };
    });
  };

  const ctx = model.ctx;
  const day = planFor(PROGRAM, state, run.date);
  const wallTest = plan.blocks.find((b) => b.measureId === 'wall_test');
  // The wall test comes before the warm-up on a green start (q1 and q2 yes).
  const wallTestFirst = !!wallTest && run.answers[0] && run.answers[1];
  const strength = run.kind !== 'motor';
  const sections = useMemo(
    () =>
      strength && light !== 'red'
        ? sessionSections(steps, { wallTest: wallTestFirst, warmup: !!WARMUP })
        : [],
    [steps, strength, light, wallTestFirst],
  );
  const power = plan.blocks.find((b) => b.role === 'power');
  const warmupContext: CardContext = { session: run.kind, power: power?.stepId ?? null };
  /** The part an exercise step begins, for its big red number where the part starts (D59). */
  const partOf = (index: number): PartStart | null =>
    index >= 0 && sections.length > 0 ? partStartedBy(sections, steps, index) : null;

  const begin = async (red: boolean) => {
    const sessionId = ulid(Date.now());
    const events = startSession(ctx, model.events, {
      sessionId,
      date: run.date,
      kind: run.kind,
      answers: run.answers,
      red,
      short: run.short,
      calmBase: run.calmBase,
      intervalsAnyway: run.intervalsAnyway,
    });
    await model.commit(events);
    setRun((r) => ({ ...r, phase: 'run', red, sessionId, stepIndex: 0 }));
  };

  const finish = async (aborted: boolean) => {
    if (!run.sessionId) {
      writeRun(run.sim, null);
      onClose();
      return;
    }
    const events = finishSession(ctx, model.events, { sessionId: run.sessionId, aborted });
    await model.commit(events);
    if (!model.sim) void requestPersistOnce(model);
    play('slut');
    setFinished(model.state.sessions.find((s) => s.sessionId === run.sessionId) ?? null);
    setRun((r) => ({ ...r, phase: 'summary' }));
  };

  const close = () => {
    writeRun(run.sim, null);
    onClose();
  };

  // »Afslut« asks first from the wall test on, as in the session: »Hold pause« stands next to it,
  // and a session left by mistake would start the warm-up and the wall test over (SPEC 3, D57).
  const askEnd = () => setConfirmEnd(true);
  const endBar = confirmEnd && (
    <div class="confirm" role="alertdialog" aria-label="Afslut passet">
      <p>Afslut passet? Det, du har logget, gemmes.</p>
      <div class="row">
        <button type="button" class="btn" onClick={() => setConfirmEnd(false)}>
          Fortsæt
        </button>
        <button type="button" class="btn primary" onClick={once(() => finish(true))}>
          Afslut
        </button>
      </div>
    </div>
  );

  if (run.phase === 'summary') {
    return <Summary session={finished} onDone={close} />;
  }

  /** The first exercise of the session's steps: »Næste« at the end of the warm-up. */
  const firstExercise = nextExercise(steps, -1, ended);

  // -------------------------------------------------------------------------------------------
  // »Dagens pas« (3.2): the whole session before it starts, »Start passet« at the bottom
  if (run.phase === 'overview') {
    const motor = run.kind === 'motor';
    const parts = motor ? motorParts(plan) : strengthParts(plan, steps, !!wallTest).parts;
    const openItem = (item: DayItem) => {
      if (item.cardId) card.open(item.cardId, item.context ?? undefined);
    };
    return withCard(
      <div class={sessionClass} hidden={hidden}>
        <SessionHeader title="Dagens pas" onClose={close} closeLabel="Tilbage" />
        <div class="session-body with-actions">
          <DayPlan
            title={plan.name}
            minutes={sessionMinutes(plan)}
            parts={parts}
            strength={!motor}
            hint={
              plan.calmBase && plan.intervalsOption
                ? 'I går var klubtræningen hård: rolig base i dag. Du kan vælge intervallerne før start.'
                : undefined
            }
            onCard={openItem}
          />
        </div>
        <div class="session-actions">
          <button
            type="button"
            class="btn primary block"
            data-testid="day-start"
            onClick={() => {
              void enableAudio();
              setRun((r) => ({ ...r, phase: 'light' }));
            }}
          >
            Start passet
          </button>
        </div>
      </div>,
      true,
    );
  }

  // -------------------------------------------------------------------------------------------
  // Traffic light (3.3)
  if (run.phase === 'light') {
    const defaults = defaultAnswers(state, run.date);
    const motor = run.kind === 'motor';
    const setAnswer = (i: number, value: boolean) =>
      setRun((r) => {
        const answers = [...r.answers] as [boolean, boolean, boolean];
        answers[i] = value;
        return { ...r, answers };
      });
    const questions = motor
      ? [
          'Sovet mindst 6 timer?',
          'Fri for ledsmerter, kun let øm?',
          'Føles kroppen og opvarmningen normal?',
        ]
      : ['Sovet mindst 6 timer?', 'Fri for ledsmerter, kun let øm?'];
    const now: Light = lightFor(motor ? run.answers : [run.answers[0], run.answers[1], true]);
    return withCard(
      <div class={sessionClass} hidden={hidden}>
        <SessionHeader title={plan.name} onClose={close} />
        {/* The questions sit low, over the buttons, where the thumb is (SPEC 6, D59). */}
        <div class="session-body low">
          <h1>Før du starter – 10 sekunder</h1>
          {firstTime && (
            <p class="hint">Skru op for medielyden: lyden er dit signal i hold og pauser.</p>
          )}
          <div class="low-group">
            {questions.map((q, i) => (
              <YesNo
                key={q}
                label={q}
                value={run.answers[i] ?? true}
                onChange={(v) => setAnswer(i, v)}
              />
            ))}
            {defaults.painReason === 'recent_sharp' && (
              <p class="hint">Du har logget skarp smerte inden for 2 dage.</p>
            )}
            {defaults.painReason === 'sunday_check' && (
              <p class="hint">Søndagstjekket noterede smerte, der ikke gik væk.</p>
            )}
            {defaults.hardYesterday && <p class="hint">I går var klubtræningen hård.</p>}
            {motor && plan.intervalsOption && (
              <label class="check">
                <input
                  type="checkbox"
                  checked={run.intervalsAnyway}
                  onChange={(e) =>
                    setRun((r) => ({
                      ...r,
                      intervalsAnyway: (e.target as HTMLInputElement).checked,
                    }))
                  }
                />{' '}
                Kør intervallerne alligevel
              </label>
            )}
            {!motor && <p class="muted">Spørgsmål 3 kommer efter opvarmningen.</p>}
          </div>
        </div>
        <div class="session-actions">
          <button
            type="button"
            class="btn block red-outline"
            onClick={once(() => {
              void enableAudio();
              return begin(true);
            })}
          >
            Rød: syg, feber, skarp smerte eller under 4 timers søvn
          </button>
          <button
            type="button"
            class={now === 'green' ? 'btn primary block' : 'btn primary block yellow'}
            onClick={once(() => {
              void enableAudio();
              soundNoted();
              if (motor) return begin(false);
              return setRun((r) => ({ ...r, phase: 'pre', preIndex: 0 }));
            })}
          >
            {motor
              ? now === 'green'
                ? 'GRØN – kør passet'
                : 'GUL – rolig base 30 min'
              : now === 'green'
                ? 'Start opvarmningen'
                : 'GUL – start opvarmningen'}
          </button>
        </div>
      </div>,
    );
  }

  // -------------------------------------------------------------------------------------------
  // Warm-up and question 3 (before session_started)
  if (run.phase === 'pre') {
    const measureFirst = wallTest && light === 'green' ? [wallTest] : [];
    const items = WARMUP?.items ?? [];
    const index = run.preIndex;
    const nextPre = () => setRun((r) => ({ ...r, preIndex: r.preIndex + 1 }));
    const firstNext = firstExercise ? upcomingOf(firstExercise) : null;
    const warmupNext = (i: number): Upcoming | null => {
      const item = items[i];
      if (!item) return firstNext;
      return {
        cardId: `${WARMUP?.id ?? 'warmup'}.${item.key}`,
        pictoId: null,
        title: `Opvarmning · ${item.name}`,
        line: item.dose,
      };
    };
    const progress = (where: 'wallTest' | 'warmup') => {
      const at = sectionOf(sections, where, 0);
      return { at, of: sections.length, label: sections[at - 1]?.label ?? '' };
    };
    if (index < measureFirst.length && measureFirst[0]) {
      const block = measureFirst[0];
      return withCard(
        <div class={sessionClass} hidden={hidden}>
          <SessionHeader
            title="Måling før opvarmning"
            progress={progress('wallTest')}
            onPause={pause}
            onClose={askEnd}
          />
          {endBar}
          <div class="session-body">
            <MeasureInput
              paused={held}
              measureId={block.measureId ?? ''}
              state={state}
              onCard={() => card.open(`${MEASURES}.${block.measureId ?? ''}`)}
              figure={
                <ExerciseFigure
                  cardId={`${MEASURES}.${block.measureId ?? ''}`}
                  pictoId={null}
                  name="Væg-testen"
                  size="now"
                />
              }
              next={<NextStrip next={warmupNext(0)} context={warmupContext} />}
              onSave={once(async (value: number) => {
                await model.commit([
                  ctx.make(
                    {
                      type: 'measurement_logged',
                      measureId: block.measureId ?? '',
                      value,
                      programWeek: day.pw,
                      round: day.round,
                    },
                    run.date,
                  ),
                ]);
                nextPre();
              })}
              onSkip={nextPre}
            />
          </div>
        </div>,
      );
    }
    const itemIndex = index - measureFirst.length;
    const item = items[itemIndex];
    if (item) {
      const header = (
        <>
          <SessionHeader
            title={`Opvarmning · ${itemIndex + 1}/${items.length}`}
            progress={progress('warmup')}
            onPause={pause}
            onClose={askEnd}
          />
          {endBar}
        </>
      );
      // The warm-up's one intro card: 10 sek before its first timer, then it closes (D44).
      if (itemIndex === 0 && introShut !== 'warmup') {
        const at = sectionOf(sections, 'warmup', 0);
        const warmupPart = at > 0 ? { at, of: sections.length, label: 'Opvarmning' } : null;
        return withCard(
          <div class={sessionClass} hidden={hidden}>
            {header}
            <div class="session-body">
              <WarmupIntro
                ids={items.map((i) => `${WARMUP?.id ?? 'warmup'}.${i.key}`)}
                context={warmupContext}
                part={warmupPart}
                paused={held}
                onDone={() => setIntroShut('warmup')}
              />
            </div>
          </div>,
        );
      }
      const id = `${WARMUP?.id ?? 'warmup'}.${item.key}`;
      return withCard(
        <div class={sessionClass} hidden={hidden}>
          {header}
          <div class="session-body">
            <WarmupItem
              key={`w${itemIndex}`}
              id={id}
              name={item.name}
              kicker={`Opvarmning · ${itemIndex + 1} af ${items.length} · ${item.dose}`}
              execution={item.execution}
              seconds={item.seconds}
              context={warmupContext}
              paused={held}
              onDone={nextPre}
              onCard={() => card.open(id, warmupContext)}
              powerName={
                item.key === '4' && power ? getStep(PROGRAM, power.stepId).name : undefined
              }
              next={warmupNext(itemIndex + 1)}
            />
          </div>
        </div>,
      );
    }
    // Question 3 after warm-up step 4; then the session starts (session_started).
    const q1q2Yellow = !run.answers[0] || !run.answers[1];
    // The warm-up's last timer can end while a card is open: the card stays until it is closed.
    return withCard(
      <div class={sessionClass} hidden={hidden}>
        <SessionHeader title="Trafiklys" progress={progress('warmup')} onClose={askEnd} />
        {endBar}
        <div class="session-body low">
          <h1>Spørgsmål 3</h1>
          <div class="low-group">
            <YesNo
              label="Opvarmning og første hop normale?"
              value={run.answers[2]}
              onChange={(v) => setRun((r) => ({ ...r, answers: [r.answers[0], r.answers[1], v] }))}
            />
            {q1q2Yellow && <p class="hint">Et nej i spørgsmål 1 eller 2 giver en gul dag.</p>}
          </div>
          {firstNext && (
            <NextBox
              next={firstNext}
              context={contextOf(firstExercise, run.kind)}
              part={partOf(firstExercise ? steps.indexOf(firstExercise) : -1)}
              onCard={(id) => card.open(id, contextOf(firstExercise, run.kind) ?? undefined)}
            />
          )}
        </div>
        <div class="session-actions">
          <button type="button" class="btn block red-outline" onClick={once(() => begin(true))}>
            Rød: syg, feber, skarp smerte eller under 4 timers søvn
          </button>
          <button
            type="button"
            class={light === 'green' ? 'btn primary block' : 'btn primary block yellow'}
            onClick={once(() => begin(false))}
          >
            {light === 'green' ? 'GRØN – kør passet' : 'GUL – minimumsdosis'}
          </button>
        </div>
      </div>,
    );
  }

  // -------------------------------------------------------------------------------------------
  // The session's steps
  const step = steps[run.stepIndex];
  if (run.sessionId && !session && run.stepIndex >= 0) {
    // The session is gone from the log (a backup was imported while it held a pause): nothing to
    // go on with, and nothing to lose – back to I dag.
    return (
      <div class={sessionClass} hidden={hidden}>
        <div class="session-body">
          <h1>Passet findes ikke længere</h1>
          <p class="cue">Loggen blev skiftet ud, mens passet holdt pause.</p>
          <button type="button" class="btn primary block" onClick={close}>
            Til I dag
          </button>
        </div>
      </div>
    );
  }
  if (!step || !run.sessionId || !session) return null;
  const sessionId = run.sessionId;
  const date = run.date;
  const groupSets = steps.filter((s) => s.group === step.group && s.type === 'set');
  const current =
    step.type === 'rest'
      ? steps.slice(run.stepIndex).find((s) => s.type === 'set' && s.group === step.group)
      : step;
  const position = current ? groupSets.indexOf(current) + 1 : 0;

  // The part of the session in the header: »Del 3 af 7« (the motor: its phases).
  let progress: { at: number; of: number; label: string } | undefined;
  if (plan.kind === 'motor' && plan.motor) {
    const phases = plan.motor.phases;
    const of = phases.length + (plan.motor.measureId ? 1 : 0);
    const at = step.type === 'distance' ? of : Math.min(motorPhase + 1, phases.length);
    progress = {
      at,
      of,
      label: step.type === 'distance' ? 'Måling' : (phases[at - 1]?.label ?? ''),
    };
  } else if (sections.length > 0) {
    const at = sectionOf(sections, 'run', run.stepIndex);
    if (at > 0) progress = { at, of: sections.length, label: sections[at - 1]?.label ?? '' };
  }

  const header = (
    <SessionHeader
      title={
        step.group
          ? `${step.group}${position > 0 ? ` · sæt ${position}/${groupSets.length}` : ''}`
          : plan.name
      }
      progress={progress}
      onPause={pause}
      // On the last screen everything is logged: »Afslut passet« finishes it, and a second
      // »Afslut« at the top would mark it as ended early (D54).
      onClose={step.type === 'finish' ? undefined : askEnd}
      progressWord={plan.kind === 'motor' ? 'Fase' : 'Del'}
    />
  );
  const logResult = async (
    block: BlockPlan,
    result: Parameters<typeof logBlockResult>[1]['result'],
  ) => {
    await model.commit([logBlockResult(ctx, { sessionId, date, block, result })]);
    advance();
  };

  // »Næste« on every step: the next exercise of any kind, or the summary after the last (D47).
  const upcomingStep = nextExercise(steps, run.stepIndex, ended);
  const upcoming: Upcoming = upcomingStep ? upcomingOf(upcomingStep) : SUMMARY_NEXT;
  const upcomingContext = contextOf(upcomingStep, run.kind);
  const upcomingPart = partOf(upcomingStep ? steps.indexOf(upcomingStep) : -1);
  const openCard = (id: string, context: CardContext | null = null) =>
    card.open(id, context ?? undefined);
  const strip = <NextStrip next={upcoming} context={upcomingContext} />;
  const nextBox = (
    <NextBox
      next={upcoming}
      context={upcomingContext}
      part={upcomingPart}
      onCard={(id) => openCard(id, upcomingContext)}
    />
  );

  // The intro card on this step (D44): in the pause before an exercise's first set, or on the
  // exercise itself with its own »Gør klar«, until it is closed.
  const host = hosts.get(run.stepIndex);
  const introKey = `step-${run.stepIndex}`;
  const introHere =
    host &&
    introShut !== introKey &&
    (host.own || (upcomingStep !== undefined && steps.indexOf(upcomingStep) === host.target));

  let body: ComponentChildren = null;
  if (introHere && host.own) {
    const target = steps[host.target] as ExerciseStep;
    body = (
      <IntroStep
        key={introKey}
        next={upcomingOf(target)}
        context={contextOf(target, run.kind)}
        part={partOf(host.target)}
        paused={held}
        onDone={() => setIntroShut(introKey)}
      />
    );
  } else {
    switch (step.type) {
      case 'set':
        if (step.measure && step.block.measureId) {
          const measureId = step.block.measureId;
          body = (
            <MeasureInput
              paused={held}
              key={`m-${step.block.blockId}`}
              measureId={measureId}
              state={state}
              // »første sæt i Pres · max«, as on the intro card: a max test is an ordinary push-up
              // or row, not the step's exercise (D45, D57).
              firstSetOf={`${trackName(step.block.trackId)} · max`}
              onCard={() => card.open(`${MEASURES}.${measureId}`)}
              figure={
                <ExerciseFigure
                  cardId={`${MEASURES}.${measureId}`}
                  pictoId={step.block.stepId}
                  name={getStep(PROGRAM, step.block.stepId).name}
                  size="now"
                />
              }
              next={strip}
              onSave={once(async (value: number) => {
                await model.commit([
                  logSet(ctx, {
                    sessionId,
                    date,
                    block: step.block,
                    setIndex: step.setIndex,
                    value,
                    measureId,
                  }),
                  ctx.make(
                    {
                      type: 'measurement_logged',
                      measureId,
                      value,
                      programWeek: session.pw,
                      round: session.round,
                    },
                    date,
                  ),
                ]);
                advance();
              })}
              onSkip={advance}
            />
          );
          break;
        }
        body = (
          <SetStep
            key={`${step.block.blockId}-${step.setIndex}-${step.side ?? ''}`}
            step={step}
            paused={held}
            next={strip}
            // After sharp pain on step 1 the set runs the lighter variant: the card shows it at the
            // top (docs/SPEC.md 3.8, D47).
            context={contextOf(step, run.kind)}
            onCard={(id) => openCard(id, contextOf(step, run.kind))}
            onLog={once(async (value?: number, rir?: Rir, pain?: Pain) => {
              const measureId = step.measure ? step.block.measureId : undefined;
              // One set, or both sides of a set done alternately (P54); a side the previous version
              // logged already is not logged again (D57).
              const logged = step.alternate
                ? session.sets
                    .filter((s) => s.blockId === step.block.blockId && s.setIndex === step.setIndex)
                    .map((s) => s.side)
                : [];
              const events = setEvents(
                ctx,
                { sessionId, date, step, value, rir, pain, measureId },
                logged,
              );
              if (measureId && value !== undefined) {
                events.push(
                  ctx.make(
                    {
                      type: 'measurement_logged',
                      measureId,
                      value,
                      programWeek: session.pw,
                      round: session.round,
                    },
                    date,
                  ),
                );
              }
              await model.commit(events);
              advance();
            })}
          />
        );
        break;
      case 'rest':
        body = (
          <RestStep
            key={`r${run.stepIndex}`}
            seconds={step.seconds}
            paused={held}
            onDone={advance}
            next={upcoming}
            context={upcomingContext}
            part={upcomingPart}
            logged={loggedLine(steps[run.stepIndex - 1], session.sets)}
            intro={!!introHere}
            onIntroClose={() => setIntroShut(introKey)}
            onCard={(id) => openCard(id, upcomingContext)}
          />
        );
        break;
      case 'power-q':
        body = (
          <Question
            title={trackName(step.block.trackId)}
            question="Alle hop/reps lige høje og hurtige?"
            next={nextBox}
            onAnswer={once((yes: boolean) => logResult(step.block, { quality: yes }))}
          />
        );
        break;
      case 'emom':
        body = (
          <EmomStep
            key={`emom${run.stepIndex}`}
            block={step.block}
            part={partOf(run.stepIndex)}
            paused={held}
            next={strip}
            onDone={advance}
            onCard={(id) => openCard(id)}
          />
        );
        break;
      case 'emom-q':
        body = (
          <EmomQuestions
            next={nextBox}
            onSave={once((clean: boolean, rest20: boolean) =>
              logResult(step.block, { clean, rest20 }),
            )}
          />
        );
        break;
      case 'club':
        body = (
          <ClubStep
            key={`club${step.set}`}
            block={step.block}
            set={step.set}
            paused={held}
            next={strip}
            onDone={advance}
            onCard={(id) => openCard(id)}
          />
        );
        break;
      case 'round':
        body = (
          <RoundStep
            key={`round-${step.block.blockId}-${step.round}`}
            block={step.block}
            round={step.round}
            paused={held}
            next={strip}
            onDone={advance}
            onCard={(id) => openCard(id)}
          />
        );
        break;
      case 'rounds-q':
        body = (
          <Question
            title={getStep(PROGRAM, step.block.stepId).name}
            question="Rene runder?"
            next={nextBox}
            onAnswer={once((yes: boolean) => logResult(step.block, { clean: yes }))}
          />
        );
        break;
      case 'club-q':
        body = (
          <Question
            title="Klubsekvensen"
            question="Ren runde?"
            next={nextBox}
            onAnswer={once((yes: boolean) => logResult(step.block, { clean: yes }))}
          />
        );
        break;
      case 'neck':
        body = (
          <NeckStep
            key="neck"
            block={step.block}
            paused={held}
            next={strip}
            onDone={advance}
            onCard={(id) => openCard(id)}
            onStop={once(async () => {
              await model.commit([
                logSet(ctx, {
                  sessionId,
                  date,
                  block: step.block,
                  setIndex: 1,
                  value: 0,
                  rir: 3,
                  pain: 'stop',
                }),
              ]);
              advance();
              advance();
            })}
          />
        );
        break;
      case 'neck-q':
        body = (
          <Feel
            next={nextBox}
            onAnswer={once((feel: 'easy' | 'ok' | 'hard') => logResult(step.block, { feel }))}
          />
        );
        break;
      case 'measure': {
        const measureId = step.block.measureId ?? '';
        body = (
          <MeasureInput
            paused={held}
            measureId={measureId}
            state={state}
            onCard={() => card.open(`${MEASURES}.${measureId}`)}
            figure={
              <ExerciseFigure
                cardId={`${MEASURES}.${measureId}`}
                pictoId={null}
                name={PROGRAM.measures.find((m) => m.id === measureId)?.name ?? ''}
                size="now"
              />
            }
            next={strip}
            onSave={once(async (value: number) => {
              await model.commit([
                ctx.make(
                  {
                    type: 'measurement_logged',
                    measureId,
                    value,
                    programWeek: session.pw,
                    round: session.round,
                  },
                  date,
                ),
              ]);
              advance();
            })}
            onSkip={advance}
          />
        );
        break;
      }
      case 'motor':
        body = (
          <MotorStep
            plan={plan}
            paused={held}
            onDone={advance}
            onPhase={setMotorPhase}
            after={
              plan.motor?.measureId
                ? `Måling · ${PROGRAM.measures.find((m) => m.id === plan.motor?.measureId)?.name ?? ''}`
                : null
            }
          />
        );
        break;
      case 'distance':
        body = (
          <MeasureInput
            paused={held}
            measureId={plan.motor?.measureId ?? 'base_check'}
            state={state}
            onCard={() => card.open(`${MEASURES}.${plan.motor?.measureId ?? 'base_check'}`)}
            next={<NextStrip next={SUMMARY_NEXT} />}
            onSave={once(async (value: number) => {
              await model.commit([
                ctx.make(
                  {
                    type: 'measurement_logged',
                    measureId: plan.motor?.measureId ?? 'base_check',
                    value,
                    programWeek: session.pw,
                    round: session.round,
                  },
                  date,
                ),
              ]);
              advance();
            })}
            onSkip={advance}
          />
        );
        break;
      case 'walk':
        body = (
          <div class="stack">
            <h1>Rød dag</h1>
            <p class="cue">Kun Open & Strong og en gåtur i dag. Passet markeres rødt.</p>
          </div>
        );
        break;
      case 'finish':
        body = (
          <div class="stack">
            <h1>{plan.name}</h1>
            <p class="cue">Alt er logget. Tryk for at se, hvad der ændres til næste gang.</p>
          </div>
        );
        break;
    }
  }

  const actions =
    step.type === 'walk' ? (
      <div class="session-actions">
        <button type="button" class="btn primary block" onClick={once(() => finish(false))}>
          Afslut den røde dag
        </button>
      </div>
    ) : step.type === 'finish' ? (
      <div class="session-actions">
        <button
          type="button"
          class="btn primary block"
          onClick={once(() => finish(false))}
          data-testid="finish"
        >
          Afslut passet
        </button>
      </div>
    ) : null;

  return withCard(
    <div class={sessionClass} hidden={hidden}>
      {header}
      {endBar}
      <DeviceNotices />
      <div class={actions ? 'session-body with-actions' : 'session-body'}>{body}</div>
      {actions}
    </div>,
  );
}

// ---------------------------------------------------------------------------------------------
// Pieces

/** SPEC 4.13: »Tryk for at slå lyd til« when sound is blocked; »Skærmen kan slukke« without Wake Lock. */
function DeviceNotices() {
  const [, setTick] = useState(0);
  useEffect(() => onWakeState(() => setTick((n) => n + 1)), []);
  const sound = audioState();
  const silent = sound === 'blocked' || sound === 'suspended' || sound === 'off';
  return (
    <>
      {silent && (
        <button
          type="button"
          class="notice"
          onClick={() => void enableAudio().then(() => setTick((n) => n + 1))}
        >
          Tryk for at slå lyd til
        </button>
      )}
      {wakeState() === 'failed' && <p class="notice">Skærmen kan slukke under passet</p>}
    </>
  );
}

function SessionHeader(props: {
  title: string;
  /** The part of the session: »Del 3 af 7« with a bar under the header. */
  progress?: { at: number; of: number; label: string };
  progressWord?: string;
  onPause?: () => void;
  /** »Afslut« (or `closeLabel`); none on the last screen. */
  onClose?: () => void;
  closeLabel?: string;
}) {
  const progress = props.progress && props.progress.of > 1 ? props.progress : undefined;
  return (
    <div class="session-top">
      <header class="session-header">
        <div class="session-heading">
          {progress && (
            <p class="session-progress" data-testid="session-progress">
              {props.progressWord ?? 'Del'} {progress.at} af {progress.of}
            </p>
          )}
          <p class="session-title">{props.title}</p>
        </div>
        {props.onPause && (
          <button
            type="button"
            class="btn small"
            onClick={props.onPause}
            data-testid="session-pause"
          >
            Hold pause
          </button>
        )}
        {props.onClose && (
          <button
            type="button"
            class="btn small"
            onClick={props.onClose}
            aria-label={props.closeLabel ? undefined : 'Afslut passet'}
          >
            {props.closeLabel ?? 'Afslut'}
          </button>
        )}
      </header>
      {progress && <SessionProgress at={progress.at} of={progress.of} label={progress.label} />}
    </div>
  );
}

function YesNo(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div class="yesno">
      <p class="yesno-label">{props.label}</p>
      <div class="row">
        <button
          type="button"
          class={props.value ? 'btn selected' : 'btn'}
          aria-pressed={props.value}
          onClick={() => props.onChange(true)}
        >
          Ja
        </button>
        <button
          type="button"
          class={!props.value ? 'btn selected' : 'btn'}
          aria-pressed={!props.value}
          onClick={() => props.onChange(false)}
        >
          Nej
        </button>
      </div>
    </div>
  );
}

function Question(props: {
  title: string;
  question: string;
  /** »Næste« under the question. */
  next?: ComponentChildren;
  onAnswer: (yes: boolean) => void;
}) {
  return (
    <div class="stack">
      <p class="step-kicker">{props.title}</p>
      <h1>{props.question}</h1>
      {props.next}
      <div class="fixed-actions">
        <button type="button" class="btn block" onClick={() => props.onAnswer(false)}>
          Nej
        </button>
        <button type="button" class="btn primary block" onClick={() => props.onAnswer(true)}>
          Ja
        </button>
      </div>
    </div>
  );
}

function Feel({
  next,
  onAnswer,
}: {
  next?: ComponentChildren;
  onAnswer: (feel: 'easy' | 'ok' | 'hard') => void;
}) {
  return (
    <div class="stack">
      <p class="step-kicker">Nakke-stigen</p>
      <h1>Hvordan føltes trinnet?</h1>
      {next}
      <div class="fixed-actions">
        <button type="button" class="btn block" onClick={() => onAnswer('easy')}>
          Let
        </button>
        <button type="button" class="btn block" onClick={() => onAnswer('ok')}>
          Passende
        </button>
        <button type="button" class="btn block" onClick={() => onAnswer('hard')}>
          Hårdt
        </button>
      </div>
    </div>
  );
}

function EmomQuestions({
  next,
  onSave,
}: {
  next?: ComponentChildren;
  onSave: (clean: boolean, rest20: boolean) => void;
}) {
  const [clean, setClean] = useState<boolean | null>(null);
  const [rest, setRest] = useState<boolean | null>(null);
  return (
    <div class="stack">
      <p class="step-kicker">Burpees</p>
      <YesNo label="Alle minutter rene?" value={clean ?? true} onChange={setClean} />
      <YesNo label="Mindst 20 sek pause i sidste minut?" value={rest ?? true} onChange={setRest} />
      {next}
      <div class="fixed-actions">
        <button
          type="button"
          class="btn primary block"
          onClick={() => onSave(clean ?? true, rest ?? true)}
        >
          Gem
        </button>
      </div>
    </div>
  );
}

/**
 * The pause (docs/SPEC.md 3.2): the countdown and the next exercise big with its animation and »Gør
 * klar«. The first time an exercise comes, its intro card stands in the pause instead until it is
 * closed or the pause ends – the same clock in both, so closing the card changes nothing (D44).
 */
function RestStep(props: {
  seconds: number;
  paused: boolean;
  onDone: () => void;
  next: Upcoming;
  context: CardContext | null;
  /** The part the next exercise begins, if it begins one (D59). */
  part: PartStart | null;
  /** The set just logged, in words: what the tap changed (SPEC 5, Bevægelse). */
  logged: string | null;
  intro: boolean;
  onIntroClose: () => void;
  onCard: (id: string) => void;
}) {
  const timer = useCountdown(props.seconds, props.paused, { onDone: props.onDone, end: 'go' });
  const logged = props.logged && (
    <p class="rest-logged step-enter" data-testid="rest-logged">
      {props.logged}
    </p>
  );
  if (props.intro) {
    return (
      <IntroCard
        next={props.next}
        context={props.context}
        clock={<CountdownView state={timer} label="Pause" size="line" part={props.part} />}
        onClose={props.onIntroClose}
      />
    );
  }
  return (
    <div class="rest">
      {logged}
      <CountdownView state={timer} label="Pause" />
      <div class="step-enter">
        {props.next.cardId ? (
          <NextBig
            next={props.next}
            context={props.context}
            part={props.part}
            onCard={props.onCard}
          />
        ) : (
          <NextStrip next={props.next} />
        )}
      </div>
      <div class="fixed-actions">
        <button type="button" class="btn block" onClick={props.onDone}>
          Spring pausen over
        </button>
      </div>
    </div>
  );
}

/** One set: »Som planlagt« in one tap; −/+, reserve and pain adjust it first (SK2). */
function SetStep(props: {
  step: Extract<Step, { type: 'set' }>;
  paused: boolean;
  /** »Næste« above the actions. */
  next: ComponentChildren;
  context: CardContext | null;
  /** Opens the exercise card of the step (»Sådan gør du«). */
  onCard: (stepId: string) => void;
  onLog: (
    value: number | undefined,
    rir: Rir | undefined,
    pain: Pain | undefined,
  ) => void | Promise<void>;
}) {
  const { step } = props;
  const block = step.block;
  const stepData = getStep(PROGRAM, block.stepId);
  const range = workRange(stepData.dose);
  const planned = plannedRir(PROGRAM, block);
  const [value, setValue] = useState(step.measure ? 0 : block.target);
  const [rir, setRir] = useState<Rir>(planned);
  const [painOpen, setPainOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [holdDone, setHoldDone] = useState(false);
  const [stopped, setStopped] = useState(false);
  const isHold = block.unit === 'sec' && !step.measure;
  // Power is steered by »lige høje og hurtige«, not by reps in reserve (R-POWER).
  const power = block.role === 'power';
  const asPlanned = value === block.target && rir === planned;
  // A set done alternately: the target counts each side, and one tap logs both (P54).
  const unit = step.alternate ? `${unitWord(block)} ${perWord(block)}` : unitWord(block);
  const cues = useCues(block.stepId, props.context);
  const clock = usePartClock();
  const parts = useMemo(() => holdClock(block.target), [block.target]);

  const submit = async (pain?: Pain) => {
    if (busy) return;
    setBusy(true);
    await props.onLog(
      step.measure ? value : asPlanned && !pain ? undefined : value,
      step.measure ? undefined : asPlanned && !pain ? undefined : rir,
      pain,
    );
  };

  const head = (
    <NowHead
      kicker={
        <>
          {getTrack(PROGRAM, block.trackId).short} · Trin {stepData.key}
          {block.tempDown?.lighter ? ' · lettere variant' : ''}
        </>
      }
      name={stepData.name}
      onCard={() => props.onCard(block.stepId)}
    />
  );
  const count = (
    <p class="set-count">
      {step.measure ? 'Måling' : `Sæt ${step.setIndex} af ${setCount(block)}`}
      {step.side ? ` · ${sideWord(step.side, block)}` : ''}
      {step.alternate ? ' · skiftevis' : ''}
    </p>
  );
  const figure = (follow?: Follow) => (
    <ExerciseFigure
      cardId={block.stepId}
      pictoId={block.stepId}
      name={stepData.name}
      context={props.context}
      size="now"
      follow={follow}
    />
  );

  if (isHold && !holdDone && !stopped) {
    return (
      <div class="stack now">
        {head}
        <div class="now-stage step-enter">
          <div class="now-figure">{figure(clock.follow(parts, { kind: 'hold' }))}</div>
          <HoldTimer
            seconds={block.target}
            paused={props.paused}
            onPart={clock.set}
            onDone={() => {
              setHoldDone(true);
              void props.onLog(undefined, undefined, undefined);
            }}
          />
        </div>
        {count}
        <NowCues cues={cues} />
        <div class="fixed-actions">
          {props.next}
          <button type="button" class="btn block" onClick={() => setStopped(true)}>
            Stoppede før tid
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="stack now">
      {head}
      <div class="now-stage step-enter">
        <div class="now-figure">{figure()}</div>
        <div class="now-target">
          <div class="big-number" data-testid="target">
            <span class="number">{value}</span>
            <span class="unit">{unit}</span>
          </div>
          {count}
          {!step.measure && !power && (
            <p class="now-reserve">
              reserve {block.rirPlan === 3 ? '3' : block.rirPlan === 1 ? '1–2' : '2'}
            </p>
          )}
          {block.load ? <p>Rygsæk: {block.load} kg</p> : null}
        </div>
      </div>
      <NowCues cues={cues} />
      <details class="why">
        <summary>Hvorfor</summary>
        <p>{stepData.execution}</p>
        <WhyText trackId={block.trackId} />
      </details>
      {painOpen && (
        <div class="pain card panel">
          <button type="button" class="btn block" onClick={() => void submit('light')}>
            Let (≤3)
          </button>
          <button type="button" class="btn block" onClick={() => void submit('sharp')}>
            Skarp eller i et led
          </button>
          <button type="button" class="btn block" onClick={() => void submit('stop')}>
            Stop øvelsen
          </button>
        </div>
      )}
      {range && !power && (
        <p class="muted small-print">
          Trinnets interval: {range.min}–{range.max} {unitWord(block)}
        </p>
      )}
      <div class="fixed-actions">
        {props.next}
        <button
          type="button"
          class="btn primary block"
          disabled={busy}
          onClick={() => void submit()}
          data-testid="as-planned"
        >
          {power
            ? asPlanned
              ? `Som planlagt (${block.target} ${unit})`
              : `Log ${value} ${unit}`
            : asPlanned
              ? `Som planlagt (${block.target} · reserve ${rirText(planned)})`
              : `Log ${value} · reserve ${rirText(rir)}`}
        </button>
        <div class="adjust row">
          <button
            type="button"
            class="btn"
            aria-label="Færre"
            onClick={() => setValue(Math.max(0, value - (isHold ? 5 : 1)))}
          >
            −
          </button>
          <span class="adjust-value">
            {value} {unitWord(block)}
          </span>
          <button
            type="button"
            class="btn"
            aria-label="Flere"
            onClick={() => setValue(value + (isHold ? 5 : 1))}
          >
            +
          </button>
          <button
            type="button"
            class="btn"
            onClick={() => setPainOpen(!painOpen)}
            aria-expanded={painOpen}
          >
            Smerte
          </button>
        </div>
        {power ? (
          <p class="adjust-note">
            Trinnets interval: {range?.min}–{range?.max} {unitWord(block)}
          </p>
        ) : (
          <div class="adjust row" role="group" aria-label="Reserve">
            <span class="adjust-label">Reserve</span>
            {([1, 2, 3] as Rir[]).map((r) => (
              <button
                key={r}
                type="button"
                class={rir === r ? 'btn selected' : 'btn'}
                aria-pressed={rir === r}
                onClick={() => setRir(r)}
              >
                {rirText(r)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function rirText(rir: Rir): string {
  return rir === 1 ? '≤1' : rir === 3 ? '3+' : String(rir);
}

/** 5-second »klar« countdown, then the hold, with sounds; logs itself at the end. */
function HoldTimer(props: {
  seconds: number;
  paused: boolean;
  onDone: () => void;
  onPart?: (index: number, clock: Clock) => void;
}) {
  const [phase, setPhase] = useState<'ready' | 'hold'>('ready');
  return phase === 'ready' ? (
    <Countdown
      key="ready"
      seconds={5}
      paused={props.paused}
      label="Klar"
      onDone={() => setPhase('hold')}
      end="go"
      size="medium"
      onClock={(clock) => props.onPart?.(0, clock)}
    />
  ) : (
    <Countdown
      key="hold"
      seconds={props.seconds}
      paused={props.paused}
      label="Hold"
      half
      onDone={props.onDone}
      end="slut"
      size="medium"
      onClock={(clock) => props.onPart?.(1, clock)}
    />
  );
}

/** A warm-up item: its figure, cues and clock, »Næste« and »Videre«. */
function WarmupItem(props: {
  id: string;
  name: string;
  kicker: string;
  execution: string;
  seconds: number;
  context: CardContext;
  paused: boolean;
  onDone: () => void;
  onCard: () => void;
  powerName?: string;
  next: Upcoming | null;
}) {
  const cues = useCues(props.id, props.context);
  return (
    <div class="stack now">
      <NowHead kicker={props.kicker} name={props.name} onCard={props.onCard} />
      <div class="now-stage step-enter">
        <div class="now-figure">
          <ExerciseFigure
            cardId={props.id}
            pictoId={null}
            name={props.name}
            context={props.context}
            size="now"
          />
        </div>
        <Countdown
          seconds={props.seconds}
          paused={props.paused}
          onDone={props.onDone}
          end="go"
          size="medium"
        />
      </div>
      <NowCues cues={cues} />
      <p class="cue">{props.execution}</p>
      {props.powerName && <p class="hint">Dagens første power-øvelse: {props.powerName}</p>}
      <div class="fixed-actions">
        <NextStrip next={props.next} context={props.context} />
        <button type="button" class="btn block" onClick={props.onDone}>
          Videre
        </button>
      </div>
    </div>
  );
}

/** A timed exercise's »Nu«: the figure beside the clock, the cues and »Sådan gør du«. */
function TimedNow(props: {
  cardId: string;
  name: string;
  kicker: ComponentChildren;
  phases: Phase[];
  follow: Follow;
  paused: boolean;
  onDone: () => void;
  onPart: (index: number, clock: Clock) => void;
  onCard: (id: string) => void;
  next: ComponentChildren;
  /** Before the clock (the club sequence's set, the EMOM's dose). */
  children?: ComponentChildren;
  /** Under »Næste«: the neck's »Stop«. */
  actions?: ComponentChildren;
  startSound?: Phase['sound'];
  movementIndex?: number;
}) {
  const cues = useCues(props.cardId);
  return (
    <div class="stack now">
      <NowHead kicker={props.kicker} name={props.name} onCard={() => props.onCard(props.cardId)} />
      {props.children}
      <PhaseRunner
        phases={props.phases}
        paused={props.paused}
        onDone={props.onDone}
        startSound={props.startSound}
        onPart={props.onPart}
        beside={
          <ExerciseFigure
            cardId={props.cardId}
            pictoId={props.cardId}
            name={props.name}
            size="now"
            follow={props.follow}
            movementIndex={props.movementIndex}
          />
        }
      />
      <NowCues cues={cues} />
      <div class="fixed-actions">
        {props.next}
        {props.actions}
      </div>
    </div>
  );
}

/**
 * The EMOM: before it starts, its intro (the animation and the steps, D44) with »Start EMOM«; then
 * the minutes with the figure following each minute's burpees.
 */
function EmomStep(props: {
  block: BlockPlan;
  /** The EMOM begins its part of the session: its number over the intro (D59). */
  part: PartStart | null;
  paused: boolean;
  next: ComponentChildren;
  onDone: () => void;
  onCard: (stepId: string) => void;
}) {
  const [started, setStarted] = useState(false);
  const emom = props.block.emom;
  const clock = usePartClock();
  const { phases, parts } = useMemo(() => emomClock(props.block), [props.block]);
  if (!emom) return null;
  const step = getStep(PROGRAM, emom.stepId);
  if (!started) {
    return (
      <div class="stack">
        <section class="intro-card" aria-label="Introkort" data-testid="intro">
          <IntroBody
            label={
              props.part
                ? `Del ${props.part.at} · ${props.part.label} · EMOM ${step.key}`
                : `Burpees · EMOM ${step.key}`
            }
            next={{
              cardId: emom.stepId,
              pictoId: emom.stepId,
              title: `${emom.minutes} × ${emom.reps} burpees`,
              line: 'Start et nyt sæt i starten af hvert minut. Resten af minuttet er pause.',
            }}
            context={null}
          />
        </section>
        <HowButton onClick={() => props.onCard(emom.stepId)} />
        <div class="fixed-actions">
          {props.next}
          <button
            type="button"
            class="btn primary block"
            onClick={() => {
              void enableAudio();
              setStarted(true);
            }}
          >
            Start EMOM
          </button>
        </div>
      </div>
    );
  }
  return (
    <TimedNow
      cardId={emom.stepId}
      name={`${emom.minutes} × ${emom.reps} burpees`}
      kicker={`Burpees · EMOM ${step.key}`}
      phases={phases}
      follow={clock.follow(parts, { kind: 'emom', reps: emom.reps })}
      paused={props.paused}
      onDone={props.onDone}
      onPart={clock.set}
      onCard={props.onCard}
      next={props.next}
      startSound="minut"
    />
  );
}

/** The club sequence: the round's five timed parts from the data, once per round. */
function ClubStep(props: {
  block: BlockPlan;
  set: number;
  paused: boolean;
  next: ComponentChildren;
  onDone: () => void;
  onCard: (stepId: string) => void;
}) {
  const clock = usePartClock();
  const { phases, parts } = useMemo(() => clubClock(props.block), [props.block]);
  const step = getStep(PROGRAM, props.block.stepId);
  const perRound = step.round?.length ?? 1;
  return (
    <TimedNow
      cardId={props.block.stepId}
      name={step.name}
      kicker={`Klubsekvensen · trin ${step.key} · sæt ${props.set} af ${props.block.sets}`}
      phases={phases}
      follow={clock.follow(parts, { kind: 'rounds', perRound })}
      paused={props.paused}
      onDone={props.onDone}
      onPart={clock.set}
      onCard={props.onCard}
      next={props.next}
    />
  );
}

/** A round of wall sit W3/W5 as the timed parts in the data (P49). */
function RoundStep(props: {
  block: BlockPlan;
  round: number;
  paused: boolean;
  next: ComponentChildren;
  onDone: () => void;
  onCard: (stepId: string) => void;
}) {
  const clock = usePartClock();
  const { phases, parts } = useMemo(() => roundClock(props.block), [props.block]);
  const step = getStep(PROGRAM, props.block.stepId);
  return (
    <TimedNow
      cardId={props.block.stepId}
      name={step.name}
      kicker={`${trackName(props.block.trackId)} · trin ${step.key} · runde ${props.round} af ${props.block.rounds ?? 1}`}
      phases={phases}
      follow={clock.follow(parts, { kind: 'rounds', perRound: Math.max(1, parts.length - 1) })}
      paused={props.paused}
      onDone={props.onDone}
      onPart={clock.set}
      onCard={props.onCard}
      next={props.next}
    >
      <p class="cue">{step.execution}</p>
    </TimedNow>
  );
}

function NeckStep(props: {
  block: BlockPlan;
  paused: boolean;
  next: ComponentChildren;
  onDone: () => void;
  onCard: (stepId: string) => void;
  onStop: () => void | Promise<void>;
}) {
  const step = getStep(PROGRAM, props.block.stepId);
  const clock = usePartClock();
  const neck = useMemo(() => neckClock(props.block), [props.block]);
  // The figure shows the direction the hold in hand (or the next) goes in (N3–N6).
  const [direction, setDirection] = useState(0);
  return (
    <TimedNow
      cardId={props.block.stepId}
      name={step.name}
      kicker={`Nakke · trin ${step.key}`}
      phases={neck.phases}
      follow={clock.follow(neck.parts, { kind: 'hold' })}
      paused={props.paused}
      onDone={props.onDone}
      onPart={(index, c) => {
        clock.set(index, c);
        setDirection(neck.direction(index));
      }}
      onCard={props.onCard}
      next={props.next}
      movementIndex={direction}
      actions={
        <button type="button" class="btn block" onClick={() => void props.onStop()}>
          Stop: snurren, svimmelhed eller smerte ud i armen
        </button>
      }
    >
      <p class="cue">{step.execution}</p>
    </TimedNow>
  );
}

/** »10 min«, »45 sek«. */
function minutesText(seconds: number): string {
  if (seconds <= 0) return 'Til du trykker videre';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} sek`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} sek`;
}

/** The motor: its phases as one clock; »Næste« is the next phase, then the measurement. */
function MotorStep(props: {
  plan: SessionPlan;
  paused: boolean;
  onDone: () => void;
  onPhase: (index: number) => void;
  /** What comes after the phases: the measurement, or the summary. */
  after: string | null;
}) {
  const motor = props.plan.motor;
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  if (!motor) return null;
  const phases: Phase[] = motor.phases.map((p) => ({ label: p.label, seconds: p.seconds }));
  const following = motor.phases[index + 1];
  const next: Upcoming = following
    ? { cardId: null, pictoId: null, title: following.label, line: minutesText(following.seconds) }
    : props.after
      ? { cardId: null, pictoId: null, title: props.after, line: 'Distancen i meter' }
      : SUMMARY_NEXT;
  return (
    <div class="stack now">
      <NowHead kicker="Motor" name={motor.title} />
      {props.plan.calmBase && <p class="hint">Rolig base i dag.</p>}
      {!started ? (
        <div class="fixed-actions">
          <NextStrip
            next={{
              cardId: null,
              pictoId: null,
              title: motor.phases[0]?.label ?? '',
              line: minutesText(motor.phases[0]?.seconds ?? 0),
            }}
          />
          <button
            type="button"
            class="btn primary block"
            onClick={() => {
              void enableAudio();
              setStarted(true);
            }}
          >
            Start uret
          </button>
        </div>
      ) : (
        <>
          <PhaseRunner
            phases={phases}
            paused={props.paused}
            onDone={props.onDone}
            showNext={false}
            onPart={(i) => {
              if (i !== index) {
                setIndex(i);
                props.onPhase(i);
              }
            }}
          />
          <div class="fixed-actions">
            <NextStrip next={next} />
          </div>
        </>
      )}
    </div>
  );
}
