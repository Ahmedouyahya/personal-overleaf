export type IssueKind = 'error' | 'warning' | 'badbox' | 'info';

export interface TexIssue {
  id: string;
  kind: IssueKind;
  message: string;
  file?: string;
  line?: number;
  endLine?: number;
  raw: string;
}

const MAX_ISSUES = 200;

const RE = {
  texError: /^!\s?(.*)$/,
  atLine: /(?:^|\s)l\.(\d+)\b/,
  inputLine: /on input line (\d+)/,
  linesRange: /lines? (\d+)(?:--(\d+))?/,
  latexWarning: /^LaTeX Warning:\s?(.*)$/i,
  packageWarning: /^Package (\S+) Warning:\s?(.*)$/i,
  overfull: /^Overfull \\(h|v)box\s?(.*)$/,
  underfull: /^Underfull \\(h|v)box\s?(.*)$/,
  noFile: /^No file (.*)\.$/,
  rerun: /Rerun to get (.*) right/,
};

/** Turn raw TeX console output into clickable issues (Overleaf-style). Pure — unit tested. */
export function parseLatexLog(input: string | string[]): TexIssue[] {
  const lines = Array.isArray(input) ? input : input.split('\n');
  const issues: TexIssue[] = [];
  const push = (i: Omit<TexIssue, 'id'>) => {
    if (issues.length >= MAX_ISSUES) return;
    issues.push({ ...i, id: `i${issues.length}` });
  };

  let pending: { message: string; raw: string[] } | null = null;
  const flushPending = (nextLine?: string) => {
    if (!pending) return;
    const raw = pending.raw.join('\n');
    const m = nextLine ? nextLine.match(RE.atLine) : null;
    const at = raw.match(RE.atLine);
    const line = m ? parseInt(m[1], 10) : at ? parseInt(at[1], 10) : undefined;
    push({ kind: 'error', message: pending.message, line, raw });
    pending = null;
  };

  for (const line of lines) {
    const err = line.match(RE.texError);
    if (err) {
      flushPending();
      pending = { message: err[1].trim() || 'TeX error', raw: [line] };
      continue;
    }
    if (pending) {
      if (line.trim() === '') {
        flushPending();
        continue;
      }
      pending.raw.push(line);
      if (pending.raw.length > 6 || RE.atLine.test(line)) {
        flushPending(line);
        continue;
      }
      continue;
    }

    let m: RegExpMatchArray | null;
    if ((m = line.match(RE.overfull))) {
      const lm = line.match(RE.linesRange);
      push({
        kind: 'badbox', message: `Overfull \\${m[1]}box${m[2] ? ' ' + m[2].trim() : ''}`.slice(0, 220),
        line: lm ? parseInt(lm[1], 10) : undefined,
        endLine: lm?.[2] ? parseInt(lm[2], 10) : undefined, raw: line,
      });
      continue;
    }
    if ((m = line.match(RE.underfull))) {
      const lm = line.match(RE.linesRange);
      push({
        kind: 'badbox', message: `Underfull \\${m[1]}box${m[2] ? ' ' + m[2].trim() : ''}`.slice(0, 220),
        line: lm ? parseInt(lm[1], 10) : undefined,
        endLine: lm?.[2] ? parseInt(lm[2], 10) : undefined, raw: line,
      });
      continue;
    }
    if ((m = line.match(RE.latexWarning))) {
      const lm = line.match(RE.inputLine);
      push({ kind: 'warning', message: m[1].trim().slice(0, 220) || 'LaTeX warning', line: lm ? parseInt(lm[1], 10) : undefined, raw: line });
      continue;
    }
    if ((m = line.match(RE.packageWarning))) {
      const lm = line.match(RE.inputLine);
      push({ kind: 'warning', message: `${m[1]}: ${m[2].trim()}`.slice(0, 220), line: lm ? parseInt(lm[1], 10) : undefined, raw: line });
      continue;
    }
    if ((m = line.match(RE.noFile))) {
      push({ kind: 'info', message: `No file ${m[1]} (compile again after first pass if needed)`, raw: line });
      continue;
    }
    if ((m = line.match(RE.rerun))) {
      push({ kind: 'info', message: `Rerun to get ${m[1]} right`, raw: line });
    }
  }
  flushPending();
  return issues;
}

export function countByKind(issues: TexIssue[]): Record<IssueKind, number> {
  const c: Record<IssueKind, number> = { error: 0, warning: 0, badbox: 0, info: 0 };
  for (const i of issues) c[i.kind] += 1;
  return c;
}

/**
 * Numbered source lines around an issue, for showing alongside an error and for
 * handing to an explainer as context. Returns '' when the issue has no line —
 * a warning about the whole document (e.g. an unset reference) has nothing to
 * point at, and guessing a window would be worse than sending none.
 */
export function contextForIssue(source: string, issue: TexIssue, radius = 12): string {
  if (!issue.line) return '';
  const lines = source.split('\n');
  const first = Math.max(1, issue.line - radius);
  const last = Math.min(lines.length, (issue.endLine ?? issue.line) + radius);
  return lines
    .slice(first - 1, last)
    .map((l, i) => `${first + i}: ${l}`)
    .join('\n');
}
