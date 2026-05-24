import { NextResponse } from 'next/server';
import { db, DATA_DIR } from '@/lib/db';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const formData = await req.formData();
  const uploads = formData.getAll('files') as File[];

  if (!uploads.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

  const uploadsDir = join(DATA_DIR, 'projects', id, 'uploads');
  await mkdir(uploadsDir, { recursive: true });

  const now = Date.now();
  const created: unknown[] = [];

  for (const file of uploads) {
    // Sanitise filename — keep extension, replace unsafe chars
    const safeName = file.name.replace(/[^a-zA-Z0-9._()-]/g, '_');
    const storagePath = join(uploadsDir, safeName);

    const bytes = await file.arrayBuffer();
    await writeFile(storagePath, Buffer.from(bytes));

    const fileId = randomUUID();
    db.prepare(
      `INSERT INTO files (id, project_id, name, path, content, storage_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', ?, ?, ?)`,
    ).run(fileId, id, safeName, safeName, storagePath, now, now);

    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, id);

    created.push(
      db.prepare(
        'SELECT id, project_id, name, path, created_at, updated_at FROM files WHERE id = ?',
      ).get(fileId),
    );
  }

  return NextResponse.json(created, { status: 201 });
}
