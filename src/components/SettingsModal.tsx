'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_PREFS, DEFAULT_AI, PRESETS, loadPrefs, savePrefs, loadAi, saveAi, type Prefs, type AiPrefs } from '@/lib/settings';

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULT_PREFS, ...loadPrefs() }));
  const [ai, setAi] = useState<AiPrefs>(() => ({ ...DEFAULT_AI, ...loadAi() }));
  const [preset, setPreset] = useState('custom');
  // Reload saved prefs on every open so cancelled edits don't linger.
  useEffect(() => {
    if (open) {
      setPrefs({ ...DEFAULT_PREFS, ...loadPrefs() });
      setAi({ ...DEFAULT_AI, ...loadAi() });
    }
  }, [open ]);
  if (!open) return null;

  const applyPreset = (name: string) => {
    setPreset(name);
    if (PRESETS[name]) setAi(a => ({ ...a, baseUrl: PRESETS[name].baseUrl, model: PRESETS[name].model }));
  };

  const save = () => {
    savePrefs(prefs);
    saveAi(ai);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Settings"
        className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-xl p-5 text-[#1D1D1F]"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      >
        <h2 className="font-semibold mb-4">Settings</h2>
        <label className="block text-sm mb-3">
          <span className="block text-xs text-gray-500 mb-1">Default compiler</span>
          <select
            value={prefs.defaultCompiler}
            onChange={e => setPrefs({ ...prefs, defaultCompiler: e.target.value })}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
          >
            {['pdflatex', 'xelatex', 'lualatex', 'latexmk'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm mb-3">
          <span className="block text-xs text-gray-500 mb-1">Autosave delay</span>
          <select
            value={prefs.autosaveMs}
            onChange={e => setPrefs({ ...prefs, autosaveMs: Number(e.target.value) })}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
          >
            <option value={500}>0.5s (fast)</option>
            <option value={1000}>1s (default)</option>
            <option value={2000}>2s (fewer writes)</option>
          </select>
        </label>
        <label className="block text-sm mb-5">
          <span className="block text-xs text-gray-500 mb-1">Default PDF zoom</span>
          <select
            value={prefs.defaultScale}
            onChange={e => setPrefs({ ...prefs, defaultScale: Number(e.target.value) })}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
          >
            <option value={1}>100%</option>
            <option value={1.2}>120% (default)</option>
            <option value={1.5}>150%</option>
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={save} className="px-4 py-1.5 bg-[#0071E3] text-white rounded-lg text-sm font-medium">Save</button>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">Stored in this browser only. Server knobs (image, timeout) stay in env — see README.</p>

        <h3 className="font-semibold mt-5 mb-1">AI assistance <span className="font-normal text-gray-400">(optional)</span></h3>
        <p className="text-[11px] text-gray-400 mb-3">Bring your own key to get “Explain” suggestions on errors. Key stays in this browser; requests go straight to your endpoint via a thin proxy.</p>
        <label className="block text-sm mb-3">
          <span className="block text-xs text-gray-500 mb-1">Preset</span>
          <select
            value={preset}
            onChange={e => applyPreset(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
          >
            <option value="custom">Custom</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </label>
        <label className="block text-sm mb-3">
          <span className="block text-xs text-gray-500 mb-1">Base URL (OpenAI-compatible)</span>
          <input
            value={ai.baseUrl}
            onChange={e => setAi({ ...ai, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
            inputMode="url"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
          />
        </label>
        <label className="block text-sm mb-3">
          <span className="block text-xs text-gray-500 mb-1">Model</span>
          <input
            value={ai.model}
            onChange={e => setAi({ ...ai, model: e.target.value })}
            placeholder="gpt-4o-mini"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
          />
        </label>
        <label className="block text-sm mb-2">
          <span className="block text-xs text-gray-500 mb-1">API key (empty for keyless local servers)</span>
          <input
            type="password"
            value={ai.apiKey}
            onChange={e => setAi({ ...ai, apiKey: e.target.value })}
            placeholder="sk-…"
            autoComplete="off"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}
