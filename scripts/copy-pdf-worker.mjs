import { copyFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const dest = join(root, 'public', 'pdf.worker.min.mjs');

await mkdir(join(root, 'public'), { recursive: true });
if (existsSync(src)) {
  await copyFile(src, dest);
  console.log('[setup] pdf worker vendored → public/pdf.worker.min.mjs');
} else {
  console.warn('[setup] pdfjs-dist worker not found; run npm install first');
}
