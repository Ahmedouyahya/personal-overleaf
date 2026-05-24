import { NextResponse } from 'next/server';
import { db, DATA_DIR } from '@/lib/db';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { page, x, y } = await req.json();

  const job = db.prepare('SELECT status, main_file FROM compile_jobs WHERE id = ?').get(jobId) as
    | { status: string; main_file: string }
    | undefined;

  if (!job || job.status !== 'success')
    return NextResponse.json({ error: 'Job not found or not successful' }, { status: 404 });

  const pdfName = job.main_file.replace(/\.tex$/i, '') + '.pdf';
  const pdfPath = join(DATA_DIR, 'output', jobId, pdfName);

  if (!existsSync(pdfPath))
    return NextResponse.json({ error: 'PDF not found' }, { status: 404 });

  try {
    const { stdout } = await exec('synctex', [
      'edit', '-o', `${page}:${Math.round(x)}:${Math.round(y)}:${pdfPath}`,
    ]);

    const inputMatch = stdout.match(/^Input:(.+)$/m);
    const lineMatch  = stdout.match(/^Line:(\d+)$/m);

    if (!inputMatch || !lineMatch)
      return NextResponse.json({ error: 'No SyncTeX match at that position' }, { status: 404 });

    return NextResponse.json({
      file: basename(inputMatch[1].trim()),
      line: parseInt(lineMatch[1], 10),
    });
  } catch {
    return NextResponse.json({ error: 'SyncTeX not available' }, { status: 500 });
  }
}
