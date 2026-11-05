import { render } from 'preact';

// Placeholder until milestone 2 builds the app itself.
function Placeholder() {
  return (
    <main>
      <h1>Comeback</h1>
      <p>Appen er under opbygning.</p>
      <p>
        <a href={`${import.meta.env.BASE_URL}probe/`}>Teknisk afprøvning (milepæl 0)</a>
      </p>
    </main>
  );
}

const root = document.getElementById('app');
if (root) render(<Placeholder />, root);
