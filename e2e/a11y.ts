import type { Page } from '@playwright/test';

// SPEC 6 measured on a screen part: text size, contrast against the background it stands on, and
// the size of everything you can tap. Returns one line per problem, so a test can expect [].

export interface A11yRules {
  /** Smallest font size in CSS px (18 in a session, 16 elsewhere). */
  minFont: number;
  /** Smallest contrast ratio (7 in a session, 4.5 elsewhere). */
  minContrast: number;
  /** Smallest width and height of a button or a summary in CSS px. */
  minTarget: number;
}

export function a11yProblems(page: Page, selector: string, rules: A11yRules): Promise<string[]> {
  return page.evaluate(
    ({ selector, rules }) => {
      const root = document.querySelector(selector);
      if (!root) return [`${selector} findes ikke`];
      const problems: string[] = [];

      const rgba = (value: string): [number, number, number, number] => {
        const m = /rgba?\(([^)]+)\)/.exec(value);
        if (!m?.[1]) return [0, 0, 0, 0];
        const parts = m[1]
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
      };
      const luminance = ([r, g, b]: [number, number, number, number]): number => {
        const lin = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };
      const background = (el: Element | null): [number, number, number, number] => {
        for (let e = el; e; e = e.parentElement) {
          const bg = rgba(getComputedStyle(e).backgroundColor);
          if (bg[3] > 0) return bg;
        }
        return [255, 255, 255, 1];
      };
      const visible = (el: Element) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      };
      const name = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);

      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (!visible(el)) continue;
        const ownText = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
        );
        const style = getComputedStyle(el);
        if (ownText) {
          const size = parseFloat(style.fontSize);
          if (size < rules.minFont) problems.push(`tekst ${size} px: »${name(el)}«`);
          const fg = luminance(rgba(style.color));
          const bg = luminance(background(el));
          const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
          if (ratio < rules.minContrast)
            problems.push(`kontrast ${ratio.toFixed(2)}:1: »${name(el)}«`);
        }
        // Generated text: the numbers of the steps (a counter) and the fold markers (a string).
        const before = getComputedStyle(el, '::before');
        if (/^"[^"]|counter\(/.test(before.content)) {
          const size = parseFloat(before.fontSize);
          if (size < rules.minFont) problems.push(`tegn ${size} px før »${name(el)}«`);
          const fg = luminance(rgba(before.color));
          const bg = luminance(background(el));
          const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
          if (ratio < rules.minContrast)
            problems.push(`kontrast ${ratio.toFixed(2)}:1 før »${name(el)}«`);
        }
        if (el.matches('button, summary, a[href], input, select')) {
          const box = el.getBoundingClientRect();
          if (box.height < rules.minTarget || box.width < rules.minTarget)
            problems.push(
              `trykflade ${Math.round(box.width)} × ${Math.round(box.height)} px: »${name(el)}«`,
            );
        }
        if (el.matches('img') && !el.hasAttribute('alt'))
          problems.push(`billede uden tekstalternativ`);
      }
      return problems;
    },
    { selector, rules },
  );
}

/** The session's rules (SPEC 6): 18 px, 7:1, 56 px; the exercise card keeps them everywhere. */
export const SESSION_RULES: A11yRules = { minFont: 18, minContrast: 7, minTarget: 56 };
