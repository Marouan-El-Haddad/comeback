import { useEffect, useState } from 'preact/hooks';
import { benchmark, type BenchResult } from '../bench';
import { formatMs, formatNumber } from '../format';
import { Facts, Row, type Boot, type Status } from '../ui';

export type FirstPaint = { ms: number; source: string };

const MAX_FIRST_PAINT_MS = 1000;
const MAX_REPLAY_MS = 100;

export function PerfRow({ boot, firstPaint }: { boot: Boot; firstPaint: FirstPaint | null }) {
  const [bench, setBench] = useState<BenchResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    // Let the "Måler …" text paint before the main thread is busy for about a second.
    setTimeout(() => {
      setBench(benchmark());
      setRunning(false);
    }, 100);
  };

  useEffect(() => {
    const id = setTimeout(run, 1500);
    return () => clearTimeout(id);
  }, []);

  let status: Status = 'waiting';
  let text = 'Måler …';
  if (firstPaint && bench && !running) {
    const slow = [
      firstPaint.ms > MAX_FIRST_PAINT_MS ? 'første tegning over 1 sekund' : '',
      bench.average > MAX_REPLAY_MS ? 'afspilning over 100 ms' : '',
    ].filter(Boolean);
    status = slow.length === 0 ? 'green' : 'red';
    text =
      slow.length === 0
        ? 'Hurtig nok: første tegning under 1 sekund og afspilning under 100 ms.'
        : `For langsom: ${slow.join(' og ')}. Mål igen ved åbning fra ikonet.`;
  }

  return (
    <Row n={8} title="Ydelse" status={status} text={text}>
      <Facts
        items={[
          [
            'Første tegning',
            firstPaint ? `${formatMs(firstPaint.ms)} (${firstPaint.source})` : '–',
          ],
          [
            'Afspilning af 1.000 hændelser',
            bench
              ? `${formatMs(bench.average)} i snit over ${formatNumber(bench.runs)} kørsler`
              : '–',
          ],
          ['Første afspilning', bench ? formatMs(bench.first) : '–'],
          ['Urets opløsning', bench ? formatMs(bench.resolution) : '–'],
          ['Hentet fra', boot.controlled ? 'appens cache' : 'nettet'],
        ]}
      />
      <div class="buttons">
        <button type="button" disabled={running} onClick={run}>
          Kør igen
        </button>
      </div>
    </Row>
  );
}
