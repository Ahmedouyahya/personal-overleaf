import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type Ctx = { params: Promise<{ id: string; fileId: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  const row = db.prepare('SELECT * FROM files WHERE id = ? AND project_id = ?').get(fileId, id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  const body = await req.json();
  const now = Date.now();
  const cols: string[] = [];
  const vals: unknown[] = [];

  if (body.content !== undefined) { cols.push('content = ?'); vals.push(body.content); }
  if (body.name !== undefined)    { cols.push('name = ?');    vals.push(body.name); }
  if (body.path !== undefined)    { cols.push('path = ?');    vals.push(body.path); }
  if (!cols.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  cols.push('updated_at = ?');
  vals.push(now, fileId, id);
  db.prepare(`UPDATE files SET ${cols.join(', ')} WHERE id = ? AND project_id = ?`).run(...vals);
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, id);

  return NextResponse.json(db.prepare('SELECT * FROM files WHERE id = ?').get(fileId));
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  db.prepare('DELETE FROM files WHERE id = ? AND project_id = ?').run(fileId, id);
  return new NextResponse(null, { status: 204 });
}
