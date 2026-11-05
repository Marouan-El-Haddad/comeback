// Historik (docs/SPEC.md 3.6, the list in milestone 2): sessions with date, status and traffic
// light; a tap shows the details (sets, reps, reserve, pain and the engine's explanations).
import { useState } from 'preact/hooks';
import { formatLong, PROGRAM } from '../../engine/index.ts';
import { capitalize } from '../format.ts';
import type { Model } from '../model.ts';
import { Summary } from '../session/Summary.tsx';

const STATUS: Record<string, string> = {
  green: 'grøn',
  yellow: 'gul',
  red: 'rød',
  travel: 'rejse',
};

export function History({ model, onBack }: { model: Model; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const sessions = model.state.sessions
    .filter((s) => s.completed && s.kind !== 'os')
    .slice()
    .reverse();
  const chosen = sessions.find((s) => s.sessionId === open);
  if (chosen) return <Summary session={chosen} onDone={() => setOpen(null)} doneLabel="Tilbage" />;
  return (
    <div class="screen history" data-testid="history">
      <button type="button" class="btn" onClick={onBack}>
        Tilbage
      </button>
      <h1>Historik</h1>
      {sessions.length === 0 && <p>Dit første pas bliver dit nulpunkt.</p>}
      <ul class="ladder-list">
        {sessions.map((s) => (
          <li key={s.sessionId}>
            <button
              type="button"
              class="ladder-row history-row"
              onClick={() => setOpen(s.sessionId)}
            >
              <span class="ladder-text">
                <span class="ladder-name">
                  {capitalize(formatLong(s.date))} ·{' '}
                  {PROGRAM.sessions.find((t) => t.id === s.kind)?.name}
                </span>
                <span class="ladder-distance">
                  {STATUS[s.status ?? s.light] ?? ''}
                  {s.aborted ? ' · afsluttet før tid' : ''}
                  {s.sets.some((x) => x.pain) ? ' · smerte noteret' : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
