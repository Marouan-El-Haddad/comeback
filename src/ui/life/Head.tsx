// The top of a screen shown in place of I dag or Uge (the club log, the Sunday check, »Flyt eller
// spring over«): »Tilbage« the size of its text, then what the screen is about and its title.
export function Head(props: { kicker: string; title: string; onClose: () => void }) {
  return (
    <>
      <button type="button" class="btn back" onClick={props.onClose}>
        Tilbage
      </button>
      <header class="life-head">
        <p class="life-kicker">{props.kicker}</p>
        <h1>{props.title}</h1>
      </header>
    </>
  );
}
