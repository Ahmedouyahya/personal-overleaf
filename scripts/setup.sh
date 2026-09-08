#!/usr/bin/env bash
# Easiest path to a running app. macOS/Linux. Windows: use WSL2 + Docker Desktop.
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1 — $2"; exit 1; }; }
need node "install Node 22+ from https://nodejs.org"
need docker "install Docker Desktop from https://www.docker.com/products/docker-desktop"
docker info >/dev/null 2>&1 || { echo "Docker daemon not running — start Docker Desktop first."; exit 1; }

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example"
fi

npm install   # also vendors the PDF worker via postinstall

# shellcheck disable=SC1091
IMAGE=$(grep -E '^TEXLIVE_IMAGE=' .env.local | cut -d= -f2- || true)
IMAGE=${IMAGE:-texlive/texlive:latest}
echo "Pulling TeX Live image: $IMAGE (one-time, ~1-2 GB)…"
docker pull "$IMAGE"

echo ""
echo "Done. Start with:"
echo "  npm run dev        # http://localhost:3000"
echo "  npm run build && npm start   # production"
echo "Verify with: curl http://localhost:3000/api/health"
