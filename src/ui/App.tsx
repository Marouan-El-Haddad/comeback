// The app shell: four tabs (I dag · Uge · Stiger · Mere), banners, onboarding, the guided session
// as a full screen over the tabs, and the time machine's red banner (docs/SPEC.md 3). »Hold pause«
// in a session shows the tabs with the session standing still under them – still mounted, so every
// clock and every logged set is where it was – and »Fortsæt passet« goes back to it (D53).
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatLong } from '../engine/index.ts';
import type { SessionKind } from '../engine/types.ts';
import { ExerciseCard } from './card.tsx';
import { useModel } from './hooks.ts';
import { lazy } from './lazy.tsx';
import type { Model } from './model.ts';
import { Ladders } from './screens/Ladders.tsx';
import { More, type MorePage } from './screens/More.tsx';
import { Onboarding } from './screens/Onboarding.tsx';
import { Today } from './screens/Today.tsx';
import { WeekView } from './screens/Week.tsx';
import { resumableRun, type RunRequest } from './session/resume.ts';
import { noteScreen } from './startup.ts';
import { applyUpdate, onSwChange, swStatus } from './sw.ts';

type Tab = 'today' | 'week' | 'ladders' | 'more';

// The guided session, Open & Strong and the exercise card are not needed for the first screen: their
// code is fetched in the background once I dag is up, or on the first tap (docs/SPEC.md 7, D35).
const Runner = lazy(() => import('./session/Runner.tsx').then((m) => m.Runner));
const OpenStrong = lazy(() => import('./session/OpenStrong.tsx').then((m) => m.OpenStrong));
const PRELOAD_AFTER_MS = 1000;

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
  /** The session is paused with »Hold pause«: the tabs are shown, the session stands still. */
  const [away, setAway] = useState(false);
  const [os, setOs] = useState(false);
  const [, setSw] = useState(0);
  const [mirrorNote, setMirrorNote] = useState(model.restoredFromMirror);
  // Diagnose counts a start only when I dag is the first screen (docs/SPEC.md 7).
  noteScreen(!model.state.onboarded ? 'onboarding' : run && !away ? 'session' : os ? 'os' : tab);

  useEffect(() => onSwChange(() => setSw((n) => n + 1)), []);
  // A session belongs to its world. When the time machine starts or ends while a session holds a
  // pause under the tabs, the session is let go here; it waits in the log, and I dag's »Fortsæt
  // passet« takes it up again in its own world (D53).
  const world = model.sim !== null;
  const lastWorld = useRef(world);
  useEffect(() => {
    if (lastWorld.current === world) return;
    lastWorld.current = world;
    setRun(null);
    setAway(false);
  }, [world]);
  useEffect(() => {
    const id = setTimeout(() => {
      void Runner.preload().catch(() => undefined);
      void OpenStrong.preload().catch(() => undefined);
      void ExerciseCard.preload().catch(() => undefined);
    }, PRELOAD_AFTER_MS);
    return () => clearTimeout(id);
  }, []);
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
              setAway(false);
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
              setAway(false);
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

  // The session stays in the same place in the tree whether it is shown or paused under the tabs,
  // so it is never drawn anew and loses nothing (»Hold pause«, docs/SPEC.md 3).
  const session = run && (
    <Runner
      key={`${run.date}-${run.kind}`}
      model={model}
      request={run}
      away={away || os}
      onAway={setAway}
      onClose={() => {
        setRun(null);
        setAway(false);
      }}
    />
  );
  if (os) {
    return (
      <>
        {banners}
        {session}
        <OpenStrong model={model} onClose={() => setOs(false)} />
      </>
    );
  }
  if (run && !away) {
    return (
      <>
        {banners}
        {session}
        {null}
      </>
    );
  }

  // The session opens once its code is there, so the tap never shows an empty screen. A session
  // paused under the tabs is the one »Fortsæt passet« goes back to.
  const start = (kind: SessionKind, short: boolean, calmBase: boolean) => {
    if (run) {
      setAway(false);
      return;
    }
    const request = { date: model.today, kind, short, calmBase };
    const open = () => setRun(request);
    void Runner.preload().then(open, open);
  };

  return (
    <>
      {banners}
      {session}
      <div class="app">
        {run && away && (
          <div class="banner paused" role="status" data-testid="paused-banner">
            <span>Passet holder pause</span>
            <button
              type="button"
              class="btn small"
              onClick={() => setAway(false)}
              data-testid="resume-session"
            >
              Fortsæt passet
            </button>
          </div>
        )}
        {swStatus.needRefresh && !run && (
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
              paused={!!run && away}
              onStart={start}
              onOpenAndStrong={() => {
                const open = () => setOs(true);
                void OpenStrong.preload().then(open, open);
              }}
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
    </>
  );
}
