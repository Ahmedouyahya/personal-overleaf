import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
  const { name, path, content = '' } = await req.json();
  if (!name?.trim() || !path?.trim()) return NextResponse.json({ error: 'name and path required' }, { status: 400 });

  const fileId = randomUUID();
  const now = Date.now();
  db.prepare(
    'INSERT INTO files (id, project_id, name, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(fileId, id, name.trim(), path.trim(), content, now, now);
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, id);

  return NextResponse.json(
    db.prepare('SELECT id, project_id, name, path, created_at, updated_at FROM files WHERE id = ?').get(fileId),
    { status: 201 },
  );
}
