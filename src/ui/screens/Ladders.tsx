// Stiger (docs/SPEC.md 3.5): the ten ladders and three power tracks with your step, its level and
// the distance to the next step; a ladder opens with all steps and »Vælg selv et andet trin«, and a
// tap on a step opens its exercise card (3.8). Below them »Øvrige« (DECISIONS.md D47): the other
// tracks, the warm-up, Open & Strong and the measurements, so every card opens outside a session.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import {
  chooseStep,
  formatDay,
  formatDose,
  getStep,
  getTrack,
  nextStep,
  PROGRAM,
  ruleOf,
  workRange,
} from '../../engine/index.ts';
import { MEASURES } from '../../content/types.ts';
import type { Level, Track, TrackState } from '../../engine/types.ts';
import { ExerciseCard, useCard } from '../card.tsx';
import { Picto, pictoUrl } from '../components/Picto.tsx';
import type { Model } from '../model.ts';
import { LevelBadge } from './ProgramPage.tsx';

const LIST = PROGRAM.tracks.filter((t) => t.category === 'ladder' || t.category === 'power');
/** »Øvrige«: the tracks that are neither ladders nor power tracks, in the programme's order. */
const OTHER_TRACKS = PROGRAM.tracks.filter((t) => t.category === 'extra');

export function distanceText(track: Track, t: TrackState, pendingUp: boolean): string {
  const step = getStep(PROGRAM, t.stepId);
  if (t.tempDown) {
    return t.tempDown.lighter
      ? `Lettere variant til ${formatDay(t.tempDown.until)} (smerte)`
      : `Midlertidigt trin til ${formatDay(t.tempDown.until)} (smerte)`;
  }
  const next = nextStep(PROGRAM, t.stepId);
  const rule = ruleOf(track, step);
  if (rule === 'emom')
    return pendingUp
      ? 'Rykker et trin op ved næste EMOM-pas'
      : 'Næste trin, når alle minutter er rene med 20 sek pause sidst';
  const left = Math.max(0, 2 - t.hits);
  if (!next) return 'Toptrin';
  if (rule === 'rounds') return left === 1 ? '1 rent pas mere' : `${left} rene pas mere`;
  if (rule === 'neck') return `${left} pas mere, der føles let${left === 1 ? '' : 'e'}`;
  const range = workRange(step.dose);
  if (!range) return '';
  const unit = range.unit === 'sec' ? ' sek' : '';
  // SPEC 3.5: what it takes to move up, also while the working number is still climbing (D10).
  if (t.target < range.max) {
    const then =
      rule === 'power'
        ? `derefter 2 pas med alle sæt på ${range.max} og lige høje reps`
        : `derefter 2 pas med alle sæt på ${range.max}${unit} og 2 i reserve`;
    return `Arbejdstal ${t.target}${unit} af ${range.max}${unit} · ${then}`;
  }
  if (rule === 'power') return `${left} pas mere med alle sæt på ${range.max} og lige høje reps`;
  return `${left} pas mere med alle sæt på ${range.max}${unit} og 2 i reserve`;
}

export function Ladders({ model }: { model: Model }) {
  const [open, setOpen] = useState<string | null>(null);
  const card = useCard();
  if (!open) return <LadderList model={model} onOpen={setOpen} />;
  const detail = {
    model,
    onBack: () => setOpen(null),
    onCard: card.open,
    hidden: card.id !== null,
  };
  return (
    <>
      {LIST.some((t) => t.id === open) ? (
        <LadderDetail {...detail} trackId={open} />
      ) : (
        <OtherDetail {...detail} id={open} />
      )}
      {card.id !== null && <ExerciseCard id={card.id} back="Tilbage" onClose={card.close} />}
    </>
  );
}

