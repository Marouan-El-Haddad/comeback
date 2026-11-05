// persist() is asked once, after the first logged session, from the tap that finishes it
// (docs/SPEC.md 9, DECISIONS D23). The answer is kept in the store's meta.
import { requestPersist } from '../storage/persist.ts';
import type { Model } from './model.ts';

export async function requestPersistOnce(model: Model): Promise<void> {
  if (model.sim) return;
  try {
    const asked = await model.real.getMeta<boolean | null>('persistRequested');
    if (asked !== undefined) return;
    const result = await requestPersist();
    await model.real.setMeta('persistRequested', result);
  } catch {
    // Not fatal: the data stays in IndexedDB either way.
  }
}
