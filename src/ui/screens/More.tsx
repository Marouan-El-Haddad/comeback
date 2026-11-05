// Mere (docs/SPEC.md 3.6): Backup (export, import with preview, last backup, persist status) and
// Om (version, programme version, sources, Diagnose – T6 – and the hidden time machine, 3.7).
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  addDays,
  daysBetween,
  exportFile,
  formatDay,
  formatLong,
  mergeEvents,
  parseImport,
  PROGRAM,
  serializeExport,
  type ImportResult,
} from '../../engine/index.ts';
import { estimate, isPersisted } from '../../storage/persist.ts';
import { audioState } from '../audio.ts';
import type { Model } from '../model.ts';
import { swStatus } from '../sw.ts';
import { wakeLockSupported, wakeState } from '../wakelock.ts';

export type MorePage = 'menu' | 'backup' | 'about' | 'diagnose' | 'timemachine';

declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

export function More({
  model,
  page,
  onPage,
}: {
  model: Model;
  page: MorePage;
  onPage: (p: MorePage) => void;
}) {
  if (page === 'backup') return <Backup model={model} onBack={() => onPage('menu')} />;
  if (page === 'about') return <About model={model} onPage={onPage} />;
  if (page === 'diagnose') return <Diagnose onBack={() => onPage('about')} />;
  if (page === 'timemachine') return <TimeMachine model={model} onBack={() => onPage('about')} />;
  return (
    <div class="screen more" data-testid="more">
      <h1>Mere</h1>
      <div class="stack">
        <button type="button" class="btn block" onClick={() => onPage('backup')}>
          Backup
        </button>
        <a class="btn block" href={`${import.meta.env.BASE_URL}program/`}>
          Programmet
        </a>
        <button type="button" class="btn block" onClick={() => onPage('about')}>
          Om
        </button>
      </div>
    </div>
  );
}

function download(text: string, name: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Backup({ model, onBack }: { model: Model; onBack: () => void }) {
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    void isPersisted().then(setPersisted);
  }, []);
  const state = model.state;
  const age = state.lastBackup ? daysBetween(state.lastBackup, model.today) : null;
  const simulated = model.sim !== null;

  const doExport = async () => {
    const text = serializeExport(
      exportFile(model.events, PROGRAM.programVersion, new Date().toISOString()),
    );
    download(text, `comeback-backup-${model.today}.json`);
    await model.commit([model.ctx.make({ type: 'backup_exported' }, model.today)]);
    setMessage(`Backup gemt i Overførsler som comeback-backup-${model.today}.json`);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPreview(parseImport(await file.text()));
    setMessage(null);
  };

  const apply = async (mode: 'replace' | 'merge') => {
    if (!preview?.ok) return;
    const events =
      mode === 'replace' ? preview.file.events : mergeEvents(model.events, preview.file.events);
    await model.replaceAll(events);
    await model.refreshDay();
    setPreview(null);
    setMessage(mode === 'replace' ? 'Data erstattet med backuppen.' : 'Backuppen er flettet ind.');
  };

  return (
    <div class="screen backup" data-testid="backup">
      <button type="button" class="btn" onClick={onBack}>
        Tilbage
      </button>
      <h1>Backup</h1>
      <p>
        Sidste backup:{' '}
        <strong data-testid="last-backup">
          {state.lastBackup ? `${formatDay(state.lastBackup)} (${age} dage siden)` : 'aldrig'}
        </strong>
      </p>
      <p class="muted">
        Varigt lager:{' '}
        {persisted === null
          ? 'ukendt'
          : persisted
            ? 'ja'
            : 'nej – browseren kan slette data ved pladsmangel'}
      </p>
      {simulated ? (
        <p class="hint">Backup og import er slået fra, mens tidsmaskinen kører.</p>
      ) : (
        <>
          <button
            type="button"
            class="btn primary block"
            onClick={() => void doExport()}
            data-testid="export"
          >
            Eksportér backup
          </button>
          <label class="btn block file-button">
            Importér backup
            <input
              type="file"
              accept="application/json,.json"
              data-testid="import-file"
              onChange={(e) => void onFile((e.target as HTMLInputElement).files?.[0])}
            />
          </label>
        </>
      )}
      {message && (
        <p class="hint" role="status">
          {message}
        </p>
      )}
      {preview && !preview.ok && (
        <p class="error-text" role="alert">
          Filen er ikke en Comeback-backup: {preview.reason}
        </p>
      )}
      {preview?.ok && (
        <div class="card panel stack" data-testid="import-preview">
          <h2>Forhåndsvisning</h2>
          <p>
            {preview.preview.count} hændelser
            {preview.preview.from
              ? `, ${formatDay(preview.preview.from)} – ${formatDay(preview.preview.to ?? preview.preview.from)}`
              : ''}
            , programversion {preview.preview.programVersion}
          </p>
          <p class="muted">Før noget ændres, gemmer appen en kopi af dine nuværende data.</p>
          <div class="row">
            <button
              type="button"
              class="btn grow"
              onClick={() => void apply('merge')}
              data-testid="import-merge"
            >
              Flet
            </button>
            <button
              type="button"
              class="btn primary grow"
              onClick={() => void apply('replace')}
              data-testid="import-replace"
            >
              Erstat alt
            </button>
          </div>
          <button type="button" class="btn block" onClick={() => setPreview(null)}>
            Fortryd
          </button>
        </div>
      )}
    </div>
  );
}

