#!/usr/bin/env sh
# Produces a restorable logical dump of the local development database.
# Usage: sh scripts/db-backup.sh [output-file]
# Defaults to ./outputs/pcx-backup-<timestamp>.sql
set -eu

COMPOSE=${COMPOSE_FILE:-infra/docker-compose.yml}
SERVICE="${PG_SERVICE:-postgres}"
DB_USER="${PG_USER:-pcx}"
DB_NAME="${PG_DATABASE:-pcx}"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
output="${1:-outputs/pcx-backup-${timestamp}.sql}"

mkdir -p "$(dirname "$output")"

# Use the container's pg_dump so the backup matches the PostgreSQL major version.
docker compose -f "$COMPOSE" exec -T "$SERVICE" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$output"

size=$(wc -c < "$output" | tr -d ' ')
echo "Backup written to $output (${size} bytes)"
