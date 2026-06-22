#!/usr/bin/env bash
# redeploy.sh — Image neu bauen und Stack deployen (idempotent: funktioniert auch beim ersten Mal)
# Auf dem Swarm-Manager-Pi aus dem Projektverzeichnis ausführen.
set -euo pipefail

STACK="mealplaner"
IMAGE="mealplaner:latest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── 1. Image bauen (ARM64 für Raspberry Pi) ───────────────────────────────────
echo "==> Baue ${IMAGE} …"
docker build --platform linux/arm64 -t "${IMAGE}" "${SCRIPT_DIR}"

# ── 2. Stack deployen (erstellt oder aktualisiert Konfiguration) ──────────────
echo "==> Deploye Stack '${STACK}' …"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-mealplaner}" \
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-***REMOVED***}" \
OLLAMA_URL="${OLLAMA_URL:-http://Stefans-PC:11434}" \
OLLAMA_VISION_MODEL="${OLLAMA_VISION_MODEL:-llava:7b}" \
OLLAMA_TEXT_MODEL="${OLLAMA_TEXT_MODEL:-llama3.2:3b}" \
docker stack deploy -c "${SCRIPT_DIR}/docker-compose.yml" "${STACK}"

# ── 3. App-Service neu starten (damit das neue Image geladen wird) ─────────────
# docker stack deploy mit :latest-Tag startet laufende Services NICHT neu —
# --force erzwingt einen Neustart mit dem frisch gebauten Image.
echo "==> Starte App-Service neu …"
docker service update --force "${STACK}_app"

echo ""
echo "✓ Deployment abgeschlossen."
echo ""
echo "  Erreichbar unter: http://pi1:3001"
echo ""
docker stack ps "${STACK}" --no-trunc
