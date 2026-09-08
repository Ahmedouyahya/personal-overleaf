import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isSafePath } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string; fileId: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  const row = db.prepare(
    'SELECT id, project_id, name, path, content, storage_path, created_at, updated_at FROM files WHERE id = ? AND project_id = ?',
  ).get(fileId, id) as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { storage_path, ...rest } = row;
  return NextResponse.json({ ...rest, isBinary: !!storage_path });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  const body = await req.json();
  const now = Date.now();
  const cols: string[] = [];
  const vals: unknown[] = [];

  if (body.content !== undefined) {
    if (typeof body.content !== 'string') return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    cols.push('content = ?'); vals.push(body.content.slice(0, 1_000_000));
  }
  if (body.name !== undefined) {
    const clean = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    if (!clean) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    cols.push('name = ?'); vals.push(clean);
  }
  if (body.path !== undefined) {
    const clean = typeof body.path === 'string' ? body.path.trim() : '';
    if (!isSafePath(clean)) return NextResponse.json({ error: 'Unsafe path (no absolute paths or ..)' }, { status: 400 });
    const dup = db.prepare('SELECT id FROM files WHERE project_id = ? AND path = ? AND id != ?').get(id, clean, fileId);
    if (dup) return NextResponse.json({ error: 'A file with this path already exists' }, { status: 409 });
    cols.push('path = ?'); vals.push(clean);
  }
  if (!cols.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  cols.push('updated_at = ?');
  vals.push(now, fileId, id);
  db.prepare(`UPDATE files SET ${cols.join(', ')} WHERE id = ? AND project_id = ?`).run(...vals);
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, id);

  const updated = db.prepare(
    'SELECT id, project_id, name, path, content, storage_path, created_at, updated_at FROM files WHERE id = ?',
  ).get(fileId) as Record<string, unknown>;
  const { storage_path, ...rest } = updated;
  return NextResponse.json({ ...rest, isBinary: !!storage_path });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  const row = db.prepare('SELECT storage_path FROM files WHERE id = ? AND project_id = ?').get(fileId, id) as
    | { storage_path: string | null }
    | undefined;
  db.prepare('DELETE FROM files WHERE id = ? AND project_id = ?').run(fileId, id);
  // Best-effort: remove the orphaned upload from disk.
  if (row?.storage_path) {
    const { unlink } = await import('fs/promises');
    await unlink(row.storage_path).catch(() => {});
  }
  return new NextResponse(null, { status: 204 });
}
