#!/bin/sh
# Kopia bazy PostgreSQL z działającego docker compose: ./scripts/backup_db.sh [katalog]  (domyślnie ./backups)
# Przywracanie: gunzip -c backups/<plik>.sql.gz | docker compose exec -T db psql -U smartcity smartcity
set -e
dir="${1:-backups}"
mkdir -p "$dir"
file="$dir/smartcity-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$file"
echo "Zapisano $file"
