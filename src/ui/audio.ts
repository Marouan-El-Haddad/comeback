// Tones from docs/SPEC.md section 5, synthesised with Web Audio: square wave at high gain so they
// carry from the floor (docs/DECISIONS.md D17, M0 point 6). No vibration (D21).
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
  minut: [{ freq: 990, start: 0, dur: 0.45 }],
  halv: [
    { freq: 880, start: 0, dur: 0.08 },
    { freq: 880, start: 0.14, dur: 0.08 },
  ],
} satisfies Record<string, Tone[]>;

export type Sound = keyof typeof SOUNDS;

const GAIN = 0.8;
let context: AudioContext | null = null;

export type AudioState = 'off' | 'running' | 'suspended' | 'blocked' | 'unsupported';

let lastError: string | null = null;

/** Creates or resumes the shared AudioContext. Call it from a tap (user gesture). */
export async function enableAudio(): Promise<AudioState> {
  if (typeof AudioContext === 'undefined') return 'unsupported';
  try {
    context ??= new AudioContext();
    if (context.state !== 'running') await context.resume();
    lastError = null;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    return 'blocked';
  }
  return audioState();
}

export function audioState(): AudioState {
  if (typeof AudioContext === 'undefined') return 'unsupported';
  if (!context) return 'off';
  if (lastError) return 'blocked';
  return context.state === 'running' ? 'running' : 'suspended';
}

/** Plays a sound now, or `delay` seconds from now. Silent when audio is not enabled. */
export function play(sound: Sound, delay = 0): void {
  const ctx = context;
  if (!ctx || ctx.state !== 'running') return;
  const at = ctx.currentTime + delay;
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
