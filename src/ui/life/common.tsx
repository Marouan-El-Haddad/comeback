// What the screens in place of I dag, Uge or Mere share (the club log, the Sunday check, Status):
// a row of toggle buttons under a label, and the close of a screen whose world changed.
import { useId } from 'preact/hooks';

/**
 * A row of toggle buttons under a label: several can be chosen (`multiple`), otherwise one or none
 * – a tap on the chosen one removes the choice. A chosen button is filled navy with aria-pressed.
 */
export function Toggles<T extends string | number>(props: {
  label: string;
  options: Array<[T, string]>;
  value: readonly T[];
  multiple?: boolean;
  columns?: 2 | 3 | 5;
  /** A group under a question (»Styrke A« under »Hvilken øvelse?«): a quieter label. */
  sub?: boolean;
  onChange: (value: T[]) => void;
}) {
  const id = useId();
  return (
    <section class="life-section">
      <p class={props.sub ? 'life-label sub' : 'life-label'} id={id}>
        {props.label}
      </p>
      <div class={`toggles cols-${props.columns ?? 3}`} role="group" aria-labelledby={id}>
        {props.options.map(([value, text]) => {
          const on = props.value.includes(value);
          return (
            <button
              key={String(value)}
              type="button"
              class={on ? 'btn selected' : 'btn'}
              aria-pressed={on}
              onClick={() =>
                props.onChange(
                  on
                    ? props.value.filter((v) => v !== value)
                    : props.multiple
                      ? [...props.value, value]
                      : [value],
                )
              }
            >
              {text}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Opened in the time machine and still open after »Afslut« (or the other way round): nothing is
 * written, and the screen closes (SPEC 3.7, D64, D65).
 */
export function otherWorld(onClose: () => void): Error {
  onClose();
  return new Error('the time machine started or ended');
}
