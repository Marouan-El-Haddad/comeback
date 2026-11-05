// Success criteria from docs/SPEC.md 1 that the engine can show on its own.
import { describe, expect, test } from 'vitest';
import { findSourceRef } from '../../content/refs.ts';
import { dayOf, Log } from './helpers/log.ts';

describe('Succeskriterier', () => {
  test('SK5: hver beslutning fra motoren har én forklarende sætning', () => {
    const log = new Log().onboard({
      steps: {
        press: { stepId: 'press.1', target: 12 },
        legs: { stepId: 'legs.3', target: 10 },
        backpack_row: { stepId: 'backpack_row.1', target: 15 },
      },
    });
    for (let k = 0; k < 6; k++) {
      log.catchUp(dayOf(k, 1));
      log.session({
        date: dayOf(k, 2),
        sets: {
          press: { values: [12, 12, 12, 12], rir: 2 },
          legs:
            k === 2
              ? { values: [10, 10, 10], rir: 2, pain: 'sharp' }
              : { values: [10, 10, 10, 10], rir: 2 },
        },
        results: { burpee_emom: { clean: true, rest20: true }, neck: { feel: 'easy' } },
      });
      log.session({
        date: dayOf(k, 5),
        kind: 'B',
        sets: { backpack_row: { values: [15, 15, 15, 15], rir: 2 } },
      });
    }
    log.catchUp(dayOf(10, 1));
    const decisions = log.events.filter(
      (e) => e.type === 'step_changed' || e.type === 'load_changed',
    );
    expect(
      new Set(decisions.map((e) => (e.type === 'step_changed' ? e.reason : 'load'))).size,
    ).toBeGreaterThanOrEqual(4);
    for (const e of decisions) {
      const text = 'explanation' in e ? e.explanation : '';
      expect(text.trim().length, JSON.stringify(e)).toBeGreaterThan(10);
      expect(text.trim().endsWith('.'), text).toBe(true);
      // ENGINE.md 1, principle 3: in the app's own words, no PDF, page or source (A2).
      expect(findSourceRef(text), text).toBeNull();
    }
  });
});
