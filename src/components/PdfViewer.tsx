'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage]         = useState(1);
  const [scale, setScale]       = useState(1.2);
  const [error, setError]       = useState<string | null>(null);

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
              <div key={n} className="shadow-2xl mb-4">
                <Page pageNumber={n} scale={scale} renderTextLayer renderAnnotationLayer />
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
