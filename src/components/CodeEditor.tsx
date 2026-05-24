'use client';

import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, historyKeymap, history, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { syntaxHighlighting, HighlightStyle, StreamLanguage, foldGutter, indentOnInput, bracketMatching } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// ── LaTeX stream tokenizer ──────────────────────────────────────────────────

interface LaTeXState { inMath: number; expectEnv: boolean }

const latexLanguage = StreamLanguage.define<LaTeXState>({
  name: 'latex',
  startState: () => ({ inMath: 0, expectEnv: false }),
  copyState: (s) => ({ ...s }),
  token(stream, state) {
    if (stream.peek() === '%') { stream.skipToEnd(); return 'ltxComment'; }

    if (state.inMath === 2) {
      if (stream.match('$$') || stream.match('\\]')) { state.inMath = 0; return 'mathDelim'; }
      if (stream.match('\\')) { stream.match(/^[a-zA-Z]+\*?/); return 'mathCmd'; }
      if (stream.match(/^[a-zA-Z0-9]+/)) return 'mathContent';
      stream.next(); return 'mathContent';
    }
    if (state.inMath === 1) {
      if (stream.match('$')) { state.inMath = 0; return 'mathDelim'; }
      if (stream.match('\\')) { stream.match(/^[a-zA-Z]+\*?/); return 'mathCmd'; }
      if (stream.match(/^[a-zA-Z0-9]+/)) return 'mathContent';
      stream.next(); return 'mathContent';
    }

    if (stream.match('\\[')) { state.inMath = 2; return 'mathDelim'; }
    if (stream.match('$$'))  { state.inMath = 2; return 'mathDelim'; }
    if (stream.match('$'))   { state.inMath = 1; return 'mathDelim'; }

    if (stream.peek() === '\\') {
      stream.next();
      const m = stream.match(/^[a-zA-Z]+\*?/);
      if (m) {
        const name = (m as RegExpMatchArray)[0];
        if (name === 'begin' || name === 'end') { state.expectEnv = true; return 'envKeyword'; }
        return 'ltxCmd';
      }
      stream.next(); return 'ltxCmd';
    }

    if (state.expectEnv) {
      if (stream.match('{')) return 'brace';
      if (stream.match(/^[a-zA-Z*]+/)) return 'envName';
      if (stream.match('}')) { state.expectEnv = false; return 'brace'; }
      state.expectEnv = false;
    }

    if (stream.match(/^[{}]/))   return 'brace';
    if (stream.match(/^[\[\]]/)) return 'sqbr';
    stream.next(); return null;
  },
  tokenTable: {
    ltxComment:  tags.lineComment,
    mathDelim:   tags.special(tags.operator),
    mathContent: tags.special(tags.string),
    mathCmd:     tags.function(tags.variableName),
    envKeyword:  tags.definitionKeyword,
    envName:     tags.typeName,
    ltxCmd:      tags.standard(tags.name),
    brace:       tags.brace,
    sqbr:        tags.squareBracket,
  },
});

const latexHighlight = HighlightStyle.define([
  { tag: tags.lineComment,                 color: '#565f89', fontStyle: 'italic' },
  { tag: tags.definitionKeyword,           color: '#bb9af7', fontWeight: '600' },
  { tag: tags.typeName,                    color: '#ff9e64' },
  { tag: tags.standard(tags.name),         color: '#7aa2f7' },
  { tag: tags.function(tags.variableName), color: '#7dcfff' },
  { tag: tags.special(tags.operator),      color: '#e0af68', fontWeight: '600' },
  { tag: tags.special(tags.string),        color: '#9ece6a' },
  { tag: tags.brace,                       color: '#89ddff' },
  { tag: tags.squareBracket,               color: '#89ddff' },
]);

const latexTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', backgroundColor: '#1a1b26', color: '#c0caf5' },
  '.cm-content': { fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',monospace", caretColor: '#7aa2f7', padding: '8px 0' },
  '.cm-cursor': { borderLeftColor: '#7aa2f7', borderLeftWidth: '2px' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.03)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.05)', color: '#737aa2' },
  '.cm-selectionBackground, ::selection': { backgroundColor: '#2d3f76 !important' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: '#2d3f76' },
  '.cm-gutters': { backgroundColor: '#16171f', borderRight: '1px solid #1f2233', color: '#3b4261' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '44px', paddingRight: '12px' },
  '.cm-matchingBracket': { backgroundColor: '#2d3f76', outline: '1px solid #7aa2f7', borderRadius: '2px' },
  '.cm-tooltip': { backgroundColor: '#1e2030', border: '1px solid #2d3f76', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', color: '#c0caf5' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#2d3f76' },
}, { dark: true });

// ── Component ────────────────────────────────────────────────────────────────

interface Props { content: string; onChange: (v: string) => void }

export default function CodeEditor({ content, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(), history(), foldGutter(), indentOnInput(),
          bracketMatching(), highlightActiveLine(), highlightActiveLineGutter(),
          highlightSelectionMatches(),
          autocompletion({ override: [latexCompletions as any] }),
          latexLanguage,
          syntaxHighlighting(latexHighlight),
          latexTheme,
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...completionKeymap, indentWithTab]),
          EditorView.updateListener.of(u => { if (u.docChanged) onChangeRef.current(u.state.doc.toString()); }),
        ],
      }),
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}

// ── LaTeX completions ─────────────────────────────────────────────────────────

function latexCompletions(ctx: import('@codemirror/autocomplete').CompletionContext) {
  const word = ctx.matchBefore(/\\[\w]*/);
  if (!word || (word.from === word.to && !ctx.explicit)) return null;
  const cmds = [
    '\\documentclass{}','\\usepackage{}','\\begin{document}','\\end{document}',
    '\\title{}','\\author{}','\\date{}','\\maketitle','\\tableofcontents',
    '\\part{}','\\chapter{}','\\section{}','\\subsection{}','\\subsubsection{}','\\paragraph{}',
    '\\textbf{}','\\textit{}','\\underline{}','\\emph{}','\\texttt{}','\\textsc{}',
    '\\label{}','\\ref{}','\\eqref{}','\\cite{}','\\citep{}','\\citet{}',
    '\\bibliography{}','\\bibliographystyle{}',
    '\\begin{figure}','\\begin{table}','\\begin{tabular}{}',
    '\\includegraphics{}','\\caption{}','\\hline',
    '\\begin{itemize}','\\begin{enumerate}','\\begin{description}','\\item',
    '\\begin{equation}','\\begin{equation*}','\\begin{align}','\\begin{align*}',
    '\\begin{gather}','\\begin{pmatrix}','\\begin{bmatrix}','\\begin{cases}',
    '\\frac{}{}','\\sqrt{}','\\sum','\\prod','\\int','\\iint','\\oint','\\lim',
    '\\infty','\\partial','\\nabla','\\cdot','\\cdots','\\ldots','\\times','\\div',
    '\\pm','\\leq','\\geq','\\neq','\\approx','\\equiv','\\in','\\notin',
    '\\subset','\\subseteq','\\cup','\\cap','\\forall','\\exists','\\to',
    '\\Rightarrow','\\Leftrightarrow','\\left(','\\right)','\\left[','\\right]',
    '\\left\\{','\\right\\}',
    '\\alpha','\\beta','\\gamma','\\delta','\\epsilon','\\zeta','\\eta','\\theta',
    '\\iota','\\kappa','\\lambda','\\mu','\\nu','\\xi','\\pi','\\rho',
    '\\sigma','\\tau','\\upsilon','\\phi','\\chi','\\psi','\\omega',
    '\\Gamma','\\Delta','\\Theta','\\Lambda','\\Xi','\\Pi','\\Sigma',
    '\\Upsilon','\\Phi','\\Psi','\\Omega',
    '\\newpage','\\clearpage','\\newline','\\noindent',
    '\\footnote{}','\\hspace{}','\\vspace{}','\\textcolor{}{}',
    '\\newcommand{}{}','\\renewcommand{}{}',
    '\\begin{abstract}','\\begin{thebibliography}','\\begin{lstlisting}',
  ];
  return {
    from: word.from,
    options: cmds
      .filter(c => c.startsWith(word.text))
      .map(c => ({ label: c, type: c.includes('{') ? 'function' : 'keyword' })),
  };
}
