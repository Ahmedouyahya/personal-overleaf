export const ALLOWED_COMPILERS = ['pdflatex', 'xelatex', 'lualatex', 'latexmk'] as const;
export type CompilerName = (typeof ALLOWED_COMPILERS)[number];

export function isCompiler(value: unknown): value is CompilerName {
  return typeof value === 'string' && (ALLOWED_COMPILERS as readonly string[]).includes(value);
}

/** Reject absolute paths, `..` escapes, empty segments and overlong input. */
export function isSafePath(p: unknown, maxLen = 200): p is string {
  if (typeof p !== 'string') return false;
  const s = p.trim();
  if (!s || s.length > maxLen) return false;
  if (s.startsWith('/') || s.includes('\\') || s.includes('\0')) return false;
  const segs = s.split('/');
  for (const seg of segs) {
    if (!seg || seg === '.' || seg === '..') return false;
    if (seg.length > 100) return false;
  }
  return true;
}

/** Escape user text embedded in generated LaTeX (e.g. \title{...}). */
export function escapeLatex(s: string): string {
  return s.replace(/([\\{}$&#%_^~])/g, '\\$1');
}

/** Finite positive number within bounds (for SyncTeX coords). */
export function isFiniteNumber(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}
