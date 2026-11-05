// Hooks for the explanations and figures in content/ (docs/SPEC.md 9.1). This module pulls in
// src/content/load.ts, so import it only from code loaded with lazy() (docs/SPEC.md 7).
import { useEffect, useState } from 'preact/hooks';
import { loadedExplain, loadExplain } from '../content/load.ts';
import type { ExplainFile } from '../content/types.ts';

/** A track's or routine's explanation: undefined while it loads, null when it is not written. */
export function useExplain(subject: string): ExplainFile | null | undefined {
  const [file, setFile] = useState(() => loadedExplain(subject));
  useEffect(() => {
    let live = true;
    setFile(loadedExplain(subject));
    void loadExplain(subject).then((loaded) => {
      if (live) setFile(loaded);
    });
    return () => {
      live = false;
    };
  }, [subject]);
  return file;
}
