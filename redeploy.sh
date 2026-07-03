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

# ── 2. Stack deployen ─────────────────────────────────────────────────────────
echo "==> Deploye Stack '${STACK}' …"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-mealplaner}" \
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-***REMOVED***}" \
OLLAMA_URL="${OLLAMA_URL:-http://Stefans-PC:11434}" \
OLLAMA_VISION_MODEL="${OLLAMA_VISION_MODEL:-llava:7b}" \
OLLAMA_TEXT_MODEL="${OLLAMA_TEXT_MODEL:-llama3.2:3b}" \
docker stack deploy -c "${SCRIPT_DIR}/docker-compose.yml" "${STACK}"

# ── 3. App-Service auf neues Image aktualisieren ──────────────────────────────
# docker stack deploy mit :latest-Tag startet laufende Services NICHT neu.
# --image erzwingt die Nutzung des gerade gebauten Images. Da sich der Tag-String
# ("mealplaner:latest") nie ändert, hält Swarm den Service-Spec sonst für
# unverändert und startet den laufenden Task NICHT neu — --force erzwingt den
# Neustart, damit das frisch gebaute Image auch wirklich verwendet wird.
echo "==> Aktualisiere App-Service auf neues Image …"
docker service update --force --image "${IMAGE}" "${STACK}_app"

echo ""
echo "✓ Deployment abgeschlossen. Erreichbar unter: http://pi1:3001"
echo ""
docker stack ps "${STACK}" --no-trunc
