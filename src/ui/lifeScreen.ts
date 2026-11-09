// The screens shown in place of I dag or Uge – the club log, the Sunday check and »Flyt eller spring
// over« – are not needed for the first screen: fetched in the background when I dag has something to
// ask, or at the tap (docs/SPEC.md 7).
import { lazy } from './lazy.tsx';

export const LifeForm = lazy(() => import('./life/LifeForm.tsx').then((m) => m.LifeForm));