function LadderList({ model, onOpen }: { model: Model; onOpen: (trackId: string) => void }) {
  const state = model.state;
  return (
    <div class="screen ladders" data-testid="ladders">
      <h1>Stiger</h1>
      <ul class="ladder-list">
        {LIST.map((track) => {
          const t = state.tracks[track.id];
          if (!t) return null;
          const step = getStep(PROGRAM, t.stepId);
          return (
            <li key={track.id}>
              <button type="button" class="ladder-row" onClick={() => onOpen(track.id)}>
                <Picto stepId={t.stepId} small />
                <span class="ladder-text">
                  <span class="ladder-name">
                    {track.short} · <span class="ladder-step-no">trin {step.key}</span>{' '}
                    <LevelBadge level={step.level} />
                  </span>
                  <span class="ladder-step">{step.name}</span>
                  <span class="ladder-distance">
                    {distanceText(track, t, state.emom.pendingUp)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <h2 class="other-heading">Øvrige</h2>
      <ul class="other-list">
        {OTHER_TRACKS.map((track) => {
          const t = state.tracks[track.id];
          if (!t) return null;
          const step = getStep(PROGRAM, t.stepId);
          return (
            <li key={track.id}>
              <OtherRow
                picto={t.stepId}
                name={track.short}
                step={step.key}
                text={step.name}
                onClick={() => onOpen(track.id)}
              />
            </li>
          );
        })}
        {PROGRAM.routines.map((routine) => (
          <li key={routine.id}>
            <OtherRow
              picto={`${routine.id}.${routine.items[0]?.key ?? ''}`}
              name={routine.name}
              text={`${routine.items.length} punkter · ${routine.minutes} min`}
              onClick={() => onOpen(routine.id)}
            />
          </li>
        ))}
        <li>
          <OtherRow
            picto={null}
            name="Målinger"
            text={`${PROGRAM.measures.length} målinger`}
            onClick={() => onOpen(MEASURES)}
          />
        </li>
      </ul>
    </div>
  );
}

/** A row under »Øvrige«; without a pictogram the text takes the whole row (no generic icon). */
function OtherRow(props: {
  picto: string | null;
  name: string;
  /** The step you are on, in red after the name (»Nakke · trin N1«). */
  step?: string;
  text: string;
  onClick: () => void;
}) {
  const picto = props.picto !== null && pictoUrl(props.picto) !== null ? props.picto : null;
  return (
    <button
      type="button"
      class={picto ? 'other-row' : 'other-row no-picto'}
      onClick={props.onClick}
    >
      {picto && <Picto stepId={picto} small />}
      <span class="ladder-text">
        <span class="ladder-name">
          {props.name}
          {props.step && (
            <>
              {' · '}
              <span class="ladder-step-no">trin {props.step}</span>
            </>
          )}
        </span>
        <span class="ladder-step">{props.text}</span>
      </span>
    </button>
  );
}

/**
 * A step, routine item or measurement in a list: a button that opens its card (SPEC 3.5), with
 * »Sådan gør du« as its cue, and under it what the list adds (»Dit trin«, »Vælg selv dette trin«).
 */
function StepRow(props: {
  id: string;
  title: string;
  level?: Level;
  dose: string;
  text: string;
  mine: boolean;
  onOpen: () => void;
  children?: ComponentChildren;
}) {
  const drawn = pictoUrl(props.id) !== null;
  return (
    <li class={props.mine ? 'prog-step step-row mine' : 'prog-step step-row'}>
      <button
        type="button"
        class={drawn ? 'step-open' : 'step-open no-picto'}
        onClick={props.onOpen}
      >
        {drawn && <Picto stepId={props.id} small />}
        <span class="step-open-text">
          <span class="prog-step-head">
            <strong>{props.title}</strong> <LevelBadge level={props.level} />
          </span>
          {props.dose && <span class="prog-dose">{props.dose}</span>}
          <span>{props.text}</span>
          <span class="step-open-how">Sådan gør du</span>
        </span>
      </button>
      {props.children && <div class="step-row-choice">{props.children}</div>}
    </li>
  );
}

interface DetailProps {
  model: Model;
  onBack: () => void;
  /** Opens a step's exercise card (SPEC 3.5: a tap on a step). */
  onCard: (id: string) => void;
  /** The card is open in its place; the list keeps its state under it. */
  hidden: boolean;
}

/** »Øvrige«: a track's steps, a routine's items or the measurements, each opening its card. */
function OtherDetail({ model, id, onBack, onCard, hidden }: DetailProps & { id: string }) {
  const track = OTHER_TRACKS.find((t) => t.id === id);
  const routine = PROGRAM.routines.find((r) => r.id === id);
  const mineId = model.state.tracks[id]?.stepId;
  const title = track?.name ?? routine?.name ?? 'Målinger';
  const rows: Array<{ id: string; title: string; level?: Level; dose: string; text: string }> =
    track
      ? track.steps.map((s) => ({
          id: s.id,
          title: `${s.key}. ${s.name}`,
          level: s.level,
          dose: formatDose(s.dose),
          text: s.execution,
        }))
      : routine
        ? routine.items.map((i) => ({
            id: `${routine.id}.${i.key}`,
            title: `${i.key}. ${i.name}`,
            dose: i.dose,
            text: i.execution,
          }))
        : PROGRAM.measures.map((m) => ({
            id: `${MEASURES}.${m.id}`,
            title: m.name,
            dose: '',
            text: m.how,
          }));
  return (
    <div class="screen other-detail" hidden={hidden}>
      <button type="button" class="btn back" onClick={onBack}>
        Tilbage
      </button>
      <h1>{title}</h1>
      <ol class="prog-steps">
        {rows.map((row) => (
          <StepRow key={row.id} {...row} mine={row.id === mineId} onOpen={() => onCard(row.id)}>
            {row.id === mineId && <p class="mine-label">Dit trin</p>}
          </StepRow>
        ))}
      </ol>
    </div>
  );
}

function LadderDetail({
  model,
  trackId,
  onBack,
  onCard,
  hidden,
}: DetailProps & { trackId: string }) {
  const track = getTrack(PROGRAM, trackId);
  const t = model.state.tracks[trackId];
  const [pick, setPick] = useState<string | null>(null);
  if (!t) return null;
  const currentIndex = track.steps.findIndex((s) => s.id === t.stepId);
  const choose = async (stepId: string) => {
    const result = chooseStep(model.ctx, model.events, { trackId, stepId, date: model.today });
    await model.commit(result.events);
    setPick(null);
  };
  return (
    <div class="screen ladder-detail" hidden={hidden}>
      <button type="button" class="btn back" onClick={onBack}>
        Tilbage
      </button>
      <h1>{track.name}</h1>
      <p class="ladder-distance">{distanceText(track, t, model.state.emom.pendingUp)}</p>
      <ol class="prog-steps">
        {track.steps.map((step, i) => {
          const mine = step.id === t.stepId;
          const up = i > currentIndex;
          return (
            <StepRow
              key={step.id}
              id={step.id}
              title={`${step.key}. ${step.name}`}
              level={step.level}
              dose={formatDose(step.dose)}
              text={step.execution}
              mine={mine}
              onOpen={() => onCard(step.id)}
            >
              {mine ? (
                <p class="mine-label">
                  Dit trin
                  {track.progression !== 'emom' && workRange(step.dose)
                    ? ` · arbejdstal ${t.target}`
                    : ''}
                </p>
              ) : pick === step.id ? (
                <div class="confirm-inline">
                  {up && !t.warnedUp && (
                    <p class="hint">Det sværeste trin med dårlig form lærer dig dårlig form.</p>
                  )}
                  <div class="row">
                    <button type="button" class="btn" onClick={() => setPick(null)}>
                      Fortryd
                    </button>
                    <button
                      type="button"
                      class="btn primary grow"
                      onClick={() => void choose(step.id)}
                    >
                      Vælg trin {step.key}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" class="btn" onClick={() => setPick(step.id)}>
                  Vælg selv dette trin
                </button>
              )}
            </StepRow>
          );
        })}
      </ol>
    </div>
  );
}
