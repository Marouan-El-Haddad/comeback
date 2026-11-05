import { useState } from 'preact/hooks';
import { formatDateTime } from '../format';
import type { Results, StorageReport } from '../store';
import { Facts, Row, type Status } from '../ui';
import { BACKGROUND_NAME, PROBE_VERSION } from '../version';

export function UpdateRow(props: {
  storage: StorageReport | null;
  results: Results;
  needRefresh: boolean;
  onCheck: () => Promise<string>;
}) {
  const { storage, results, needRefresh, onCheck } = props;
  const [checkText, setCheckText] = useState<string | null>(null);

  const previous = storage?.versions.filter((v) => v.version < PROBE_VERSION).at(-1);
  const current = storage?.versions.find((v) => v.version === PROBE_VERSION);
  const marker = storage?.idb.marker ?? storage?.ls.marker;
  const found = results.updateFound && results.updateFound.version < PROBE_VERSION;
  const applied = results.updateApplied && results.updateApplied.fromVersion < PROBE_VERSION;

  let status: Status = 'waiting';
  let text: string;
  if (!storage) {
    text = 'Læser lageret …';
  } else if (needRefresh) {
    text = 'Ny version klar – tryk »Opdatér« øverst.';
  } else if (!previous && PROBE_VERSION === 1) {
    text =
      'Venter på version 2. Når den er udgivet: åbn appen, og vent på »Ny version klar« øverst.';
  } else if (!previous) {
    text = 'Denne browser har ikke set en tidligere version, så opdateringen kan ikke prøves her.';
  } else {
    const kept =
      marker !== undefined &&
      current !== undefined &&
      storage.idb.marker !== undefined &&
      storage.ls.marker !== undefined &&
      marker.createdAt < current.firstSeenAt;
    if (!kept) {
      status = 'red';
      text = `Opdateret fra version ${previous.version}, men tallet fra før opdateringen er væk.`;
    } else if (found && applied) {
      status = 'green';
      text = `Opdateret fra version ${previous.version} ved tryk på »Opdatér«, og tallet er bevaret.`;
    } else {
      text = `Version ${PROBE_VERSION} kører, og tallet er bevaret, men »Ny version klar« blev ${
        found ? 'vist uden tryk på »Opdatér«' : 'ikke vist'
      }. Det kan prøves igen med en ny version.`;
    }
  }

  const check = async () => {
    setCheckText('Søger …');
    setCheckText(await onCheck());
  };

  return (
    <Row n={4} title="Opdatering" status={status} text={text}>
      <Facts
        items={[
          ['Denne version', `${PROBE_VERSION} (${BACKGROUND_NAME})`],
          ['Tidligere version', previous ? String(previous.version) : 'ingen'],
          [
            '»Ny version klar« vist',
            results.updateFound
              ? `${formatDateTime(results.updateFound.at)}, fundet ${results.updateFound.how}`
              : 'nej',
          ],
          [
            'Opdateret ved tryk',
            results.updateApplied ? formatDateTime(results.updateApplied.at) : 'nej',
          ],
          ['Tallet', marker ? String(marker.number) : '–'],
          ...(checkText ? ([['Søgning', checkText]] as [string, string][]) : []),
        ]}
      />
      <div class="buttons">
        <button type="button" onClick={() => void check()}>
          Søg efter ny version
        </button>
      </div>
    </Row>
  );
}
