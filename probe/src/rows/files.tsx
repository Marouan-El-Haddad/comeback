import { useRef, useState } from 'preact/hooks';
import { syntheticEvents } from '../bench';
import { copenhagenDate, errorText, formatDateTime, formatNumber, nowIso } from '../format';
import type { Marker, Results, StorageReport } from '../store';
import { Facts, Row, combine, outcomeText, type Recorder } from '../ui';
import { PROBE_VERSION } from '../version';

type ProbeFile = {
  app: 'comeback-probe';
  probeVersion: number;
  exportedAt: string;
  marker: Marker | null;
  events: unknown[];
};

function isProbeFile(data: unknown): data is ProbeFile {
  if (typeof data !== 'object' || data === null) return false;
  const o = data as Record<string, unknown>;
  return o.app === 'comeback-probe' && typeof o.exportedAt === 'string' && Array.isArray(o.events);
}

export function FilesRow(props: {
  storage: StorageReport | null;
  results: Results;
  record: Recorder;
}) {
  const { storage, results, record } = props;
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const marker = storage?.idb.marker ?? storage?.ls.marker;

  /** About the size of a real backup: the number plus 1,000 synthetic events. */
  const buildFile = () => {
    const name = `comeback-probe-${copenhagenDate(new Date())}.json`;
    const data: ProbeFile = {
      app: 'comeback-probe',
      probeVersion: PROBE_VERSION,
      exportedAt: nowIso(),
      marker: marker ?? null,
      events: syntheticEvents(1000),
    };
    return { name, json: JSON.stringify(data) };
  };

  const exportFile = () => {
    try {
      const { name, json } = buildFile();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      const text = `${name} hentet – ligger den i Downloads?`;
      record({ exported: { ok: true, text, at: nowIso() } });
    } catch (error) {
      record({ exported: { ok: false, text: errorText(error), at: nowIso() } });
    }
  };

  const importFile = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!isProbeFile(data)) throw new Error('Filen er ikke en eksport fra proben');
      const same = marker !== undefined && data.marker?.number === marker.number;
      const text = `${file.name}: ${formatNumber(data.events.length)} hændelser, tal ${
        data.marker?.number ?? '–'
      } (${same ? 'samme som nu' : 'et andet tal end nu'})`;
      setPreview(`Eksporteret ${formatDateTime(data.exportedAt)} fra version ${data.probeVersion}`);
      record({ imported: { ok: true, text, at: nowIso() } });
    } catch (error) {
      record({ imported: { ok: false, text: errorText(error), at: nowIso() } });
    }
  };

  const shareFile = async () => {
    if (typeof navigator.share !== 'function') {
      record({ shared: { ok: false, text: 'Web Share findes ikke i browseren', at: nowIso() } });
      return;
    }
    const { name, json } = buildFile();
    const asJson = new File([json], name, { type: 'application/json' });
    const asText = new File([json], name.replace(/\.json$/, '.txt'), { type: 'text/plain' });
    const canShare = (file: File) =>
      typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    const file = canShare(asJson) ? asJson : canShare(asText) ? asText : null;
    if (!file) {
      const text = 'Browseren kan ikke dele filer (canShare svarede nej)';
      record({ shared: { ok: false, text, at: nowIso() } });
      return;
    }
    const kind = file === asJson ? 'som JSON-fil' : 'som tekstfil (.txt), JSON blev afvist';
    try {
      await navigator.share({ files: [file], title: 'Comeback-probe' });
      record({ shared: { ok: true, text: `Delt ${kind}`, at: nowIso() } });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError';
      record({
        shared: cancelled
          ? { ok: true, text: `Delingsmenuen åbnede ${kind} (annulleret)`, at: nowIso() }
          : { ok: false, text: errorText(error), at: nowIso() },
      });
    }
  };

  const status = combine([results.exported?.ok, results.imported?.ok, results.shared?.ok]);
  const text =
    status === 'green'
      ? 'Eksport, import og deling virker.'
      : status === 'red'
        ? 'Mindst én del virker ikke – se linjerne herunder.'
        : 'Tryk »Eksportér«, og find filen i Downloads. Læs den ind igen med »Importér«. Prøv »Del«.';

  return (
    <Row n={9} title="Filer" status={status} text={text}>
      <Facts
        items={[
          ['Eksportér', outcomeText(results.exported)],
          ['Importér', outcomeText(results.imported)],
          ...(preview ? ([['Indhold', preview]] as [string, string][]) : []),
          ['Del', outcomeText(results.shared)],
        ]}
      />
      <input
        ref={input}
        type="file"
        class="hidden"
        onChange={(event) => {
          const target = event.currentTarget;
          const file = target.files?.[0];
          target.value = '';
          if (file) void importFile(file);
        }}
      />
      <div class="buttons">
        <button type="button" onClick={exportFile}>
          Eksportér
        </button>
        <button type="button" onClick={() => input.current?.click()}>
          Importér
        </button>
        <button type="button" onClick={() => void shareFile()}>
          Del
        </button>
      </div>
    </Row>
  );
}
