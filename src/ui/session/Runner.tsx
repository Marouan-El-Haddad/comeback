// The guided session (docs/SPEC.md 3.2, 3.3, 4.2–4.5): traffic light, warm-up, every set with
// »Som planlagt«, timers, the finisher, neck and the summary with the engine's explanations.
import { useEffect, useMemo, useState } from 'preact/hooks';
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
import type { Light, Pain, Rir, SessionSummary, Side } from '../../engine/types.ts';
import { MEASURES } from '../../content/types.ts';
import { audioState, enableAudio, play } from '../audio.ts';
import { ExerciseCard, HowButton, useCard } from '../card.tsx';
import { Picto } from '../components/Picto.tsx';
import { WhyText } from '../components/Why.tsx';
import { readLocal, useModel, writeLocal } from '../hooks.ts';
import { ulid } from '../ids.ts';
import type { Model } from '../model.ts';
import { requestPersistOnce } from '../persist.ts';
import { keepAwake, onWakeState, releaseAwake, wakeState } from '../wakelock.ts';
import { buildSteps, setCount, type Step } from './steps.ts';
import { Countdown, PhaseRunner, type Phase } from './timers.tsx';
import { MeasureInput } from './MeasureInput.tsx';
import { RUN_KEY, type RunRequest, type RunState } from './resume.ts';
import { Summary } from './Summary.tsx';

/** »Skru op for medielyden« is shown at the first session only (SPEC 5, Lyd). */
const SOUND_KEY = 'comeback.soundNoted';

const WARMUP = PROGRAM.routines.find((r) => r.id === 'warmup');

function trackName(trackId: string): string {
  return getTrack(PROGRAM, trackId).short;
}

function unitWord(block: BlockPlan): string {
  return block.unit === 'sec' ? 'sek' : 'reps';
}

function sideWord(side: Side | undefined, block: BlockPlan): string {
  if (!side) return '';
  if (block.per === 'ben') return side === 'L' ? 'Venstre ben' : 'Højre ben';
  return side === 'L' ? 'Venstre side' : 'Højre side';
}

