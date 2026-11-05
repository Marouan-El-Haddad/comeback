// References to the programme PDF, its page numbers and sources outside the app. The app explains
// itself and never shows them (docs/DECISIONS.md A2). The tests run findSourceRef on the UI's texts,
// the programme data and content/; the UI shows the programme's own prose through withoutSources.

/** A page reference in parentheses, as the programme writes it: »(side 37)«, »(s. 7)«. */
const PAGE = String.raw`\((?:PDF[ -])?(?:side|sider|s\.)\s*\d+(?:\s*[–-]\s*\d+)?\)`;
/** A citation in parentheses: »(Edwards 2023)«, »(van Dyk 2019)«. */
const CITATION = String.raw`\([\p{L}'’ .&-]*\p{Lu}[\p{L}'’-]*,?\s(?:19|20)\d{2}[a-z]?\)`;

const PATTERNS: RegExp[] = [
  /\bPDF/iu,
  /\bsidetal/iu,
  // »side 47« with at most one space (or a no-break space); a tab or a line break is a new table
  // cell or line in the screen's text, not a page number.
  /\b(?:side|sider|s\.)[ \xa0]?\d/iu,
  /\bkild(?:e|en|ens|er|erne|ernes)\b/iu,
  new RegExp(CITATION, 'u'),
  /\bhttps?:\/\//iu,
  /\bwww\./iu,
];

/** The first reference to the PDF, a page or a source in the text, or null. */
export function findSourceRef(text: string): string | null {
  for (const pattern of PATTERNS) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }
  return null;
}

/** The programme's prose without page references and citations, for showing it in the app. */
export function withoutSources(text: string): string {
  return text
    .replace(new RegExp(String.raw`\s*${PAGE}`, 'giu'), '')
    .replace(new RegExp(String.raw`\s*${CITATION}`, 'gu'), '')
    .replace(/ {2,}/g, ' ')
    .trim();
}
