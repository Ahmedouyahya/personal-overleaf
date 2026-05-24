import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), Date.now(), id);
  return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return new NextResponse(null, { status: 204 });
}
