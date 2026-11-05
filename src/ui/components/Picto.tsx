// A step's pictogram from program/pictos.json; steps without their own use the ladder's nearest
// (docs/SPEC.md section 5). Never a generic icon: without a mapping nothing is drawn.
import { PROGRAM } from '../../engine/program.ts';

const BASE = import.meta.env.BASE_URL;

export function pictoUrl(key: string, white = false): string | null {
  const ref = PROGRAM.pictos[key];
  if (!ref) return null;
  return `${BASE}pictos/${white ? 'white/' : ''}${ref.picto}.svg`;
}

export function Picto({ stepId, small = false }: { stepId: string; small?: boolean }) {
  const url = pictoUrl(stepId);
  if (!url) return null;
  return (
    <img
      class={small ? 'picto small' : 'picto'}
      src={url}
      alt=""
      width={small ? 72 : 120}
      height={small ? 72 : 120}
      decoding="async"
    />
  );
}
