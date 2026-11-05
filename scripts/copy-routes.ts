// GitHub Pages serves static files only: the app's routes get a copy of index.html, so a direct
// link such as /comeback/program/ opens the app on that page. Run by `npm run build`.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES = ['program'];
for (const route of ROUTES) {
  mkdirSync(join('dist', route), { recursive: true });
  copyFileSync(join('dist', 'index.html'), join('dist', route, 'index.html'));
}
console.log(`Routes: ${ROUTES.map((r) => `/${r}/`).join(', ')}`);