export function Runner({
  model,
  request,
  onClose,
}: {
  model: Model;
  request: RunRequest;
  onClose: () => void;
}) {
  useModel(model);
  const [run, setRun] = useState<RunState>(() => {
    const saved = readLocal<RunState>(RUN_KEY);
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
      return saved;
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
      phase: 'light',
      answers: defaults.answers,
      red: false,
      preIndex: 0,
      stepIndex: 0,
      sessionId: null,
      intervalsAnyway: false,
      sim: model.sim !== null,
    };
  });
  const [paused, setPaused] = useState(false);
  // A button that appears after a change of screen cannot be hit by the same clumsy double tap
  // (SPEC 6, design review D1): taps are ignored for half a second.
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    setSettling(true);
    const id = setTimeout(() => setSettling(false), 500);
    return () => clearTimeout(id);
  }, [run.phase, run.preIndex, run.stepIndex]);
  const sessionClass = settling ? 'session settling' : 'session';
  const [firstTime] = useState(() => readLocal<boolean>(SOUND_KEY) !== true);
  const soundNoted = () => writeLocal(true, SOUND_KEY);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [finished, setFinished] = useState<SessionSummary | null>(null);
  // »Sådan gør du« opens the exercise card in place of the session, which keeps running under it
  // (docs/SPEC.md 3.8, DECISIONS.md D43).
  const card = useCard();
  const withCard = (view: preact.JSX.Element) => (
    <>
      {view}
      {card.id !== null && (
        <ExerciseCard
          id={card.id}
          back="Tilbage til passet"
          onClose={card.close}
          context={card.context}
        />
      )}
    </>
  );

  useEffect(() => {
    writeLocal(run, RUN_KEY);
  }, [run]);
  useEffect(() => {
    void keepAwake();
    return () => releaseAwake();
  }, []);

  const state = model.state;
  const light: Light = run.red ? 'red' : lightFor(run.answers);
  const session = run.sessionId
    ? state.sessions.find((s) => s.sessionId === run.sessionId)
    : undefined;

  const plan: SessionPlan = useMemo(() => {
    const resolved = resolvePlan(PROGRAM, state, {
      date: run.date,
      kind: run.kind,
      light,
      short: run.short,
      calmBase: run.calmBase,
      intervalsAnyway: run.intervalsAnyway,
    });
    if (!session) return resolved;
    // The session runs exactly as it was planned when it started (P26).
    const blocks = resolved.blocks.map((b) => {
      const ref = session.blocks.find((r) => r.blockId === b.blockId);
      return ref
        ? { ...b, stepId: ref.stepId, sets: ref.sets, target: ref.target, rirPlan: ref.rirPlan }
        : b;
    });
    return { ...resolved, blocks };
  }, [state, run.date, run.kind, light, run.short, run.calmBase, run.intervalsAnyway, session]);

  const steps = useMemo(() => buildSteps(plan), [plan]);

  // Resumed from the log alone (stepIndex -1): the first set, result or measurement not logged.
  useEffect(() => {
    if (run.phase !== 'run' || run.stepIndex >= 0 || !session) return;
    const done = (step: Step): boolean => {
      switch (step.type) {
        case 'set':
          return session.sets.some(
            (s) =>
              s.blockId === step.block.blockId &&
              s.setIndex === step.setIndex &&
              s.side === step.side,
          );
        case 'power-q':
        case 'emom-q':
        case 'club-q':
        case 'neck-q':
        case 'rounds-q':
          return session.results.some((r) => r.blockId === step.block.blockId);
        case 'emom':
        case 'club':
        case 'neck':
        case 'round':
          return session.results.some((r) => r.blockId === step.block.blockId);
        default:
          return false;
      }
    };
    let index = steps.findIndex((step) => step.type !== 'rest' && !done(step));
    if (index < 0) index = steps.length - 1;
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
    setPaused(false);
    setRun((r) => {
      let next = r.stepIndex + 1;
      while (skip(steps[next])) next++;
      return { ...r, stepIndex: Math.min(next, steps.length - 1) };
    });
  };

  const ctx = model.ctx;
  const day = planFor(PROGRAM, state, run.date);

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
      writeLocal(null, RUN_KEY);
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
    writeLocal(null, RUN_KEY);
    onClose();
  };

  if (run.phase === 'summary') {
    return <Summary session={finished} onDone={close} />;
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
      <div class={sessionClass} hidden={card.id !== null}>
        <SessionHeader title={plan.name} onClose={close} />
        <div class="session-body">
          <h1>Før du starter – 10 sekunder</h1>
          {firstTime && (
            <p class="hint">Skru op for medielyden: lyden er dit signal i hold og pauser.</p>
          )}
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
                  setRun((r) => ({ ...r, intervalsAnyway: (e.target as HTMLInputElement).checked }))
                }
              />{' '}
              Kør intervallerne alligevel
            </label>
          )}
          {!motor && <p class="muted">Spørgsmål 3 kommer efter opvarmningen.</p>}
        </div>
        <div class="session-actions">
          <button
            type="button"
            class="btn block red-outline"
            onClick={() => {
              void enableAudio();
              void begin(true);
            }}
          >
            Rød: syg, feber, skarp smerte eller under 4 timers søvn
          </button>
          <button
            type="button"
            class={now === 'green' ? 'btn primary block' : 'btn primary block yellow'}
            onClick={() => {
              void enableAudio();
              soundNoted();
              if (motor) void begin(false);
              else setRun((r) => ({ ...r, phase: 'pre', preIndex: 0 }));
            }}
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
    const wallTest = plan.blocks.find((b) => b.measureId === 'wall_test');
    const measureFirst = wallTest && light === 'green' ? [wallTest] : [];
    const items = WARMUP?.items ?? [];
    const index = run.preIndex;
    const nextPre = () => setRun((r) => ({ ...r, preIndex: r.preIndex + 1 }));
    if (index < measureFirst.length && measureFirst[0]) {
      const block = measureFirst[0];
      return withCard(
        <div class={sessionClass} hidden={card.id !== null}>
          <SessionHeader
            title="Måling før opvarmning"
            paused={paused}
            onPause={() => setPaused(!paused)}
            onClose={close}
          />
          <div class="session-body">
            <MeasureInput
              measureId={block.measureId ?? ''}
              state={state}
              onCard={() => card.open(`${MEASURES}.${block.measureId ?? ''}`)}
              onSave={async (value) => {
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
              }}
              onSkip={nextPre}
            />
          </div>
        </div>,
      );
    }
    const itemIndex = index - measureFirst.length;
    const item = items[itemIndex];
    if (item) {
      const power = plan.blocks.find((b) => b.role === 'power');
      return withCard(
        <div class={sessionClass} hidden={card.id !== null}>
          <SessionHeader
            title={`Opvarmning · ${itemIndex + 1}/${items.length}`}
            paused={paused}
            onPause={() => setPaused(!paused)}
            onClose={close}
          />
          <div class="session-body">
            <p class="step-kicker">{item.dose}</p>
            <h1>{item.name}</h1>
            <p class="cue">{item.execution}</p>
            <HowButton
              onClick={() =>
                card.open(`${WARMUP?.id ?? 'warmup'}.${item.key}`, {
                  session: run.kind,
                  power: power?.stepId ?? null,
                })
              }
            />
            {item.key === '4' && power && (
              <p class="hint">Dagens første power-øvelse: {getStep(PROGRAM, power.stepId).name}</p>
            )}
            <Countdown
              key={`w${itemIndex}`}
              seconds={item.seconds}
              paused={paused}
              onDone={nextPre}
              end="go"
            />
            <button type="button" class="btn block" onClick={nextPre}>
              Videre
            </button>
          </div>
        </div>,
      );
    }
    // Question 3 after warm-up step 4; then the session starts (session_started).
    const q1q2Yellow = !run.answers[0] || !run.answers[1];
    // The warm-up's last timer can end while a card is open: the card stays until it is closed.
    return withCard(
      <div class={sessionClass} hidden={card.id !== null}>
        <SessionHeader title="Trafiklys" onClose={close} />
        <div class="session-body">
          <h1>Spørgsmål 3</h1>
          <YesNo
            label="Opvarmning og første hop normale?"
            value={run.answers[2]}
            onChange={(v) => setRun((r) => ({ ...r, answers: [r.answers[0], r.answers[1], v] }))}
          />
          {q1q2Yellow && <p class="hint">Et nej i spørgsmål 1 eller 2 giver en gul dag.</p>}
        </div>
        <div class="session-actions">
          <button type="button" class="btn block red-outline" onClick={() => void begin(true)}>
            Rød: syg, feber, skarp smerte eller under 4 timers søvn
          </button>
          <button
            type="button"
            class={light === 'green' ? 'btn primary block' : 'btn primary block yellow'}
            onClick={() => void begin(false)}
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
  if (!step || !run.sessionId || !session) return null;
  const sessionId = run.sessionId;
  const date = run.date;
  const groupSets = steps.filter((s) => s.group === step.group && s.type === 'set');
  const current =
    step.type === 'rest'
      ? steps.slice(run.stepIndex).find((s) => s.type === 'set' && s.group === step.group)
      : step;
  const position = current ? groupSets.indexOf(current) + 1 : 0;

  const header = (
    <SessionHeader
      title={
        step.group
          ? `${step.group}${position > 0 ? ` · sæt ${position}/${groupSets.length}` : ''}`
          : plan.name
      }
      paused={paused}
      onPause={() => setPaused(!paused)}
      onClose={() => setConfirmEnd(true)}
    />
  );
  const endBar = confirmEnd && (
    <div class="confirm" role="alertdialog" aria-label="Afslut passet">
      <p>Afslut passet? Det, du har logget, gemmes.</p>
      <div class="row">
        <button type="button" class="btn" onClick={() => setConfirmEnd(false)}>
          Fortsæt
        </button>
        <button type="button" class="btn primary" onClick={() => void finish(true)}>
          Afslut
        </button>
      </div>
    </div>
  );

  const logResult = async (
    block: BlockPlan,
    result: Parameters<typeof logBlockResult>[1]['result'],
  ) => {
    await model.commit([logBlockResult(ctx, { sessionId, date, block, result })]);
    advance();
  };

  let body: preact.ComponentChildren = null;
  switch (step.type) {
    case 'set':
      if (step.measure && step.block.measureId) {
        const measureId = step.block.measureId;
        body = (
          <MeasureInput
            key={`m-${step.block.blockId}`}
            measureId={measureId}
            state={state}
            firstSetOf={`${trackName(step.block.trackId)} · ${getStep(PROGRAM, step.block.stepId).name}`}
            onCard={() => card.open(`${MEASURES}.${measureId}`)}
            onSave={async (value) => {
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
            }}
            onSkip={advance}
          />
        );
        break;
      }
      body = (
        <SetStep
          key={`${step.block.blockId}-${step.setIndex}-${step.side ?? ''}`}
          step={step}
          paused={paused}
          onCard={card.open}
          onLog={async (value, rir, pain) => {
            const measureId = step.measure ? step.block.measureId : undefined;
            const events = [
              logSet(ctx, {
                sessionId,
                date,
                block: step.block,
                setIndex: step.setIndex,
                side: step.side,
                value,
                rir,
                pain,
                measureId,
              }),
            ];
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
          }}
        />
      );
      break;
    case 'rest': {
      const next = steps
        .slice(run.stepIndex + 1)
        .find((s) => s.type === 'set' && !ended.has(s.block.blockId));
      body = (
        <div class="rest">
          <p class="step-kicker">Pause</p>
          <Countdown
            key={`r${run.stepIndex}`}
            seconds={step.seconds}
            paused={paused}
            onDone={advance}
            end="go"
          />
          {next?.type === 'set' && (
            <div class="next-up card panel">
              <p class="muted">Næste</p>
              <p class="next-title">
                {trackName(next.block.trackId)} · {getStep(PROGRAM, next.block.stepId).name}
              </p>
              <p>
                Sæt {next.setIndex} af {setCount(next.block)}
                {next.side ? ` · ${sideWord(next.side, next.block)}` : ''} ·{' '}
                {next.measure ? 'måling: max' : `mål ${next.block.target} ${unitWord(next.block)}`}
              </p>
              <HowButton onClick={() => card.open(next.block.stepId)} />
            </div>
          )}
          <div class="fixed-actions">
            <button type="button" class="btn block" onClick={advance}>
              Spring pausen over
            </button>
          </div>
        </div>
      );
      break;
    }
    case 'power-q':
      body = (
        <Question
          title={trackName(step.block.trackId)}
          question="Alle hop/reps lige høje og hurtige?"
          onAnswer={(yes) => void logResult(step.block, { quality: yes })}
        />
      );
      break;
    case 'emom':
      body = (
        <EmomStep
          key={`emom${run.stepIndex}`}
          block={step.block}
          paused={paused}
          onDone={advance}
          onCard={card.open}
        />
      );
      break;
    case 'emom-q':
      body = (
        <EmomQuestions onSave={(clean, rest20) => void logResult(step.block, { clean, rest20 })} />
      );
      break;
    case 'club':
      body = (
        <ClubStep
          key={`club${step.set}`}
          block={step.block}
          set={step.set}
          paused={paused}
          onDone={advance}
          onCard={card.open}
        />
      );
      break;
    case 'round':
      body = (
        <RoundStep
          key={`round-${step.block.blockId}-${step.round}`}
          block={step.block}
          round={step.round}
          paused={paused}
          onDone={advance}
          onCard={card.open}
        />
      );
      break;
    case 'rounds-q':
      body = (
        <Question
          title={getStep(PROGRAM, step.block.stepId).name}
          question="Rene runder?"
          onAnswer={(yes) => void logResult(step.block, { clean: yes })}
        />
      );
      break;
    case 'club-q':
      body = (
        <Question
          title="Klubsekvensen"
          question="Ren runde?"
          onAnswer={(yes) => void logResult(step.block, { clean: yes })}
        />
      );
      break;
    case 'neck':
      body = (
        <NeckStep
          key="neck"
          block={step.block}
          paused={paused}
          onDone={advance}
          onCard={card.open}
          onStop={async () => {
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
          }}
        />
      );
      break;
    case 'neck-q':
      body = <Feel onAnswer={(feel) => void logResult(step.block, { feel })} />;
      break;
    case 'measure':
      body = (
        <MeasureInput
          measureId={step.block.measureId ?? ''}
          state={state}
          onCard={() => card.open(`${MEASURES}.${step.block.measureId ?? ''}`)}
          onSave={async (value) => {
            await model.commit([
              ctx.make(
                {
                  type: 'measurement_logged',
                  measureId: step.block.measureId ?? '',
                  value,
                  programWeek: session.pw,
                  round: session.round,
                },
                date,
              ),
            ]);
            advance();
          }}
          onSkip={advance}
        />
      );
      break;
    case 'motor':
      body = <MotorStep plan={plan} paused={paused} onDone={advance} />;
      break;
    case 'distance':
      body = (
        <MeasureInput
          measureId={plan.motor?.measureId ?? 'base_check'}
          state={state}
          onCard={() => card.open(`${MEASURES}.${plan.motor?.measureId ?? 'base_check'}`)}
          onSave={async (value) => {
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
          }}
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

  const actions =
    step.type === 'walk' ? (
      <div class="session-actions">
        <button type="button" class="btn primary block" onClick={() => void finish(false)}>
          Afslut den røde dag
        </button>
      </div>
    ) : step.type === 'finish' ? (
      <div class="session-actions">
        <button
          type="button"
          class="btn primary block"
          onClick={() => void finish(false)}
          data-testid="finish"
        >
          Afslut passet
        </button>
      </div>
    ) : null;

  return withCard(
    <div class={sessionClass} hidden={card.id !== null}>
      {header}
      {endBar}
      <DeviceNotices />
      <div class="session-body">{body}</div>
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
  paused?: boolean;
  onPause?: () => void;
  onClose: () => void;
}) {
  return (
    <header class="session-header">
      <p class="session-title">{props.title}</p>
      {props.onPause && (
        <button type="button" class="btn small" onClick={props.onPause} aria-pressed={props.paused}>
          {props.paused ? 'Fortsæt' : 'Hold pause'}
        </button>
      )}
      <button type="button" class="btn small" onClick={props.onClose} aria-label="Afslut passet">
        Afslut
      </button>
    </header>
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

function Question(props: { title: string; question: string; onAnswer: (yes: boolean) => void }) {
  return (
    <div class="stack">
      <p class="step-kicker">{props.title}</p>
      <h1>{props.question}</h1>
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

function Feel({ onAnswer }: { onAnswer: (feel: 'easy' | 'ok' | 'hard') => void }) {
  return (
    <div class="stack">
      <p class="step-kicker">Nakke-stigen</p>
      <h1>Hvordan føltes trinnet?</h1>
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

function EmomQuestions({ onSave }: { onSave: (clean: boolean, rest20: boolean) => void }) {
  const [clean, setClean] = useState<boolean | null>(null);
  const [rest, setRest] = useState<boolean | null>(null);
  return (
    <div class="stack">
      <p class="step-kicker">Burpees</p>
      <YesNo label="Alle minutter rene?" value={clean ?? true} onChange={setClean} />
      <YesNo label="Mindst 20 sek pause i sidste minut?" value={rest ?? true} onChange={setRest} />
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

/** One set: »Som planlagt« in one tap; −/+, reserve and pain adjust it first (SK2). */
function SetStep(props: {
  step: Extract<Step, { type: 'set' }>;
  paused: boolean;
  /** Opens the exercise card of the step (»Sådan gør du«). */
  onCard: (stepId: string) => void;
  onLog: (value: number | undefined, rir: Rir | undefined, pain: Pain | undefined) => Promise<void>;
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

  const submit = async (pain?: Pain) => {
    if (busy) return;
    setBusy(true);
    await props.onLog(
      step.measure ? value : asPlanned && !pain ? undefined : value,
      step.measure ? undefined : asPlanned && !pain ? undefined : rir,
      pain,
    );
  };

  const title = (
    <div class="set-head">
      <p class="step-kicker">
        {getTrack(PROGRAM, block.trackId).short} · Trin {stepData.key}
        {block.tempDown?.lighter ? ' · lettere variant' : ''}
      </p>
      <h1 class="set-name">{stepData.name}</h1>
    </div>
  );
  const info = (
    <div class="set-info">
      <Picto stepId={block.stepId} />
      <div>
        <p class="set-count">
          {step.measure ? 'Måling' : `Sæt ${step.setIndex} af ${setCount(block)}`}
          {step.side ? ` · ${sideWord(step.side, block)}` : ''}
        </p>
        {!step.measure && (
          <p class="muted">
            mål {block.target} {unitWord(block)}
            {power
              ? ''
              : ` · reserve ${block.rirPlan === 3 ? '3' : block.rirPlan === 1 ? '1–2' : '2'}`}
          </p>
        )}
        {block.load ? <p class="muted">Rygsæk: {block.load} kg</p> : null}
        <HowButton onClick={() => props.onCard(block.stepId)} />
      </div>
    </div>
  );
  const cues = (
    <div class="cues">
      {stepData.cues.slice(0, 2).map((c) => (
        <p key={c} class="cue">
          {c}
        </p>
      ))}
      <details class="why">
        <summary>Hvorfor</summary>
        <p>{stepData.execution}</p>
        <WhyText trackId={block.trackId} />
      </details>
    </div>
  );

  if (isHold && !holdDone && !stopped) {
    return (
      <div class="stack">
        {title}
        {info}
        <HoldTimer
          seconds={block.target}
          paused={props.paused}
          onDone={() => {
            setHoldDone(true);
            void props.onLog(undefined, undefined, undefined);
          }}
        />
        {cues}
        <div class="fixed-actions">
          <button type="button" class="btn block" onClick={() => setStopped(true)}>
            Stoppede før tid
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="stack">
      {title}
      {info}
      <div class="big-number" data-testid="target">
        <span class="number">{value}</span>
        <span class="unit">{unitWord(block)}</span>
      </div>
      {cues}
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
        <button
          type="button"
          class="btn primary block"
          disabled={busy}
          onClick={() => void submit()}
          data-testid="as-planned"
        >
          {power
            ? asPlanned
              ? `Som planlagt (${block.target} ${unitWord(block)})`
              : `Log ${value} ${unitWord(block)}`
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
function HoldTimer(props: { seconds: number; paused: boolean; onDone: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'hold'>('ready');
  return phase === 'ready' ? (
    <Countdown
      key="ready"
      seconds={5}
      paused={props.paused}
      label="Klar"
      onDone={() => setPhase('hold')}
      end="go"
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
    />
  );
}

function EmomStep(props: {
  block: BlockPlan;
  paused: boolean;
  onDone: () => void;
  onCard: (stepId: string) => void;
}) {
  const [started, setStarted] = useState(false);
  const emom = props.block.emom;
  if (!emom) return null;
  const phases: Phase[] = [
    { label: 'Klar', seconds: 5 },
    ...Array.from({ length: emom.minutes }, (_, i) => ({
      label: `Minut ${i + 1} af ${emom.minutes}`,
      detail: `${emom.reps} burpees, resten af minuttet er pause`,
      seconds: 60,
      sound: 'minut' as const,
    })),
  ];
  return (
    <div class="stack">
      <p class="step-kicker">Burpees · EMOM {getStep(PROGRAM, emom.stepId).key}</p>
      <h1>
        {emom.minutes} × {emom.reps} burpees
      </h1>
      <HowButton onClick={() => props.onCard(emom.stepId)} />
      {!started ? (
        <>
          <p class="cue">Start et nyt sæt i starten af hvert minut. Resten af minuttet er pause.</p>
          <div class="fixed-actions">
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
        </>
      ) : (
        <PhaseRunner
          phases={phases}
          paused={props.paused}
          onDone={props.onDone}
          startSound="minut"
        />
      )}
    </div>
  );
}

/** The club sequence: the round's five timed parts from the data, once per round. */
function ClubStep(props: {
  block: BlockPlan;
  set: number;
  paused: boolean;
  onDone: () => void;
  onCard: (stepId: string) => void;
}) {
  const rounds = props.block.rounds ?? 1;
  const parts = getStep(PROGRAM, props.block.stepId).round ?? [];
  const phases: Phase[] = [{ label: 'Klar', seconds: 5 }];
  for (let r = 1; r <= rounds; r++) {
    for (const p of parts) {
      phases.push({ label: rounds > 1 ? `Runde ${r}: ${p.label}` : p.label, seconds: p.seconds });
    }
  }
  return (
    <div class="stack">
      <p class="step-kicker">
        Klubsekvensen · trin {getStep(PROGRAM, props.block.stepId).key} · sæt {props.set} af{' '}
        {props.block.sets}
      </p>
      <HowButton onClick={() => props.onCard(props.block.stepId)} />
      <PhaseRunner phases={phases} paused={props.paused} onDone={props.onDone} />
    </div>
  );
}

/** A round of wall sit W3/W5 as the timed parts in the data (P49). */
function RoundStep(props: {
  block: BlockPlan;
  round: number;
  paused: boolean;
  onDone: () => void;
  onCard: (stepId: string) => void;
}) {
  const step = getStep(PROGRAM, props.block.stepId);
  const phases: Phase[] = [
    { label: 'Klar', seconds: 5 },
    ...(step.round ?? []).map((p) => ({ label: p.label, seconds: p.seconds })),
  ];
  return (
    <div class="stack">
      <p class="step-kicker">
        {getTrack(PROGRAM, props.block.trackId).short} · trin {step.key} · runde {props.round} af{' '}
        {props.block.rounds ?? 1}
      </p>
      <h1>{step.name}</h1>
      <p class="cue">{step.execution}</p>
      <HowButton onClick={() => props.onCard(props.block.stepId)} />
      <PhaseRunner phases={phases} paused={props.paused} onDone={props.onDone} />
    </div>
  );
}

function NeckStep(props: {
  block: BlockPlan;
  paused: boolean;
  onDone: () => void;
  onCard: (stepId: string) => void;
  onStop: () => Promise<void>;
}) {
  const step = getStep(PROGRAM, props.block.stepId);
  const directions = props.block.per === 'retning' ? 4 : 1;
  const holds = props.block.unit === 'sec';
  const phases: Phase[] = [{ label: 'Klar', seconds: 5 }];
  for (let s = 1; s <= props.block.sets; s++) {
    for (let d = 1; d <= directions; d++) {
      const where = directions > 1 ? ` · retning ${d} af ${directions}` : '';
      phases.push(
        holds
          ? {
              label: `Sæt ${s}${where}`,
              detail: `Hold ${props.block.target} sek.`,
              seconds: props.block.target,
            }
          : {
              label: `Sæt ${s}${where}`,
              detail: `${props.block.target} langsomme reps.`,
              seconds: 0,
            },
      );
      phases.push({ label: 'Pause', seconds: 10 });
    }
  }
  phases.pop();
  return (
    <div class="stack">
      <p class="step-kicker">Nakke · trin {step.key}</p>
      <h1>{step.name}</h1>
      <p class="cue">{step.execution}</p>
      <HowButton onClick={() => props.onCard(props.block.stepId)} />
      <PhaseRunner phases={phases} paused={props.paused} onDone={props.onDone} />
      <button type="button" class="btn block" onClick={() => void props.onStop()}>
        Stop: snurren, svimmelhed eller smerte ud i armen
      </button>
    </div>
  );
}

function MotorStep(props: { plan: SessionPlan; paused: boolean; onDone: () => void }) {
  const motor = props.plan.motor;
  const [started, setStarted] = useState(false);
  if (!motor) return null;
  const phases: Phase[] = motor.phases.map((p) => ({ label: p.label, seconds: p.seconds }));
  return (
    <div class="stack">
      <p class="step-kicker">Motor</p>
      <h1>{motor.title}</h1>
      {props.plan.calmBase && <p class="hint">Rolig base i dag.</p>}
      {!started ? (
        <div class="fixed-actions">
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
        <PhaseRunner phases={phases} paused={props.paused} onDone={props.onDone} />
      )}
    </div>
  );
}
