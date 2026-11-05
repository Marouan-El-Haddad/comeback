// Mere (docs/SPEC.md 3.6): Backup (export, import with preview, last backup, persist status) and
// Om (version, programme version, sources, Diagnose – T6, D34 – and the hidden time machine, 3.7).
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
  TIME_ZONE,
  todayIn,
  type ImportResult,
} from '../../engine/index.ts';
import { estimate, isPersisted } from '../../storage/persist.ts';
import type { MirrorStatus } from '../../storage/store.ts';
import { audioState, type AudioState } from '../audio.ts';
import type { Model } from '../model.ts';
import { median, readStartupTimes, thisStart } from '../startup.ts';
import { swStatus } from '../sw.ts';
import { History } from './History.tsx';
import { wakeLockSupported, wakeState, type WakeState } from '../wakelock.ts';

export type MorePage = 'menu' | 'history' | 'backup' | 'about' | 'diagnose' | 'timemachine';

const WAKE: Record<WakeState, string> = {
  off: 'fra',
  lock: 'låst',
  video: 'video-fallback',
  failed: 'fejlet',
};
const SOUND: Record<AudioState, string> = {
  off: 'fra (slås til ved start af et pas)',
  running: 'kører',
  suspended: 'sat på pause',
  blocked: 'blokeret',
  unsupported: 'findes ikke',
};

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
  if (page === 'history') return <History model={model} onBack={() => onPage('menu')} />;
  if (page === 'backup') return <Backup model={model} onBack={() => onPage('menu')} />;
  if (page === 'about') return <About model={model} onPage={onPage} />;
  if (page === 'diagnose') return <Diagnose model={model} onBack={() => onPage('about')} />;
  if (page === 'timemachine') return <TimeMachine model={model} onBack={() => onPage('about')} />;
  return (
    <div class="screen more" data-testid="more">
      <h1>Mere</h1>
      <div class="stack">
        <button type="button" class="btn block" onClick={() => onPage('history')}>
          Historik
        </button>
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
      <p class={persisted === false ? 'flag' : ''}>
        Varigt lager:{' '}
        {persisted === null
          ? 'ukendt'
          : persisted
            ? 'ja'
            : 'nej – browseren kan slette data ved pladsmangel. Eksportér en backup jævnligt.'}
      </p>
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
        <div class="card stack" data-testid="import-preview">
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
      <div class="backup-actions">
        {simulated ? (
          <p class="hint">Backup og import er slået fra, mens tidsmaskinen kører.</p>
        ) : (
          <>
            <label class="btn block file-button">
              Importér backup
              <input
                type="file"
                accept="application/json,.json"
                data-testid="import-file"
                onChange={(e) => void onFile((e.target as HTMLInputElement).files?.[0])}
              />
            </label>
            <button
              type="button"
              class="btn primary block"
              onClick={() => void doExport()}
              data-testid="export"
            >
              Eksportér backup
            </button>
          </>
        )}
      </div>
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

/** "21.40" or "21.40.18" in Danish time, built from parts like formatDay. */
function clockTime(at: string, seconds = false): string {
  const parts = new Intl.DateTimeFormat('da-DK', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(seconds ? { second: '2-digit' } : {}),
  }).formatToParts(Date.parse(at));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return [part('hour'), part('minute'), seconds ? part('second') : undefined]
    .filter((p) => p !== undefined)
    .join('.');
}

/** "3.833 ms" */
function ms(value: number | null): string {
  return value === null ? 'ukendt' : `${Math.round(value).toLocaleString('da-DK')} ms`;
}

function mirrorText(status: MirrorStatus): string {
  if (!status.ok) return status.error ?? 'fejl';
  if (status.pending) return 'venter på at blive gemt';
  if (!status.savedAt) return 'intet gemt endnu';
  const events = `${status.events.toLocaleString('da-DK')} ${status.events === 1 ? 'hændelse' : 'hændelser'}`;
  return `${events} · gemt kl. ${clockTime(status.savedAt, true)}`;
}

function Diagnose({ model, onBack }: { model: Model; onBack: () => void }) {
  const [info, setInfo] = useState<DiagnoseInfo>({ persisted: null, usage: '…' });
  const [, setTick] = useState(0);
  useEffect(() => {
    void Promise.all([isPersisted(), estimate()]).then(([persisted, est]) =>
      setInfo({
        persisted,
        usage: est
          ? `${(est.usage / 1e6).toFixed(1)} MB af ${(est.quota / 1e6).toFixed(0)} MB`
          : 'ukendt',
      }),
    );
    // The mirror, Wake Lock, sound and this start change while the page is open.
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const controller =
    navigator.serviceWorker?.controller?.scriptURL.split('/').pop() ?? 'ikke aktiv endnu';
  const rows: Array<[string, string]> = [
    ['Version', APP_VERSION],
    ['Programversion', PROGRAM.programVersion],
    [
      'Service worker',
      `${controller}${swStatus.offlineReady ? ' · klar til offline' : ''}${swStatus.needRefresh ? ' · ny version venter' : ''}${swStatus.error ? ` · fejl: ${swStatus.error}` : ''}`,
    ],
    ['Spejl', mirrorText(model.real.mirrorStatus)],
    ['Varigt lager', info.persisted === null ? 'ukendt' : info.persisted ? 'ja' : 'nej'],
    ['Lagerplads', info.usage],
    [
      'Wake Lock',
      `${wakeLockSupported() ? 'API findes' : 'API mangler'} · nu: ${WAKE[wakeState()]}`,
    ],
    ['Lyd', SOUND[audioState()]],
    ['Viewport', `${window.innerWidth} × ${window.innerHeight}, DPR ${window.devicePixelRatio}`],
    ['Tidszone', Intl.DateTimeFormat().resolvedOptions().timeZone],
    ['Sprog', navigator.language],
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
      <StartupTimes />
    </div>
  );
}

/** Only clean starts from the icon (docs/SPEC.md 7, D34): the latest and the median. */
function StartupTimes() {
  const times = readStartupTimes();
  const last = times[times.length - 1];
  const verdict = thisStart();
  return (
    <section class="stack" data-testid="startup">
      <h2>Opstart fra ikonet</h2>
      {last ? (
        <>
          <table class="startup-table">
            <thead>
              <tr>
                <td />
                <th scope="col">Seneste</th>
                <th scope="col" data-testid="startup-median">
                  Median af {times.length}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Første tegning</th>
                <td data-testid="startup-paint-last">{ms(last.paint)}</td>
                <td data-testid="startup-paint-median">
                  {ms(median(times.flatMap((t) => (t.paint === null ? [] : [t.paint]))))}
                </td>
              </tr>
              <tr>
                <th scope="row">I dag synlig</th>
                <td data-testid="startup-today-last">{ms(last.today)}</td>
                <td data-testid="startup-today-median">{ms(median(times.map((t) => t.today)))}</td>
              </tr>
            </tbody>
          </table>
          <p class="muted" data-testid="startup-when">
            Seneste: {formatDay(todayIn(Date.parse(last.at)))} kl. {clockTime(last.at)}
          </p>
        </>
      ) : (
        <p class="hint" data-testid="startup-none">
          Ingen måling endnu. Luk appen helt, og åbn den fra ikonet.
        </p>
      )}
      <p class="muted" data-testid="startup-this">
        {verdict === undefined
          ? 'Denne opstart er ikke målt endnu.'
          : verdict === null
            ? 'Denne opstart er talt med.'
            : `Denne opstart tæller ikke: ${verdict}.`}
      </p>
    </section>
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
