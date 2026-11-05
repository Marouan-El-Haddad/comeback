// After »Afslut passet«: logged against planned, the engine's decisions with their explanation
// (SK5), pain flags and one button (docs/SPEC.md 4.2).
import { formatLong, getStep, getTrack, PROGRAM } from '../../engine/index.ts';
import type { SessionSummary } from '../../engine/types.ts';

const STATUS: Record<string, string> = {
  green: 'Grøn',
  yellow: 'Gul',
  red: 'Rød',
  travel: 'Rejse',
};

export function Summary({
  session,
  onDone,
}: {
  session: SessionSummary | null;
  onDone: () => void;
}) {
  if (!session) {
    return (
      <div class="session">
        <div class="session-body">
          <h1>Passet er gemt</h1>
        </div>
        <div class="session-actions">
          <button type="button" class="btn primary block" onClick={onDone}>
            Færdig
          </button>
        </div>
      </div>
    );
  }
  const name = PROGRAM.sessions.find((s) => s.id === session.kind)?.name ?? session.kind;
  const targetChanges = Object.values(session.evaluations).filter(
    (e) => e.qualifying && e.targetAfter !== e.targetBefore,
  );
  const pains = session.sets.filter((s) => s.pain);
  return (
    <div class="session">
      <div class="session-body">
        <p class="step-kicker">{formatLong(session.date)}</p>
        <h1>
          {name} · {STATUS[session.status ?? session.light] ?? ''}
        </h1>
        {session.status === 'yellow' && <p class="hint">Gult pas tæller som gennemført.</p>}
        {session.aborted && <p class="hint">Passet blev afsluttet før tid. Det loggede er gemt.</p>}

        <section class="stack">
          <h2>Motorens beslutninger</h2>
          {session.decisions.length === 0 && targetChanges.length === 0 && (
            <p>Ingen ændringer i trin efter dette pas.</p>
          )}
          <ul class="decisions" data-testid="decisions">
            {session.decisions.map((d) => (
              <li key={d.explanation}>{d.explanation}</li>
            ))}
            {targetChanges.map((e) => {
              const step = getStep(PROGRAM, e.stepId);
              const unit = step.dose.kind === 'hold' ? 'sek' : 'reps';
              return (
                <li key={`t${e.trackId}`}>
                  {getTrack(PROGRAM, e.trackId).short}: {e.targetAfter} {unit} pr. sæt næste gang.
                </li>
              );
            })}
          </ul>
        </section>

        {pains.length > 0 && (
          <section class="stack">
            <h2>Smerte</h2>
            <ul>
              {pains.map((p, i) => (
                <li key={i}>
                  {getTrack(PROGRAM, p.trackId).short}:{' '}
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
              const step = getStep(PROGRAM, b.stepId);
              const values = sets
                .map((s) => `${s.reps ?? s.seconds ?? 0}${s.side ? s.side : ''}`)
                .join(', ');
              return (
                <li key={b.blockId}>
                  <strong>
                    {getTrack(PROGRAM, b.trackId).short} trin {step.key}
                  </strong>
                  : {values || (result ? 'udført' : 'ikke logget')}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <div class="session-actions">
        <button type="button" class="btn primary block" onClick={onDone} data-testid="done">
          Færdig
        </button>
      </div>
    </div>
  );
}
