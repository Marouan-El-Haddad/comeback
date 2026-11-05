import { useMemo } from 'preact/hooks';
import { CPH, copenhagenDate, errorText } from '../format';
import { Facts, Row } from '../ui';

type Check = { label: string; ok: boolean; seen: string };

function check(label: string, expected: string, compute: () => string): Check {
  try {
    const seen = compute();
    return { label, ok: seen === expected, seen };
  } catch (error) {
    return { label, ok: false, seen: errorText(error) };
  }
}

/** Fixed dates with known answers, so the result does not depend on today's date. */
function runChecks(): Check[] {
  const winter = new Date(Date.UTC(2026, 10, 10, 12)); // tirsdag 10. november 2026, 13:00 i København
  const summer = new Date(Date.UTC(2026, 6, 1, 12)); // 1. juli 2026, 14:00 i København
  const hour = (date: Date) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: CPH, hour: '2-digit', hourCycle: 'h23' }).format(
      date,
    );
  // Weekday and month are read as separate parts; their order depends on the locale data.
  const danish = (date: Date) => {
    const parts = new Intl.DateTimeFormat('da-DK', {
      timeZone: CPH,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '?';
    return `${part('weekday')} ${part('month')}`;
  };
  return [
    check('Vintertid i København', '13', () => hour(winter)),
    check('Sommertid i København', '14', () => hour(summer)),
    check('Dansk ugedag og måned', 'tirsdag november', () => danish(winter)),
    check('en-CA giver ÅÅÅÅ-MM-DD', '2026-11-10', () =>
      new Intl.DateTimeFormat('en-CA', { timeZone: CPH }).format(winter),
    ),
  ];
}

export function TimeRow({ now }: { now: Date }) {
  const checks = useMemo(runChecks, []);
  const failed = checks.filter((c) => !c.ok);
  const clock = (timeZone?: string) =>
    new Intl.DateTimeFormat('da-DK', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(now);
  const todayDanish = new Intl.DateTimeFormat('da-DK', {
    timeZone: CPH,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  return (
    <Row
      n={7}
      title="Tid og sprog"
      status={failed.length === 0 ? 'green' : 'red'}
      text={
        failed.length === 0
          ? 'Datoer kan regnes i København og vises på dansk, uanset browserens indstillinger.'
          : `Fejl i: ${failed.map((c) => c.label).join(', ')}.`
      }
    >
      <Facts
        items={[
          ['Tidszone (browser)', Intl.DateTimeFormat().resolvedOptions().timeZone],
          ['Sprog (browser)', navigator.languages.join(', ') || navigator.language],
          ['I dag i København', `${copenhagenDate(now)}, ${todayDanish}`],
          ['Klokken lokalt', clock()],
          ['Klokken i København', clock(CPH)],
          ...checks.map((c): [string, string] => [c.label, `${c.ok ? 'OK' : 'FEJL'} (${c.seen})`]),
        ]}
      />
    </Row>
  );
}
