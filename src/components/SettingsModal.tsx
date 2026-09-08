'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from '@/lib/settings';

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULT_PREFS, ...loadPrefs() }));
  // Reload saved prefs on every open so cancelled edits don't linger.
  useEffect(() => {
    if (open) setPrefs({ ...DEFAULT_PREFS, ...loadPrefs() });
  }, [open ]);
  if (!open) return null;

  const save = () => {
    savePrefs(prefs);
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
      </div>
    </div>
  );
}
