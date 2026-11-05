// »Hvorfor« (docs/SPEC.md 3.2): the track's »Hvorfor« in the app's own words from content/explain
// when it is written, otherwise the programme's own boxes without page numbers and citations
// (docs/DECISIONS.md A2). Loaded with the session, not at start (it uses src/ui/content.ts).
import { withoutSources } from '../../content/refs.ts';
import { getTrack, PROGRAM } from '../../engine/index.ts';
import { useExplain } from '../content.ts';

export function WhyText({ trackId }: { trackId: string }) {
  const explain = useExplain(trackId);
  const texts =
    explain?.why ?? (getTrack(PROGRAM, trackId).why ?? []).map((w) => withoutSources(w.text));
  return (
    <>
      {texts.map((text) => (
        <p key={text}>{text}</p>
      ))}
    </>
  );
}
