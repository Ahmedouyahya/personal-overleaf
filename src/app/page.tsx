'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FolderOpen, Trash2, Edit3, BookOpen } from 'lucide-react';

interface Project { id: string; name: string; created_at: number; updated_at: number }

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const router = useRouter();

  useEffect(() => { load(); }, []);

  const load = () =>
    fetch('/api/projects').then(r => r.json()).then(setProjects);

  const create = async () => {
    if (!newName.trim()) return;
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const p = await res.json();
    setCreating(false);
    setNewName('');
    router.push(`/editor/${p.id}`);
  };

  const del = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this project?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    load();
  };

  const rename = async () => {
    if (!renaming || !renaming.name.trim()) return;
    await fetch(`/api/projects/${renaming.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renaming.name.trim() }),
    });
    setRenaming(null);
    load();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#0071E3] flex items-center justify-center">
              <BookOpen size={14} className="text-white" />
            </div>
            <span className="font-semibold text-[#1D1D1F]">Personal Overleaf</span>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0071E3] text-white rounded-lg text-sm font-medium hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Plus size={14} /> New Project
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* New project form */}
        {creating && (
          <div className="mb-5 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium mb-3">New Project</p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setCreating(false); }}
                placeholder="Project name"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/30"
              />
              <button onClick={create} className="px-4 py-1.5 bg-[#0071E3] text-white rounded-lg text-sm font-medium hover:brightness-110">
                Create
              </button>
              <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Project list */}
        {projects.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <FolderOpen size={44} className="mx-auto mb-4 opacity-30" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm mt-1">Create your first LaTeX project to get started</p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => router.push(`/editor/${p.id}`)}
                className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4 cursor-pointer hover:-translate-y-px hover:shadow-md transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-[#0071E3]/10 flex items-center justify-center shrink-0">
                  <FolderOpen size={18} className="text-[#0071E3]" />
                </div>

                {renaming?.id === p.id ? (
                  <input
                    autoFocus
                    value={renaming.name}
                    onChange={e => setRenaming({ ...renaming, name: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setRenaming(null); }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 px-2 py-0.5 border border-[#0071E3] rounded text-sm focus:outline-none"
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1D1D1F] truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Updated {new Date(p.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                )}

                <div
                  className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => setRenaming({ id: p.id, name: p.name })}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  ><Edit3 size={13} /></button>
                  <button
                    onClick={e => del(p.id, e)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                  ><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
