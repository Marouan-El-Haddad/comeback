// Side plank and balance are measured on both sides (docs/SPEC.md 4.8, DECISIONS.md P59, D49):
// the left side's time, then the right side's, and the shorter is the measurement's one number.
// Which measurements that is comes from the programme's own words (»pr. side«, »pr. ben«).
import { describe, expect, test } from 'vitest';
import { PROGRAM } from '../../engine/program.ts';
import type { Measure } from '../../engine/types.ts';
import { measureSides, shortest } from '../session/sides.ts';

function measure(id: string): Measure {
  const found = PROGRAM.measures.find((m) => m.id === id);
  if (!found) throw new Error(`Ingen måling ${id}`);
  return found;
}

describe('målinger pr. side', () => {
  test('sideplanke og balance tages pr. side, alle andre målinger én gang', () => {
    expect(PROGRAM.measures.filter((m) => measureSides(m) !== null).map((m) => m.id)).toEqual([
      'side_plank',
      'balance',
    ]);
  });

  test('sideplanke: venstre og højre side; balance: venstre og højre ben', () => {
    expect(measureSides(measure('side_plank'))).toEqual(['Venstre side', 'Højre side']);
    expect(measureSides(measure('balance'))).toEqual(['Venstre ben', 'Højre ben']);
  });

  test('kun en måling med ur tages pr. side', () => {
    const reps: Measure = { ...measure('pushups'), how: 'Max i ét sæt pr. side.' };
    expect(measureSides(reps)).toBeNull();
  });

  test('den korteste tid gemmes; mangler en side, er der intet tal endnu', () => {
    expect(shortest([40, 35])).toBe(35);
    expect(shortest([35, 40])).toBe(35);
    expect(shortest([40, null])).toBeNull();
    expect(shortest([25])).toBe(25);
    expect(shortest([])).toBeNull();
  });
});
