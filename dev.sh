#!/usr/bin/env bash
# dev.sh — Lokale Entwicklungsumgebung starten
#
# Startet Backend + Frontend parallel im Watch-Modus.
# Kein MinIO, kein Docker — Bilder werden lokal gespeichert.
#
# Voraussetzungen:
#   node >= 20           (node --version)
#   npm                  (npm --version)
#   Ollama läuft lokal   (ollama serve) — optional, KI-Features sonst deaktiviert
#
# Verwendung:
#   chmod +x dev.sh
#   ./dev.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
DATA_DIR="${SCRIPT_DIR}/data"

# ── Farben ────────────────────────────────────────────────────────────────────
BLUE='\033[1;34m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

info()  { echo -e "${BLUE}[backend]${RESET} $*"; }
vite()  { echo -e "${GREEN}[frontend]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[warn]${RESET}    $*"; }

# ── Freien Port finden ────────────────────────────────────────────────────────
find_free_port() {
  local port=${1:-3001}
  while lsof -iTCP:"${port}" -sTCP:LISTEN -t &>/dev/null 2>&1; do
    echo -e "${YELLOW}[warn]${RESET}    Port ${port} belegt — versuche $((port + 1))..." >&2
    port=$((port + 1))
  done
  echo "${port}"
}

# ── Abhängigkeiten prüfen ─────────────────────────────────────────────────────
command -v node &>/dev/null || { echo "node nicht gefunden. Bitte Node.js >= 20 installieren."; exit 1; }
command -v npm  &>/dev/null || { echo "npm nicht gefunden."; exit 1; }

# ── node_modules installieren falls nötig ────────────────────────────────────
if [[ ! -d "${BACKEND_DIR}/node_modules" ]]; then
  info "Installiere Backend-Abhängigkeiten..."
  (cd "${BACKEND_DIR}" && npm install)
fi

if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
  vite "Installiere Frontend-Abhängigkeiten..."
  (cd "${FRONTEND_DIR}" && npm install)
fi

# ── Datenverzeichnis anlegen ──────────────────────────────────────────────────
mkdir -p "${DATA_DIR}/images"

# ── Freien Backend-Port bestimmen ─────────────────────────────────────────────
BACKEND_PORT=$(find_free_port 3001)

# Vite-Proxy dynamisch auf den gewählten Port setzen
export VITE_BACKEND_PORT="${BACKEND_PORT}"

# ── Ollama-Status prüfen ──────────────────────────────────────────────────────
if curl -s --max-time 2 http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo -e "${GREEN}[ollama]${RESET}  Erreichbar unter http://localhost:11434 ✓"
else
  warn "Ollama nicht erreichbar (http://localhost:11434)."
  warn "KI-Features (Foto-Parse, Diktat) sind deaktiviert."
  warn "Ollama starten mit: ollama serve"
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Mealplaner Dev-Modus"
echo "══════════════════════════════════════════════════════"
echo "  Backend:  http://localhost:${BACKEND_PORT}"
echo "  Frontend: http://localhost:5173  (öffnet sich automatisch)"
echo "  Daten:    ${DATA_DIR}/"
echo "  Bilder:   ${DATA_DIR}/images/ (lokal, kein MinIO)"
echo "  SQLite:   ${DATA_DIR}/dev.db"
echo "  Ollama:   http://localhost:11434"
echo "  Stoppen:  Ctrl+C"
echo "══════════════════════════════════════════════════════"
echo ""

# ── Cleanup beim Beenden ──────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "Stoppe Server..."
  kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
  wait "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
  echo "Gestoppt."
}
trap cleanup EXIT INT TERM

# ── Backend starten ───────────────────────────────────────────────────────────
STORAGE_TYPE=local \
DB_PATH="${DATA_DIR}/dev.db" \
LOCAL_IMAGES_DIR="${DATA_DIR}/images" \
OLLAMA_URL="http://localhost:11434" \
PORT="${BACKEND_PORT}" \
  node --watch "${BACKEND_DIR}/src/index.js" 2>&1 | sed "s/^/$(echo -e "${BLUE}[backend]${RESET}") /" &
BACKEND_PID=$!

# Kurz warten bis Backend bereit ist
sleep 2

# ── Frontend starten (Backend-Port via Env an Vite übergeben) ─────────────────
(cd "${FRONTEND_DIR}" && VITE_BACKEND_PORT="${BACKEND_PORT}" npm run dev) \
  2>&1 | sed "s/^/$(echo -e "${GREEN}[frontend]${RESET}") /" &
FRONTEND_PID=$!

# ── Warten ───────────────────────────────────────────────────────────────────
wait "${BACKEND_PID}" "${FRONTEND_PID}"
