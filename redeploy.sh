#!/usr/bin/env bash
# redeploy.sh — Image neu bauen und Stack deployen (idempotent: funktioniert auch beim ersten Mal)
# Auf dem Swarm-Manager-Pi aus dem Projektverzeichnis ausführen.
set -euo pipefail

STACK="mealplaner"
IMAGE="mealplaner:latest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-mealplaner}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-***REMOVED***}"
MINIO_BUCKET="${MINIO_BUCKET:-mealplaner}"

# ── 1. Image bauen (ARM64 für Raspberry Pi) ───────────────────────────────────
echo "==> Baue ${IMAGE} …"
docker build --platform linux/arm64 -t "${IMAGE}" "${SCRIPT_DIR}"

# ── 2. Stack deployen ─────────────────────────────────────────────────────────
echo "==> Deploye Stack '${STACK}' …"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY}" \
MINIO_SECRET_KEY="${MINIO_SECRET_KEY}" \
OLLAMA_URL="${OLLAMA_URL:-http://Stefans-PC:11434}" \
OLLAMA_VISION_MODEL="${OLLAMA_VISION_MODEL:-llava:7b}" \
OLLAMA_TEXT_MODEL="${OLLAMA_TEXT_MODEL:-llama3.2:3b}" \
docker stack deploy -c "${SCRIPT_DIR}/docker-compose.yml" "${STACK}"

# ── 3. Warten bis MinIO bereit ist (Port 9002 am Host) ────────────────────────
echo "==> Warte auf MinIO (kann bis zu 3 Min dauern bei erstem Start) …"
RETRY=0
until curl -sf --max-time 5 "http://localhost:9002/minio/health/live" >/dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  MINIO_STATE=$(docker service ps "${STACK}_minio" --format '{{.CurrentState}}' 2>/dev/null | head -1 || echo 'unbekannt')
  if [ "${RETRY}" -ge 60 ]; then
    echo "⚠  MinIO nach 60 Versuchen nicht erreichbar (Status: ${MINIO_STATE})"
    echo "   Prüfe: docker service ps mealplaner_minio --no-trunc"
    break
  fi
  echo "   Versuch ${RETRY}/60 — MinIO: ${MINIO_STATE}"
  sleep 3
done

if curl -sf --max-time 5 "http://localhost:9002/minio/health/live" >/dev/null 2>&1; then
  echo "   MinIO ist bereit."

  # ── 4. Bucket anlegen (via minio/mc mit Host-Netzwerk → Port 9002) ──────────
  echo "==> Stelle Bucket '${MINIO_BUCKET}' sicher …"
  docker run --rm \
    --network host \
    --entrypoint sh \
    quay.io/minio/mc \
    -c "mc alias set myminio http://localhost:9002 '${MINIO_ACCESS_KEY}' '${MINIO_SECRET_KEY}' \
        && mc mb --ignore-existing 'myminio/${MINIO_BUCKET}' \
        && echo '[minio] Bucket OK'" \
    || echo "⚠  Bucket-Anlage via MC fehlgeschlagen — App erstellt ihn beim Start selbst"
fi

# ── 5. App-Service neu starten damit das neue Image geladen wird ──────────────
echo "==> Starte App-Service neu …"
docker service update --force "${STACK}_app"

echo ""
echo "✓ Deployment abgeschlossen."
echo ""
echo "  Erreichbar unter: http://pi1:3001"
echo ""
docker stack ps "${STACK}" --no-trunc
