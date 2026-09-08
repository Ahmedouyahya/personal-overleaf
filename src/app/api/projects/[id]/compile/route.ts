import { db, DATA_DIR } from '@/lib/db';
import { compile } from '@/lib/compiler';
import { isCompiler, isSafePath } from '@/lib/validate';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { writeFile } from 'fs/promises';

export const maxDuration = 300; // 5 min Vercel timeout hint (ignored locally)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const mainFile: string = typeof body.mainFile === 'string' ? body.mainFile : 'main.tex';
  const compiler: string = isCompiler(body.compiler) ? body.compiler : 'pdflatex';

  if (!isSafePath(mainFile) || !mainFile.endsWith('.tex')) {
    return new Response('data: {"type":"error","message":"Invalid mainFile (must be a safe .tex path)"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const files = db
    .prepare('SELECT path, content, storage_path FROM files WHERE project_id = ?')
    .all(id) as Array<{ path: string; content: string; storage_path: string | null }>;

  if (!files.length) {
    return new Response('data: {"type":"error","message":"No files in project"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  if (!files.some(f => f.path === mainFile)) {
    return new Response('data: {"type":"error","message":"mainFile not found in project"}\n\n', {
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
          files: files.map(f => ({
            path: f.path,
            content: f.storage_path ? undefined : f.content,
            storagePath: f.storage_path ?? undefined,
          })),
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
        // Retention: keep only the 10 newest jobs per project (disk + rows).
        try {
          const stale = db.prepare(
            'SELECT id FROM compile_jobs WHERE project_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 10',
          ).all(id) as Array<{ id: string }>;
          const { rm } = await import('fs/promises');
          for (const s of stale) {
            await rm(join(DATA_DIR, 'output', s.id), { recursive: true, force: true }).catch(() => {});
            db.prepare('DELETE FROM compile_jobs WHERE id = ?').run(s.id);
          }
        } catch {}
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
