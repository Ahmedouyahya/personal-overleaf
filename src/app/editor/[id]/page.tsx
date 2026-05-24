'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ChevronLeft, Play, FileText, Plus, Trash2, Loader2,
  CheckCircle2, TriangleAlert, Eye, Terminal, ChevronRight,
} from 'lucide-react';

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false });
const PdfViewer  = dynamic(() => import('@/components/PdfViewer'),  { ssr: false });

interface FileEntry { id: string; name: string; path: string }
interface Job { id: string; success: boolean; duration: number }

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [projectName, setProjectName] = useState('');
  const [files, setFiles]             = useState<FileEntry[]>([]);
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [content, setContent]         = useState('');
  const [mainFile, setMainFile]       = useState('main.tex');
  const [compiler, setCompiler]       = useState('pdflatex');

  const [compiling, setCompiling]     = useState(false);
  const [logs, setLogs]               = useState<string[]>([]);
  const [job, setJob]                 = useState<Job | null>(null);
  const [pdfJobId, setPdfJobId]       = useState<string | null>(null);
  const [rightTab, setRightTab]       = useState<'pdf' | 'log'>('pdf');
  const [sidebar, setSidebar]         = useState(true);
  const [newFile, setNewFile]         = useState('');
  const [showNew, setShowNew]         = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestContent = useRef('');

  useEffect(() => { loadProject(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProject = async () => {
    const [pr, fr] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch(`/api/projects/${projectId}/files`),
    ]);
    const project = await pr.json();
    const fileList: FileEntry[] = await fr.json();
    setProjectName(project.name);
    setFiles(fileList);
    if (fileList.length) {
      const f = fileList.find(f => f.path === 'main.tex') ?? fileList[0];
      openFile(f.id, fileList);
    }
  };

  const openFile = async (id: string, list?: FileEntry[]) => {
    setActiveId(id);
    const res = await fetch(`/api/projects/${projectId}/files/${id}`);
    const f = await res.json();
    setContent(f.content ?? '');
    latestContent.current = f.content ?? '';
    const fl = list ?? files;
    const entry = fl.find(e => e.id === id);
    if (entry?.path.endsWith('.tex')) setMainFile(entry.path);
  };

  const handleChange = (val: string) => {
    latestContent.current = val;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(val), 1000);
  };

  const save = async (c?: string) => {
    if (!activeId) return;
    await fetch(`/api/projects/${projectId}/files/${activeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: c ?? latestContent.current }),
    });
  };

  const addFile = async () => {
    if (!newFile.trim()) return;
    const name = newFile.trim();
    const res = await fetch(`/api/projects/${projectId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path: name }),
    });
    const f = await res.json();
    const updated = [...files, { id: f.id, name: f.name, path: f.path }];
    setFiles(updated);
    setShowNew(false);
    setNewFile('');
    openFile(f.id, updated);
  };

  const delFile = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this file?')) return;
    await fetch(`/api/projects/${projectId}/files/${id}`, { method: 'DELETE' });
    const updated = files.filter(f => f.id !== id);
    setFiles(updated);
    if (activeId === id) {
      if (updated.length) openFile(updated[0].id, updated);
      else { setActiveId(null); setContent(''); }
    }
  };

  const compile = async () => {
    await save();
    setCompiling(true);
    setLogs([]);
    setRightTab('log');

    const res = await fetch(`/api/projects/${projectId}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainFile, compiler }),
    });
    if (!res.body) { setCompiling(false); return; }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === 'log') setLogs(p => [...p, evt.line]);
          if (evt.type === 'done') {
            setJob({ id: evt.jobId, success: evt.success, duration: evt.duration });
            if (evt.success) { setPdfJobId(evt.jobId); setRightTab('pdf'); }
          }
        } catch {}
      }
    }
    setCompiling(false);
  };

  return (
    <div className="h-screen flex flex-col bg-[#1a1b26] text-[#c0caf5] overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-2 bg-[#16171f] border-b border-[#1f2233]">
        <button onClick={() => router.push('/')} className="p-1.5 rounded hover:bg-white/10 text-[#737aa2]">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium truncate max-w-[200px]">{projectName}</span>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <select
            value={compiler}
            onChange={e => setCompiler(e.target.value)}
            className="text-xs bg-[#1f2233] border border-[#2d3f76] rounded px-2 py-1 text-[#c0caf5] focus:outline-none"
          >
            <option value="pdflatex">pdflatex</option>
            <option value="xelatex">xelatex</option>
            <option value="lualatex">lualatex</option>
            <option value="latexmk">latexmk</option>
          </select>

          {files.filter(f => f.path.endsWith('.tex')).length > 1 && (
            <select
              value={mainFile}
              onChange={e => setMainFile(e.target.value)}
              className="text-xs bg-[#1f2233] border border-[#2d3f76] rounded px-2 py-1 text-[#c0caf5] max-w-[140px] focus:outline-none"
            >
              {files.filter(f => f.path.endsWith('.tex')).map(f => (
                <option key={f.id} value={f.path}>{f.path}</option>
              ))}
            </select>
          )}

          <button
            onClick={compile}
            disabled={compiling}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0071E3] text-white rounded-lg text-xs font-medium hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {compiling ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {compiling ? 'Compiling…' : 'Compile'}
          </button>

          {job && (
            <span className={`flex items-center gap-1 text-xs ${job.success ? 'text-[#9ece6a]' : 'text-[#ff7b72]'}`}>
              {job.success
                ? <><CheckCircle2 size={12} /> {(job.duration / 1000).toFixed(1)}s</>
                : <><TriangleAlert size={12} /> Error</>}
            </span>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        {sidebar ? (
          <aside className="w-48 shrink-0 bg-[#16171f] border-r border-[#1f2233] flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f2233]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#565f89]">Files</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setShowNew(v => !v)} className="p-1 rounded hover:bg-white/10 text-[#565f89]" title="New file">
                  <Plus size={13} />
                </button>
                <button onClick={() => setSidebar(false)} className="p-1 rounded hover:bg-white/10 text-[#565f89]" title="Hide">
                  <ChevronLeft size={13} />
                </button>
              </div>
            </div>

            {showNew && (
              <div className="px-2 py-1.5 border-b border-[#1f2233]">
                <input
                  autoFocus
                  value={newFile}
                  onChange={e => setNewFile(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addFile(); if (e.key === 'Escape') setShowNew(false); }}
                  placeholder="file.tex"
                  className="w-full text-xs px-2 py-1 bg-[#1f2233] border border-[#2d3f76] rounded text-[#c0caf5] focus:outline-none"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-1">
              {files.map(f => (
                <div
                  key={f.id}
                  onClick={() => openFile(f.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs group ${
                    activeId === f.id
                      ? 'bg-[#2d3f76] text-[#c0caf5]'
                      : 'text-[#737aa2] hover:bg-white/5 hover:text-[#c0caf5]'
                  }`}
                >
                  <FileText size={12} className="shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{f.path}</span>
                  <button
                    onClick={e => delFile(f.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-[#ff7b72] transition-opacity"
                  ><Trash2 size={10} /></button>
                </div>
              ))}
            </div>
          </aside>
        ) : (
          <button
            onClick={() => setSidebar(true)}
            className="w-7 shrink-0 bg-[#16171f] border-r border-[#1f2233] flex items-center justify-center hover:bg-white/5 text-[#565f89]"
            title="Show files"
          >
            <ChevronRight size={13} />
          </button>
        )}

        {/* Code editor */}
        <div className="flex-1 overflow-hidden">
          {activeId ? (
            <CodeEditor key={activeId} content={content} onChange={handleChange} />
          ) : (
            <div className="h-full flex items-center justify-center text-[#565f89] text-sm">
              Select a file to edit
            </div>
          )}
        </div>

        {/* PDF / Log panel */}
        <div className="w-[45%] shrink-0 border-l border-[#1f2233] flex flex-col">
          {/* Tabs */}
          <div className="shrink-0 flex border-b border-[#1f2233]">
            {(['pdf', 'log'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                  rightTab === tab
                    ? 'text-[#7aa2f7] border-b-2 border-[#7aa2f7]'
                    : 'text-[#565f89] hover:text-[#c0caf5]'
                }`}
              >
                {tab === 'pdf' ? <Eye size={12} /> : <Terminal size={12} />}
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'pdf' ? (
              pdfJobId ? (
                <PdfViewer url={`/api/jobs/${pdfJobId}/pdf`} />
              ) : (
                <div className="h-full flex items-center justify-center text-[#565f89] text-sm">
                  {compiling ? (
                    <div className="text-center">
                      <Loader2 size={28} className="animate-spin mx-auto mb-2 opacity-30" />
                      <p>Compiling…</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p>No PDF yet</p>
                      <p className="text-xs mt-1 text-[#3b4261]">Press Compile to build</p>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="h-full overflow-y-auto font-mono text-[11px] leading-relaxed p-3 text-[#9ca3af] whitespace-pre-wrap break-all">
                {logs.length === 0 ? (
                  <span className="text-[#3b4261]">No output yet — press Compile.</span>
                ) : logs.join('\n')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
