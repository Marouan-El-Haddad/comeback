// The figure format's lengths (docs/SPEC.md 9.1), in a module of their own: src/content/types.ts is
// part of the start files, so the figure system, which is loaded with the exercise card, takes them
// from here and nothing of them lands in the start files (docs/SPEC.md 7, DECISIONS.md D48).

/** Segment lengths in figure units, as the pictograms (tools/pictos/picto.py). */
export const BODY = {
  shin: 23,
  thigh: 24,
  torso: 30,
  upperArm: 16,
  forearm: 15,
  neck: 11,
  headRadius: 6.4,
  /** Ankle to toes, or wrist to fingers, when a tip is given as an angle. */
  tip: 7.5,
} as const;

/** Front view: the default widths of the shoulders and the pelvis. */
export const FRONT_WIDTH = { shoulders: 22, hips: 12 } as const;
