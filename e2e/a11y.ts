import type { Page } from '@playwright/test';

// SPEC 5 and 6 measured on a screen part: text size and the type scale, contrast against the
// background the text stands on, the size of everything you can tap, the space between two tap
// targets and the height of the primary button. Returns one line per problem, so a test can expect
// [].

export interface A11yRules {
  /** Smallest font size in CSS px (18 in a session, 16 elsewhere). */
  minFont: number;
  /** Smallest contrast ratio (7 in a session, 4.5 elsewhere). */
  minContrast: number;
  /** Smallest width and height of a button or a summary in CSS px. */
  minTarget: number;
  /** Smallest space between two tap targets on the screen in CSS px (SPEC 6: 8). */
  minGap?: number;
  /** Smallest height of a primary button in CSS px (SPEC 5: 64). */
  minPrimary?: number;
  /** The font sizes the type scale allows (SPEC 5); text in any other size is a problem. */
  scale?: readonly number[];
}

/**
 * The type scale (SPEC 5, DECISIONS.md D59): text 16 (outside a session), 18 and 20; headings 22
 * and 28; numbers 32 on a card and 64, 88 and 96 in a session.
 */
export const TYPE_SCALE: readonly number[] = [16, 18, 20, 22, 28, 32, 64, 88, 96];

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
      const inScale = (size: number) =>
        !rules.scale || rules.scale.some((step) => Math.abs(step - size) < 0.5);

      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (!visible(el)) continue;
        const ownText = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
        );
        const style = getComputedStyle(el);
        if (ownText) {
          const size = parseFloat(style.fontSize);
          if (size < rules.minFont) problems.push(`tekst ${size} px: »${name(el)}«`);
          else if (!inScale(size))
            problems.push(`tekst ${size} px uden for skalaen: »${name(el)}«`);
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
          else if (!inScale(size))
            problems.push(`tegn ${size} px uden for skalaen før »${name(el)}«`);
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
          if (rules.minPrimary && el.matches('.btn.primary') && box.height < rules.minPrimary)
            problems.push(`primærknap ${Math.round(box.height)} px høj: »${name(el)}«`);
        }
        if (el.matches('img') && !el.hasAttribute('alt'))
          problems.push(`billede uden tekstalternativ`);
      }

      // The space between two tap targets that are on the screen now: the ones a tap in their
      // middle reaches (not rolled away under the fixed actions, not outside the window). Content
      // that rolls under a fixed or sticky bar is not measured against the bar's buttons: each
      // layer (the page, a bar) is measured on its own.
      if (rules.minGap) {
        const layer = (el: Element): Element | null => {
          for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
            const position = getComputedStyle(e).position;
            if (position === 'fixed' || position === 'sticky') return e;
          }
          return null;
        };
        // Hit testing ignores the half second after a change of screen, when a session's buttons
        // take no taps (`pointer-events: none`, D33): for the test, everything takes them.
        const force = document.createElement('style');
        force.textContent = '* { pointer-events: auto !important; }';
        document.head.append(force);
        const targets = [...root.querySelectorAll('button, summary, a[href], input, select')]
          .filter(visible)
          .filter((el) => {
            const box = el.getBoundingClientRect();
            const x = box.left + box.width / 2;
            const y = box.top + box.height / 2;
            if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
            const hit = document.elementFromPoint(x, y);
            return !!hit && (hit === el || el.contains(hit));
          });
        force.remove();
        for (let i = 0; i < targets.length; i++) {
          for (let j = i + 1; j < targets.length; j++) {
            const a = targets[i];
            const b = targets[j];
            if (!a || !b || a.contains(b) || b.contains(a)) continue;
            if (layer(a) !== layer(b)) continue;
            const p = a.getBoundingClientRect();
            const q = b.getBoundingClientRect();
            const gap = Math.max(
              q.left - p.right,
              p.left - q.right,
              q.top - p.bottom,
              p.top - q.bottom,
            );
            if (gap < rules.minGap - 0.5)
              problems.push(`afstand ${Math.round(gap)} px: »${name(a)}« og »${name(b)}«`);
          }
        }
      }
      return problems;
    },
    { selector, rules },
  );
}

/** The session's rules (SPEC 6): 18 px, 7:1, 56 px; the exercise card keeps them everywhere. */
export const SESSION_RULES: A11yRules = {
  minFont: 18,
  minContrast: 7,
  minTarget: 56,
  minGap: 8,
  minPrimary: 64,
  scale: TYPE_SCALE,
};

/** Outside a session (SPEC 6): 16 px and 4,5:1, the same targets and the same type scale. */
export const APP_RULES: A11yRules = {
  minFont: 16,
  minContrast: 4.5,
  minTarget: 56,
  minGap: 8,
  minPrimary: 64,
  scale: TYPE_SCALE,
};
