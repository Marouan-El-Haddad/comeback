// Stiger (docs/SPEC.md 3.5): the ten ladders and three power tracks with your step, its level and
// the distance to the next step; a ladder opens with all steps and »Vælg selv et andet trin«.
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
import type { Track, TrackState } from '../../engine/types.ts';
import { Picto } from '../components/Picto.tsx';
import type { Model } from '../model.ts';
import { LevelBadge } from './ProgramPage.tsx';

const LIST = PROGRAM.tracks.filter((t) => t.category === 'ladder' || t.category === 'power');

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
  if (t.target < range.max) return `Arbejdstal ${t.target}${unit} af ${range.max}${unit}`;
  if (rule === 'power') return `${left} pas mere med alle sæt på ${range.max} og lige høje reps`;
  return `${left} pas mere med alle sæt på ${range.max}${unit} og 2 i reserve`;
}

export function Ladders({ model }: { model: Model }) {
  const [open, setOpen] = useState<string | null>(null);
  const state = model.state;
  if (open) return <LadderDetail model={model} trackId={open} onBack={() => setOpen(null)} />;
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
              <button type="button" class="ladder-row" onClick={() => setOpen(track.id)}>
                <Picto stepId={t.stepId} small />
                <span class="ladder-text">
                  <span class="ladder-name">
                    {track.short} · trin {step.key} <LevelBadge level={step.level} />
                  </span>
                  <span class="ladder-step">{step.name}</span>
                  <span class="muted">{distanceText(track, t, state.emom.pendingUp)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LadderDetail({
  model,
  trackId,
  onBack,
}: {
  model: Model;
  trackId: string;
  onBack: () => void;
}) {
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
    <div class="screen ladder-detail">
      <button type="button" class="btn" onClick={onBack}>
        Tilbage
      </button>
      <h1>{track.name}</h1>
      <p class="muted">{distanceText(track, t, model.state.emom.pendingUp)}</p>
      <ol class="prog-steps">
        {track.steps.map((step, i) => {
          const mine = step.id === t.stepId;
          const up = i > currentIndex;
          return (
            <li key={step.id} class={mine ? 'prog-step mine' : 'prog-step'}>
              <Picto stepId={step.id} small />
              <div>
                <p class="prog-step-head">
                  <strong>
                    {step.key}. {step.name}
                  </strong>{' '}
                  <LevelBadge level={step.level} />
                </p>
                <p class="prog-dose">{formatDose(step.dose)}</p>
                <p>{step.execution}</p>
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
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
