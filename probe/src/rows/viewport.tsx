import { formatNumber } from '../format';
import { Facts, Row } from '../ui';

export function ViewportRow() {
  const visual = window.visualViewport;
  return (
    <Row n={10} title="Viewport" status="green" text="Aflæst. Læs tallene op.">
      <p class="big">
        {innerWidth} × {innerHeight}
      </p>
      <Facts
        items={[
          ['innerWidth × innerHeight', `${innerWidth} × ${innerHeight}`],
          ['devicePixelRatio', formatNumber(devicePixelRatio)],
          ['Skærm (screen)', `${screen.width} × ${screen.height}`],
          [
            'visualViewport',
            visual ? `${Math.round(visual.width)} × ${Math.round(visual.height)}` : 'findes ikke',
          ],
        ]}
      />
    </Row>
  );
}
