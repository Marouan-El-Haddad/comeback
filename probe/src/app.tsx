import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { errorText, nowIso } from './format';
import { FilesRow } from './rows/files';
import { InstallRow } from './rows/install';
import { OfflineRow } from './rows/offline';
import { PerfRow, type FirstPaint } from './rows/perf';
import { SoundRow } from './rows/sound';
import { StorageRow } from './rows/storage';
import { TimeRow } from './rows/time';
import { UpdateRow } from './rows/update';
import { ViewportRow } from './rows/viewport';
import { WakeRow } from './rows/wake';
import { bootStorage, loadResults, saveResults, type Results, type StorageReport } from './store';
import type { Boot, Recorder } from './ui';
import { PROBE_VERSION } from './version';

export function App({ boot }: { boot: Boot }) {
  const [results, setResults] = useState<Results>(loadResults);
  const resultsRef = useRef(results);
  // Writes synchronously, so a result survives an immediate reload (e.g. "Opdatér").
  const record = useCallback<Recorder>((patch) => {
    const next = { ...resultsRef.current, ...patch };
    resultsRef.current = next;
    saveResults(next);
    setResults(next);
  }, []);

  const [storage, setStorage] = useState<StorageReport | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [swError, setSwError] = useState<string | null>(null);
  const [firstPaint, setFirstPaint] = useState<FirstPaint | null>(null);
  const [now, setNow] = useState(() => new Date());
  const manualCheckAt = useRef(0);

  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, reg) => setRegistration(reg ?? null),
    onRegisterError: (error: unknown) => setSwError(errorText(error)),
  });

  useEffect(() => {
    void bootStorage(PROBE_VERSION, new Date()).then(setStorage);
    if (!boot.online) {
      const text = boot.controlled ? 'Åbnede uden net fra appens cache' : 'Åbnede uden net';
      record({ offline: { ok: true, text, at: nowIso() } });
    }
    // Time from navigation start to the first paint (point 8).
    requestAnimationFrame((frameTime) => {
      setTimeout(() => {
        const paints = performance.getEntriesByType('paint');
        const paint =
          paints.find((p) => p.name === 'first-contentful-paint') ??
          paints.find((p) => p.name === 'first-paint');
        setFirstPaint(
          paint
            ? { ms: paint.startTime, source: paint.name }
            : { ms: frameTime, source: 'første frame' },
        );
      }, 0);
    });
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [boot, record]);

  useEffect(() => {
    if (!needRefresh || resultsRef.current.updateFound?.version === PROBE_VERSION) return;
    const how = Date.now() - manualCheckAt.current < 60_000 ? 'manuelt' : 'automatisk';
    record({ updateFound: { at: nowIso(), how, version: PROBE_VERSION } });
  }, [needRefresh, record]);

  const applyUpdate = () => {
    record({ updateApplied: { at: nowIso(), fromVersion: PROBE_VERSION } });
    void updateServiceWorker(true);
  };

  const checkForUpdate = async (): Promise<string> => {
    if (!registration) return 'Ingen service worker endnu';
    manualCheckAt.current = Date.now();
    try {
      await registration.update();
      return registration.installing || registration.waiting
        ? 'Ny version fundet'
        : 'Ingen ny version fundet';
    } catch (error) {
      return `Fejl: ${errorText(error)}`;
    }
  };

  return (
    <>
      {needRefresh && (
        <div class="banner" role="status">
          <span>Ny version klar</span>
          <button type="button" onClick={applyUpdate}>
            Opdatér
          </button>
        </div>
      )}
      <header class="top">
        <h1>Comeback-probe</h1>
        <p class="version">Version {PROBE_VERSION}</p>
        <p>Teknisk afprøvning af telefonen. Læs hver række op: nummer, farve og tekst.</p>
      </header>
      <main>
        <InstallRow boot={boot} registration={registration} swError={swError} />
        <StorageRow boot={boot} storage={storage} results={results} record={record} />
        <OfflineRow
          boot={boot}
          results={results}
          registration={registration}
          swError={swError}
          offlineReady={offlineReady}
        />
        <UpdateRow
          storage={storage}
          results={results}
          needRefresh={needRefresh}
          onCheck={checkForUpdate}
        />
        <WakeRow results={results} record={record} />
        <SoundRow results={results} record={record} />
        <TimeRow now={now} />
        <PerfRow boot={boot} firstPaint={firstPaint} />
        <FilesRow storage={storage} results={results} record={record} />
        <ViewportRow />
      </main>
    </>
  );
}
