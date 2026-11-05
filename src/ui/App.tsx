// The app shell: four tabs (I dag · Uge · Stiger · Mere), banners, onboarding, the guided session
// as a full screen over the tabs, and the time machine's red banner (docs/SPEC.md 3).
import { useEffect, useState } from 'preact/hooks';
import { formatLong } from '../engine/index.ts';
import type { SessionKind } from '../engine/types.ts';
import { useModel } from './hooks.ts';
import type { Model } from './model.ts';
import { Ladders } from './screens/Ladders.tsx';
import { More, type MorePage } from './screens/More.tsx';
import { Onboarding } from './screens/Onboarding.tsx';
import { Today } from './screens/Today.tsx';
import { WeekView } from './screens/Week.tsx';
import { OpenStrong } from './session/OpenStrong.tsx';
import { resumableRun, Runner, type RunRequest } from './session/Runner.tsx';
import { applyUpdate, onSwChange, swStatus } from './sw.ts';

type Tab = 'today' | 'week' | 'ladders' | 'more';

const TABS: Array<[Tab, string]> = [
  ['today', 'I dag'],
  ['week', 'Uge'],
  ['ladders', 'Stiger'],
  ['more', 'Mere'],
];

export function App({ model }: { model: Model }) {
  useModel(model);
  const [tab, setTab] = useState<Tab>('today');
  const [morePage, setMorePage] = useState<MorePage>('menu');
  const [run, setRun] = useState<RunRequest | null>(() => resumableRun(model));
  const [os, setOs] = useState(false);
  const [, setSw] = useState(0);
  const [mirrorNote, setMirrorNote] = useState(model.restoredFromMirror);

  useEffect(() => onSwChange(() => setSw((n) => n + 1)), []);
  useEffect(() => {
    // A new day (midnight, or the app reopened the next morning) writes its catch-up events.
    const check = () => {
      if (document.visibilityState === 'visible') void model.refreshDay();
    };
    document.addEventListener('visibilitychange', check);
    const id = setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      clearInterval(id);
    };
  }, [model]);

  const banners = (
    <>
      {model.sim && (
        <div class="banner sim" role="status">
          <span>SIMULERET · {formatLong(model.sim.date)}</span>
          <button
            type="button"
            class="btn small"
            onClick={() => void model.nextSimulatedDay()}
            data-testid="sim-next"
          >
            +1 dag
          </button>
          <button
            type="button"
            class="btn small"
            data-testid="sim-exit"
            onClick={() => {
              setRun(null);
              setOs(false);
              void model.stopSimulation();
            }}
          >
            Afslut
          </button>
        </div>
      )}
      {model.saveError && (
        <div class="banner error" role="alert">
          <span>Kan ikke gemme – eksportér backup nu</span>
          <button
            type="button"
            class="btn small"
            onClick={() => {
              setRun(null);
              setTab('more');
              setMorePage('backup');
            }}
          >
            Backup
          </button>
        </div>
      )}
      {mirrorNote && (
        <div class="banner info" role="status">
          <span>Data gendannet fra spejl</span>
          <button type="button" class="btn small" onClick={() => setMirrorNote(false)}>
            OK
          </button>
        </div>
      )}
    </>
  );

  if (!model.state.onboarded) {
    return (
      <>
        {banners}
        <Onboarding model={model} />
      </>
    );
  }

  if (run) {
    return (
      <>
        {banners}
        <Runner
          key={`${run.date}-${run.kind}`}
          model={model}
          request={run}
          onClose={() => setRun(null)}
        />
      </>
    );
  }
  if (os) {
    return (
      <>
        {banners}
        <OpenStrong model={model} onClose={() => setOs(false)} />
      </>
    );
  }

  const start = (kind: SessionKind, short: boolean, calmBase: boolean) =>
    setRun({ date: model.today, kind, short, calmBase });

  return (
    <div class="app">
      {banners}
      {swStatus.needRefresh && (
        <div class="banner update" role="status">
          <span>Ny version klar</span>
          <button
            type="button"
            class="btn small"
            onClick={() => void applyUpdate()}
            data-testid="update"
          >
            Opdatér
          </button>
        </div>
      )}
      <main class="tab-content">
        {tab === 'today' && (
          <Today
            model={model}
            onStart={start}
            onOpenAndStrong={() => setOs(true)}
            onBackup={() => {
              setTab('more');
              setMorePage('backup');
            }}
          />
        )}
        {tab === 'week' && <WeekView model={model} />}
        {tab === 'ladders' && <Ladders model={model} />}
        {tab === 'more' && <More model={model} page={morePage} onPage={setMorePage} />}
      </main>
      <nav class="tabbar" aria-label="Faner">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            class={tab === id ? 'tab active' : 'tab'}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => {
              setTab(id);
              if (id === 'more') setMorePage('menu');
            }}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
