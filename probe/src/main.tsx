import { render } from 'preact';
import { App } from './app';
import './style.css';
import type { Boot } from './ui';
import { BACKGROUND } from './version';

const boot: Boot = {
  controlled: 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null,
  online: navigator.onLine,
  fromIcon: new URLSearchParams(location.search).get('source') === 'pwa',
};

document.documentElement.style.setProperty('--probe-bg', BACKGROUND);
const root = document.getElementById('app');
if (root) render(<App boot={boot} />, root);
