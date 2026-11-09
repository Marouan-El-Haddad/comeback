// After »Afslut passet« (and from Historik): logged against planned, what changes next time with
// one explanation each (SK5), pain flags and one button (docs/SPEC.md 4.2, design review D15).
import { formatLong, formatDose, getStep, getTrack, PROGRAM } from '../../engine/index.ts';
import type { LoggedSet, PlannedBlockRef, SessionSummary } from '../../engine/types.ts';

const STATUS: Record<string, string> = {
  green: 'Grøn',
  yellow: 'Gul',
  red: 'Rød',
  travel: 'Rejse',
};

/** »Pres: 7 reps …« with the name first in bold, so the list can be skimmed. */
function Named({ text }: { text: string }) {
  const at = text.indexOf(': ');
  if (at < 0) return <>{text}</>;
  return (
    <>
      <strong>{text.slice(0, at + 1)}</strong>
      {text.slice(at + 1)}
    </>
  );
}

function values(sets: LoggedSet[]): string {
  const value = (s: LoggedSet) => `${s.reps ?? s.seconds ?? 0}`;
  const left = sets.filter((s) => s.side === 'L');
  const right = sets.filter((s) => s.side === 'R');
  if (left.length === 0 && right.length === 0) return sets.map(value).join(', ');
  return `venstre ${left.map(value).join(', ')} · højre ${right.map(value).join(', ')}`;
}

function blockName(ref: PlannedBlockRef): string {
  const track = getTrack(PROGRAM, ref.trackId);
  const step = getStep(PROGRAM, ref.stepId);
  if (track.progression === 'emom') return `Burpees EMOM ${step.key}`;
  return `${track.short} trin ${step.key}`;
}

function planText(ref: PlannedBlockRef): string {
  const step = getStep(PROGRAM, ref.stepId);
  if (step.dose.kind === 'emom' || step.dose.kind === 'rounds') return formatDose(step.dose);
  const unit = step.dose.kind === 'hold' ? ' sek' : '';
  return `${ref.sets} × ${ref.target}${unit}`;
}

export function Summary({
  session,
  onDone,
  doneLabel = 'Færdig',
}: {
  session: SessionSummary | null;
  onDone: () => void;
  doneLabel?: string;
}) {
  if (!session) {
    return (
      <div class="session">
        <div class="session-body with-actions">
          <h1>Passet er gemt</h1>
        </div>
        <div class="session-actions">
          <button type="button" class="btn primary block" onClick={onDone}>
            {doneLabel}
          </button>
        </div>
      </div>
    );
  }
  const name = PROGRAM.sessions.find((s) => s.id === session.kind)?.name ?? session.kind;
  const targetChanges = Object.values(session.evaluations).filter(
    (e) => e.qualifying && e.targetAfter !== e.targetBefore,
  );
  // A set done alternately is logged as both its sides with the same pain (P54): named once.
  const pains = session.sets.filter(
    (s, i, all) =>
      s.pain &&
      all.findIndex(
        (o) => o.blockId === s.blockId && o.setIndex === s.setIndex && o.pain === s.pain,
      ) === i,
  );
  return (
    <div class="session">
      <div class="session-body with-actions">
        <header class="summary-head">
          <p class="step-kicker">{formatLong(session.date)}</p>
          <h1>{name}</h1>
          {/* The traffic light in words, with its colour as an edge (SPEC 6). */}
          <p class={`light-badge ${session.status ?? session.light}`}>
            {STATUS[session.status ?? session.light] ?? ''}
          </p>
        </header>
        {session.status === 'yellow' && <p class="hint">Gult pas tæller som gennemført.</p>}
        {session.aborted && <p class="hint">Passet blev afsluttet før tid. Det loggede er gemt.</p>}

        <section class="stack">
          <h2>Næste gang</h2>
          {session.decisions.length === 0 && targetChanges.length === 0 && (
            <p>Ingen ændringer efter dette pas.</p>
          )}
          <ul class="decisions" data-testid="decisions">
            {session.decisions.map((d) => (
              <li key={d.explanation}>
                <Named text={d.explanation} />
              </li>
            ))}
            {targetChanges.map((e) => {
              const step = getStep(PROGRAM, e.stepId);
              const unit = step.dose.kind === 'hold' ? 'sek' : 'reps';
              return (
                <li key={`t${e.trackId}`}>
                  <strong>{getTrack(PROGRAM, e.trackId).short}:</strong> {e.targetAfter} {unit} pr.
                  sæt næste gang.
                </li>
              );
            })}
          </ul>
        </section>

        {pains.length > 0 && (
          <section class="stack">
            <h2>Smerte</h2>
            <ul class="logged">
              {pains.map((p, i) => (
                <li key={i}>
                  <strong>{getTrack(PROGRAM, p.trackId).short}:</strong>{' '}
                  {p.pain === 'light'
                    ? 'let (≤3)'
                    : p.pain === 'sharp'
                      ? 'skarp eller i et led'
                      : 'stoppet'}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section class="stack">
          <h2>Logget</h2>
          <ul class="logged">
            {session.blocks.map((b) => {
              const sets = session.sets.filter((s) => s.blockId === b.blockId && !s.measureId);
              const result = session.results.find((r) => r.blockId === b.blockId);
              const logged = sets.length > 0 ? values(sets) : result ? 'udført' : 'ikke logget';
              return (
                <li key={b.blockId}>
                  <strong>{blockName(b)}</strong>: {logged} (plan {planText(b)})
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <div class="session-actions">
        <button type="button" class="btn primary block" onClick={onDone} data-testid="done">
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
