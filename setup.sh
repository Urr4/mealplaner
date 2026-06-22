#!/usr/bin/env bash
# setup.sh — Erstkonfiguration & Deployment des Mealplaner-Stacks
#
# Auf dem Swarm-Manager-Pi als Benutzer mit sudo-Rechten ausführen (z.B. stefan@pi1).
# Kann mehrfach ausgeführt werden — alle Schritte sind idempotent.
#
# Verwendung:
#   chmod +x setup.sh
#   ./setup.sh
#
# Optionen:
#   ./setup.sh --wipe-db     Datenbank löschen (Achtung: alle Rezepte weg!)
#   ./setup.sh --wipe-minio  MinIO-Daten löschen (Achtung: alle Bilder weg!)
#
# Was das Skript tut:
#   1. Pakete installieren (docker, nfs-common) falls nötig
#   2. NFS-Share mounten falls nötig
#   3. Datenverzeichnisse auf der NAS anlegen und Berechtigungen setzen
#   4. Docker-Overlay-Netzwerk 'web' anlegen falls nötig
#   5. Image bauen (ARM64 für Raspberry Pi)
#   6. Stack deployen

set -euo pipefail

# ── Konfiguration ─────────────────────────────────────────────────────────────
NAS_IP="192.168.178.62"
NAS_EXPORT="/volume1/cloudstorage"
MOUNT_POINT="/volume1/cloudstorage"
DATA_ROOT="${MOUNT_POINT}/docker-swarm-data"

IMAGE="mealplaner:latest"
STACK="mealplaner"

# MinIO-Zugangsdaten — bei Bedarf anpassen
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-mealplaner}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-***REMOVED***}"

