import { render } from 'preact';
import { openStore } from './storage/store.ts';
import { App } from './ui/App.tsx';
import { Model } from './ui/model.ts';
import { ProgramPage } from './ui/screens/ProgramPage.tsx';
import { registerServiceWorker } from './ui/sw.ts';
import './ui/theme.css';
import './ui/app.css';

const root = document.getElementById('app');
const path = location.pathname.slice(import.meta.env.BASE_URL.length).replace(/\/$/, '');

function StartError({ message }: { message: string }) {
  return (
    <main class="screen">
      <h1>Appen kunne ikke starte</h1>
      <p>Dine data er ikke slettet. Luk appen helt, og åbn den igen.</p>
      <p class="muted">{message}</p>
    </main>
  );
}

async function boot(container: HTMLElement): Promise<void> {
  try {
    const store = await openStore();
    const loaded = await store.load();
    const model = new Model(store, loaded.events, Date.now());
    model.restoredFromMirror = loaded.restoredFromMirror;
    render(<App model={model} />, container);
    await model.refreshDay();
  } catch (error) {
    render(
      <StartError message={error instanceof Error ? error.message : String(error)} />,
      container,
    );
  }
}

if (root) {
  if (path === 'program') render(<ProgramPage />, root);
  else void boot(root);
}
registerServiceWorker();
