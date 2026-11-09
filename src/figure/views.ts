// A figure's views (docs/SPEC.md 9.1, DECISIONS.md D58 and D60): its own, and a second one beside it
// where one is not enough – a squat from the side for the hip and the back, and from the front for
// the knees over the toes. Both follow the same phases and the same clock, with one loop length. The
// second view is drawn, animated and checked as a figure of its own: the same item and movement, its
// own angle, props, keyframes, transitions and marks, and the figure's red segments unless it names
// its own. The two stand side by side or over each other, whichever draws the smaller one larger.
import type { Fault, FigureItem, OwnMovement, View } from '../content/types.ts';
import { buildModel, CARD_TIMING, type FigureModel, type Timing } from './motion.ts';

/** The second view as a figure of its own, or null when the figure has none. */
export function secondFigure(figure: FigureItem): FigureItem | null {
  const second = figure.second;
  if (!second) return null;
  const base = {
    id: figure.id,
    ...(figure.movement !== undefined ? { movement: figure.movement } : {}),
    props: second.props,
    highlight: second.highlight ?? figure.highlight,
    keyframes: second.keyframes,
    ...(second.transitions ? { transitions: second.transitions } : {}),
    ...(second.marks ? { marks: second.marks } : {}),
    ...(second.inFront ? { inFront: second.inFront } : {}),
  };
  return second.view === 'side'
    ? { ...base, view: 'side', facing: second.facing }
    : { ...base, view: second.view };
}

/** The figure's views: its own first, then its second. */
export function figureViews(figure: FigureItem): FigureItem[] {
  const second = secondFigure(figure);
  return second ? [figure, second] : [figure];
}

/**
 * The models of a figure's views on one clock (L1 in the P1b review): a view that travels and ends
 * with its cut (it stands half a second where it got to, D58) gives the other view the same half
 * second at its first position, so both loops last as long and the views never drift apart.
 */
export function viewModels(
  figure: FigureItem,
  movement: OwnMovement,
  timing: Timing = CARD_TIMING,
): FigureModel[] {
  const views = figureViews(figure);
  const models = views.map((view) => buildModel(view, movement, timing));
  if (!models.some((m) => m.timeline.moves.at(-1)?.cut)) return models;
  return models.map((m, i) =>
    m.timeline.moves.at(-1)?.cut ? m : buildModel(views[i] as FigureItem, movement, timing, true),
  );
}

/** The gap between two views, in px (figure.css). */
export const VIEW_GAP = 8;

/** How wide a view is for its height as drawn: its box with the padding, its travel left out. */
export function viewAspect(model: FigureModel, still = false): number {
  const box = still || (model.travel && !model.fixed) ? model.stillBox : model.box;
  return (box.x1 - box.x0 + 6) / (box.y1 - box.y0 + 6);
}

/**
 * The heights the views are drawn at in a place `width` × `height` px (one view's height side by
 * side): side by side each gets half the width, over each other half the height (D60).
 */
export function drawnHeights(
  aspects: readonly number[],
  width: number,
  height: number,
  stacked: boolean,
  gap = VIEW_GAP,
): number[] {
  const w = stacked ? width : (width - gap) / 2;
  const h = stacked ? (height - gap) / 2 : height;
  return aspects.map((a) => Math.min(h, w / a));
}

/**
 * Whether two views stand over each other rather than side by side (M1 in the P1b review, D60):
 * whichever draws the smaller of them larger. A standing figure stands side by side; a lying one
 * over each other where the place is narrow, so a push-up beside the target is 240 × 66 px in each
 * view instead of 113 × 26 px.
 */
export function stackViews(aspects: readonly number[], width: number, height: number): boolean {
  if (aspects.length < 2 || width <= 0 || height <= 0) return false;
  const side = Math.min(...drawnHeights(aspects, width, height, false));
  const over = Math.min(...drawnHeights(aspects, width, height, true));
  return over > side + 0.5;
}

/** A view's name on the card and the contact sheet. */
export const VIEW_NAME: Record<View, string> = {
  side: 'Fra siden',
  front: 'Forfra',
  top: 'Ovenfra',
};

/** The view a typical mistake is drawn in: the figure's own unless it names the second's. */
export function faultFigure(figure: FigureItem, fault: Pick<Fault, 'view'>): FigureItem | null {
  if (fault.view === undefined || fault.view === figure.view) return figure;
  const second = secondFigure(figure);
  return second && second.view === fault.view ? second : null;
}
