import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isSafePath } from '@/lib/validate';
import { randomUUID } from 'crypto';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = db.prepare(
    'SELECT id, project_id, name, path, storage_path, created_at, updated_at FROM files WHERE project_id = ? ORDER BY path',
  ).all(id);
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { name, path, content = '' } = await req.json();
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 100) : '';
  const cleanPath = typeof path === 'string' ? path.trim() : '';
  if (!cleanName || !isSafePath(cleanPath))
    return NextResponse.json({ error: 'Valid name and safe path required (no absolute paths or ..)' }, { status: 400 });

  const dup = db.prepare('SELECT id FROM files WHERE project_id = ? AND path = ?').get(id, cleanPath);
  if (dup) return NextResponse.json({ error: 'A file with this path already exists' }, { status: 409 });

  const fileId = randomUUID();
  const now = Date.now();
  db.prepare(
    'INSERT INTO files (id, project_id, name, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(fileId, id, cleanName, cleanPath, typeof content === 'string' ? content.slice(0, 1_000_000) : '', now, now);
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, id);

  return NextResponse.json(
    db.prepare('SELECT id, project_id, name, path, storage_path, created_at, updated_at FROM files WHERE id = ?').get(fileId),
    { status: 201 },
  );
}
