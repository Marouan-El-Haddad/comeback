// Hooks for the explanations and figures in content/ (docs/SPEC.md 9.1). This module pulls in
// src/content/load.ts, so import it only from code loaded with lazy() (docs/SPEC.md 7).
import { useEffect, useState } from 'preact/hooks';
import { loadedExplain, loadedFigures, loadExplain, loadFigures } from '../content/load.ts';
import type { ExplainFile, FigureFile } from '../content/types.ts';

function useContent<T>(
  subject: string,
  loaded: (subject: string) => T | null | undefined,
  load: (subject: string) => Promise<T | null>,
): T | null | undefined {
  const [file, setFile] = useState(() => loaded(subject));
  useEffect(() => {
    let live = true;
    setFile(loaded(subject));
    void load(subject).then((data) => {
      if (live) setFile(data);
    });
    return () => {
      live = false;
    };
  }, [subject]);
  return file;
}

/** A track's or routine's explanation: undefined while it loads, null when it is not written. */
export function useExplain(subject: string): ExplainFile | null | undefined {
  return useContent(subject, loadedExplain, loadExplain);
}

/** A track's or routine's figures: undefined while they load, null when none is drawn. */
export function useFigures(subject: string): FigureFile | null | undefined {
  return useContent(subject, loadedFigures, loadFigures);
}
