// Tones from docs/SPEC.md section 5 (Lyd), synthesised with Web Audio. Square wave at high gain so
// they carry from the floor (docs/DECISIONS.md D17).
type Tone = { freq: number; start: number; dur: number };

export const SOUNDS = {
  tik: [{ freq: 880, start: 0, dur: 0.06 }],
  go: [
    { freq: 660, start: 0, dur: 0.1 },
    { freq: 990, start: 0.1, dur: 0.1 },
  ],
  slut: [
    { freq: 660, start: 0, dur: 0.15 },
    { freq: 880, start: 0.2, dur: 0.15 },
    { freq: 1320, start: 0.4, dur: 0.3 },
  ],
} satisfies Record<string, Tone[]>;

export type Sound = keyof typeof SOUNDS;

const GAIN = 0.8;
let context: AudioContext | null = null;

/** Creates or resumes the shared AudioContext. Call it from a tap. */
export async function audioContext(): Promise<AudioContext> {
  context ??= new AudioContext();
  if (context.state !== 'running') await context.resume();
  return context;
}

/** Schedules a sound at `at` seconds on the context's clock. */
export function play(ctx: AudioContext, sound: Sound, at = ctx.currentTime): void {
  for (const tone of SOUNDS[sound]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = tone.freq;
    const t0 = at + tone.start;
    const t1 = t0 + tone.dur;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(GAIN, t0 + 0.005);
    gain.gain.setValueAtTime(GAIN, t1 - 0.005);
    gain.gain.linearRampToValueAtTime(0, t1);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(t0);
    oscillator.stop(t1 + 0.01);
  }
}
