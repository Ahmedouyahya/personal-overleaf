import { NextResponse } from 'next/server';
import { db, DATA_DIR } from '@/lib/db';
import { join } from 'path';
import { createReadStream, existsSync } from 'fs';
import { stat } from 'fs/promises';

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = db.prepare('SELECT * FROM compile_jobs WHERE id = ?').get(jobId) as
    | { status: string; main_file: string }
    | undefined;

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'success') return NextResponse.json({ error: 'PDF not ready' }, { status: 404 });

  const pdfName = job.main_file.replace(/\.tex$/i, '') + '.pdf';
  const pdfPath = join(DATA_DIR, 'output', jobId, pdfName);

  if (!existsSync(pdfPath)) return NextResponse.json({ error: 'PDF not found' }, { status: 404 });

  const { size } = await stat(pdfPath);
  const nodeStream = createReadStream(pdfPath);

  return new Response(nodeStream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(size),
      'Content-Disposition': 'inline; filename="document.pdf"',
    },
  });
}