function About({ model, onPage }: { model: Model; onPage: (p: MorePage) => void }) {
  const timer = useRef<number | null>(null);
  const press = () => {
    timer.current = window.setTimeout(() => onPage('timemachine'), 2000);
  };
  const release = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  void model;
  return (
    <div class="screen about" data-testid="about">
      <button type="button" class="btn" onClick={() => onPage('menu')}>
        Tilbage
      </button>
      <h1>Om</h1>
      <p
        class="version"
        data-testid="version"
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
      >
        Version {APP_VERSION}
      </p>
      <p>Programversion {PROGRAM.programVersion}</p>
      <p class="muted">
        Comeback – sekundærtræning til Muay Thai. Programmet er den faglige sandhed; appen ændrer
        aldrig indholdet. Kilderne står i programmets side 54.
      </p>
      <button
        type="button"
        class="btn block"
        onClick={() => onPage('diagnose')}
        data-testid="diagnose-open"
      >
        Diagnose
      </button>
    </div>
  );
}

interface DiagnoseInfo {
  persisted: boolean | null;
  usage: string;
}

function Diagnose({ onBack }: { onBack: () => void }) {
  const [info, setInfo] = useState<DiagnoseInfo>({ persisted: null, usage: '…' });
  useEffect(() => {
    void Promise.all([isPersisted(), estimate()]).then(([persisted, est]) =>
      setInfo({
        persisted,
        usage: est
          ? `${(est.usage / 1e6).toFixed(1)} MB af ${(est.quota / 1e6).toFixed(0)} MB`
          : 'ukendt',
      }),
    );
  }, []);
  const paint = performance
    .getEntriesByType('paint')
    .find((p) => p.name === 'first-contentful-paint');
  const today = performance.getEntriesByName('cb-today')[0];
  const controller = navigator.serviceWorker?.controller?.scriptURL.split('/').pop() ?? 'ingen';
  const rows: Array<[string, string]> = [
    ['Version', APP_VERSION],
    ['Programversion', PROGRAM.programVersion],
    [
      'Service worker',
      `${controller}${swStatus.offlineReady ? ' · klar til offline' : ''}${swStatus.needRefresh ? ' · ny version venter' : ''}${swStatus.error ? ` · fejl: ${swStatus.error}` : ''}`,
    ],
    ['Varigt lager', info.persisted === null ? 'ukendt' : info.persisted ? 'ja' : 'nej'],
    ['Lagerplads', info.usage],
    ['Wake Lock', `${wakeLockSupported() ? 'API findes' : 'API mangler'} · nu: ${wakeState()}`],
    ['Lyd', audioState()],
    ['Viewport', `${window.innerWidth} × ${window.innerHeight}, DPR ${window.devicePixelRatio}`],
    ['Tidszone', Intl.DateTimeFormat().resolvedOptions().timeZone],
    ['Sprog', navigator.language],
    ['Første tegning', paint ? `${Math.round(paint.startTime)} ms` : 'ukendt'],
    ['I dag synlig', today ? `${Math.round(today.startTime)} ms` : 'ukendt'],
  ];
  return (
    <div class="screen diagnose" data-testid="diagnose">
      <button type="button" class="btn" onClick={onBack}>
        Tilbage
      </button>
      <h1>Diagnose</h1>
      <p class="muted">Tag et skærmbillede af siden, hvis noget ikke virker.</p>
      <dl class="facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd data-testid={`diag-${label}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TimeMachine({ model, onBack }: { model: Model; onBack: () => void }) {
  const [date, setDate] = useState(addDays(model.sim?.date ?? model.today, 1));
  return (
    <div class="screen timemachine" data-testid="timemachine">
      <button type="button" class="btn" onClick={onBack}>
        Tilbage
      </button>
      <h1>Tidsmaskinen</h1>
      <p>
        Appen kører på en kopi af dine data. Intet gemmes; »Afslut« i det røde banner kasserer
        kopien, og dine rigtige data er urørte.
      </p>
      <label class="field">
        <span>Simuleret dato</span>
        <input
          type="date"
          value={date}
          onInput={(e) => setDate((e.target as HTMLInputElement).value)}
          data-testid="sim-date"
        />
      </label>
      <p class="muted">{formatLong(date)}</p>
      <button
        type="button"
        class="btn primary block"
        data-testid="sim-start"
        onClick={() => {
          void model.startSimulation(date);
          onBack();
        }}
      >
        Start simulering
      </button>
    </div>
  );
}
