import { describe, expect, it } from 'vitest';
import { contextForIssue, countByKind, parseLatexLog, type TexIssue } from './latex-errors';

const issue = (over: Partial<TexIssue> = {}): TexIssue => ({
  id: 'i0',
  kind: 'error',
  message: 'boom',
  raw: '! boom',
  ...over,
});

/** A slice of real pdflatex console output, in the shape the compiler returns it. */
const REAL_LOG = `This is pdfTeX, Version 3.141592653-2.6-1.40.25
(/usr/share/texlive/texmf-dist/tex/latex/base/article.cls
Document Class: article 2023/05/17 v1.4n Standard LaTeX document class
)
Runaway argument?
{\contentsline {section}{Intro}{1}{}\n
! Paragraph ended before \\contentsline was complete.
<to be read again>
                   \\par
l.42 \\tableofcontents

! Undefined control sequence.
l.57 \\includegraphics
                      {missing-figure}
LaTeX Warning: Reference \`fig:one' on page 1 undefined on input line 63.
Package hyperref Warning: Rerun to get outlines right
Overfull \\hbox (14.22636pt too wide) in paragraph at lines 71--73
[]\\OT1/cmr/m/n/10 This line is simply too long for the text block
Underfull \\vbox (badness 10000) has occurred while \\output is active [1]
No file main.toc.
Rerun to get cross-references right.
`;

describe('parseLatexLog', () => {
  it('returns no issues for clean output', () => {
    expect(parseLatexLog('This is pdfTeX\nOutput written on main.pdf (1 page).')).toEqual([]);
  });

  it('handles empty input', () => {
    expect(parseLatexLog('')).toEqual([]);
  });

  it('parses a real log into issues of every kind', () => {
    const issues = parseLatexLog(REAL_LOG);

    expect(issues.map((i) => i.kind)).toEqual([
      'error', // Paragraph ended before \contentsline was complete.
      'error', // Undefined control sequence.
      'warning', // LaTeX Warning: undefined reference
      'warning', // Package hyperref Warning
      'badbox', // Overfull \hbox
      'badbox', // Underfull \vbox
      'info', // No file main.toc
      'info', // Rerun to get cross-references right
    ]);
  });

  it('captures the line number reported as "l.N"', () => {
    const [first, second] = parseLatexLog(REAL_LOG);

    expect(first.message).toBe('Paragraph ended before \\contentsline was complete.');
    expect(first.line).toBe(42);

    expect(second.message).toBe('Undefined control sequence.');
    expect(second.line).toBe(57);
  });

  it('keeps the raw console lines that produced an error', () => {
    const [first] = parseLatexLog(REAL_LOG);
    expect(first.raw).toContain('! Paragraph ended before \\contentsline was complete.');
    expect(first.raw).toContain('l.42 \\tableofcontents');
  });

  it('reads the line number of warnings from "on input line N"', () => {
    const warning = parseLatexLog(REAL_LOG).find((i) => i.kind === 'warning' && i.message.startsWith('Reference'));
    expect(warning?.line).toBe(63);
  });

  it('namespaces package warnings with the package name', () => {
    const warning = parseLatexLog(REAL_LOG).find((i) => i.message.startsWith('hyperref:'));
    expect(warning?.message).toBe('hyperref: Rerun to get outlines right');
    expect(warning?.kind).toBe('warning');
  });

  it('parses overfull boxes with their line range', () => {
    const box = parseLatexLog(REAL_LOG).find((i) => i.message.startsWith('Overfull'));
    expect(box?.kind).toBe('badbox');
    expect(box?.line).toBe(71);
    expect(box?.endLine).toBe(73);
  });

  it('parses underfull boxes', () => {
    const box = parseLatexLog(REAL_LOG).find((i) => i.message.startsWith('Underfull'));
    expect(box?.kind).toBe('badbox');
    expect(box?.line).toBeUndefined();
  });

  it('surfaces missing files and rerun hints as info', () => {
    const info = parseLatexLog(REAL_LOG).filter((i) => i.kind === 'info');
    expect(info.map((i) => i.message)).toEqual([
      'No file main.toc (compile again after first pass if needed)',
      'Rerun to get cross-references right',
    ]);
  });

  it('accepts pre-split lines as well as a single string', () => {
    const lines = ['! Undefined control sequence.', 'l.12 \\bad'];
    expect(parseLatexLog(lines)).toEqual(parseLatexLog(lines.join('\n')));
  });

  it('assigns a unique id to every issue', () => {
    const ids = parseLatexLog(REAL_LOG).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('caps the number of reported issues', () => {
    const noisy = Array.from({ length: 500 }, () => 'Rerun to get cross-references right.');
    const issues = parseLatexLog(noisy);

    expect(issues).toHaveLength(200);
    expect(issues.at(-1)?.id).toBe('i199');
  });

  it('falls back to a generic message for a bare "!"', () => {
    expect(parseLatexLog('!')[0].message).toBe('TeX error');
  });
});

describe('contextForIssue', () => {
  const source = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n');

  it('sends nothing when the issue has no line to point at', () => {
    expect(contextForIssue(source, issue())).toBe('');
  });

  it('returns a numbered window around the issue', () => {
    const excerpt = contextForIssue(source, issue({ line: 20 }), 2);
    expect(excerpt).toBe('18: line 18\n19: line 19\n20: line 20\n21: line 21\n22: line 22');
  });

  it('clamps the window to the start of the file', () => {
    expect(contextForIssue(source, issue({ line: 1 }), 2)).toBe('1: line 1\n2: line 2\n3: line 3');
  });

  it('clamps the window to the end of the file', () => {
    expect(contextForIssue(source, issue({ line: 40 }), 2)).toBe('38: line 38\n39: line 39\n40: line 40');
  });

  it('covers the whole range of a multi-line issue', () => {
    const excerpt = contextForIssue(source, issue({ line: 10, endLine: 14 }), 1);
    expect(excerpt).toBe('9: line 9\n10: line 10\n11: line 11\n12: line 12\n13: line 13\n14: line 14\n15: line 15');
  });
});

describe('countByKind', () => {
  it('counts every kind, including the ones at zero', () => {
    expect(countByKind(parseLatexLog(REAL_LOG))).toEqual({
      error: 2,
      warning: 2,
      badbox: 2,
      info: 2,
    });
  });

  it('returns zeroes for an empty list', () => {
    expect(countByKind([])).toEqual({ error: 0, warning: 0, badbox: 0, info: 0 });
  });
});
