import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

export const DATA_DIR = join(process.cwd(), 'data');
mkdirSync(join(DATA_DIR, 'output'), { recursive: true });

const db = new Database(join(DATA_DIR, 'db.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id         TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name       TEXT NOT NULL,
    path       TEXT NOT NULL,
    content    TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS compile_jobs (
    id         TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    compiler   TEXT NOT NULL DEFAULT 'pdflatex',
    main_file  TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    finished_at INTEGER,
    duration_ms INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

export { db };