# Ollama auf dem Desktop-PC
OLLAMA_URL="${OLLAMA_URL:-http://Stefans-PC:11434}"
OLLAMA_VISION_MODEL="${OLLAMA_VISION_MODEL:-llava:7b}"
OLLAMA_TEXT_MODEL="${OLLAMA_TEXT_MODEL:-llama3.2:3b}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Hilfsfunktionen ───────────────────────────────────────────────────────────
info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[ OK ]\033[0m  $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
die()   { echo -e "\033[1;31m[FAIL]\033[0m  $*" >&2; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# 1. Pakete installieren
# ─────────────────────────────────────────────────────────────────────────────
install_packages() {
  info "Prüfe benötigte Pakete..."

  local pkgs=()
  command -v docker &>/dev/null   || pkgs+=(docker.io)
  command -v git    &>/dev/null   || pkgs+=(git)
  dpkg -l nfs-common &>/dev/null 2>&1 || pkgs+=(nfs-common)

  if [[ ${#pkgs[@]} -gt 0 ]]; then
    info "Installiere: ${pkgs[*]}"
    sudo apt-get update -qq
    sudo apt-get install -y "${pkgs[@]}"
    ok "Pakete installiert."
  else
    ok "Alle Pakete vorhanden."
  fi

  # Benutzer zur docker-Gruppe hinzufügen
  if ! groups | grep -q docker; then
    info "Füge $USER zur docker-Gruppe hinzu..."
    sudo usermod -aG docker "$USER"
    warn "Gruppe hinzugefügt — ggf. ab- und anmelden falls docker-Befehle fehlschlagen."
  fi

  # Docker-Daemon starten
  if ! sudo systemctl is-active --quiet docker; then
    info "Starte Docker-Daemon..."
    sudo systemctl enable --now docker
  fi

  # Swarm initialisieren
  if ! docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q active; then
    info "Initialisiere Docker Swarm (Einzelknoten-Manager)..."
    docker swarm init || warn "Swarm init fehlgeschlagen — evtl. bereits im Swarm."
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. NFS-Share mounten
# ─────────────────────────────────────────────────────────────────────────────
setup_nfs() {
  info "Prüfe NFS-Mount bei ${MOUNT_POINT}..."

  if [[ ! -d "${MOUNT_POINT}" ]]; then
    info "Erstelle Mount-Point ${MOUNT_POINT}..."
    sudo mkdir -p "${MOUNT_POINT}"
  fi

  if mountpoint -q "${MOUNT_POINT}"; then
    ok "NFS bereits gemountet bei ${MOUNT_POINT}."
    return
  fi

  local fstab_entry="${NAS_IP}:${NAS_EXPORT} ${MOUNT_POINT} nfs nfsvers=4,hard,intr,noac,_netdev,nofail 0 0"
  if ! grep -qF "${NAS_IP}:${NAS_EXPORT}" /etc/fstab; then
    info "Füge NFS-Eintrag zu /etc/fstab hinzu..."
    echo "${fstab_entry}" | sudo tee -a /etc/fstab > /dev/null
    ok "fstab-Eintrag hinzugefügt."
  fi

  info "Mounte NFS-Share..."
  sudo mount -a
  if mountpoint -q "${MOUNT_POINT}"; then
    ok "NFS erfolgreich gemountet."
  else
    die "NFS-Mount fehlgeschlagen. Ist ${NAS_IP} erreichbar und der Export vorhanden?"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. Datenverzeichnisse anlegen und Berechtigungen setzen
# ─────────────────────────────────────────────────────────────────────────────
setup_directories() {
  info "Lege Datenverzeichnisse auf der NAS an..."

  # Synology root_squash: Docker-Container (als root) können keine chmod machen.
  # Berechtigungen müssen vom Pi aus per sudo gesetzt werden.
  for dir in mealplaner minio/mealplaner; do
    local path="${DATA_ROOT}/${dir}"
    if [[ ! -d "${path}" ]]; then
      info "Erstelle ${path}..."
      sudo mkdir -p "${path}"
    fi
    local perms
    perms=$(stat -c "%a" "${path}")
    if [[ "${perms}" != "777" ]]; then
      info "Setze Berechtigungen auf ${path} (war ${perms})..."
      sudo chmod 777 "${path}"
    fi
  done

  ok "Datenverzeichnisse bereit."
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. Image bauen
# ─────────────────────────────────────────────────────────────────────────────
build_image() {
  info "Baue ${IMAGE} für linux/arm64 (kann auf dem Pi ~5–10 Min dauern)..."
  docker build --platform linux/arm64 -t "${IMAGE}" "${SCRIPT_DIR}"
  ok "Image gebaut."
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. Stack deployen
# ─────────────────────────────────────────────────────────────────────────────
deploy_stack() {
  info "Deploye Docker-Swarm-Stack '${STACK}'..."

  MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY}" \
  MINIO_SECRET_KEY="${MINIO_SECRET_KEY}" \
  OLLAMA_URL="${OLLAMA_URL}" \
  OLLAMA_VISION_MODEL="${OLLAMA_VISION_MODEL}" \
  OLLAMA_TEXT_MODEL="${OLLAMA_TEXT_MODEL}" \
  docker stack deploy -c "${SCRIPT_DIR}/docker-compose.yml" "${STACK}"

  ok "Stack deployed."

  info "Warte auf Services..."
  sleep 5
  docker stack ps "${STACK}" --no-trunc
}

# ─────────────────────────────────────────────────────────────────────────────
# Wipe-Modus
# ─────────────────────────────────────────────────────────────────────────────
wipe_db() {
  warn "WIPE-MODUS: Löscht die SQLite-Datenbank (alle Rezepte, Personen, Einstellungen)!"
  read -rp "Sicher? Tippe JA zum Bestätigen: " confirm
  [[ "${confirm}" == "JA" ]] || { info "Abgebrochen."; exit 0; }

  local db="${DATA_ROOT}/mealplaner/mealplaner.db"
  if [[ -f "${db}" ]]; then
    sudo rm "${db}"
    ok "Datenbank gelöscht: ${db}"
  else
    warn "Keine Datenbank gefunden bei ${db}."
  fi

  if docker service ls --format '{{.Name}}' | grep -q "${STACK}_app"; then
    info "Starte App-Service neu..."
    docker service update --force "${STACK}_app"
    ok "Service neu gestartet."
  fi
}

wipe_minio() {
  warn "WIPE-MODUS: Löscht alle MinIO-Bilder!"
  read -rp "Sicher? Tippe JA zum Bestätigen: " confirm
  [[ "${confirm}" == "JA" ]] || { info "Abgebrochen."; exit 0; }

  local minio_dir="${DATA_ROOT}/minio/mealplaner"
  sudo rm -rf "${minio_dir:?}/"*
  ok "MinIO-Daten gelöscht."

  if docker service ls --format '{{.Name}}' | grep -q "${STACK}_minio"; then
    docker service update --force "${STACK}_minio"
    ok "MinIO-Service neu gestartet."
  fi
}

print_next_steps() {
  echo ""
  echo "════════════════════════════════════════════════════════════════════"
  echo "  Deployment abgeschlossen!"
  echo "════════════════════════════════════════════════════════════════════"
  echo ""
  echo "  App erreichbar unter:"
  echo "    http://pi1:3001"
  echo ""
  echo "  Nächste Schritte:"
  echo "    1. App öffnen und Einstellungen konfigurieren:"
  echo "       - Ollama-URL (Standard: http://Stefans-PC:11434)"
  echo "       - Modelle nach Bedarf anpassen"
  echo ""
  echo "  Nützliche Befehle:"
  echo "    docker stack ps ${STACK}              # Service-Status"
  echo "    docker service logs ${STACK}_app      # App-Logs"
  echo "    docker service logs ${STACK}_minio    # MinIO-Logs"
  echo "    ./redeploy.sh                          # Nach Code-Änderungen"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
main() {
  case "${1:-}" in
    --wipe-db)    wipe_db;    exit 0 ;;
    --wipe-minio) wipe_minio; exit 0 ;;
  esac

  echo ""
  echo "════════════════════════════════════════════════════════════════════"
  echo "  Mealplaner — Erstkonfiguration & Deployment"
  echo "════════════════════════════════════════════════════════════════════"
  echo ""

  if ! sudo -n true 2>/dev/null; then
    warn "Dieses Skript benötigt sudo für einige Schritte. Ggf. wirst du nach dem Passwort gefragt."
  fi

  install_packages
  setup_nfs
  setup_directories
  build_image
  deploy_stack
  print_next_steps
}

main "$@"
