#!/usr/bin/env sh
# Restore drill: prove a logical backup actually recovers to a fresh database.
# Usage: sh scripts/db-restore-drill.sh <backup-file>
# Creates a throwaway database, restores the backup, verifies a seed row, and
# drops the throwaway database on exit.
set -eu

backup="${1:?usage: sh scripts/db-restore-drill.sh <backup-file>}"

COMPOSE=${COMPOSE_FILE:-infra/docker-compose.yml}
SERVICE="${PG_SERVICE:-postgres}"
DB_USER="${PG_USER:-pcx}"
ADMIN_DB="${PG_ADMIN_DB:-postgres}"
DRILL_DB="pcx_restore_drill"

if [ ! -f "$backup" ]; then
  echo "Backup file not found: $backup" >&2
  exit 2
fi

psql() {
  docker compose -f "$COMPOSE" exec -T "$SERVICE" psql -U "$DB_USER" -d "$1" -v ON_ERROR_STOP=1 -tAc "$2"
}

cleanup() {
  psql "$ADMIN_DB" "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DRILL_DB';" >/dev/null 2>&1 || true
  docker compose -f "$COMPOSE" exec -T "$SERVICE" \
    psql -U "$DB_USER" -d "$ADMIN_DB" -c "DROP DATABASE IF EXISTS $DRILL_DB;" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Start from a clean throwaway database.
cleanup
docker compose -f "$COMPOSE" exec -T "$SERVICE" \
  psql -U "$DB_USER" -d "$ADMIN_DB" -c "CREATE DATABASE $DRILL_DB OWNER $DB_USER;" >/dev/null

# Restore the dump into the throwaway database.
docker compose -f "$COMPOSE" exec -T "$SERVICE" \
  psql -U "$DB_USER" -d "$DRILL_DB" -v ON_ERROR_STOP=1 < "$backup" >/dev/null

count=$(psql "$DRILL_DB" "SELECT count(*) FROM categories;")
if [ "$count" -lt 1 ] 2>/dev/null; then
  echo "Restore drill failed: categories missing after restore" >&2
  exit 1
fi

echo "Restore drill passed: $count categories recovered to $DRILL_DB"
