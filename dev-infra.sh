#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# dev-infra.sh  –  Start all local development infrastructure
#                  Neo4j + MinIO on a shared Docker network
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

NETWORK="mealplaner-dev"
NEO4J_CONTAINER="mealplaner-neo4j"
MINIO_CONTAINER="mealplaner-minio"
MINIO_BUCKET="recipes"
MINIO_USER="mealplaner"
MINIO_PASS="${MINIO_SECRET_KEY:?MINIO_SECRET_KEY setzen, z. B. export MINIO_SECRET_KEY=dev-passwort}"
NEO4J_PASS="${NEO4J_PASSWORD:?NEO4J_PASSWORD setzen, z. B. export NEO4J_PASSWORD=dev-passwort}"

# ── Docker network ────────────────────────────────────────────────────────────
if ! docker network ls --format '{{.Name}}' | grep -q "^${NETWORK}$"; then
  echo "▶ Creating Docker network '${NETWORK}'..."
  docker network create "${NETWORK}"
else
  echo "✓ Network '${NETWORK}' already exists"
fi

# ── Neo4j ─────────────────────────────────────────────────────────────────────
if docker ps -a --format '{{.Names}}' | grep -q "^${NEO4J_CONTAINER}$"; then
  if ! docker ps --format '{{.Names}}' | grep -q "^${NEO4J_CONTAINER}$"; then
    echo "▶ Starting existing Neo4j container..."
    docker start "${NEO4J_CONTAINER}"
  else
    echo "✓ Neo4j already running"
  fi
else
  echo "▶ Creating and starting Neo4j..."
  docker run -d \
    --name "${NEO4J_CONTAINER}" \
    --network "${NETWORK}" \
    -p 7474:7474 \
    -p 7687:7687 \
    -e NEO4J_AUTH="neo4j/${NEO4J_PASS}" \
    -e NEO4J_PLUGINS='["apoc"]' \
    -v mealplaner-neo4j-data:/data \
    neo4j:5
fi

# ── MinIO ─────────────────────────────────────────────────────────────────────
if docker ps -a --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
  if ! docker ps --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
    echo "▶ Starting existing MinIO container..."
    docker start "${MINIO_CONTAINER}"
  else
    echo "✓ MinIO already running"
  fi
else
  echo "▶ Creating and starting MinIO..."
  docker run -d \
    --name "${MINIO_CONTAINER}" \
    --network "${NETWORK}" \
    -p 9000:9000 \
    -p 9001:9001 \
    -e MINIO_ROOT_USER="${MINIO_USER}" \
    -e MINIO_ROOT_PASSWORD="${MINIO_PASS}" \
    -v mealplaner-minio-data:/data \
    minio/minio server /data --console-address ":9001"
fi

# ── Wait for MinIO to be ready and create bucket ──────────────────────────────
echo "▶ Waiting for MinIO to be ready..."
until docker run --rm --network "${NETWORK}" \
    -e MC_HOST_local="http://${MINIO_USER}:${MINIO_PASS}@${MINIO_CONTAINER}:9000" \
    minio/mc ready local > /dev/null 2>&1; do
  printf '.'
  sleep 2
done
echo " ready!"

echo "▶ Ensuring bucket '${MINIO_BUCKET}' exists..."
docker run --rm --network "${NETWORK}" \
  -e MC_HOST_local="http://${MINIO_USER}:${MINIO_PASS}@${MINIO_CONTAINER}:9000" \
  minio/mc mb --ignore-existing "local/${MINIO_BUCKET}"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "✅ All infrastructure is running:"
echo "   Neo4j Browser : http://localhost:7474  (neo4j / ${NEO4J_PASS})"
echo "   Neo4j Bolt    : bolt://localhost:7687"
echo "   MinIO API     : http://localhost:9000"
echo "   MinIO Console : http://localhost:9001  (${MINIO_USER} / ${MINIO_PASS})"
echo ""
echo "   Start the Spring Boot backend with: ./gradlew bootRun"
echo "   Start the React frontend with:      cd frontend && npm run dev"
