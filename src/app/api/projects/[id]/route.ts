import { NextResponse } from 'next/server';
import { db, DATA_DIR } from '@/lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await req.json();
  const clean = typeof name === 'string' ? name.trim().slice(0, 100) : '';
  if (!clean) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(clean, Date.now(), id);
  return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.includes('/') || id.includes('..') || id.includes('\\'))
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  // Best-effort: remove orphaned uploads from disk (compile outputs expire with jobs).
  const { rm } = await import('fs/promises');
  const { join } = await import('path');
  await rm(join(DATA_DIR, 'projects', id), { recursive: true, force: true }).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
