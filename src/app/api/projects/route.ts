import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET() {
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const id = randomUUID();
  const now = Date.now();
  db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, name.trim(), now, now);

  const fileId = randomUUID();
  const defaultTex = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

\\title{${name.trim()}}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
Hello, world!

\\end{document}
`;
  db.prepare(
    'INSERT INTO files (id, project_id, name, path, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(fileId, id, 'main.tex', 'main.tex', defaultTex, now, now);

  return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id), { status: 201 });
}
