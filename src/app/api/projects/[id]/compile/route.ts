import { db, DATA_DIR } from '@/lib/db';
import { compile } from '@/lib/compiler';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { writeFile } from 'fs/promises';

export const maxDuration = 300; // 5 min Vercel timeout hint (ignored locally)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const mainFile: string = body.mainFile ?? 'main.tex';
  const compiler: string = body.compiler ?? 'pdflatex';

  const files = db
    .prepare('SELECT path, content FROM files WHERE project_id = ?')
    .all(id) as Array<{ path: string; content: string }>;

  if (!files.length) {
    return new Response('data: {"type":"error","message":"No files in project"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const jobId = randomUUID();
  const now = Date.now();
  const outputDir = join(DATA_DIR, 'output', jobId);
  db.prepare(
    'INSERT INTO compile_jobs (id, project_id, status, compiler, main_file, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(jobId, id, 'running', compiler, mainFile, now);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (type: string, data: Record<string, unknown>) =>
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));

      try {
        const result = await compile({
          files,
          mainFile,
          compiler,
          outputDir,
          onLog: (chunk) => {
            for (const line of chunk.split('\n')) {
              if (line.trim()) send('log', { line });
            }
          },
        });

        const duration = Date.now() - now;
        const status = result.success ? 'success' : 'error';
        db.prepare(
          'UPDATE compile_jobs SET status = ?, finished_at = ?, duration_ms = ? WHERE id = ?',
        ).run(status, Date.now(), duration, jobId);

        await writeFile(join(outputDir, 'compile.log'), result.log, 'utf-8').catch(() => {});
        send('done', { jobId, success: result.success, duration });
      } catch (err: unknown) {
        db.prepare('UPDATE compile_jobs SET status = ?, finished_at = ? WHERE id = ?').run(
          'error', Date.now(), jobId,
        );
        send('error', { message: err instanceof Error ? err.message : String(err) });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
