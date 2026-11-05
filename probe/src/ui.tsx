import type { ComponentChildren } from 'preact';
import { formatDateTime } from './format';
import type { Outcome, Results } from './store';

export type Status = 'green' | 'red' | 'waiting';

/** Facts about this page load, captured before anything else runs. */
export type Boot = {
  /** The page was served by the probe's service worker. */
  controlled: boolean;
  online: boolean;
  /** Opened through the manifest's start_url, i.e. from the home-screen icon. */
  fromIcon: boolean;
};

/** Stores test results that need your action, so they survive closing the app. */
export type Recorder = (patch: Partial<Results>) => void;

const LABEL: Record<Status, string> = { green: 'GRØN', red: 'RØD', waiting: 'VENTER' };

export function Row(props: {
  n: number;
  title: string;
  status: Status;
  text: string;
  children?: ComponentChildren;
}) {
  return (
    <section class="row" data-row={props.n}>
      <div class="row-head">
        <h2>
          {props.n}. {props.title}
        </h2>
        <span class={`status status-${props.status}`} data-status={props.status}>
          {LABEL[props.status]}
        </span>
      </div>
      <p class="row-text">{props.text}</p>
      {props.children}
    </section>
  );
}

export type Fact = [label: string, value: ComponentChildren];

export function Facts({ items }: { items: Fact[] }) {
  return (
    <dl class="facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function outcomeText(outcome: Outcome | undefined, notTried = 'ikke prøvet'): string {
  if (!outcome) return notTried;
  return `${outcome.ok ? 'OK' : 'FEJL'}: ${outcome.text} (${formatDateTime(outcome.at)})`;
}

/** Red if a tried check failed, green if every check passed, otherwise waiting. */
export function combine(checks: (boolean | undefined)[]): Status {
  if (checks.some((c) => c === false)) return 'red';
  if (checks.length > 0 && checks.every((c) => c === true)) return 'green';
  return 'waiting';
}
