// The app's version: commit date and short hash (docs/DECISIONS.md D31), set by vite.config.ts.
// Shown under Om and kept with each start-up time on Diagnose (D42).
declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
