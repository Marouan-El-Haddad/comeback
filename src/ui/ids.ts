// Event ids (ULID: time-sortable, 26 characters) and the event factory the engine is given. Ids and
// timestamps are made here, outside the engine, which has no clock or randomness (D26).
import type { AppEvent, EventBody, EventFactory, ISODate } from '../engine/types.ts';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(now: number): string {
  let time = now;
  let out = '';
  for (let i = 0; i < 10; i++) {
    out = (ENCODING[time % 32] ?? '0') + out;
    time = Math.floor(time / 32);
  }
  const random = crypto.getRandomValues(new Uint8Array(16));
  for (const byte of random) out += ENCODING[byte % 32] ?? '0';
  return out;
}

/** Events stamped with the real clock (`now`), or the time machine's clock. */
export function eventFactory(now: () => number = () => Date.now()): EventFactory {
  return (body: EventBody, date: ISODate): AppEvent => {
    const t = now();
    return { ...body, id: ulid(t), at: new Date(t).toISOString(), date, v: 1 };
  };
}
