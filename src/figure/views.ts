// A figure's views (docs/SPEC.md 9.1, DECISIONS.md D58): its own, and a second one beside it where
// one is not enough – a squat from the side for the hip and the back, and from the front for the
// knees over the toes. Both follow the same phases and the same clock. The second view is drawn,
// animated and checked as a figure of its own: the same item and movement, its own angle, props,
// keyframes, transitions and marks, and the figure's red segments unless it names its own.
import type { Fault, FigureItem, View } from '../content/types.ts';

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
