'use client';

import { useMemo, useState } from 'react';
import { CircleAlert, Info, Loader2, Sparkles, Terminal, TriangleAlert } from 'lucide-react';
import { contextForIssue, countByKind, parseLatexLog, type IssueKind, type TexIssue } from '@/lib/latex-errors';
import { loadAi } from '@/lib/settings';

interface ErrorPanelProps {
  logs: string[];
  compiling: boolean;
  /** Content of the file currently open, used as context for explanations. */
  source: string;
  onJump: (line: number) => void;
}

const KIND_STYLE: Record<IssueKind, { Icon: typeof Info; className: string }> = {
  error: { Icon: CircleAlert, className: 'text-[#f7768e]' },
  warning: { Icon: TriangleAlert, className: 'text-[#e0af68]' },
  badbox: { Icon: TriangleAlert, className: 'text-[#565f89]' },
  info: { Icon: Info, className: 'text-[#7aa2f7]' },
};

export default function ErrorPanel({ logs, compiling, source, onJump }: ErrorPanelProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const issues = useMemo(() => parseLatexLog(logs), [logs]);
  const counts = useMemo(() => countByKind(issues), [issues]);

  const explain = async (issue: TexIssue) => {
    const { baseUrl, model, apiKey } = loadAi();
    if (!baseUrl || !model) {
      setAiError('Set an AI endpoint in Settings to use explanations.');
      return;
    }
    setExplaining(issue.id);
    setAiError(null);
    try {
      const res = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          model,
          apiKey,
          issue: issue.raw || issue.message,
          context: contextForIssue(source, issue),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setExplanations((p) => ({ ...p, [issue.id]: data.suggestion }));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Could not reach the AI endpoint');
    } finally {
      setExplaining(null);
    }
  };

  if (logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center font-mono text-[11px] text-[#3b4261]">
        {compiling ? 'Compiling…' : 'No output yet — press Compile.'}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[#1f2233] text-[11px]">
        {issues.length === 0 ? (
          <span className="text-[#9ece6a]">No problems found.</span>
        ) : (
          (['error', 'warning', 'badbox', 'info'] as const)
            .filter((k) => counts[k] > 0)
            .map((k) => {
              const { Icon, className } = KIND_STYLE[k];
              return (
                <span key={k} className={`flex items-center gap-1 ${className}`}>
                  <Icon size={12} />
                  {counts[k]}
                  <span className="text-[#565f89]">{k === 'badbox' ? 'box' : k}</span>
                </span>
              );
            })
        )}
        <button
          onClick={() => setShowRaw((v) => !v)}
          title={showRaw ? 'Show parsed issues' : 'Show raw log'}
          className={`ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
            showRaw ? 'text-[#7aa2f7] bg-[#1f2233]' : 'text-[#565f89] hover:text-[#c0caf5]'
          }`}
        >
          <Terminal size={12} />
          raw
        </button>
      </div>

      {aiError && (
        <div className="shrink-0 px-3 py-1.5 text-[11px] text-[#f7768e] border-b border-[#1f2233]">
          {aiError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed">
        {showRaw ? (
          <div className="p-3 text-[#9ca3af] whitespace-pre-wrap break-all">{logs.join('\n')}</div>
        ) : issues.length === 0 ? (
          <div className="p-3 text-[#3b4261]">Compile finished without errors or warnings.</div>
        ) : (
          issues.map((issue) => {
            const { Icon, className } = KIND_STYLE[issue.kind];
            return (
              <div key={issue.id} className="border-b border-[#1f2233]/60 px-3 py-2">
                <div className="flex items-start gap-2">
                  <Icon size={13} className={`mt-0.5 shrink-0 ${className}`} />
                  <span className="flex-1 text-[#c0caf5] break-words">{issue.message}</span>
                  {issue.line !== undefined && (
                    <button
                      onClick={() => onJump(issue.line as number)}
                      className="shrink-0 text-[#7aa2f7] hover:underline"
                      title={`Jump to line ${issue.line}`}
                    >
                      line {issue.line}
                    </button>
                  )}
                  <button
                    onClick={() => explain(issue)}
                    disabled={explaining === issue.id}
                    className="shrink-0 flex items-center gap-1 text-[#565f89] hover:text-[#7aa2f7] disabled:opacity-50"
                    title="Explain this with your configured AI endpoint"
                  >
                    {explaining === issue.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    explain
                  </button>
                </div>
                {explanations[issue.id] && (
                  <p className="mt-1.5 ml-5 text-[#9ece6a] whitespace-pre-wrap break-words">{explanations[issue.id]}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
