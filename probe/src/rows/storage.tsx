import { useEffect, useState } from 'preact/hooks';
import { errorText, formatBytes, formatDateTime, nowIso } from '../format';
import type { Results, StorageReport, StoreSide } from '../store';
import { Facts, Row, outcomeText, type Boot, type Recorder, type Status } from '../ui';

function sideText(side: StoreSide): string {
  if (side.error) return `fejl: ${side.error}`;
  if (!side.marker) return 'tom';
  return `${side.marker.number}, gemt ${formatDateTime(side.marker.createdAt)}`;
}

export function StorageRow(props: {
  boot: Boot;
  storage: StorageReport | null;
  results: Results;
  record: Recorder;
}) {
  const { boot, storage, results, record } = props;
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

  const refresh = async () => {
    if (!('storage' in navigator)) return;
    setPersisted(await navigator.storage.persisted());
    setEstimate(await navigator.storage.estimate());
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const requestPersist = async () => {
    if (!('storage' in navigator) || typeof navigator.storage.persist !== 'function') {
      record({
        persist: { ok: false, text: 'navigator.storage.persist findes ikke', at: nowIso() },
      });
      return;
    }
    try {
      const granted = await navigator.storage.persist();
      record({
        persist: { ok: granted, text: granted ? 'svarede ja' : 'svarede nej', at: nowIso() },
      });
      await refresh();
    } catch (error) {
      record({ persist: { ok: false, text: errorText(error), at: nowIso() } });
    }
  };

  if (!storage) return <Row n={2} title="Lager" status="waiting" text="Læser lageret …" />;

  const { idb, ls } = storage;
  const number = idb.marker?.number ?? ls.marker?.number;
  let status: Status;
  let text: string;
  if (idb.error || ls.error) {
    status = 'red';
    text = [
      idb.error ? `IndexedDB virker ikke (${idb.error}).` : '',
      ls.error ? `localStorage virker ikke (${ls.error}).` : '',
    ]
      .filter(Boolean)
      .join(' ');
  } else if (storage.createdNow && boot.controlled) {
    status = 'red';
    text =
      'Appen åbnede fra sin cache, men tallet manglede: lageret er blevet slettet. Et nyt tal er gemt.';
  } else if (storage.createdNow) {
    status = 'waiting';
    text = 'Første besøg: tallet er gemt nu. Luk appen helt, og åbn den igen – samme tal?';
  } else if (!idb.marker || !ls.marker) {
    status = 'red';
    text = idb.marker
      ? 'localStorage har mistet tallet; IndexedDB har det stadig.'
      : 'IndexedDB har mistet tallet; localStorage har det stadig.';
  } else if (idb.marker.number !== ls.marker.number) {
    status = 'red';
    text = 'IndexedDB og localStorage har forskellige tal.';
  } else {
    status = 'green';
    text = `Samme tal i IndexedDB og localStorage siden ${formatDateTime(idb.marker.createdAt)}.`;
  }

  return (
    <Row n={2} title="Lager" status={status} text={text}>
      <p class="big">{number ?? '–'}</p>
      <Facts
        items={[
          ['IndexedDB', sideText(idb)],
          ['localStorage', sideText(ls)],
          ['Åbnet', `${storage.visits} ${storage.visits === 1 ? 'gang' : 'gange'}`],
          ['Varigt lager (persisted)', persisted === null ? 'ukendt' : persisted ? 'ja' : 'nej'],
          ['persist()', outcomeText(results.persist, 'ikke prøvet – tryk »Persist«')],
          [
            'Plads',
            estimate?.usage !== undefined && estimate.quota !== undefined
              ? `${formatBytes(estimate.usage)} brugt af ${formatBytes(estimate.quota)}`
              : 'ukendt',
          ],
        ]}
      />
      <div class="buttons">
        <button type="button" onClick={() => void requestPersist()}>
          Persist
        </button>
      </div>
    </Row>
  );
}
