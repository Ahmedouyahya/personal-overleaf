# Personal Overleaf

Minimal offline single-user LaTeX editor — Next.js + SQLite + Docker.

Create projects, edit `.tex` files with LaTeX highlighting + autocomplete, upload figures, compile with `pdflatex` / `xelatex` / `lualatex` / `latexmk` in an isolated container, preview the PDF, and double-click the PDF to jump back to source (SyncTeX).

## Quickstart

Prerequisites: Node 22+, Docker running.

```bash
cp .env.example .env.local   # optional, defaults work
npm install
npm run dev                  # http://localhost:3000
```

Compile needs a TeX Live Docker image (default `localhost/latexforge/texlive:2024`, override via `TEXLIVE_IMAGE`):

```bash
docker pull texlive/texlive:latest
TEXLIVE_IMAGE=texlive/texlive:latest npm run dev
```

Or with Compose:

```bash
docker compose up --build    # http://localhost:3000
```

## Usage

1. Dashboard (`/`): New Project → auto-creates `main.tex`, rename / delete from the list.
2. Editor (`/editor/[id]`): left = files, middle = code, right = PDF / Log tabs.
3. Pick compiler + main file in the header, press Compile (or `Ctrl/Cmd+Enter`).
4. Double-click PDF to jump to the `.tex` line (needs `synctex` binary on host for reverse lookup).
5. Upload `.png` / `.pdf` figures via the upload button; reference with `\includegraphics{filename}`.

## Env

| Var | Default | Purpose |
| --- | ------- | ------- |
| `TEXLIVE_IMAGE` | `localhost/latexforge/texlive:2024` | TeX Live image spawned per compile |
| `COMPILE_TIMEOUT` | `120` | Seconds before a compile is killed |
| `DOCKER_HOST` | `/var/run/docker.sock` | Docker socket for `dockerode` |

## Scripts

```bash
npm run dev    # dev server
npm run build  # production build
npm start      # serve production build
```

## Project structure

- `src/app/page.tsx` — dashboard
- `src/app/editor/[id]/page.tsx` — editor + compile streaming (SSE)
- `src/components/CodeEditor.tsx` — CodeMirror LaTeX mode
- `src/components/PdfViewer.tsx` — react-pdf preview + SyncTeX click
- `src/app/api/projects/...` — projects / files / upload CRUD (SQLite)
- `src/app/api/projects/[id]/compile/route.ts` — SSE compile stream
- `src/lib/compiler.ts` — Docker-isolated compile (no network, 512 MB, 1 CPU)
- `src/lib/db.ts` — `better-sqlite3` in `./data/db.sqlite`

## Troubleshooting

- `Cannot connect to Docker socket`: start Docker, check `/var/run/docker.sock` perms, or set `DOCKER_HOST`.
- `Image not found`: `docker pull texlive/texlive:latest` and set `TEXLIVE_IMAGE` accordingly.
- `SyncTeX not available`: install `synctex` on the host (`texlive-binaries`); forward search still works without it.
- PDF shows old content: recompile; each compile creates a new job id.
- Blank editor after switching files: fixed in #PR3 (content sync); refresh if on an old build.

## Roadmap / non-goals

- Typst (see issue #17): out of scope for now — this repo is LaTeX-focused. Typst would need a second compiler pipeline + editor mode; happy to discuss in the issue.
- Multi-user / auth / sharing: intentionally single-user offline.

## Contributing

Small focused PRs welcome: one fix per PR, run `npx tsc --noEmit` before pushing.
