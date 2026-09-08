'use client';

export interface Prefs {
  defaultCompiler: string;
  autosaveMs: number;
  defaultScale: number;
}

export const DEFAULT_PREFS: Prefs = {
  defaultCompiler: 'pdflatex',
  autosaveMs: 1000,
  defaultScale: 1.2,
};

const KEY = 'personal-overleaf:prefs:v1';
const COMPILERS = ['pdflatex', 'xelatex', 'lualatex', 'latexmk'];

export function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      defaultCompiler: COMPILERS.includes(p.defaultCompiler ?? '') ? (p.defaultCompiler as string) : DEFAULT_PREFS.defaultCompiler,
      autosaveMs: [500, 1000, 2000].includes(p.autosaveMs ?? 0) ? (p.autosaveMs as number) : DEFAULT_PREFS.autosaveMs,
      defaultScale: typeof p.defaultScale === 'number' && p.defaultScale >= 0.5 && p.defaultScale <= 3
        ? p.defaultScale : DEFAULT_PREFS.defaultScale,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}
