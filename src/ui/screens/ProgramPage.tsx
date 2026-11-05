// /program: every ladder and step, the week table, measurements and catalogues straight from
// program/*.json, read-only, for checking the programme (docs/PLAN.md milestone 1). No page
// numbers: the app never refers to the PDF (docs/DECISIONS.md A2, D38).
import { formatDose } from '../../engine/format.ts';
import { PROGRAM } from '../../engine/program.ts';
import type { Level, Track } from '../../engine/types.ts';
import { Picto } from '../components/Picto.tsx';

const LEVEL_NAME: Record<Level, string> = {
  basis: 'Basis',
  staerk: 'Stærk',
  imponerende: 'Imponerende',
  boss: 'Boss',
};

export function LevelBadge({ level }: { level?: Level }) {
  if (!level) return null;
  return <span class={`level level-${level}`}>{LEVEL_NAME[level]}</span>;
}

function TrackSection({ track }: { track: Track }) {
  return (
    <section class="prog-track card" id={track.id}>
      <h2>{track.name}</h2>
      <ol class="prog-steps">
        {track.steps.map((step) => (
          <li key={step.id} class="prog-step">
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
            </div>
          </li>
        ))}
      </ol>
      {track.note && <p class="prog-note">{track.note}</p>}
    </section>
  );
}

export function ProgramPage() {
  const groups: Array<[string, Track[]]> = [
    ['Ti stiger', PROGRAM.tracks.filter((t) => t.category === 'ladder')],
    ['Power og burpees', PROGRAM.tracks.filter((t) => t.category === 'power')],
    ['Øvrige spor', PROGRAM.tracks.filter((t) => t.category === 'extra')],
  ];
  const warmup = PROGRAM.routines.find((r) => r.id === 'warmup');
  const os = PROGRAM.routines.find((r) => r.id === 'os');
  return (
    <main class="prog">
      <header class="prog-top">
        <h1>Programmet</h1>
        <p class="muted">
          Programversion {PROGRAM.programVersion}. Alt herunder kommer direkte fra appens data.
        </p>
        <nav class="prog-index" aria-label="Indhold">
          {groups.flatMap(([, tracks]) =>
            tracks.map((t) => (
              <a key={t.id} href={`#${t.id}`} class="btn">
                {t.short}
              </a>
            )),
          )}
          <a href="#uger" class="btn">
            Uger
          </a>
          <a href="#maalinger" class="btn">
            Målinger
          </a>
          <a href="#hero" class="btn">
            Hero
          </a>
          <a href="#imponer" class="btn">
            Imponer
          </a>
          <a href="#boss" class="btn">
            Boss
          </a>
        </nav>
      </header>

      {groups.map(([title, tracks]) => (
        <div key={title} class="prog-group">
          <h2 class="prog-group-title">{title}</h2>
          {tracks.map((track) => (
            <TrackSection key={track.id} track={track} />
          ))}
        </div>
      ))}

      <section class="card" id="rutiner">
        <h2>{warmup?.name}</h2>
        <ol class="prog-list">
          {warmup?.items.map((i) => (
            <li key={i.key}>
              <strong>
                {i.name} · {i.dose}
              </strong>
              <p>{i.execution}</p>
            </li>
          ))}
        </ol>
        <h2>{os?.name}</h2>
        <ol class="prog-list">
          {os?.items.map((i) => (
            <li key={i.key}>
              <strong>
                {i.name} · {i.dose}
              </strong>
              <p>{i.execution}</p>
            </li>
          ))}
        </ol>
      </section>

      <section class="card" id="uger">
        <h2>12 uger</h2>
        <div class="prog-weeks">
          {PROGRAM.weeks.map((w) => (
            <div key={w.pw} class="prog-week">
              <h3>
                Uge {w.pw} · {w.text.from} · {w.text.phase}
              </h3>
              <dl>
                <dt>Styrke</dt>
                <dd>{w.text.strength}</dd>
                <dt>Power</dt>
                <dd>{w.text.power}</dd>
                <dt>Motor (tor)</dt>
                <dd>{w.text.motor}</dd>
                <dt>Burpees (tir)</dt>
                <dd>{w.text.burpees}</dd>
                {w.text.note && (
                  <>
                    <dt>Note</dt>
                    <dd>{w.text.note}</dd>
                  </>
                )}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section class="card" id="maalinger">
        <h2>Målinger</h2>
        <ul class="prog-list">
          {PROGRAM.measures.map((m) => (
            <li key={m.id}>
              <strong>{m.name}</strong>
              <p>{m.how}</p>
            </li>
          ))}
        </ul>
        <h2>Målbrættet</h2>
        <table class="prog-table">
          <thead>
            <tr>
              <th>Måling</th>
              <th>Basis</th>
              <th>Stærk</th>
              <th>Imponerende</th>
            </tr>
          </thead>
          <tbody>
            {PROGRAM.board.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.basis}</td>
                <td>{row.staerk}</td>
                <td>{row.imponerende}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section class="card" id="hero">
        <h2>Hero-tavlen ({PROGRAM.heroes.length})</h2>
        <ul class="prog-list">
          {PROGRAM.heroes.map((h) => (
            <li key={h.id}>
              <strong>{h.name}:</strong> {h.ready}
            </li>
          ))}
        </ul>
      </section>

      <section class="card" id="imponer">
        <h2>Imponer-kataloget ({PROGRAM.impress.length})</h2>
        <ul class="prog-list">
          {PROGRAM.impress.map((i) => (
            <li key={i.id}>
              <strong>{i.name}</strong>
              <p>{i.how}</p>
              <p class="muted">Klar når: {i.ready}</p>
            </li>
          ))}
        </ul>
        <h2>Sidegrene ({PROGRAM.sideBranches.length})</h2>
        <ul class="prog-list">
          {PROGRAM.sideBranches.map((s) => (
            <li key={s.id}>
              <strong>{s.name}</strong>
              <p>{s.how}</p>
              <p class="muted">Klar når: {s.ready}</p>
            </li>
          ))}
        </ul>
      </section>

      <section class="card" id="boss">
        <h2>Boss-udfordringer ({PROGRAM.bosses.length})</h2>
        <ul class="prog-list">
          {PROGRAM.bosses.map((b) => (
            <li key={b.id}>
              <strong>{b.name}</strong>
              <p>{b.how}</p>
              <p class="muted">
                Stærk: {b.staerk} · Imponerende: {b.imponerende}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
