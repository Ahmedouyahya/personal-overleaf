import Docker from 'dockerode';
import { mkdir, writeFile, rm, readdir, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

const IMAGE = process.env.TEXLIVE_IMAGE ?? 'localhost/latexforge/texlive:2024';
const TIMEOUT_MS = parseInt(process.env.COMPILE_TIMEOUT ?? '120', 10) * 1000;

export interface CompileResult {
  success: boolean;
  log: string;
}

export async function compile(opts: {
  files: Array<{ path: string; content: string }>;
  mainFile: string;
  compiler: string;
  outputDir: string;
  onLog?: (chunk: string) => void;
}): Promise<CompileResult> {
  const { files, mainFile, compiler, outputDir, onLog } = opts;

  const tmpBase = join(tmpdir(), `pers-latex-${Date.now()}`);
  const inputDir = join(tmpBase, 'input');
  const tmpOut = join(tmpBase, 'output');
  await mkdir(inputDir, { recursive: true });
  await mkdir(tmpOut, { recursive: true });

  for (const f of files) {
    const dest = join(inputDir, f.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, f.content, 'utf-8');
  }

  const main = mainFile.replace(/[^a-zA-Z0-9._/-]/g, '');
  const cmds: Record<string, string> = {
    pdflatex: `pdflatex -interaction=nonstopmode -halt-on-error -synctex=1 -output-directory=/output "${main}"`,
    xelatex:  `xelatex  -interaction=nonstopmode -halt-on-error -synctex=1 -output-directory=/output "${main}"`,
    lualatex: `lualatex -interaction=nonstopmode -halt-on-error -synctex=1 -output-directory=/output "${main}"`,
    latexmk:  `latexmk  -pdf -interaction=nonstopmode -halt-on-error -outdir=/output -synctex=1 -f "${main}"`,
  };
  const cmd = cmds[compiler] ?? cmds.pdflatex;

  const host = process.env.DOCKER_HOST ?? '/var/run/docker.sock';
  const socketPath = host.startsWith('unix://') ? host.slice(7) : host;
  const docker = new Docker({ socketPath });

  const container = await docker.createContainer({
    Image: IMAGE,
    Cmd: ['sh', '-c', cmd],
    WorkingDir: '/workspace',
    User: 'root',
    Env: ['HOME=/tmp', 'TMPDIR=/tmp'],
    HostConfig: {
      Binds: [`${inputDir}:/workspace:ro`, `${tmpOut}:/output:rw`],
      NetworkMode: 'none',
      ReadonlyRootfs: true,
      Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=512m', '/var/tmp': 'rw,noexec,nosuid,size=64m' },
      Memory: 512 * 1024 * 1024,
      MemorySwap: 512 * 1024 * 1024,
      NanoCpus: 1e9,
      PidsLimit: 50,
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges=true'],
      AutoRemove: false,
    },
  });

  let log = '';
  const stream = await container.attach({ stream: true, stdout: true, stderr: true });
  await container.start();

  container.modem.demuxStream(
    stream,
    { write: (c: Buffer) => { const t = c.toString('utf8'); log += t; onLog?.(t); } },
    { write: (c: Buffer) => { const t = c.toString('utf8'); log += t; onLog?.(t); } },
  );

  const exitCode = await Promise.race<number>([
    new Promise<number>((res) => container.wait((err, d) => res(err ? 1 : (d?.StatusCode ?? 1)))),
    new Promise<number>((_, rej) => setTimeout(() => rej(new Error('Compile timeout')), TIMEOUT_MS)),
  ]).catch(async (err) => { await container.kill().catch(() => {}); throw err; });

  await container.remove({ force: true }).catch(() => {});

  // Copy output files to persistent dir
  await mkdir(outputDir, { recursive: true });
  const outFiles = await readdir(tmpOut).catch(() => [] as string[]);
  for (const f of outFiles) await copyFile(join(tmpOut, f), join(outputDir, f)).catch(() => {});

  await rm(tmpBase, { recursive: true, force: true }).catch(() => {});

  return { success: exitCode === 0, log };
}
