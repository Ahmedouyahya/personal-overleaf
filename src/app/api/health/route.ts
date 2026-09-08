import { NextResponse } from 'next/server';
import { db, DATA_DIR } from '@/lib/db';
import { existsSync } from 'fs';

export async function GET() {
  const timeoutRaw = process.env.COMPILE_TIMEOUT ?? '120';
  const timeout = parseInt(timeoutRaw, 10);
  const socketDefault = process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock';
  const socket = process.env.DOCKER_HOST ?? socketDefault;
  let socketOk = true;
  if (!socket.includes('pipe')) {
    const path = socket.startsWith('unix://') ? socket.slice(7) : socket;
    socketOk = existsSync(path);
  }
  let dbOk = true;
  try {
    db.prepare('SELECT 1').get();
  } catch {
    dbOk = false;
  }
  const ok = dbOk && Number.isFinite(timeout) && timeout > 0;
  return NextResponse.json(
    {
      ok,
      checks: {
        db: dbOk ? 'ok' : 'error',
        dockerSocket: socketOk ? 'ok' : 'missing (is Docker running?)',
        dataDir: existsSync(DATA_DIR) ? 'ok' : 'missing',
      },
      config: {
        texliveImage: process.env.TEXLIVE_IMAGE ?? 'localhost/latexforge/texlive:2024',
        compileTimeoutSec: Number.isFinite(timeout) && timeout > 0 ? timeout : 120,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
