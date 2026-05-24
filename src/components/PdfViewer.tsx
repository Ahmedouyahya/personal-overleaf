'use client';

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  url: string;
  pdfJobId?: string;
  onNavigate?: (file: string, line: number) => void;
}

export default function PdfViewer({ url, pdfJobId, onNavigate }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage]         = useState(1);
  const [scale, setScale]       = useState(1.2);
  const [error, setError]       = useState<string | null>(null);

  const handleDblClick = useCallback((e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (!pdfJobId || !onNavigate) return;
    const rect   = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    // Convert to PDF points (72 DPI baseline). react-pdf renders 1pt = 1px at scale=1.
    const pdfX = clickX / scale;
    const pdfY = (rect.height - clickY) / scale; // PDF Y is bottom-up
    fetch(`/api/jobs/${pdfJobId}/synctex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: pageNum, x: Math.round(pdfX), y: Math.round(pdfY) }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.file && data?.line) onNavigate(data.file, data.line); })
      .catch(() => {});
  }, [pdfJobId, onNavigate, scale]);

  return (
    <div className="flex flex-col h-full bg-[#1a1b26]">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-b border-[#1f2233] bg-[#16171f] text-xs text-[#737aa2]">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1 rounded hover:bg-white/10 disabled:opacity-30">
          <ChevronLeft size={13} />
        </button>
        <span>{page} / {numPages || '—'}</span>
        <button onClick={() => setPage(p => Math.min(numPages, p + 1))} disabled={page >= numPages} className="p-1 rounded hover:bg-white/10 disabled:opacity-30">
          <ChevronRight size={13} />
        </button>
        <div className="flex-1" />
        {onNavigate && (
          <span className="text-[10px] text-[#3b4261] select-none">double-click to jump to source</span>
        )}
        <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-1 rounded hover:bg-white/10"><ZoomOut size={13} /></button>
        <span className="w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-1 rounded hover:bg-white/10"><ZoomIn size={13} /></button>
        <a href={url} download="document.pdf" className="p-1 rounded hover:bg-white/10 hover:text-[#c0caf5]" title="Download">
          <Download size={13} />
        </a>
      </div>

      {/* PDF */}
      <div className="flex-1 overflow-auto flex flex-col items-center py-4 gap-4" style={{ background: '#525659' }}>
        {error ? (
          <div className="text-red-400 text-sm bg-red-950/20 rounded p-3 m-4">{error}</div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => { setNumPages(numPages); setError(null); }}
            onLoadError={e => setError('Failed to load PDF: ' + e.message)}
            loading={<div className="text-white/40 text-sm mt-8">Loading PDF…</div>}
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
              <div
                key={n}
                className="shadow-2xl mb-4"
                onDoubleClick={e => handleDblClick(e, n)}
                style={{ cursor: onNavigate ? 'crosshair' : 'default' }}
              >
                <Page pageNumber={n} scale={scale} renderTextLayer renderAnnotationLayer />
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
