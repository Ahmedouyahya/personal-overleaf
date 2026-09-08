import { NextResponse } from 'next/server';
import { db, DATA_DIR } from '@/lib/db';
import { randomUUID } from 'crypto';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const formData = await req.formData();
  const uploads = formData.getAll('files') as File[];

  if (!uploads.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  if (uploads.length > 10) return NextResponse.json({ error: 'Max 10 files per upload' }, { status: 400 });

  const uploadsDir = join(DATA_DIR, 'projects', id, 'uploads');
  await mkdir(uploadsDir, { recursive: true });

  const now = Date.now();
  const created: unknown[] = [];
  const MAX_BYTES = 10 * 1024 * 1024;

  for (const file of uploads) {
    // Sanitise filename — keep extension, replace unsafe chars
    const raw = (file.name || 'file').slice(0, 100);
    let safeName = raw.replace(/[^a-zA-Z0-9._()-]/g, '_').replace(/^\.+/, '_');
    if (!safeName || safeName === '.' || safeName === '..') safeName = 'file';
    if (file.size > MAX_BYTES) return NextResponse.json({ error: `File too large (max 10 MB): ${safeName}` }, { status: 413 });

    // Avoid overwriting an existing upload with the same name
    let storagePath = join(uploadsDir, safeName);
    let n = 1;
    const dot = safeName.lastIndexOf('.');
    const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
    const ext = dot > 0 ? safeName.slice(dot) : '';
    while (existsSync(storagePath)) {
      n += 1;
      if (n > 100) return NextResponse.json({ error: 'Too many name collisions' }, { status: 409 });
      storagePath = join(uploadsDir, `${stem}-${n}${ext}`);
    }
    const finalName = basename(storagePath);

    const bytes = await file.arrayBuffer();
    await writeFile(storagePath, Buffer.from(bytes));

    const fileId = randomUUID();
    db.prepare(
      `INSERT INTO files (id, project_id, name, path, content, storage_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', ?, ?, ?)`,
    ).run(fileId, id, finalName, finalName, storagePath, now, now);

    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, id);

    created.push(
      db.prepare(
        'SELECT id, project_id, name, path, storage_path, created_at, updated_at FROM files WHERE id = ?',
      ).get(fileId),
    );
  }

  return NextResponse.json(created, { status: 201 });
}
