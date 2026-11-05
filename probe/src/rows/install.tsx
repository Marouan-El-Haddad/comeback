import { Facts, Row, type Boot, type Status } from '../ui';

const MODES = ['fullscreen', 'standalone', 'minimal-ui', 'browser'] as const;

function displayMode(): string {
  return MODES.find((mode) => matchMedia(`(display-mode: ${mode})`).matches) ?? 'ukendt';
}

export function swStateText(
  registration: ServiceWorkerRegistration | null,
  swError: string | null,
): string {
  if (!('serviceWorker' in navigator)) return 'findes ikke';
  if (swError) return 'fejl';
  if (!registration) return 'registreres …';
  const state = registration.active ? 'aktiv' : registration.installing ? 'installeres' : 'venter';
  const control = navigator.serviceWorker.controller ? 'styrer siden' : 'styrer ikke siden endnu';
  return `${state}, ${control}`;
}

export function InstallRow(props: {
  boot: Boot;
  registration: ServiceWorkerRegistration | null;
  swError: string | null;
}) {
  const { boot, registration, swError } = props;
  const mode = displayMode();
  const standalone = mode === 'standalone' || mode === 'fullscreen';
  const manifest = document.querySelector('link[rel="manifest"]') !== null;

  let status: Status = 'waiting';
  let text = 'Installér fra menuen, og åbn fra ikonet – står der STANDALONE her?';
  if (!('serviceWorker' in navigator)) {
    status = 'red';
    text = 'Browseren har ingen service worker, så siden kan ikke installeres som app.';
  } else if (swError) {
    status = 'red';
    text = `Service worker kunne ikke registreres: ${swError}`;
  } else if (!manifest) {
    status = 'red';
    text = 'Manifestet mangler.';
  } else if (standalone && registration?.active) {
    status = 'green';
    text = 'Installeret og åbnet som app uden browserens adresselinje.';
  } else if (standalone) {
    text = 'STANDALONE – venter på, at service worker bliver aktiv.';
  } else if (boot.fromIcon) {
    status = 'red';
    text = 'Åbnet fra ikonet, men ikke som STANDALONE.';
  }

  return (
    <Row n={1} title="Installation" status={status} text={text}>
      <p class="big">{mode.toUpperCase()}</p>
      <Facts
        items={[
          ['Åbnet fra ikonet', boot.fromIcon ? 'ja' : 'nej'],
          ['Manifest', manifest ? 'fundet' : 'mangler'],
          ['Service worker', swStateText(registration, swError)],
        ]}
      />
    </Row>
  );
}
