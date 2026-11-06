// Review page for the exercise cards, served by the dev server only (never part of the build):
// cards.html#press.1 draws the card of press.1 exactly as the app does, so e2e/shots/cards.shots.ts
// can take a screenshot of every explained step (`npm run shots:cards`).
import { render } from 'preact';
import { ExerciseCard, prepare } from '../../src/ui/components/ExerciseCard.tsx';
import '../../src/ui/theme.css';
import '../../src/ui/app.css';

const root = document.getElementById('app');

async function show(): Promise<void> {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!root || id === '') return;
  await prepare(id);
  render(<ExerciseCard key={id} id={id} back="Tilbage" onClose={() => undefined} />, root);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => void show());
void show();
