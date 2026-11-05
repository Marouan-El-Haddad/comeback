import { render } from 'preact';
import { ProgramPage } from './ui/screens/ProgramPage.tsx';
import './ui/theme.css';

// Placeholder until milestone 2 builds the app itself.
function Placeholder() {
  return (
    <main class="prog">
      <h1>Comeback</h1>
      <p>Appen er under opbygning.</p>
      <p>
        <a href={`${import.meta.env.BASE_URL}program/`}>Programmet</a>
      </p>
      <p>
        <a href={`${import.meta.env.BASE_URL}probe/`}>Teknisk afprøvning (milepæl 0)</a>
      </p>
    </main>
  );
}

const path = location.pathname.slice(import.meta.env.BASE_URL.length).replace(/\/$/, '');
const root = document.getElementById('app');
if (root) render(path === 'program' ? <ProgramPage /> : <Placeholder />, root);
