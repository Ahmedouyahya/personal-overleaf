# Personal Overleaf

Minimal offline single-user LaTeX editor — Next.js + SQLite + Docker.

Create projects, edit `.tex` files with LaTeX highlighting + autocomplete, upload figures, compile with `pdflatex` / `xelatex` / `lualatex` / `latexmk` in an isolated container, preview the PDF, and double-click the PDF to jump back to source (SyncTeX).

## Why this exists

Overleaf is excellent. If you're happy sending your drafts to someone else's servers, use it — it's better at collaboration than this will ever be.

This is for the case where the document cannot leave the machine: a paper under embargo, a thesis with unpublished results, client work under NDA, or simply a laptop that's offline. You keep the editing experience — live preview, click-to-source, real LaTeX — without a copy of your source living on a third party's disk.

There is no account, no telemetry, and no network dependency after the initial Docker pull. Compilation happens in a container with networking disabled.

| | Personal Overleaf | Overleaf.com | Local `latexmk` + editor |
| --- | --- | --- | --- |
| Document leaves your machine | **No** | Yes | No |
| Live preview + click-to-source | Yes | Yes | Manual |
| Setup effort | `npm run setup` | None | You assemble it |
| Works fully offline | Yes (after image pull) | No | Yes |
| Collaboration | No — single user by design | Yes | No |
| Cost | Free (MIT) | Free tier / paid | Free |

## Quickstart (easiest first)

**Option A — one command (recommended):**

```bash
npm run setup   # checks Node + Docker, creates .env.local, installs, pulls TeX Live
npm run dev     # http://localhost:3000
```

**Option B — Docker only (no Node needed):**

```bash
docker compose up --build    # http://localhost:3000
```

**Option C — manual:**

```bash
cp .env.example .env.local   # optional, defaults work
npm install                  # also vendors the PDF worker for offline preview
docker pull texlive/texlive:latest
TEXLIVE_IMAGE=texlive/texlive:latest npm run dev
```

Windows: use WSL2 + Docker Desktop. The app talks to `//./pipe/docker_engine` by default on win32, or set `DOCKER_HOST`.

Verify setup anytime: `curl http://localhost:3000/api/health` → `{ ok: true, checks: … }`.

## Usage

1. Dashboard (`/`): New Project → auto-creates `main.tex`, rename / delete from the list.
2. Editor (`/editor/[id]`): left = files, middle = code, right = PDF / Log tabs.
3. Pick compiler + main file in the header, press Compile (or `Ctrl/Cmd+Enter`).
4. Double-click PDF to jump to the `.tex` line (needs `synctex` binary on host for reverse lookup).
5. Upload `.png` / `.pdf` figures via the upload button; reference with `\includegraphics{filename}`.
6. The Log tab parses the compiler output into issues — errors, warnings, over/underfull boxes — each with its line number. Click a line number to jump to it, or press **raw** to see the console output verbatim. An overfull box reports the whole line range it spans.

## Optional: explain errors with an AI endpoint

Any issue in the Log tab has an **explain** button. It sends that one error — plus a small window of the surrounding source — to an OpenAI-compatible endpoint you configure yourself, and prints the reply inline.

This is bring-your-own-key and entirely optional; with nothing configured the button just tells you to go and set one up. The key is stored in your browser's `localStorage` and is forwarded only to the endpoint you entered — it never touches this app's server, database, or logs. Presets exist for OpenAI and for a local Ollama, which keeps the whole thing offline.

## Settings

Gear icon (dashboard) → stored in this browser only:

| Pref | Options | Effect |
| ---- | ------- | ------ |
| Default compiler | pdflatex / xelatex / lualatex / latexmk | Pre-selected for new editor sessions |
| Autosave delay | 0.5s / 1s / 2s | Debounce for editor PUTs (2s = fewer writes) |
| Default PDF zoom | 100 / 120 / 150% | Initial preview scale per compile |
| AI endpoint | OpenAI-compatible base URL, or a preset | Where **explain** sends the error; empty disables it |
| AI model | any model id the endpoint accepts | Sent with each request |
| AI key | your key | Kept in this browser only, sent only to the endpoint above |

Server knobs (image, timeout, socket) stay in env — see below. They apply to everyone using this install.

## Env

| Var | Default | Purpose |
| --- | ------- | ------- |
| `TEXLIVE_IMAGE` | `localhost/latexforge/texlive:2024` | TeX Live image spawned per compile |
| `COMPILE_TIMEOUT` | `120` | Seconds before a compile is killed |
| `DOCKER_HOST` | `/var/run/docker.sock` (`//./pipe/docker_engine` on Windows) | Docker socket for `dockerode` |

## Scripts

```bash
npm run setup  # one-time: checks, .env.local, install, TeX image
npm run dev    # dev server
npm run build  # production build (standalone, see Dockerfile)
npm start      # serve production build
```

## Performance notes

- PDF preview renders the current page only and caches immutable job PDFs (`private, max-age=3600`); the PDF worker is vendored into `public/` so preview works offline with no CDN round-trip.
- Compile runs in a locked-down container (no network, 512 MB, 1 CPU, capped timeout) and streams logs via SSE.
- Only the 10 newest compile jobs per project are kept — older PDFs + DB rows are pruned automatically, so disk use stays flat.
- Production Docker image uses Next.js `standalone` output (no dev deps, smaller/faster start).

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

Small focused PRs welcome — one change per PR. Before pushing:

```bash
npx tsc --noEmit   # types
npm test           # unit tests (vitest)
npm run build      # production build
```

Tests live next to what they test (`src/lib/latex-errors.test.ts` is the pattern to follow): one `describe` per function, `it` names that state the behaviour rather than the implementation.

## License

MIT — see [LICENSE](LICENSE).
