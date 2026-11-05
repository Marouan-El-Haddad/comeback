// Renders programme data in the source's wording (docs/PROGRAM_KILDE.md), e.g. "3 × 6–12 pr. side".
import type { Dose, Per } from './types.ts';

/** "6–12", or "3" when min and max are equal. */
function range([min, max]: [number, number]): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

function perText(per: Per | undefined): string {
  return per ? ` pr. ${per}` : '';
}

/** The dose as the source writes it: "3 × 6–12", "2–3 × 15–30 sek pr. side", "4 × 3", "Altid". */
export function formatDose(dose: Dose): string {
  switch (dose.kind) {
    case 'reps':
    case 'power':
      return `${range(dose.sets)} × ${range(dose.reps)}${perText(dose.per)}`;
    case 'hold':
      return `${range(dose.sets)} × ${range(dose.seconds)} sek${perText(dose.per)}`;
    case 'fixed':
      return `${dose.sets} × ${dose.reps}${perText(dose.per)}`;
    case 'emom':
      return `${dose.minutes} × ${dose.reps}`;
    case 'rounds':
    case 'always':
      return dose.text;
  }
}
