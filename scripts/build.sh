#!/usr/bin/env bash
# Production build (ADR-025 §7): build the web app's Docker image.
# Usage: scripts/build.sh [tag]   (default tag: school-portal-web:latest)
set -euo pipefail
cd "$(dirname "$0")/.."

TAG="${1:-school-portal-web:latest}"
echo "==> Building production image: ${TAG}"
docker build -t "${TAG}" .
echo "==> Done. Run: docker run --env-file .env -p 3000:3000 ${TAG}"
