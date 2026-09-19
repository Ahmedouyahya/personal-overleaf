'use client';

export interface Prefs {
  defaultCompiler: string;
  autosaveMs: number;
  defaultScale: number;
}

export interface AiPrefs {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
};

export const DEFAULT_AI: AiPrefs = { baseUrl: '', model: '', apiKey: '' };

export const DEFAULT_PREFS: Prefs = {
  defaultCompiler: 'pdflatex',
  autosaveMs: 1000,
  defaultScale: 1.2,
};

const KEY = 'personal-overleaf:prefs:v1';
const AI_KEY = 'personal-overleaf:ai:v1';
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

/** BYOK AI creds — browser-only, never sent anywhere except your configured endpoint. */
export function loadAi(): AiPrefs {
  if (typeof window === 'undefined') return DEFAULT_AI;
  try {
    const raw = window.localStorage.getItem(AI_KEY);
    if (!raw) return DEFAULT_AI;
    const p = JSON.parse(raw) as Partial<AiPrefs>;
    const baseUrl = typeof p.baseUrl === 'string' ? p.baseUrl.trim().replace(/\/+$/, '').slice(0, 200) : '';
    try {
      if (baseUrl) {
        const u = new URL(baseUrl);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return DEFAULT_AI;
      }
    } catch {
      return DEFAULT_AI;
    }
    return {
      baseUrl,
      model: typeof p.model === 'string' ? p.model.trim().slice(0, 100) : '',
      apiKey: typeof p.apiKey === 'string' ? p.apiKey.trim().slice(0, 500) : '',
    };
  } catch {
    return DEFAULT_AI;
  }
}

export function saveAi(p: AiPrefs): void {
  try {
    window.localStorage.setItem(AI_KEY, JSON.stringify({ baseUrl: p.baseUrl, model: p.model, apiKey: p.apiKey }));
  } catch {}
}
