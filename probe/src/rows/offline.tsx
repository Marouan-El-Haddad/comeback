import { useState } from 'preact/hooks';
import { formatDateTime } from '../format';
import type { Results } from '../store';
import { Facts, Row, type Boot, type Status } from '../ui';

export function OfflineRow(props: {
  boot: Boot;
  results: Results;
  registration: ServiceWorkerRegistration | null;
  swError: string | null;
  offlineReady: boolean;
}) {
  const { boot, results, registration, swError, offlineReady } = props;
  const [showSteps, setShowSteps] = useState(false);
  const ready = offlineReady || Boolean(registration?.active);

  let status: Status = 'waiting';
  let text = 'Tryk »Test offline«, og følg trinene.';
  if (!('serviceWorker' in navigator) || swError) {
    status = 'red';
    text = 'Uden service worker kan siden ikke åbne uden net.';
  } else if (results.offline?.ok) {
    status = 'green';
    text = `Siden åbnede uden net ${formatDateTime(results.offline.at)}.`;
  }

  return (
    <Row n={3} title="Offline" status={status} text={text}>
      <Facts
        items={[
          ['Net lige nu', navigator.onLine ? 'online' : 'offline'],
          ['Klar til offline', ready ? 'ja' : 'ikke endnu'],
          ['Denne åbning', boot.online ? 'med net' : 'uden net'],
        ]}
      />
      {showSteps && (
        <div class="note">
          {!ready && <p>Vent, til »Klar til offline« siger ja.</p>}
          <p>1. Slå flytilstand til.</p>
          <p>2. Tryk »Genindlæs« – eller luk appen helt, og åbn den fra ikonet.</p>
          <p>Siden skal stadig åbne og vise GRØN her. Åbner den ikke, er punktet rødt.</p>
        </div>
      )}
      <div class="buttons">
        <button type="button" onClick={() => setShowSteps(true)}>
          Test offline
        </button>
        {showSteps && (
          <button type="button" onClick={() => location.reload()}>
            Genindlæs
          </button>
        )}
      </div>
    </Row>
  );
}
